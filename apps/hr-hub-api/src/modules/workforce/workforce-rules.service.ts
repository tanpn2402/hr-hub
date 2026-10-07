import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { effectiveRules, loadWorkforceRules, type WorkforceRuleRecord, type WorkforceRules } from './models/workforce-rules.model';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import dayjs from 'dayjs';

export interface CreateWorkforceRuleInput {
  kind?: string;
  property: string;
  value: string;
  employeeCode?: string | null;
  weekday?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  priority?: number;
  reason?: string | null;
  enabled?: boolean;
}

export interface UpdateWorkforceRuleInput {
  kind?: string;
  property?: string;
  value?: string;
  employeeCode?: string | null;
  weekday?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  priority?: number;
  reason?: string | null;
  enabled?: boolean;
}

@Injectable()
export class WorkforceRulesService implements OnModuleInit {
  private readonly baseRules: WorkforceRules;
  private readonly logger: TraceLogger;

  /**
   * Only DB rules are cached here.
   *
   * Base rules come from .env and are loaded once when the application starts.
   */
  private dbRules: WorkforceRuleRecord[] = [];

  constructor(
    readonly config: ConfigService,
    readonly traceContext: TraceContextService,
    private readonly prisma: PrismaService,
  ) {
    this.baseRules = loadWorkforceRules(config);
    this.logger = new TraceLogger(traceContext, WorkforceRulesService.name);

    this.logger.log('Base Rules ' + JSON.stringify(this.baseRules));
  }

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /**
   * Reload enabled DB rules into memory.
   *
   * The cache is replaced atomically only after the DB query succeeds.
   */
  async reload(): Promise<void> {
    const rules = await this.prisma.workforceRule.findMany({
      where: {
        enabled: true,
      },
      orderBy: [
        {
          priority: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    const nextRules: WorkforceRuleRecord[] = rules.map((rule) => ({
      kind: rule.kind,
      property: rule.property,
      value: rule.value,
      employeeCode: rule.employeeCode,
      weekday: rule.weekday,
      startDate: rule.startDate ? rule.startDate.toISOString() : null,
      endDate: rule.endDate ? rule.endDate.toISOString() : null,
      priority: rule.priority,
      enabled: rule.enabled,
      reason: rule.reason,
    }));

    this.dbRules = nextRules;
  }

  /**
   * Get all currently cached enabled rules.
   *
   * This is useful for the HR admin UI.
   */
  getRules(): WorkforceRuleRecord[] {
    return this.dbRules;
  }

  /**
   * Get all DB rules directly from the database.
   *
   * Unlike getRules(), this also includes disabled rules.
   */
  async findAll(options?: { includeDisabled?: boolean }) {
    return this.prisma.workforceRule.findMany({
      where: options?.includeDisabled
        ? undefined
        : {
            enabled: true,
          },
      orderBy: [
        {
          priority: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.workforceRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(`Workforce rule "${id}" not found`);
    }

    return rule;
  }

  async create(input: CreateWorkforceRuleInput) {
    this.validateRule(input);

    const rule = await this.prisma.workforceRule.create({
      data: {
        kind: input.kind ?? 'OVERRIDE',
        property: input.property,
        value: input.value,
        employeeCode: input.employeeCode ?? null,
        weekday: input.weekday ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        priority: input.priority ?? 0,
        reason: input.reason ?? null,
        enabled: input.enabled ?? true,
      },
    });

    await this.reload();

    return rule;
  }

  async update(id: string, input: UpdateWorkforceRuleInput) {
    await this.findOne(id);

    this.validateRule(input);

    const rule = await this.prisma.workforceRule.update({
      where: { id },
      data: {
        ...(input.kind !== undefined && {
          kind: input.kind,
        }),
        ...(input.property !== undefined && {
          property: input.property,
        }),
        ...(input.value !== undefined && {
          value: input.value,
        }),
        ...(input.employeeCode !== undefined && {
          employeeCode: input.employeeCode,
        }),
        ...(input.weekday !== undefined && {
          weekday: input.weekday,
        }),
        ...(input.startDate !== undefined && {
          startDate: input.startDate,
        }),
        ...(input.endDate !== undefined && {
          endDate: input.endDate,
        }),
        ...(input.priority !== undefined && {
          priority: input.priority,
        }),
        ...(input.reason !== undefined && {
          reason: input.reason,
        }),
        ...(input.enabled !== undefined && {
          enabled: input.enabled,
        }),
      },
    });

    await this.reload();

    return rule;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.workforceRule.delete({
      where: { id },
    });

    await this.reload();

    return {
      success: true,
    };
  }

  /**
   * Enable/disable a rule.
   *
   * Disabling a rule also removes it from the in-memory cache.
   */
  async setEnabled(id: string, enabled: boolean) {
    await this.findOne(id);

    const rule = await this.prisma.workforceRule.update({
      where: { id },
      data: {
        enabled,
      },
    });

    await this.reload();

    return rule;
  }

  /**
   * Resolve rules for one employee and one date.
   *
   * No database query is performed here.
   */
  resolve(employeeCode: string, date: string | Date): WorkforceRules {
    this.logger.debug('DB Rules ' + JSON.stringify({ dbRules: this.dbRules, date, employeeCode }));

    return effectiveRules(
      {
        ...this.baseRules,
      },
      employeeCode,
      date instanceof Date ? date.toISOString() : date,
      this.dbRules,
      this.logger,
    );
  }

  /**
   * Return base .env rules.
   *
   * Useful for displaying the "Base" column in the admin UI.
   */
  getBaseRules(): WorkforceRules {
    return this.baseRules;
  }

  /**
   * Return both base and cached DB rules for admin/debugging.
   */
  getConfiguration() {
    return {
      baseRules: this.baseRules,
      dbRules: this.dbRules,
    };
  }

  private validateRule(input: CreateWorkforceRuleInput | UpdateWorkforceRuleInput): void {
    if (input.weekday !== undefined && input.weekday !== null) {
      // Monday = 1 ... Sunday = 7.
      if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) {
        throw new Error('weekday must be an integer from 1 (Monday) to 7 (Sunday)');
      }
    }

    if (input.startDate !== undefined && input.startDate !== null && !dayjs.utc(input.startDate).isValid()) {
      throw new Error(`Invalid startDate: ${input.startDate}. Expected YYYY-MM-DD`);
    }

    if (input.endDate !== undefined && input.endDate !== null && !dayjs.utc(input.endDate).isValid()) {
      throw new Error(`Invalid endDate: ${input.endDate}. Expected YYYY-MM-DD`);
    }

    if (input.startDate && input.endDate && input.startDate > input.endDate) {
      throw new Error('startDate must be before or equal to endDate');
    }

    if (input.priority !== undefined && (!Number.isInteger(input.priority) || input.priority < 0)) {
      throw new Error('priority must be a non-negative integer');
    }
  }
}
