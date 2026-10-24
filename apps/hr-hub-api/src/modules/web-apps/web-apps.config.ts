import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';

/** Slugs that would collide with SPA routes or internal directories. */
export const RESERVED_SLUGS = new Set(['late-attendance', 'web-apps', 'launch', 'api', 'assets', 'admin', 'console']);

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

/** Hard cap enforced by multer; the configured WEBAPPS_MAX_ARCHIVE_MB is enforced by the service. */
export const UPLOAD_HARD_LIMIT_BYTES = 256 * 1024 * 1024;

const MB = 1024 * 1024;

const DEFAULT_EXTENSIONS = [
  'html',
  'htm',
  'css',
  'js',
  'mjs',
  'json',
  'map',
  'txt',
  'md',
  'xml',
  'csv',
  'svg',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'webmanifest',
  'wasm',
  'mp3',
  'mp4',
  'webm',
  'ogg',
  'wav',
];

/** Reads WEBAPPS_* settings. Everything has a default so the API boots without extra configuration. */
@Injectable()
export class WebAppsConfig {
  readonly root: string;
  readonly maxArchiveBytes: number;
  readonly maxFiles: number;
  readonly maxTotalBytes: number;
  readonly maxFileBytes: number;
  readonly maxValueBytes: number;
  readonly maxKeysPerApp: number;
  readonly maxOpenDatabases: number;
  readonly adminRoles: string[];
  readonly allowedExtensions: Set<string>;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('WEBAPPS_ROOT', './data/webapps'));
    this.maxArchiveBytes = config.get<number>('WEBAPPS_MAX_ARCHIVE_MB', 50) * MB;
    this.maxFiles = config.get<number>('WEBAPPS_MAX_FILES', 2000);
    this.maxTotalBytes = config.get<number>('WEBAPPS_MAX_EXTRACTED_MB', 200) * MB;
    this.maxFileBytes = config.get<number>('WEBAPPS_MAX_FILE_MB', 20) * MB;
    this.maxValueBytes = config.get<number>('WEBAPPS_MAX_VALUE_KB', 1024) * 1024;
    this.maxKeysPerApp = config.get<number>('WEBAPPS_MAX_KEYS', 1000);
    this.maxOpenDatabases = config.get<number>('WEBAPPS_MAX_OPEN_DBS', 32);
    this.adminRoles = splitList(config.get<string>('WEBAPPS_ADMIN_ROLES', 'hr'));
    this.allowedExtensions = new Set(
      splitList(config.get<string>('WEBAPPS_ALLOWED_EXTENSIONS', DEFAULT_EXTENSIONS.join(','))).map((value) =>
        value.toLowerCase().replace(/^\./, ''),
      ),
    );
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
