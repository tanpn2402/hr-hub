import { Resolver, Query, Args, Int, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Client } from '../types/client.type.js';
import { ClientType } from '../../common/db-enums.js';
import { ClientsService } from '../../clients/clients.service.js';
import { GraphQLAuthGuard } from '../guards/graphql-auth.guard.js';
import { PaginationInfo } from '../types/pagination.type.js';
import type { Request } from 'express';

// Shape returned by ClientsService.findAll/findByClientId (raw Prisma rows).
// SQLite stores clientType/redirectUris/webOrigins/grantTypes as plain
// strings (see prisma/schema.prisma banner comment), so they need to be
// converted into the shapes the GraphQL `Client` type declares.
interface RawClientRow {
  id: string;
  realmId: string;
  clientId: string;
  clientType: string;
  name: string | null;
  description: string | null;
  enabled: boolean;
  redirectUris: string;
  webOrigins: string;
  grantTypes: string;
  requireConsent: boolean;
  backchannelLogoutUri: string | null;
  backchannelLogoutSessionRequired: boolean;
  serviceAccountUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toGraphQLClient(row: RawClientRow): Client {
  return {
    id: row.id,
    realmId: row.realmId,
    clientId: row.clientId,
    clientType: row.clientType as ClientType,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    redirectUris: JSON.parse(row.redirectUris) as string[],
    webOrigins: JSON.parse(row.webOrigins) as string[],
    grantTypes: JSON.parse(row.grantTypes) as string[],
    requireConsent: row.requireConsent,
    backchannelLogoutUri: row.backchannelLogoutUri,
    backchannelLogoutSessionRequired: row.backchannelLogoutSessionRequired,
    serviceAccountUserId: row.serviceAccountUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Resolver(() => Client)
@UseGuards(GraphQLAuthGuard)
export class ClientResolver {
  constructor(private readonly clientsService: ClientsService) {}

  private getRealmId(context: any): string | null {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const req = context.req as Request;
    return (req.headers['x-realm-id'] as string) || null;
  }

  @Query(() => [Client])
  async clients(
    @Context() context: any,
    @Args('realmId') realmId: string,
  ): Promise<Client[]> {
    const realm = { id: realmId, name: '' } as any; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
    /* eslint-disable @typescript-eslint/no-unsafe-argument */
    const rows = await this.clientsService.findAll(realm);
    return rows.map((row) => toGraphQLClient(row));
  }

  @Query(() => Client, { nullable: true })
  async client(
    @Context() context: any,
    @Args('realmId') realmId: string,
    @Args('clientId') clientId: string,
  ): Promise<Client | null> {
    try {
      const realm = { id: realmId, name: '' } as any; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
      /* eslint-disable @typescript-eslint/no-unsafe-argument */
      const row = await this.clientsService.findByClientId(realm, clientId);
      return toGraphQLClient(row);
    } catch {
      return null;
    }
  }

  @Query(() => [Client])
  async clientsPaginated(
    @Context() context: any,
    @Args('realmId') realmId: string,
    @Args('skip', { type: () => Int, defaultValue: 0 }) skip: number,
    @Args('take', { type: () => Int, defaultValue: 10 }) take: number,
  ): Promise<{ items: Client[]; pagination: PaginationInfo }> {
    const realm = { id: realmId, name: '' } as any; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
    const rawItems = await this.clientsService.findAll(realm);
    const items = rawItems.map((row) => toGraphQLClient(row));
    const total = items.length;
    const paginatedItems = items.slice(skip, skip + take);
    return {
      items: paginatedItems,
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        pageSize: take,
        totalPages: Math.ceil(total / take),
        hasNext: skip + take < total,
        hasPrevious: skip > 0,
      },
    };
  }
}
