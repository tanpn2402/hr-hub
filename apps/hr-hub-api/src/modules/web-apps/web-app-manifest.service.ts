import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { EMPTY_MANIFEST, MANIFEST_FILE, parseManifest, WebAppManifest } from './web-app-manifest';
import { WebAppStorageService } from './web-app-storage.service';

/**
 * Manifest of the version an app currently serves. Only published, enabled apps have a "current" pointer, so
 * `null` also means "this app is not live". Cached per version: versions are immutable.
 */
@Injectable()
export class WebAppManifestService {
  private readonly cache = new Map<string, { target: string; manifest: WebAppManifest }>();
  private readonly logger: TraceLogger;

  constructor(
    private readonly storage: WebAppStorageService,
    traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, WebAppManifestService.name);
  }

  async current(slug: string): Promise<WebAppManifest | null> {
    const target = await this.storage.readCurrent(slug);
    if (!target) return null;

    const cached = this.cache.get(slug);
    if (cached?.target === target) return cached.manifest;

    let manifest = EMPTY_MANIFEST;
    const text = await readFile(join(this.storage.appDir(slug), target, MANIFEST_FILE), 'utf8').catch(() => null);
    if (text !== null) {
      try {
        manifest = parseManifest(text);
      } catch (error) {
        // Validated on upload; only versions uploaded before manifests existed can get here.
        this.logger.warn(`Ignoring ${MANIFEST_FILE} of ${slug} (${target}): ${(error as Error).message}`);
      }
    }
    this.cache.set(slug, { target, manifest });
    return manifest;
  }
}
