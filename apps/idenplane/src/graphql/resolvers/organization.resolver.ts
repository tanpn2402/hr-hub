import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Organization } from '../types/organization.type.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GraphQLAuthGuard } from '../guards/graphql-auth.guard.js';
import { PaginationInfo } from '../types/pagination.type.js';

// Shape returned by Prisma for the Organization model. SQLite stores
// verifiedDomains as a JSON-array string (see prisma/schema.prisma banner
// comment), so it needs to be parsed into the string[] the GraphQL
// `Organization` type declares.
interface RawOrganizationRow {
  id: string;
  realmId: string;
  name: string;
  slug: string;
  displayName: string | null;
  description: string | null;
  enabled: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  requireMfa: boolean;
  verifiedDomains: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toGraphQLOrganization(row: RawOrganizationRow): Organization {
  return {
    id: row.id,
    realmId: row.realmId,
    name: row.name,
    slug: row.slug,
    displayName: row.displayName,
    description: row.description,
    enabled: row.enabled,
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
    requireMfa: row.requireMfa,
    verifiedDomains: JSON.parse(row.verifiedDomains) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Resolver(() => Organization)
@UseGuards(GraphQLAuthGuard)
export class OrganizationResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => [Organization])
  async organizations(
    @Args('realmId') realmId: string,
    @Args('skip', { type: () => Int, defaultValue: 0 }) skip: number,
    @Args('take', { type: () => Int, defaultValue: 10 }) take: number,
  ): Promise<{ items: Organization[]; pagination: PaginationInfo }> {
    const where = { realmId };
    const [rawItems, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.organization.count({ where }),
    ]);
    const items = rawItems.map((row) => toGraphQLOrganization(row));
    return {
      items,
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

  @Query(() => Organization, { nullable: true })
  async organization(
    @Args('realmId') realmId: string,
    @Args('id') id: string,
  ): Promise<Organization | null> {
    const org = await this.prisma.organization.findFirst({
      where: { id, realmId },
    });
    return org ? toGraphQLOrganization(org) : null;
  }
}
