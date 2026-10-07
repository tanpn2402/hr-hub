import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readdir, stat } from 'node:fs/promises';
import { dirname, join, posix, resolve, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import * as tar from 'tar-stream';
import * as yauzl from 'yauzl';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { ArchiveType } from './web-apps.types';
import { WebAppsConfig } from './web-apps.config';

export class ArchiveValidationError extends Error {
  constructor(readonly errors: string[]) {
    super(errors.join('; '));
  }
}

export interface ExtractResult {
  /** Directory that holds the app (index.html lives directly inside). */
  baseDir: string;
  fileCount: number;
  totalBytes: number;
}

const MAX_DEPTH = 20;
const MAX_PATH_LENGTH = 255;
const IGNORED = (rel: string) => rel.startsWith('__MACOSX/') || rel === '__MACOSX' || posix.basename(rel) === '.DS_Store';

/**
 * Validates and extracts static-site archives. Nothing from the archive is ever executed; files are streamed
 * entry by entry into a staging directory and every limit is enforced on the bytes actually written.
 */
@Injectable()
export class ArchiveExtractorService {
  private readonly logger: TraceLogger;

  constructor(
    private readonly config: WebAppsConfig,
    traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, ArchiveExtractorService.name);
  }

  async detectType(archivePath: string): Promise<ArchiveType> {
    const handle = await open(archivePath, 'r');
    try {
      const header = Buffer.alloc(4);
      await handle.read(header, 0, 4, 0);
      if (header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) return 'zip';
      if (header[0] === 0x1f && header[1] === 0x8b) return 'tar.gz';
    } finally {
      await handle.close();
    }
    throw new ArchiveValidationError(['Unsupported archive type. Upload a .zip or .tar.gz file']);
  }

  checksum(archivePath: string): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      const hash = createHash('sha256');
      createReadStream(archivePath)
        .on('data', (chunk) => hash.update(chunk))
        .on('error', reject)
        .on('end', () => resolvePromise(hash.digest('hex')));
    });
  }

  async extract(archivePath: string, type: ArchiveType, destDir: string): Promise<ExtractResult> {
    this.logger.log(`Extracting ${type} ${archivePath} -> ${destDir}`);
    await mkdir(destDir, { recursive: true });
    const sink = new ExtractionSink(resolve(destDir), this.config);

    try {
      if (type === 'zip') await this.extractZip(archivePath, sink);
      else await this.extractTarGz(archivePath, sink);
    } catch (error) {
      this.logger.warn(`Extraction rejected (${archivePath}): ${(error as Error).message}`);
      throw error;
    }

    const baseDir = await this.locateBaseDir(resolve(destDir));
    this.logger.log(`Extracted ${sink.fileCount} files, ${sink.totalBytes} bytes; app root: ${baseDir}`);
    return { baseDir, fileCount: sink.fileCount, totalBytes: sink.totalBytes };
  }

  /** index.html must be at the root, optionally inside a single wrapper folder (e.g. dist/). */
  private async locateBaseDir(root: string): Promise<string> {
    let base = root;
    for (let i = 0; i < 2; i++) {
      const entries = await readdir(base, { withFileTypes: true });
      if (entries.some((entry) => entry.isFile() && entry.name === 'index.html')) return base;
      if (entries.length === 1 && entries[0].isDirectory()) {
        base = join(base, entries[0].name);
        continue;
      }
      break;
    }
    throw new ArchiveValidationError(['index.html was not found at the root of the archive']);
  }

  private extractZip(archivePath: string, sink: ExtractionSink): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      yauzl.open(archivePath, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (openError, zip) => {
        if (openError || !zip) {
          reject(new ArchiveValidationError([`Invalid zip archive: ${openError?.message ?? 'unreadable'}`]));
          return;
        }

        const fail = (error: unknown) => {
          zip.close();
          reject(error instanceof Error ? error : new Error(String(error)));
        };

        zip.on('error', (error) => fail(new ArchiveValidationError([`Invalid zip archive: ${error.message}`])));
        zip.on('end', () => resolvePromise());
        zip.on('entry', (entry: yauzl.Entry) => {
          void (async () => {
            const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
            const isDirectory = entry.fileName.endsWith('/');

            if (entry.isEncrypted()) throw new ArchiveValidationError([`Encrypted entry: ${entry.fileName}`]);
            if (mode === 0o120000) throw new ArchiveValidationError([`Symlinks are not allowed: ${entry.fileName}`]);
            if (mode !== 0 && mode !== 0o100000 && mode !== 0o040000) {
              throw new ArchiveValidationError([`Unsupported entry type: ${entry.fileName}`]);
            }

            if (isDirectory) {
              await sink.directory(entry.fileName);
            } else {
              sink.declare(entry.fileName, entry.uncompressedSize);
              const stream = await new Promise<Readable | null>((res, rej) => {
                if (!sink.accepts(entry.fileName)) return res(null);
                zip.openReadStream(entry, (error, readable) => (error || !readable ? rej(error) : res(readable)));
              });
              if (stream) await sink.file(entry.fileName, stream);
            }
            zip.readEntry();
          })().catch(fail);
        });
        zip.readEntry();
      });
    });
  }

  private async extractTarGz(archivePath: string, sink: ExtractionSink): Promise<void> {
    const extract = tar.extract();

    extract.on('entry', (header, stream, next) => {
      void (async () => {
        if (header.type === 'directory') {
          stream.resume();
          await sink.directory(header.name);
        } else if (header.type === 'file') {
          sink.declare(header.name, header.size ?? 0);
          if (sink.accepts(header.name)) await sink.file(header.name, stream);
          else stream.resume();
        } else {
          stream.resume();
          throw new ArchiveValidationError([`Unsupported entry type "${header.type}": ${header.name}`]);
        }
        next();
      })().catch((error) => extract.destroy(error instanceof Error ? error : new Error(String(error))));
    });

    try {
      await pipeline(createReadStream(archivePath), createGunzip(), extract);
    } catch (error) {
      if (error instanceof ArchiveValidationError) throw error;
      throw new ArchiveValidationError([`Invalid tar.gz archive: ${(error as Error).message}`]);
    }
  }
}

