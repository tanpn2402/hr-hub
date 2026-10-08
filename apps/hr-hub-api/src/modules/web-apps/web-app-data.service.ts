import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  PayloadTooLargeException,
} from '@nestjs/common';
import Database from 'better-sqlite3';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { WebAppStorageService } from './web-app-storage.service';
import { DataActor } from './web-apps-actor';
import { WebAppsConfig } from './web-apps.config';

export const DATA_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

interface DataRow {
  key: string;
  value: string;
  updated_at: number;
  created_at: number | null;
  created_by: string | null;
  updated_by: string | null;
  state: string;
}

/** Records are never physically deleted: state 'A' = active, 'X' = deleted. Reads only return 'A'. */
const STATE_ACTIVE = 'A';
const STATE_DELETED = 'X';
const SCHEMA_VERSION = 2;

const toEntry = (row: DataRow) => ({
  key: row.key,
  value: JSON.parse(row.value) as unknown,
  updatedAt: row.updated_at,
  createdAt: row.created_at ?? row.updated_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
});

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
        updated_at INTEGER NOT NULL,
        created_at INTEGER,
        created_by TEXT,
        updated_by TEXT,
        state TEXT NOT NULL DEFAULT 'A',
        created_device TEXT,
        updated_device TEXT
      )`);
      db.pragma(`user_version = ${SCHEMA_VERSION}`);
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

  list(slug: string) {
    this.logger.debug(`List keys of ${slug}`);
    return (
      this.open(slug)
        .prepare('SELECT key, value, updated_at, created_at, created_by, updated_by, state FROM data WHERE state = ? ORDER BY key')
        .all(STATE_ACTIVE) as DataRow[]
    ).map((row) => ({
      key: row.key,
      updatedAt: row.updated_at,
      createdAt: row.created_at ?? row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    }));
  }

  get(slug: string, key: string) {
    this.assertKey(key);
    this.logger.debug(`Get ${slug} key ${key}`);
    const row = this.open(slug)
      .prepare('SELECT key, value, updated_at, created_at, created_by, updated_by, state FROM data WHERE key = ? AND state = ?')
      .get(key, STATE_ACTIVE) as DataRow | undefined;
    if (!row) throw new NotFoundException('Key not found');
    return toEntry(row);
  }

  /** Active value of a key without throwing when the app database or the key does not exist. */
  peek(slug: string, key: string): unknown {
    try {
      const row = this.open(slug)
        .prepare('SELECT key, value, updated_at, created_at, created_by, updated_by, state FROM data WHERE key = ? AND state = ?')
        .get(key, STATE_ACTIVE) as DataRow | undefined;
      return row ? (JSON.parse(row.value) as unknown) : null;
    } catch {
      return null;
    }
  }

  /**
   * Create or update. `ifUpdatedAt` enables optimistic concurrency; 0 means "must not exist yet".
   * Writing over a deleted (state X) key revives it as a new record.
   */
  put(slug: string, key: string, value: unknown, ifUpdatedAt: number | undefined, actor: DataActor) {
    this.assertKey(key);
    if (value === undefined) throw new BadRequestException('"value" is required');

    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized) > this.config.maxValueBytes) {
      throw new PayloadTooLargeException(`Value exceeds ${this.config.maxValueBytes} bytes`);
    }

    const db = this.open(slug);
    const write = db.transaction(() => {
      const existing = db.prepare('SELECT updated_at, state FROM data WHERE key = ?').get(key) as
        { updated_at: number; state: string } | undefined;
      const live = existing?.state === STATE_ACTIVE;

      if (ifUpdatedAt !== undefined && (live ? existing.updated_at : 0) !== ifUpdatedAt) {
        throw new ConflictException('The value was changed by someone else');
      }

      if (!live) {
        const { count } = db.prepare('SELECT COUNT(*) AS count FROM data WHERE state = ?').get(STATE_ACTIVE) as { count: number };
        if (count >= this.config.maxKeysPerApp) {
          throw new PayloadTooLargeException(`Key limit reached (${this.config.maxKeysPerApp})`);
        }
      }

      // Monotonic so optimistic-concurrency tokens never repeat within a key.
      const now = Math.max(Date.now(), (existing?.updated_at ?? 0) + 1);
      db.prepare(
        `INSERT INTO data (key, value, updated_at, created_at, created_by, updated_by, state, created_device, updated_device)
         VALUES (@key, @value, @now, @now, @by, @by, 'A', @device, @device)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by,
           updated_device = excluded.updated_device,
           created_at = CASE WHEN data.state = 'X' THEN excluded.created_at ELSE data.created_at END,
           created_by = CASE WHEN data.state = 'X' THEN excluded.created_by ELSE data.created_by END,
           created_device = CASE WHEN data.state = 'X' THEN excluded.created_device ELSE data.created_device END,
           state = 'A'`,
      ).run({ key, value: serialized, now, by: actor.by, device: actor.device });
      return { updatedAt: now, created: !live };
    });

    const { updatedAt, created } = write();
    this.logger.log(
      `${created ? 'Created' : 'Updated'} ${slug} key ${key} (${serialized.length} chars) by ${actor.by ?? 'anonymous'} from ${actor.device ?? 'unknown'}`,
    );
    return { key, updatedAt };
  }

  /** Soft delete (state A -> X). Only the creator or an admin may delete; the change is recorded in updated_*. */
  delete(slug: string, key: string, actor: DataActor) {
    this.assertKey(key);
    const db = this.open(slug);

    const row = db.prepare('SELECT created_by FROM data WHERE key = ? AND state = ?').get(key, STATE_ACTIVE) as
      { created_by: string | null } | undefined;
    if (!row) throw new NotFoundException('Key not found');

    const isCreator = !!actor.by && !!row.created_by && row.created_by === actor.by;
    if (!actor.isAdmin && !isCreator) {
      this.logger.warn(
        `Delete denied: ${actor.by ?? 'anonymous'} is not the creator (${row.created_by ?? 'unknown'}) of ${slug} key ${key}`,
      );
      throw new ForbiddenException('Only the creator or an administrator can delete this record');
    }

    const now = Date.now();
    db.prepare('UPDATE data SET state = ?, updated_by = ?, updated_at = MAX(?, updated_at + 1), updated_device = ? WHERE key = ?').run(
      STATE_DELETED,
      actor.by,
      now,
      actor.device,
      key,
    );

    this.logger.log(`Deleted (state X) ${slug} key ${key} by ${actor.by ?? 'anonymous'} from ${actor.device ?? 'unknown'}`);
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
    this.migrate(db, slug);
    this.handles.set(slug, db);

    while (this.handles.size > this.config.maxOpenDatabases) {
      const oldest = this.handles.keys().next().value as string;
      this.close(oldest);
    }
    return db;
  }

  /** v1 -> v2: audit columns and soft-delete state (existing rows become active). */
  private migrate(db: Database.Database, slug: string) {
    const version = db.pragma('user_version', { simple: true }) as number;
    if (version >= SCHEMA_VERSION) return;

    this.logger.log(`Migrating database of ${slug} from v${version} to v${SCHEMA_VERSION}`);
    db.transaction(() => {
      const columns = (db.prepare('PRAGMA table_info(data)').all() as Array<{ name: string }>).map((column) => column.name);
      const add = (name: string, definition: string) => {
        if (!columns.includes(name)) db.exec(`ALTER TABLE data ADD COLUMN ${name} ${definition}`);
      };
      add('created_at', 'INTEGER');
      add('created_by', 'TEXT');
      add('updated_by', 'TEXT');
      add('state', "TEXT NOT NULL DEFAULT 'A'");
      add('created_device', 'TEXT');
      add('updated_device', 'TEXT');
      db.exec('UPDATE data SET created_at = updated_at WHERE created_at IS NULL');
      db.pragma(`user_version = ${SCHEMA_VERSION}`);
    })();
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
