import { ConfigService } from '@nestjs/config';
import { minutesOfDay, parseDdMmYyyy } from '../utils/time.util';
import { TraceLogger } from '@app/modules/app/trace/trace-logger.service';

/** Numeric rule fields that can be overridden per employee or by HR exceptions. */
export interface OverridableWorkforceRules {
  /** Morning check-in must be at or before this time, otherwise it counts as late. */
  morningStartMinutes: number;

  /** End of the morning shift. */
  morningEndMinutes: number;

  /** Required checkout time when the afternoon is on leave. */
  morningCheckoutDeadlineMinutes: number;

  /** Afternoon check-in must be at or before this time when the morning was on leave. */
  afternoonStartMinutes: number;

  /** Required checkout time for a day that runs into the afternoon. */
  afternoonCheckoutDeadlineMinutes: number;

  /** Start of the leave system's morning half-day window. */
  leaveDayStartMinutes: number;

  /** End of the leave system's afternoon half-day window. */
  leaveDayEndMinutes: number;

  fineLateMorning: number;
  fineLateAfternoon: number;
  fineNoCheckoutHalfDay: number;
  fineNoCheckoutFullDay: number;
}

/**
 * Rule properties that can be overridden by HR.
 *
 * These are kept as strings because the DB rule table stores values as strings.
 */
export type WorkforceRuleProperty =
  | 'MORNING_START'
  | 'MORNING_END'
  | 'MORNING_CHECKOUT_DEADLINE'
  | 'AFTERNOON_START'
  | 'AFTERNOON_CHECKOUT_DEADLINE'
  | 'LEAVE_DAY_START'
  | 'LEAVE_DAY_END'
  | 'FINE_LATE_MORNING'
  | 'FINE_LATE_AFTERNOON'
  | 'FINE_NO_CHECKOUT_HALF_DAY'
  | 'FINE_NO_CHECKOUT_FULL_DAY'
  | 'CHECKIN_REQUIRED'
  | 'CHECKOUT_REQUIRED'
  | 'WORKING_DAY';

export interface WorkforceRuleRecord {
  kind: string;
  property: string;
  value: string;

  employeeCode: string | null;

  /**
   * JS weekday:
   * 0 = Sunday
   * 1 = Monday
   * ...
   * 6 = Saturday
   */
  weekday: number | null;

  /** ISO YYYY-MM-DD. */
  startDate: string | null;

  /** ISO YYYY-MM-DD. Inclusive. */
  endDate: string | null;

  priority: number;

  enabled: boolean;

  reason: string | null;
}

export interface WorkforceRules extends OverridableWorkforceRules {
  /** Vietnamese weekday labels from the attendance file. */
  workdays: Set<string>;

  /** Extra calendar dates that count as required workdays. */
  makeupWorkdays: Map<string, { LeaveDate: string }>;

  /** Employee codes excluded entirely from the report. */
  excludedEmployeeCodes: Set<string>;

  /** Holidays. */
  holidays: Set<string>;

  /** Max fine per month. */
  maxFinePerMonth: number;

  /**
   * Legacy .env employee overrides.
   *
   * These are still supported in stage 1.
   */
  employeeOverrides: Map<string, Partial<OverridableWorkforceRules>>;

  /**
   * HR-defined DB rules.
   *
   * These are evaluated by effectiveRules().
   */
  specificRules: WorkforceRuleRecord[];
}

type OverridableField = keyof OverridableWorkforceRules;

const TIME_FIELDS: Record<string, OverridableField> = {
  WORKFORCE_MORNING_START: 'morningStartMinutes',
  WORKFORCE_MORNING_END: 'morningEndMinutes',
  WORKFORCE_MORNING_CHECKOUT_DEADLINE: 'morningCheckoutDeadlineMinutes',
  WORKFORCE_AFTERNOON_START: 'afternoonStartMinutes',
  WORKFORCE_AFTERNOON_CHECKOUT_DEADLINE: 'afternoonCheckoutDeadlineMinutes',
  WORKFORCE_LEAVE_DAY_START: 'leaveDayStartMinutes',
  WORKFORCE_LEAVE_DAY_END: 'leaveDayEndMinutes',
};

const FINE_FIELDS: Record<string, OverridableField> = {
  WORKFORCE_FINE_LATE_MORNING: 'fineLateMorning',
  WORKFORCE_FINE_LATE_AFTERNOON: 'fineLateAfternoon',
  WORKFORCE_FINE_NO_CHECKOUT_HALF_DAY: 'fineNoCheckoutHalfDay',
  WORKFORCE_FINE_NO_CHECKOUT_FULL_DAY: 'fineNoCheckoutFullDay',
};

