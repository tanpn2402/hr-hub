import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  PayloadTooLargeException,
} from '@nestjs/common';
import Database from 'better-sqlite3';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { WebAppStorageService } from './web-app-storage.service';
import { WebAppsConfig } from './web-apps.config';

export const DATA_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

interface DataRow {
  key: string;
  value: string;
  updated_at: number;
}

/** Per-app SQLite key/value store. One database file per web app; the slug always comes from the route. */
@Injectable()
export class WebAppDataService implements OnModuleDestroy {
  /** Insertion-ordered LRU of open handles. */
  private readonly handles = new Map<string, Database.Database>();

  private readonly logger: TraceLogger;

  constructor(
    private readonly storage: WebAppStorageService,
    private readonly config: WebAppsConfig,
    traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, WebAppDataService.name);
  }

  onModuleDestroy() {
    for (const slug of [...this.handles.keys()]) this.close(slug);
  }

  initDatabase(slug: string): void {
    this.logger.log(`Initializing database for ${slug}: ${this.storage.dbPath(slug)}`);
    const db = new Database(this.storage.dbPath(slug));
    try {
      this.configure(db);
      db.exec(`CREATE TABLE IF NOT EXISTS data (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`);
      db.pragma('user_version = 1');
    } finally {
      db.close();
    }
  }

  close(slug: string): void {
    const db = this.handles.get(slug);
    if (db) {
      this.logger.debug(`Closing database of ${slug}`);
      this.handles.delete(slug);
      db.close();
    }
  }

  list(slug: string): Array<{ key: string; updatedAt: number }> {
    this.logger.debug(`List keys of ${slug}`);
    return this.open(slug)
      .prepare('SELECT key, updated_at FROM data ORDER BY key')
      .all()
      .map((row) => ({ key: (row as DataRow).key, updatedAt: (row as DataRow).updated_at }));
  }

  get(slug: string, key: string) {
    this.assertKey(key);
    this.logger.debug(`Get ${slug} key ${key}`);
    const row = this.open(slug).prepare('SELECT key, value, updated_at FROM data WHERE key = ?').get(key) as DataRow | undefined;
    if (!row) throw new NotFoundException('Key not found');
    return { key: row.key, value: JSON.parse(row.value) as unknown, updatedAt: row.updated_at };
  }

  /** `ifUpdatedAt` enables optimistic concurrency; 0 means "must not exist yet". */
  put(slug: string, key: string, value: unknown, ifUpdatedAt?: number) {
    this.assertKey(key);
    if (value === undefined) throw new BadRequestException('"value" is required');

    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized) > this.config.maxValueBytes) {
      throw new PayloadTooLargeException(`Value exceeds ${this.config.maxValueBytes} bytes`);
    }

    const db = this.open(slug);
    const write = db.transaction(() => {
      const existing = db.prepare('SELECT updated_at FROM data WHERE key = ?').get(key) as { updated_at: number } | undefined;

      if (ifUpdatedAt !== undefined && (existing?.updated_at ?? 0) !== ifUpdatedAt) {
        throw new ConflictException('The value was changed by someone else');
      }

      if (!existing) {
        const { count } = db.prepare('SELECT COUNT(*) AS count FROM data').get() as { count: number };
        if (count >= this.config.maxKeysPerApp) {
          throw new PayloadTooLargeException(`Key limit reached (${this.config.maxKeysPerApp})`);
        }
      }

      // Monotonic so optimistic-concurrency tokens never repeat within a key.
      const updatedAt = Math.max(Date.now(), (existing?.updated_at ?? 0) + 1);
      db.prepare(
        `INSERT INTO data (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ).run(key, serialized, updatedAt);
      return updatedAt;
    });

    const updatedAt = write();
    this.logger.log(`Put ${slug} key ${key} (${serialized.length} chars)`);
    return { key, updatedAt };
  }

  delete(slug: string, key: string) {
    this.assertKey(key);
    const result = this.open(slug).prepare('DELETE FROM data WHERE key = ?').run(key);
    if (result.changes === 0) throw new NotFoundException('Key not found');
    this.logger.log(`Deleted ${slug} key ${key}`);
    return { key, deleted: true };
  }

  private open(slug: string): Database.Database {
    const cached = this.handles.get(slug);
    if (cached) {
      this.handles.delete(slug);
      this.handles.set(slug, cached);
      return cached;
    }

    let db: Database.Database;
    try {
      db = new Database(this.storage.dbPath(slug), { fileMustExist: true });
      this.logger.debug(`Opened database of ${slug}: ${this.storage.dbPath(slug)}`);
    } catch {
      this.logger.error(`Database not found for ${slug}: ${this.storage.dbPath(slug)}`);
      throw new NotFoundException('Web app database not found');
    }
    this.configure(db);
    this.handles.set(slug, db);

    while (this.handles.size > this.config.maxOpenDatabases) {
      const oldest = this.handles.keys().next().value as string;
      this.close(oldest);
    }
    return db;
  }

  private configure(db: Database.Database) {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
  }

  private assertKey(key: string) {
    if (!DATA_KEY_PATTERN.test(key)) throw new BadRequestException('Invalid key');
  }
}
