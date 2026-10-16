import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { WebApp, WebAppVersion } from '@generated/prisma';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { ArchiveExtractorService, ArchiveValidationError } from './archive-extractor.service';
import { WebAppDataService } from './web-app-data.service';
import { MANIFEST_FILE, ManifestError, parseManifest, WebAppManifest } from './web-app-manifest';
import { WebAppSettingsService } from './web-app-settings.service';
import { parseRequiredRoles, WebAppAccessService } from './web-app-access.service';
import { WebAppStorageService } from './web-app-storage.service';
import { RESERVED_SLUGS, SLUG_PATTERN, WebAppsConfig } from './web-apps.config';
import { CreateWebAppInput, UpdateWebAppInput, UploadedArchive, UploadVersionInput } from './web-apps.types';

/** Looked up at the root of an uploaded version, first match wins. */
const ICON_FILES = ['favicon.svg', 'favicon.png', 'favicon.ico'];

interface StagedVersion {
  tempDir: string;
  baseDir: string;
  fileCount: number;
  totalBytes: number;
  checksum: string;
  archiveType: 'zip' | 'tar.gz';
  icon: string | null;
  /** Validated hrhub.json: parsed, and its original text (stored with the version). */
  manifest: WebAppManifest | null;
  manifestText: string | null;
}

/** An archive uploaded through "inspect", waiting (extracted) for the create / upload form to be submitted. */
interface PendingUpload {
  staged: StagedVersion;
  archive: Pick<UploadedArchive, 'originalname' | 'size'>;
  userId: string;
  timer: NodeJS.Timeout;
}

const PENDING_TTL_MS = 30 * 60 * 1000;
const ICON_PREVIEW_MAX_BYTES = 200 * 1024;
const ICON_TYPES: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp' };