const PROPERTY_TO_FIELD: Record<string, OverridableField> = {
  MORNING_START: 'morningStartMinutes',
  MORNING_END: 'morningEndMinutes',
  MORNING_CHECKOUT_DEADLINE: 'morningCheckoutDeadlineMinutes',
  AFTERNOON_START: 'afternoonStartMinutes',
  AFTERNOON_CHECKOUT_DEADLINE: 'afternoonCheckoutDeadlineMinutes',
  LEAVE_DAY_START: 'leaveDayStartMinutes',
  LEAVE_DAY_END: 'leaveDayEndMinutes',
  FINE_LATE_MORNING: 'fineLateMorning',
  FINE_LATE_AFTERNOON: 'fineLateAfternoon',
  FINE_NO_CHECKOUT_HALF_DAY: 'fineNoCheckoutHalfDay',
  FINE_NO_CHECKOUT_FULL_DAY: 'fineNoCheckoutFullDay',
};

export function loadWorkforceRules(config: ConfigService, specificRules: WorkforceRuleRecord[] = []): WorkforceRules {
  return {
    workdays: new Set(
      config
        .get<string>('WORKFORCE_WORKDAYS', '1,2,3,4,5')
        .split(',')
        .map((day) => day.trim())
        .filter(Boolean),
    ),

    makeupWorkdays: new Map<string, { LeaveDate: string }>(
      config
        .get<string>('WORKFORCE_MAKEUP_WORKDAYS', '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          const match = value.match(/^(\d{2}-\d{2}-\d{4})\((.+)\)$/);

          if (!match) {
            throw new Error(`Invalid WORKFORCE_MAKEUP_WORKDAYS value: ${value}`);
          }

          const [, makeupWorkday, json] = match;

          return [parseDdMmYyyy(makeupWorkday), JSON.parse(json) as { LeaveDate: string }];
        }),
    ),

    holidays: new Set(
      config
        .get<string>('WORKFORCE_HOLIDAYS', '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map(parseDdMmYyyy),
    ),

    excludedEmployeeCodes: new Set(
      config
        .get<string>('WORKFORCE_EXCLUDED_EMPLOYEES', '')
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean),
    ),

    maxFinePerMonth: config.get<number>('WORKFORCE_MAX_FINE_PER_MONTH', 500_000),

    employeeOverrides: loadEmployeeOverrides(config),

    specificRules,

    morningStartMinutes: minutesOfDay(config.get<string>('WORKFORCE_MORNING_START', '08:30')),

    morningEndMinutes: minutesOfDay(config.get<string>('WORKFORCE_MORNING_END', '11:30')),

    morningCheckoutDeadlineMinutes: minutesOfDay(config.get<string>('WORKFORCE_MORNING_CHECKOUT_DEADLINE', '11:29')),

    afternoonStartMinutes: minutesOfDay(config.get<string>('WORKFORCE_AFTERNOON_START', '13:00')),

    afternoonCheckoutDeadlineMinutes: minutesOfDay(config.get<string>('WORKFORCE_AFTERNOON_CHECKOUT_DEADLINE', '17:15')),

    leaveDayStartMinutes: minutesOfDay(config.get<string>('WORKFORCE_LEAVE_DAY_START', '08:00')),

    leaveDayEndMinutes: minutesOfDay(config.get<string>('WORKFORCE_LEAVE_DAY_END', '17:30')),

    fineLateMorning: Number(config.get<string>('WORKFORCE_FINE_LATE_MORNING', '30000')),

    fineLateAfternoon: Number(config.get<string>('WORKFORCE_FINE_LATE_AFTERNOON', '30000')),

    fineNoCheckoutHalfDay: Number(config.get<string>('WORKFORCE_FINE_NO_CHECKOUT_HALF_DAY', '10000')),

    fineNoCheckoutFullDay: Number(config.get<string>('WORKFORCE_FINE_NO_CHECKOUT_FULL_DAY', '10000')),
  };
}

/**
 * Resolve the rules effective for an employee on a specific date.
 *
 * Resolution order:
 *
 *   1. .env employee override
 *   2. HR DB-specific rules
 *
 * Among DB rules:
 *   - employee-specific beats company-wide
 *   - higher priority beats lower priority
 *
 * `date` is optional for backwards compatibility with existing callers.
 */
