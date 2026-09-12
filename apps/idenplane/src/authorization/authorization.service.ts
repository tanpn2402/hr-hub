import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Policy, Realm } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../cache/cache.service.js';
import {
  evaluatePolicies,
  evaluatePolicy,
  type RawPolicy,
  type PolicyEvaluationRequest,
  type PolicyEvaluationResult,
  type PolicyMatchDetail,
} from './policy-engine.js';
import type { CreatePolicyDto } from './authorization.dto.js';
import type { UpdatePolicyDto } from './authorization.dto.js';
import type { EvaluatePolicyDto } from './authorization.dto.js';
import type { TestPolicyDto } from './authorization.dto.js';

const POLICY_CACHE_TTL = 60; // seconds

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────

  async createPolicy(realm: Realm, dto: CreatePolicyDto) {
    const existing = await this.prisma.policy.findFirst({
      where: { realmId: realm.id, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Policy '${dto.name}' already exists in this realm`,
      );
    }

    const policy = await this.prisma.policy.create({
      data: {
        realmId: realm.id,
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled ?? true,
        effect: dto.effect ?? 'ALLOW',
        priority: dto.priority ?? 0,
        logic: dto.logic ?? 'AND',
        clientId: dto.clientId ?? null,
        subjectConditions: AuthorizationService.toJsonField(
          dto.subjectConditions,
        ),
        resourceConditions: AuthorizationService.toJsonField(
          dto.resourceConditions,
        ),
        actionConditions: AuthorizationService.toJsonField(
          dto.actionConditions,
        ),
        environmentConditions: AuthorizationService.toJsonField(
          dto.environmentConditions,
        ),
      },
    });

    await this.invalidatePolicyCache(realm.id);
    return policy;
  }

  async findAllPolicies(realm: Realm) {
    return this.prisma.policy.findMany({
      where: { realmId: realm.id },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findPolicyById(realm: Realm, id: string) {
    const policy = await this.prisma.policy.findFirst({
      where: { id, realmId: realm.id },
    });
    if (!policy) {
      throw new NotFoundException(`Policy '${id}' not found`);
    }
    return policy;
  }

  async updatePolicy(realm: Realm, id: string, dto: UpdatePolicyDto) {
    await this.findPolicyById(realm, id);

    const updated = await this.prisma.policy.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled,
        effect: dto.effect,
        priority: dto.priority,
        logic: dto.logic,
        clientId: dto.clientId,
        subjectConditions: AuthorizationService.toJsonField(
          dto.subjectConditions,
        ),
        resourceConditions: AuthorizationService.toJsonField(
          dto.resourceConditions,
        ),
        actionConditions: AuthorizationService.toJsonField(
          dto.actionConditions,
        ),
        environmentConditions: AuthorizationService.toJsonField(
          dto.environmentConditions,
        ),
      },
    });

    await this.invalidatePolicyCache(realm.id);
    return updated;
  }

  async deletePolicy(realm: Realm, id: string) {
    await this.findPolicyById(realm, id);
    await this.prisma.policy.delete({ where: { id } });
    await this.invalidatePolicyCache(realm.id);
  }

  // ─── Policy evaluation ─────────────────────────────────────

  /**
   * Evaluate all realm policies for the given request.
   * Policies are cached per realm for `POLICY_CACHE_TTL` seconds.
   */
  async evaluate(
    realm: Realm,
    dto: EvaluatePolicyDto,
  ): Promise<PolicyEvaluationResult> {
    const start = Date.now();

    const policies = await this.getCachedPolicies(realm.id);

    // If clientId scoping is requested, include only policies that are either
    // globally scoped (clientId = null) or scoped to that specific client.
    const applicable: RawPolicy[] = dto.clientId
      ? policies.filter(
          (p: RawPolicy) => p.clientId === null || p.clientId === dto.clientId,
        )
      : policies;

    const request: PolicyEvaluationRequest = {
      subject: dto.subject,
      resource: dto.resource,
      action: dto.action,
      environment: dto.environment,
      clientId: dto.clientId,
    };

    const result = evaluatePolicies(applicable, request);

    const elapsed = Date.now() - start;
    this.logger.debug(
      `Policy evaluation for realm "${realm.name}" took ${elapsed}ms — ` +
        `decision: ${result.decision}, policies evaluated: ${result.evaluatedCount}`,
    );

    return result;
  }

  /**
   * Test a single specific policy against a request, without considering other
   * policies in the realm.  Useful for debugging policy logic.
   */
  async testPolicy(
    realm: Realm,
    id: string,
    dto: TestPolicyDto,
  ): Promise<{
    matched: boolean;
    effect: 'ALLOW' | 'DENY';
    detail: PolicyMatchDetail;
  }> {
    const policy = await this.findPolicyById(realm, id);

    const request: PolicyEvaluationRequest = {
      subject: dto.subject,
      resource: dto.resource,
      action: dto.action,
      environment: dto.environment,
    };

    const detail = evaluatePolicy(
      AuthorizationService.toRawPolicy(policy),
      request,
    );

    return {
      matched: detail.matched,
      effect: detail.effect,
      detail,
    };
  }

  // ─── Cache helpers ──────────────────────────────────────────

  private policyListCacheKey(realmId: string): string {
    return `policies:${realmId}`;
  }

  private async getCachedPolicies(realmId: string): Promise<RawPolicy[]> {
    const cacheKey = this.policyListCacheKey(realmId);
    const cached = await this.cache.getCachedRealmConfig<RawPolicy[]>(cacheKey);
    if (cached) return cached;

    const policies = await this.prisma.policy.findMany({
      where: { realmId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    const rawPolicies = policies.map((p) =>
      AuthorizationService.toRawPolicy(p),
    );

    await this.cache.cacheRealmConfig(cacheKey, rawPolicies, POLICY_CACHE_TTL);

    return rawPolicies;
  }

  private async invalidatePolicyCache(realmId: string): Promise<void> {
    const cacheKey = this.policyListCacheKey(realmId);
    await this.cache.invalidateRealmCache(cacheKey);
  }

  // ─── SQLite Json-as-string helpers ─────────────────────────
  //
  // The ABAC condition fields on `Policy` are `Json?` on PostgreSQL but are
  // stored as JSON-serialised `String?` under the SQLite schema (see
  // prisma/schema.prisma). These helpers convert between the DTO's
  // object-array shape and the persisted JSON text.

  private static toJsonField(value: object[] | undefined): string | undefined {
    return value === undefined ? undefined : JSON.stringify(value);
  }

  private static parseConditionsField(value: string | null): unknown {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private static toRawPolicy(policy: Policy): RawPolicy {
    return {
      ...policy,
      subjectConditions: AuthorizationService.parseConditionsField(
        policy.subjectConditions,
      ),
      resourceConditions: AuthorizationService.parseConditionsField(
        policy.resourceConditions,
      ),
      actionConditions: AuthorizationService.parseConditionsField(
        policy.actionConditions,
      ),
      environmentConditions: AuthorizationService.parseConditionsField(
        policy.environmentConditions,
      ),
    };
  }
}
