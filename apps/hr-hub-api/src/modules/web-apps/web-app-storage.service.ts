import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readlink, rename, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { WebAppsConfig } from './web-apps.config';

/**
 * The only place that knows the on-disk layout:
 *
 *   <root>/.tmp/            staging area (same filesystem so renames are atomic)
 *   <root>/.trash/          soft-deleted apps
 *   <root>/<slug>/versions/<n>/   immutable extracted versions
 *   <root>/<slug>/current         relative symlink -> versions/<n>
 *   <root>/<slug>/app.db          per-app SQLite database
 */
@Injectable()
export class WebAppStorageService {
  private readonly logger: TraceLogger;

  constructor(
    private readonly config: WebAppsConfig,
    traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, WebAppStorageService.name);
  }

  get uploadDir() {
    return join(this.config.root, '.tmp', 'uploads');
  }

  appDir(slug: string) {
    return join(this.config.root, slug);
  }

  dbPath(slug: string) {
    return join(this.appDir(slug), 'app.db');
  }

  versionPath(slug: string, version: number) {
    return join(this.appDir(slug), 'versions', String(version));
  }

  /** Creates the root, and wipes leftovers of interrupted uploads. */
  async prepareRoot(): Promise<void> {
    this.logger.log(`Preparing web apps root: ${this.config.root}`);
    await rm(join(this.config.root, '.tmp'), { recursive: true, force: true });
    await mkdir(this.uploadDir, { recursive: true });
    await mkdir(join(this.config.root, '.trash'), { recursive: true });
  }

  async createTempDir(): Promise<string> {
    const dir = join(this.config.root, '.tmp', randomUUID());
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async initAppDir(slug: string): Promise<void> {
    this.logger.log(`Creating app dir: ${this.appDir(slug)}`);
    await mkdir(join(this.appDir(slug), 'versions'), { recursive: true, mode: 0o755 });
  }

  /** Moves a validated, extracted directory into permanent storage. */
  async commitVersion(slug: string, stagedDir: string, version: number): Promise<string> {
    const target = this.versionPath(slug, version);
    this.logger.log(`Committing ${slug} v${version}: ${stagedDir} -> ${target}`);
    await rename(stagedDir, target);
    return `versions/${version}`;
  }

  /** Atomically points `current` at the given version (symlink + rename over the old one). */
  async setCurrent(slug: string, version: number): Promise<void> {
    this.logger.log(`Pointing ${slug} current -> versions/${version} in ${this.appDir(slug)}`);
    const tmpLink = join(this.appDir(slug), `current.${randomUUID()}.tmp`);
    await symlink(`versions/${version}`, tmpLink);
    try {
      await rename(tmpLink, join(this.appDir(slug), 'current'));
    } catch (error) {
      await rm(tmpLink, { force: true });
      throw error;
    }
  }

  async clearCurrent(slug: string): Promise<void> {
    this.logger.log(`Removing current pointer of ${slug} in ${this.appDir(slug)}`);
    await rm(join(this.appDir(slug), 'current'), { force: true });
  }

  async readCurrent(slug: string): Promise<string | null> {
    try {
      return await readlink(join(this.appDir(slug), 'current'));
    } catch {
      return null;
    }
  }

  async trashApp(slug: string): Promise<void> {
    const trashDir = join(this.config.root, '.trash', `${slug}-${Date.now()}`);
    this.logger.log(`Moving ${slug} to trash: ${this.appDir(slug)} -> ${trashDir}`);
    await mkdir(join(this.config.root, '.trash'), { recursive: true });
    await rename(this.appDir(slug), trashDir);
  }

  async removeDir(path: string): Promise<void> {
    await rm(path, { recursive: true, force: true });
  }

  async removeFile(path: string): Promise<void> {
    await rm(path, { force: true });
  }
}