export function effectiveRules(
  rules: WorkforceRules,
  employeeCode: string,
  date: string,
  dbRules: WorkforceRuleRecord[] = [],
  logger?: TraceLogger,
): WorkforceRules {
  // 1. Start with .env base rules.
  let result: WorkforceRules = rules;

  // 2. Apply legacy employee-specific .env overrides.
  const employeeOverride = rules.employeeOverrides.get(employeeCode);

  if (employeeOverride) {
    result = {
      ...result,
      ...employeeOverride,
    };
  }

  // 3. Find DB rules matching this employee/date.
  const matchingRules = dbRules.filter((rule) => matchesRule(rule, employeeCode, date));

  // 4. Resolve each property independently.
  //
  // Example:
  //   everyone / Friday / 16:45
  //   employee 533 / Friday / 16:00
  //
  // Both match, but the employee-specific rule wins.
  if (employeeCode === '512') {
    logger?.debug('matchingRules ' + JSON.stringify({ matchingRules, employeeOverride }));
  }
  const properties = new Set(matchingRules.map((rule) => rule.property));

  for (const property of properties) {
    const candidates = matchingRules.filter((rule) => rule.property === property);

    const selected = candidates.sort(compareRuleSpecificity)[0];

    if (!selected) {
      continue;
    }

    result = applyRule(result, selected);
  }

  return result;
}

function matchesRule(rule: WorkforceRuleRecord, employeeCode: string, date: string): boolean {
  if (!rule.enabled) {
    return false;
  }

  // Employee-specific rule.
  // null means the rule applies to everyone.
  if (rule.employeeCode !== null && rule.employeeCode !== employeeCode) {
    return false;
  }

  // Weekday:
  // 1 = Monday ... 7 = Sunday.
  if (rule.weekday !== null && getWeekday(date) !== rule.weekday) {
    return false;
  }

  // Inclusive date range.
  if (rule.startDate !== null && date < rule.startDate) {
    return false;
  }

  if (rule.endDate !== null && date > rule.endDate) {
    return false;
  }

  return true;
}

/**
 * Higher-ranked rules are more specific.
 *
 * Priority:
 *   1. employee-specific
 *   2. exact date
 *   3. date range
 *   4. weekday
 *   5. explicit priority
 */
function compareRuleSpecificity(a: WorkforceRuleRecord, b: WorkforceRuleRecord): number {
  // Employee-specific beats company-wide.
  const employeeSpecificA = a.employeeCode !== null ? 1 : 0;
  const employeeSpecificB = b.employeeCode !== null ? 1 : 0;

  if (employeeSpecificA !== employeeSpecificB) {
    return employeeSpecificB - employeeSpecificA;
  }

  // Exact date beats a date range.
  const exactDateA = isExactDate(a) ? 1 : 0;
  const exactDateB = isExactDate(b) ? 1 : 0;

  if (exactDateA !== exactDateB) {
    return exactDateB - exactDateA;
  }

  // A date-constrained rule beats a weekday-only rule.
  const dateRangeA = hasDateRange(a) ? 1 : 0;
  const dateRangeB = hasDateRange(b) ? 1 : 0;

  if (dateRangeA !== dateRangeB) {
    return dateRangeB - dateRangeA;
  }

  // Weekday-specific beats a completely general rule.
  const weekdayA = a.weekday !== null ? 1 : 0;
  const weekdayB = b.weekday !== null ? 1 : 0;

  if (weekdayA !== weekdayB) {
    return weekdayB - weekdayA;
  }

  // Finally use explicit priority.
  return b.priority - a.priority;
}

function isExactDate(rule: WorkforceRuleRecord): boolean {
  return rule.startDate !== null && rule.endDate !== null && rule.startDate === rule.endDate;
}

function hasDateRange(rule: WorkforceRuleRecord): boolean {
  return rule.startDate !== null || rule.endDate !== null;
}

