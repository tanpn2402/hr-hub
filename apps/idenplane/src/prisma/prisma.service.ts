import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { getPgPoolConfig } from '../database/pg-pool-config.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    // SQLite (development / CI only, see prisma/schema.sqlite.prisma) uses
    // its own driver adapter — @prisma/adapter-pg only speaks Postgres.
    const adapter = databaseUrl.startsWith('file:')
      ? new PrismaBetterSqlite3({ url: databaseUrl })
      : new PrismaPg(getPgPoolConfig(databaseUrl));
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