@Injectable()
export class WebAppsService implements OnModuleInit {
  private readonly logger: TraceLogger;
  private readonly locks = new Map<string, Promise<void>>();
  private readonly pending = new Map<string, PendingUpload>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: WebAppStorageService,
    private readonly extractor: ArchiveExtractorService,
    private readonly data: WebAppDataService,
    private readonly config: WebAppsConfig,
    private readonly access: WebAppAccessService,
    private readonly settings: WebAppSettingsService,
    traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, WebAppsService.name);
  }

  async onModuleInit() {
    try {
      await this.storage.prepareRoot();
      await this.reconcile();
    } catch (error) {
      this.logger.error(`Web apps storage initialization failed: ${(error as Error).message}`);
    }
  }

  // ---------------------------------------------------------------- queries

  /** Management list. Private apps are only listed for their owner. */
  async list(user: AuthenticatedUser) {
    const apps = (
      await this.prisma.webApp.findMany({
        where: { status: { not: 'deleted' } },
        orderBy: { createdAt: 'desc' },
      })
    ).filter((app) => this.access.canSee(user, app));
    const versionIds = apps.map((app) => app.currentVersionId).filter((id): id is string => !!id);
    const versions = await this.prisma.webAppVersion.findMany({ where: { id: { in: versionIds } } });
    const byId = new Map(versions.map((version) => [version.id, version]));

    return apps.map((app) => this.toView(app, app.currentVersionId ? byId.get(app.currentVersionId) : undefined));
  }

  /**
   * Apps visible to the caller (logged in or anonymous). Admins get every app (management view); everyone else gets only the
   * published apps their roles allow, without management details.
   */
  async listFor(user: AuthenticatedUser | null) {
    if (user && this.access.isAdmin(user)) return this.list(user);

    // Anonymous callers have no roles, so they only get apps without required roles.
    const apps = await this.access.listAccessible(user ?? { roles: [] });
    const versions = await this.prisma.webAppVersion.findMany({
      where: { id: { in: apps.map((app) => app.currentVersionId).filter((id): id is string => !!id) } },
    });
    const byId = new Map(versions.map((version) => [version.id, version]));

    return apps.map((app) => ({
      ...this.toView(app, app.currentVersionId ? byId.get(app.currentVersionId) : undefined),
      settingsSchema: {},
      settings: {},
      missingSettings: [],
      requiredRoles: [],
      createdBy: null,
      createdByName: null,
    }));
  }

  async get(id: string) {
    const app = await this.findApp(id);
    const current = app.currentVersionId ? await this.prisma.webAppVersion.findUnique({ where: { id: app.currentVersionId } }) : null;
    return this.toView(app, current ?? undefined, (await this.settingsVersion(app)) ?? undefined);
  }

  /**
   * The version whose hrhub.json defines the app's settings: the published one, else (a draft waiting for its
   * settings before it can be published) the latest uploaded one.
   */
  private async settingsVersion(app: WebApp) {
    if (app.currentVersionId) return this.prisma.webAppVersion.findUnique({ where: { id: app.currentVersionId } });
    return this.prisma.webAppVersion.findFirst({ where: { webAppId: app.id, status: 'ready' }, orderBy: { version: 'desc' } });
  }

  currentVersion(app: WebApp) {
    return app.currentVersionId ? this.prisma.webAppVersion.findUnique({ where: { id: app.currentVersionId } }) : null;
  }

  async listVersions(id: string) {
    await this.findApp(id);
    const versions = await this.prisma.webAppVersion.findMany({
      where: { webAppId: id, status: { not: 'deleted' } },
      orderBy: { version: 'desc' },
    });
    const app = await this.findApp(id);
    return versions.map((version) => this.toVersionView(version, app.currentVersionId));
  }

  async getVersion(id: string, version: number) {
    const app = await this.findApp(id);
    return this.toVersionView(await this.findVersion(id, version), app.currentVersionId);
  }

  // -------------------------------------------------------------- inspect (upload first, then fill the form)

  /**
   * Extracts and validates an archive without creating anything, and keeps it for PENDING_TTL_MS: the admin form shows
   * what the package says about itself (name, description, icon, settings to fill) and submits with the token, so the
   * file is not uploaded twice.
   */
  async inspect(file: UploadedArchive | undefined, user: AuthenticatedUser) {
    if (!file) throw new BadRequestException('file is required');
    let staged: StagedVersion;
    try {
      staged = await this.stage(file);
    } finally {
      await this.discard(file);
    }

    const token = randomUUID();
    const timer = setTimeout(() => void this.dropPending(token), PENDING_TTL_MS);
    timer.unref();
    this.pending.set(token, { staged, archive: { originalname: file.originalname, size: file.size }, userId: user.id, timer });
    this.logger.log(`Inspected ${file.originalname} for ${user.id}: token ${token}`);

    return {
      token,
      expiresAt: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
      archive: { name: file.originalname, size: file.size, fileCount: staged.fileCount, totalBytes: staged.totalBytes },
      manifest: staged.manifest,
      icon: staged.icon,
      iconPreview: await this.iconPreview(staged),
    };
  }

  /** A pending upload of this user, still waiting; throws when it expired or belongs to someone else. */
  private pendingFor(token: unknown, user: AuthenticatedUser): PendingUpload {
    const pending = typeof token === 'string' ? this.pending.get(token) : undefined;
    if (!pending || pending.userId !== user.id) {
      throw new BadRequestException('The uploaded package expired or is unknown; choose the file again');
    }
    return pending;
  }

  private async dropPending(token: string) {
    const pending = this.pending.get(token);
    if (!pending) return;
    this.pending.delete(token);
    clearTimeout(pending.timer);
    await this.storage.removeDir(pending.staged.tempDir);
  }

  private async iconPreview(staged: StagedVersion): Promise<string | null> {
    if (!staged.icon) return null;
    const path = join(staged.baseDir, staged.icon);
    const info = await stat(path).catch(() => null);
    if (!info || info.size > ICON_PREVIEW_MAX_BYTES) return null;
    const type = ICON_TYPES[extname(staged.icon).toLowerCase()] ?? 'application/octet-stream';
    return `data:${type};base64,${(await readFile(path)).toString('base64')}`;
  }

  /** The package of a create / upload: a pending (inspected) one, or the file sent along. */
  private async resolvePackage(input: { stagingToken?: unknown }, file: UploadedArchive | undefined, user: AuthenticatedUser) {
    if (input.stagingToken) {
      await this.discard(file);
      const pending = this.pendingFor(input.stagingToken, user);
      return { staged: pending.staged, archive: pending.archive, token: input.stagingToken as string };
    }
    if (!file) return null;
    return { staged: null as StagedVersion | null, archive: file as Pick<UploadedArchive, 'originalname' | 'size'>, token: null, file };
  }

  // -------------------------------------------------------------- mutations

  async create(input: CreateWebAppInput, file: UploadedArchive | undefined, user: AuthenticatedUser) {
    const slug = (input.slug ?? '').trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug)) {
      await this.discard(file);
      throw new BadRequestException('slug must be 2-63 chars: lowercase letters, digits and hyphens');
    }
    if (RESERVED_SLUGS.has(slug)) {
      await this.discard(file);
      throw new BadRequestException(`slug "${slug}" is reserved`);
    }
    const requiredRoles = this.parseRoles(input.requiredRoles);
    const isPrivate = this.truthy(input.isPrivate);
    const publish = this.truthy(input.publish);
    const pkg = await this.resolvePackage(input, file, user);

    this.logger.log(`Create web app ${slug} by ${user.id} (archive: ${pkg?.archive.originalname ?? 'none'})`);
    return this.withLock(slug, async () => {
      // Everything that can be refused is checked before the package is used: a pending one stays available.
      if (await this.prisma.webApp.findUnique({ where: { slug } })) {
        await this.discard(file);
        throw new ConflictException(`slug "${slug}" is already used`);
      }

      let staged = pkg?.staged ?? null;
      const ownStaging = !pkg?.token;
      let consumed = false;
      let appId: string | null = null;
      try {
        if (!staged && pkg?.file) staged = await this.stage(pkg.file);

        const name = (input.name ?? '').trim() || staged?.manifest?.name || '';
        if (!name) throw new BadRequestException('name is required');
        const schema = staged?.manifest?.settings ?? {};
        const values = await this.settings.merge(schema, {}, input.settings);
        const missing = this.settings.missingRequired(schema, values);
        if (publish && staged && missing.length) throw new BadRequestException({ message: 'Missing required settings', errors: missing });

        // From here on the package is consumed.
        if (pkg?.token) this.forgetPending(pkg.token);
        consumed = true;
        await this.storage.initAppDir(slug);
        this.data.initDatabase(slug);

        const app = await this.prisma.webApp.create({
          data: {
            slug,
            name,
            description: input.description?.trim() || staged?.manifest?.description || null,
            requiredRoles: JSON.stringify(requiredRoles),
            isPrivate,
            settings: JSON.stringify(values),
            createdBy: user.id,
            createdByName: user.username ?? user.email ?? null,
          },
        });
        appId = app.id;

        if (staged && pkg) {
          const version = await this.commit(app, staged, pkg.archive, undefined, user);
          if (publish) await this.publishLocked(app.id, version.version);
        }
      } catch (error) {
        if (appId) {
          await this.prisma.webAppVersion.deleteMany({ where: { webAppId: appId } }).catch(() => undefined);
          await this.prisma.webApp.delete({ where: { id: appId } }).catch(() => undefined);
          this.data.close(slug);
          await this.storage.removeDir(this.storage.appDir(slug));
        }
        throw error;
      } finally {
        // A pending package survives a refused form (the admin fixes it and submits again), a direct upload does not.
        if (ownStaging || consumed) await this.cleanup(staged, pkg?.file);
      }

      return this.get(appId);
    });
  }

  /** Stops tracking a pending upload whose files are being committed (the caller cleans them up). */
  private forgetPending(token: string) {
    const pending = this.pending.get(token);
    if (pending) clearTimeout(pending.timer);
    this.pending.delete(token);
  }

  async update(id: string, input: UpdateWebAppInput, user: AuthenticatedUser) {
    const app = await this.findApp(id);
    const data: { name?: string; description?: string | null; requiredRoles?: string; isPrivate?: boolean; settings?: string } = {};

    if (input.name !== undefined) {
      if (!input.name.trim()) throw new BadRequestException('name cannot be empty');
      data.name = input.name.trim();
    }
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.requiredRoles !== undefined) data.requiredRoles = JSON.stringify(this.parseRoles(input.requiredRoles));
    if (input.settings !== undefined) {
      const schema = this.settings.manifestOf(await this.settingsVersion(app))?.settings ?? {};
      data.settings = JSON.stringify(await this.settings.merge(schema, this.settings.storedValues(app), input.settings));
    }
    if (input.isPrivate !== undefined) {
      data.isPrivate = this.truthy(input.isPrivate);
      // Only the creator can lock an app to themselves (otherwise it would be hidden from the admin who did it).
      if (data.isPrivate && !app.isPrivate && !this.access.isOwner(user, app)) {
        throw new ForbiddenException('Only the creator can make this web app private');
      }
    }

    await this.prisma.webApp.update({ where: { id: app.id }, data });
    return this.get(id);
  }

  async uploadVersion(id: string, file: UploadedArchive | undefined, input: UploadVersionInput, user: AuthenticatedUser) {
    const pkg = await this.resolvePackage(input, file, user);
    if (!pkg) throw new BadRequestException('file is required');
    const app = await this.findApp(id);
    const publish = this.truthy(input.publish);

    this.logger.log(`Upload version for ${app.slug} by ${user.id} (${pkg.archive.originalname}, ${pkg.archive.size} bytes)`);
    return this.withLock(app.slug, async () => {
      let staged = pkg.staged;
      let committed = false;
      try {
        if (!staged && pkg.file) staged = await this.stage(pkg.file);
        if (!staged) throw new BadRequestException('file is required');

        // Settings of the new version: what is stored, plus what the admin entered for new keys.
        const schema = staged.manifest?.settings ?? {};
        const values = await this.settings.merge(schema, this.settings.storedValues(app), input.settings);
        const missing = this.settings.missingRequired(schema, values);
        if (publish && missing.length) throw new BadRequestException({ message: 'Missing required settings', errors: missing });

        if (pkg.token) this.forgetPending(pkg.token);
        committed = true;
        await this.prisma.webApp.update({ where: { id: app.id }, data: { settings: JSON.stringify(values) } });
        const version = await this.commit(app, staged, pkg.archive, input.note, user);
        if (publish) await this.publishLocked(app.id, version.version);
        return this.getVersion(app.id, version.version);
      } finally {
        if (!pkg.token || committed) await this.cleanup(staged, pkg.file);
      }
    });
  }

  async publish(id: string, version: number) {
    const app = await this.findApp(id);
    await this.withLock(app.slug, () => this.publishLocked(id, version));
    return this.get(id);
  }

  async rollback(id: string, version: number) {
    const app = await this.findApp(id);
    if (!app.currentVersionId) throw new BadRequestException('Nothing is published yet');
    const target = await this.findVersion(id, version);
    this.logger.log(`Rollback ${app.slug} to v${version}`);
    if (target.id === app.currentVersionId) throw new BadRequestException('That version is already published');
    await this.withLock(app.slug, () => this.publishLocked(id, version));
    return this.get(id);
  }

  async disable(id: string) {
    const app = await this.findApp(id);
    this.logger.log(`Disable web app ${app.slug}`);
    await this.withLock(app.slug, async () => {
      await this.storage.clearCurrent(app.slug);
      this.data.close(app.slug);
      await this.prisma.webApp.update({ where: { id }, data: { status: 'disabled' } });
    });
    return this.get(id);
  }

  async enable(id: string) {
    const app = await this.findApp(id);
    this.logger.log(`Enable web app ${app.slug}`);
    await this.withLock(app.slug, async () => {
      if (!app.currentVersionId) {
        await this.prisma.webApp.update({ where: { id }, data: { status: 'draft' } });
        return;
      }
      const current = await this.prisma.webAppVersion.findUnique({ where: { id: app.currentVersionId } });
      if (current) await this.storage.setCurrent(app.slug, current.version);
      await this.prisma.webApp.update({ where: { id }, data: { status: 'published' } });
    });
    return this.get(id);
  }

  async remove(id: string) {
    const app = await this.findApp(id);
    this.logger.log(`Delete web app ${app.slug}`);
    await this.withLock(app.slug, async () => {
      this.data.close(app.slug);
      await this.storage.clearCurrent(app.slug);
      await this.storage.trashApp(app.slug).catch((error) => {
        this.logger.warn(`Could not move ${app.slug} to trash: ${(error as Error).message}`);
      });
      await this.prisma.webAppVersion.updateMany({ where: { webAppId: id }, data: { status: 'deleted' } });
      await this.prisma.webApp.update({
        where: { id },
        data: {
          status: 'deleted',
          currentVersionId: null,
          // Frees the slug (unique) so a new web app can reuse it; the files are already in .trash/.
          slug: `${app.slug}~deleted-${Date.now()}`,
        },
      });
    });
    return { id, deleted: true };
  }

  // ---------------------------------------------------------------- helpers

  /** Makes the `current` symlinks match the database (self-heal after restore or failed deploys). */
  private async reconcile() {
    const apps = await this.prisma.webApp.findMany({ where: { status: { not: 'deleted' } } });

    for (const app of apps) {
      try {
        const current = app.currentVersionId ? await this.prisma.webAppVersion.findUnique({ where: { id: app.currentVersionId } }) : null;
        const expected = app.status === 'published' && current ? `versions/${current.version}` : null;
        const actual = await this.storage.readCurrent(app.slug);

        if (expected === actual) continue;
        if (expected && current) await this.storage.setCurrent(app.slug, current.version);
        else await this.storage.clearCurrent(app.slug);
        this.logger.warn(`Reconciled "current" for web app ${app.slug}`);
      } catch (error) {
        this.logger.error(`Reconcile failed for ${app.slug}: ${(error as Error).message}`);
      }
    }
  }

  private async publishLocked(id: string, versionNumber: number) {
    const app = await this.findApp(id);
    const version = await this.findVersion(id, versionNumber);
    if (version.status !== 'ready') throw new BadRequestException('Version is not ready');
    const missing = this.settings.missingRequired(this.settings.manifestOf(version)?.settings ?? {}, this.settings.storedValues(app));
    if (missing.length) throw new BadRequestException({ message: 'Missing required settings', errors: missing });
    this.logger.log(`Publish ${app.slug} v${version.version} (was ${app.currentVersionId ?? 'none'})`);

    // Disabled apps keep the pointer but are not exposed until re-enabled.
    if (app.status !== 'disabled') await this.storage.setCurrent(app.slug, version.version);
    await this.prisma.webApp.update({
      where: { id },
      data: { currentVersionId: version.id, status: app.status === 'disabled' ? 'disabled' : 'published' },
    });
  }

  private async stage(file: UploadedArchive): Promise<StagedVersion> {
    if (file.size > this.config.maxArchiveBytes) {
      throw new UnprocessableEntityException({
        message: `Archive exceeds ${Math.floor(this.config.maxArchiveBytes / 1024 / 1024)} MB`,
      });
    }

    const tempDir = await this.storage.createTempDir();
    try {
      const archiveType = await this.extractor.detectType(file.path);
      const checksum = await this.extractor.checksum(file.path);
      const result = await this.extractor.extract(file.path, archiveType, tempDir);
      const manifestText = await readFile(join(result.baseDir, MANIFEST_FILE), 'utf8').catch(() => null);
      // A package that ships a broken hrhub.json is rejected instead of silently ignored.
      const manifest = manifestText === null ? null : parseManifest(manifestText);
      const icon = await this.findIcon(result.baseDir, manifest);
      return {
        tempDir,
        baseDir: result.baseDir,
        fileCount: result.fileCount,
        totalBytes: result.totalBytes,
        checksum,
        archiveType,
        icon,
        manifest,
        manifestText,
      };
    } catch (error) {
      await this.storage.removeDir(tempDir);
      if (error instanceof ArchiveValidationError) {
        throw new UnprocessableEntityException({ message: 'Invalid archive', errors: error.errors });
      }
      if (error instanceof ManifestError) {
        throw new UnprocessableEntityException({ message: `Invalid ${MANIFEST_FILE}`, errors: error.errors });
      }
      throw error;
    }
  }

  private async commit(
    app: WebApp,
    staged: StagedVersion,
    file: Pick<UploadedArchive, 'originalname' | 'size'>,
    note: string | undefined,
    user: AuthenticatedUser,
  ): Promise<WebAppVersion> {
    const last = await this.prisma.webAppVersion.findFirst({
      where: { webAppId: app.id },
      orderBy: { version: 'desc' },
    });
    const version = (last?.version ?? 0) + 1;

    const storagePath = await this.storage.commitVersion(app.slug, staged.baseDir, version);
    try {
      this.logger.log(`Created ${app.slug} v${version} at ${this.storage.versionPath(app.slug, version)} (${staged.fileCount} files)`);
      return await this.prisma.webAppVersion.create({
        data: {
          webAppId: app.id,
          version,
          archiveName: file.originalname.slice(0, 255),
          archiveType: staged.archiveType,
          archiveSize: file.size,
          storagePath,
          size: staged.totalBytes,
          fileCount: staged.fileCount,
          checksum: staged.checksum,
          icon: staged.icon,
          manifest: staged.manifestText,
          note: note?.trim() || null,
          createdBy: user.id,
          createdByName: user.username ?? user.email ?? null,
        },
      });
    } catch (error) {
      await this.storage.removeDir(this.storage.versionPath(app.slug, version));
      throw error;
    }
  }

  /** The manifest's "icon" (must exist), else the first favicon.* found at the root. */
  private async findIcon(dir: string, manifest: WebAppManifest | null): Promise<string | null> {
    if (manifest?.icon) {
      const info = await stat(join(dir, manifest.icon)).catch(() => null);
      if (!info?.isFile()) throw new ManifestError([`"icon": ${manifest.icon} was not found at the archive root`]);
      return manifest.icon;
    }
    for (const name of ICON_FILES) {
      const info = await stat(join(dir, name)).catch(() => null);
      if (info?.isFile()) return name;
    }
    return null;
  }

  private async cleanup(staged: StagedVersion | null, file: Pick<UploadedArchive, 'path'> | undefined) {
    if (staged) await this.storage.removeDir(staged.tempDir);
    await this.discard(file);
  }

  private async discard(file: Pick<UploadedArchive, 'path'> | undefined) {
    if (file) await this.storage.removeFile(file.path);
  }

  /** Management by id: private apps of other users answer 404, like apps that don't exist. */
  async assertManageable(id: string, user: AuthenticatedUser) {
    const app = await this.prisma.webApp.findUnique({ where: { id } });
    if (app && !this.access.canSee(user, app)) {
      this.logger.warn(`Management denied: user ${user.id} is not the owner of private web app ${app.slug}`);
      throw new NotFoundException('Web app not found');
    }
  }

  private async findApp(id: string): Promise<WebApp> {
    const app = await this.prisma.webApp.findUnique({ where: { id } });
    if (!app || app.status === 'deleted') throw new NotFoundException('Web app not found');
    return app;
  }

  private async findVersion(webAppId: string, version: number): Promise<WebAppVersion> {
    if (!Number.isInteger(version) || version < 1) throw new BadRequestException('Invalid version');
    const row = await this.prisma.webAppVersion.findUnique({
      where: { webAppId_version: { webAppId, version } },
    });
    if (!row || row.status === 'deleted') throw new NotFoundException('Version not found');
    return row;
  }

  private parseRoles(input: unknown): string[] {
    let list: unknown = input;
    if (typeof input === 'string') {
      const trimmed = input.trim();
      list = trimmed.startsWith('[') ? parseRequiredRoles(trimmed) : trimmed.split(',');
    }
    if (list === undefined || list === null || list === '') return [];
    if (!Array.isArray(list)) throw new BadRequestException('requiredRoles must be a list of role names');

    const roles = [...new Set(list.map((role) => String(role).trim()).filter(Boolean))];
    if (roles.length > 50 || roles.some((role) => role.length > 100)) {
      throw new BadRequestException('Too many or too long role names');
    }
    return roles;
  }

  private truthy(value: unknown): boolean {
    return value === true || value === 'true' || value === '1';
  }

  /** Serializes work per slug (single API instance). */
  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const chain = previous.then(() => next);
    this.locks.set(key, chain);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(key) === chain) this.locks.delete(key);
    }
  }

  toView(app: WebApp, current?: WebAppVersion, settingsVersion: WebAppVersion | undefined = current) {
    const schema = this.settings.manifestOf(settingsVersion)?.settings ?? {};
    const stored = this.settings.storedValues(app);
    return {
      id: app.id,
      slug: app.slug,
      name: app.name,
      description: app.description,
      status: app.status,
      requiredRoles: parseRequiredRoles(app.requiredRoles),
      isPrivate: app.isPrivate,
      currentVersionId: app.currentVersionId,
      currentVersion: current?.version ?? null,
      icon: current?.icon ?? null,
      // What the published version declares, the values entered (defaults filled in), and what is still missing.
      settingsSchema: schema,
      settings: this.settings.effectiveValues(schema, stored),
      missingSettings: this.settings.missingRequired(schema, stored),
      url: `/hr-hub/apps/${app.slug}/`,
      createdBy: app.createdBy,
      createdByName: app.createdByName,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }

  private toVersionView(version: WebAppVersion, currentVersionId: string | null) {
    return { ...version, isCurrent: version.id === currentVersionId };
  }
}
