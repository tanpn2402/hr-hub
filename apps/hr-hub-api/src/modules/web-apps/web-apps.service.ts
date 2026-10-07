import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { WebApp, WebAppVersion } from '@generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { ArchiveExtractorService, ArchiveValidationError } from './archive-extractor.service';
import { WebAppDataService } from './web-app-data.service';
import { parseRequiredRoles, WebAppAccessService } from './web-app-access.service';
import { WebAppStorageService } from './web-app-storage.service';
import { RESERVED_SLUGS, SLUG_PATTERN, WebAppsConfig } from './web-apps.config';
import { CreateWebAppInput, UpdateWebAppInput, UploadedArchive, UploadVersionInput } from './web-apps.types';

interface StagedVersion {
  tempDir: string;
  baseDir: string;
  fileCount: number;
  totalBytes: number;
  checksum: string;
  archiveType: 'zip' | 'tar.gz';
}

@Injectable()
export class WebAppsService implements OnModuleInit {
  private readonly logger: TraceLogger;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: WebAppStorageService,
    private readonly extractor: ArchiveExtractorService,
    private readonly data: WebAppDataService,
    private readonly config: WebAppsConfig,
    private readonly access: WebAppAccessService,
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

  async list() {
    const apps = await this.prisma.webApp.findMany({
      where: { status: { not: 'deleted' } },
      orderBy: { createdAt: 'desc' },
    });
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
    if (user && this.access.isAdmin(user)) return this.list();

    // Anonymous callers have no roles, so they only get apps without required roles.
    const apps = await this.access.listAccessible(user ?? { roles: [] });
    const versions = await this.prisma.webAppVersion.findMany({
      where: { id: { in: apps.map((app) => app.currentVersionId).filter((id): id is string => !!id) } },
    });
    const byId = new Map(versions.map((version) => [version.id, version]));

    return apps.map((app) => ({
      ...this.toView(app, app.currentVersionId ? byId.get(app.currentVersionId) : undefined),
      requiredRoles: [],
      createdBy: null,
      createdByName: null,
    }));
  }

  async get(id: string) {
    const app = await this.findApp(id);
    const current = app.currentVersionId ? await this.prisma.webAppVersion.findUnique({ where: { id: app.currentVersionId } }) : null;
    return this.toView(app, current ?? undefined);
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

  // -------------------------------------------------------------- mutations

  async create(input: CreateWebAppInput, file: UploadedArchive | undefined, user: AuthenticatedUser) {
    const slug = (input.slug ?? '').trim().toLowerCase();
    const name = (input.name ?? '').trim();
    if (!SLUG_PATTERN.test(slug)) {
      throw new BadRequestException('slug must be 2-63 chars: lowercase letters, digits and hyphens');
    }
    if (RESERVED_SLUGS.has(slug)) throw new BadRequestException(`slug "${slug}" is reserved`);
    if (!name) throw new BadRequestException('name is required');
    const requiredRoles = this.parseRoles(input.requiredRoles);

    this.logger.log(`Create web app ${slug} by ${user.id} (archive: ${file?.originalname ?? 'none'})`);
    return this.withLock(slug, async () => {
      if (await this.prisma.webApp.findUnique({ where: { slug } })) {
        await this.discard(file);
        throw new ConflictException(`slug "${slug}" is already used`);
      }

      // Validate the archive before anything is created.
      const staged = file ? await this.stage(file) : null;

      let appId: string | null = null;
      try {
        await this.storage.initAppDir(slug);
        this.data.initDatabase(slug);

        const app = await this.prisma.webApp.create({
          data: {
            slug,
            name,
            description: input.description?.trim() || null,
            requiredRoles: JSON.stringify(requiredRoles),
            createdBy: user.id,
            createdByName: user.username ?? user.email ?? null,
          },
        });
        appId = app.id;

        if (staged && file) {
          const version = await this.commit(app, staged, file, undefined, user);
          if (this.truthy(input.publish)) await this.publishLocked(app.id, version.version);
        }
      } catch (error) {
        if (appId) {
          await this.prisma.webAppVersion.deleteMany({ where: { webAppId: appId } }).catch(() => undefined);
          await this.prisma.webApp.delete({ where: { id: appId } }).catch(() => undefined);
        }
        this.data.close(slug);
        await this.storage.removeDir(this.storage.appDir(slug));
        throw error;
      } finally {
        await this.cleanup(staged, file);
      }

      return this.get(appId);
    });
  }

  async update(id: string, input: UpdateWebAppInput) {
    const app = await this.findApp(id);
    const data: { name?: string; description?: string | null; requiredRoles?: string } = {};

    if (input.name !== undefined) {
      if (!input.name.trim()) throw new BadRequestException('name cannot be empty');
      data.name = input.name.trim();
    }
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.requiredRoles !== undefined) data.requiredRoles = JSON.stringify(this.parseRoles(input.requiredRoles));

    await this.prisma.webApp.update({ where: { id: app.id }, data });
    return this.get(id);
  }

  async uploadVersion(id: string, file: UploadedArchive | undefined, input: UploadVersionInput, user: AuthenticatedUser) {
    if (!file) throw new BadRequestException('file is required');
    const app = await this.findApp(id);

    this.logger.log(`Upload version for ${app.slug} by ${user.id} (${file.originalname}, ${file.size} bytes)`);
    return this.withLock(app.slug, async () => {
      let staged: StagedVersion | null = null;
      try {
        staged = await this.stage(file);
        const version = await this.commit(app, staged, file, input.note, user);
        if (this.truthy(input.publish)) await this.publishLocked(app.id, version.version);
        return this.getVersion(app.id, version.version);
      } finally {
        await this.cleanup(staged, file);
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
      return { tempDir, baseDir: result.baseDir, fileCount: result.fileCount, totalBytes: result.totalBytes, checksum, archiveType };
    } catch (error) {
      await this.storage.removeDir(tempDir);
      if (error instanceof ArchiveValidationError) {
        throw new UnprocessableEntityException({ message: 'Invalid archive', errors: error.errors });
      }
      throw error;
    }
  }

  private async commit(
    app: WebApp,
    staged: StagedVersion,
    file: UploadedArchive,
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

  private async cleanup(staged: StagedVersion | null, file: UploadedArchive | undefined) {
    if (staged) await this.storage.removeDir(staged.tempDir);
    await this.discard(file);
  }

  private async discard(file: UploadedArchive | undefined) {
    if (file) await this.storage.removeFile(file.path);
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

  toView(app: WebApp, current?: WebAppVersion) {
    return {
      id: app.id,
      slug: app.slug,
      name: app.name,
      description: app.description,
      status: app.status,
      requiredRoles: parseRequiredRoles(app.requiredRoles),
      currentVersionId: app.currentVersionId,
      currentVersion: current?.version ?? null,
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