class ExtractionSink {
  fileCount = 0;
  totalBytes = 0;
  private entryCount = 0;
  private readonly seen = new Set<string>();

  constructor(
    private readonly root: string,
    private readonly config: WebAppsConfig,
  ) {}

  accepts(rawName: string): boolean {
    const rel = this.normalize(rawName);
    return rel !== null && !IGNORED(rel);
  }

  /** Early check from the declared size. The real limit is enforced on streamed bytes. */
  declare(rawName: string, declaredSize: number): void {
    const rel = this.normalize(rawName);
    if (rel === null || IGNORED(rel)) return;
    if (declaredSize > this.config.maxFileBytes) {
      throw new ArchiveValidationError([`File too large: ${rel}`]);
    }
  }

  async directory(rawName: string): Promise<void> {
    const rel = this.normalize(rawName);
    if (rel === null || IGNORED(rel)) return;
    this.countEntry();
    await mkdir(this.resolveInside(rel), { recursive: true, mode: 0o755 });
  }

  async file(rawName: string, stream: Readable): Promise<void> {
    const rel = this.normalize(rawName);
    if (rel === null || IGNORED(rel)) {
      stream.resume();
      return;
    }

    this.countEntry();

    const extension = posix.extname(rel).slice(1).toLowerCase();
    if (!this.config.allowedExtensions.has(extension)) {
      stream.resume();
      throw new ArchiveValidationError([`File type not allowed: ${rel}`]);
    }

    const key = rel.toLowerCase();
    if (this.seen.has(key)) {
      stream.resume();
      throw new ArchiveValidationError([`Duplicate path: ${rel}`]);
    }
    this.seen.add(key);

    const target = this.resolveInside(rel);
    await mkdir(dirname(target), { recursive: true, mode: 0o755 });

    let fileBytes = 0;
    const counter = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        fileBytes += chunk.length;
        this.totalBytes += chunk.length;
        if (fileBytes > this.config.maxFileBytes) {
          callback(new ArchiveValidationError([`File too large: ${rel}`]));
        } else if (this.totalBytes > this.config.maxTotalBytes) {
          callback(new ArchiveValidationError(['Archive is too large once extracted']));
        } else {
          callback(null, chunk);
        }
      },
    });

    await pipeline(stream, counter, createWriteStream(target, { flags: 'wx', mode: 0o644 }));
    this.fileCount++;
    await stat(target);
  }

  private countEntry() {
    this.entryCount++;
    if (this.entryCount > this.config.maxFiles) {
      throw new ArchiveValidationError([`Archive contains more than ${this.config.maxFiles} entries`]);
    }
  }

  /** Returns the normalized relative path, or null for an empty/root entry. Throws on anything unsafe. */
  private normalize(rawName: string): string | null {
    if (rawName.includes('\0')) throw new ArchiveValidationError(['Entry name contains a NUL byte']);
    if (rawName.includes('\\')) throw new ArchiveValidationError([`Backslash in entry name: ${rawName}`]);
    if (rawName.startsWith('/') || /^[A-Za-z]:/.test(rawName)) {
      throw new ArchiveValidationError([`Absolute path not allowed: ${rawName}`]);
    }

    const segments = rawName.split('/').filter((segment) => segment !== '' && segment !== '.');
    if (segments.includes('..')) throw new ArchiveValidationError([`Path traversal not allowed: ${rawName}`]);
    if (segments.length === 0) return null;
    if (segments.length > MAX_DEPTH) throw new ArchiveValidationError([`Path too deep: ${rawName}`]);

    const rel = segments.join('/');
    if (rel.length > MAX_PATH_LENGTH) throw new ArchiveValidationError([`Path too long: ${rawName}`]);
    return rel;
  }

  private resolveInside(rel: string): string {
    const target = resolve(this.root, rel);
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new ArchiveValidationError([`Path escapes the extraction directory: ${rel}`]);
    }
    return target;
  }
}