function applyRule(rules: WorkforceRules, rule: WorkforceRuleRecord): WorkforceRules {
  switch (rule.property) {
    case 'MORNING_START':
      return {
        ...rules,
        morningStartMinutes: minutesOfDay(rule.value),
      };

    case 'MORNING_END':
      return {
        ...rules,
        morningEndMinutes: minutesOfDay(rule.value),
      };

    case 'MORNING_CHECKOUT_DEADLINE':
      return {
        ...rules,
        morningCheckoutDeadlineMinutes: minutesOfDay(rule.value),
      };

    case 'AFTERNOON_START':
      return {
        ...rules,
        afternoonStartMinutes: minutesOfDay(rule.value),
      };

    case 'AFTERNOON_CHECKOUT_DEADLINE':
      return {
        ...rules,
        afternoonCheckoutDeadlineMinutes: minutesOfDay(rule.value),
      };

    case 'LEAVE_DAY_START':
      return {
        ...rules,
        leaveDayStartMinutes: minutesOfDay(rule.value),
      };

    case 'LEAVE_DAY_END':
      return {
        ...rules,
        leaveDayEndMinutes: minutesOfDay(rule.value),
      };

    case 'FINE_LATE_MORNING':
      return {
        ...rules,
        fineLateMorning: Number(rule.value),
      };

    case 'FINE_LATE_AFTERNOON':
      return {
        ...rules,
        fineLateAfternoon: Number(rule.value),
      };

    case 'FINE_NO_CHECKOUT_HALF_DAY':
      return {
        ...rules,
        fineNoCheckoutHalfDay: Number(rule.value),
      };

    case 'FINE_NO_CHECKOUT_FULL_DAY':
      return {
        ...rules,
        fineNoCheckoutFullDay: Number(rule.value),
      };

    default:
      return rules;
  }
}

function isRuleApplicable(rule: WorkforceRuleRecord, employeeCode: string, date: string): boolean {
  if (rule.employeeCode && rule.employeeCode !== employeeCode) {
    return false;
  }

  if (rule.startDate && date < rule.startDate) {
    return false;
  }

  if (rule.endDate && date > rule.endDate) {
    return false;
  }

  if (rule.weekday !== null) {
    const weekday = getWeekday(date);

    if (weekday !== rule.weekday) {
      return false;
    }
  }

  return true;
}

function ruleSpecificity(rule: WorkforceRuleRecord, employeeCode: string): number {
  let score = 0;

  if (rule.employeeCode === employeeCode) {
    score += 100;
  }

  if (rule.startDate && rule.endDate && rule.startDate === rule.endDate) {
    score += 50;
  } else if (rule.startDate || rule.endDate) {
    score += 30;
  }

  if (rule.weekday !== null) {
    score += 10;
  }

  return score;
}

function applySpecificRule(rules: WorkforceRules, rule: WorkforceRuleRecord): void {
  const field = PROPERTY_TO_FIELD[rule.property];

  if (field) {
    if (field.endsWith('Minutes')) {
      rules[field] = minutesOfDay(rule.value);
    } else {
      rules[field] = Number(rule.value);
    }

    return;
  }

  /**
   * These are handled separately from numeric rules.
   *
   * They are currently attached to WorkforceRules dynamically so the
   * attendance/fine calculation can use them without changing the
   * existing numeric rule model.
   */
  if (rule.property === 'CHECKIN_REQUIRED') {
    // handled by helper below
    setBooleanOverride(rules, 'checkInRequired', rule.value);
    return;
  }

  if (rule.property === 'CHECKOUT_REQUIRED') {
    setBooleanOverride(rules, 'checkOutRequired', rule.value);
    return;
  }

  if (rule.property === 'WORKING_DAY') {
    setBooleanOverride(rules, 'workingDay', rule.value);
  }
}

function setBooleanOverride(rules: WorkforceRules, key: string, value: string): void {
  (rules as WorkforceRules & Record<string, unknown>)[key] = value === 'true';
}

function getWeekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function loadEmployeeOverrides(config: ConfigService): Map<string, Partial<OverridableWorkforceRules>> {
  const employeeCodes = config
    .get<string>('WORKFORCE_OVERRIDE_RULE_EMPLOYEES', '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);

  const overrides = new Map<string, Partial<OverridableWorkforceRules>>();

  for (const code of employeeCodes) {
    const override: Partial<OverridableWorkforceRules> = {};

    for (const [envKey, field] of Object.entries(TIME_FIELDS)) {
      const raw = config.get<string>(`${code}_${envKey}`);

      if (raw) {
        override[field] = minutesOfDay(raw);
      }
    }

    for (const [envKey, field] of Object.entries(FINE_FIELDS)) {
      const raw = config.get<string>(`${code}_${envKey}`);

      if (raw) {
        override[field] = Number(raw);
      }
    }

    overrides.set(code, override);
  }

  return overrides;
}
