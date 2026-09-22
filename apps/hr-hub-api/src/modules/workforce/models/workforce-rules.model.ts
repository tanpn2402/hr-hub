import { ConfigService } from '@nestjs/config';
import { minutesOfDay, parseDdMmYyyy } from '../utils/time.util';

/** Numeric rule fields that can be overridden per employee via `<Mã NV>_<ENV_KEY>` in .env. */
export interface OverridableWorkforceRules {
  /** Morning check-in must be at or before this time, otherwise it counts as late (rule 1). */
  morningStartMinutes: number;
  /** End of the morning shift. */
  morningEndMinutes: number;
  /** Required checkout time when the afternoon is on leave (rule 3). */
  morningCheckoutDeadlineMinutes: number;
  /** Afternoon check-in must be at or before this time when the morning was on leave (rule 2). */
  afternoonStartMinutes: number;
  /** Required checkout time for a day that runs into the afternoon (rule 4). */
  afternoonCheckoutDeadlineMinutes: number;
  /** Start of the leave system's "morning" half-day window, used to detect whether a leave request covers it. */
  leaveDayStartMinutes: number;
  /** End of the leave system's "afternoon" half-day window, used to detect whether a leave request covers it. */
  leaveDayEndMinutes: number;
  fineLateMorning: number;
  fineLateAfternoon: number;
  fineNoCheckoutHalfDay: number;
  fineNoCheckoutFullDay: number;
}

export interface WorkforceRules extends OverridableWorkforceRules {
  /** Vietnamese weekday labels (as printed in the attendance file) that the fine rules apply to. */
  workdays: Set<string>;
  /** Extra calendar dates (ISO yyyy-MM-dd) that count as required workdays even on an off-day - e.g. a compensatory "ngày làm bù" scheduled on a Saturday. */
  makeupWorkdays: Map<string, { LeaveDate: string }>;
  /** Employee codes (Mã NV) to exclude entirely from the report - e.g. staff who have since left the company. */
  excludedEmployeeCodes: Set<string>;
  /** Holidays */
  holidays: Set<string>;
  /** Max fine per month */
  maxFinePerMonth: number;
  /** Per-employee overrides for the fields above, keyed by Mã NV (see WORKFORCE_OVERRIDE_RULE_EMPLOYEES). */
  employeeOverrides: Map<string, Partial<OverridableWorkforceRules>>;
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

export function loadWorkforceRules(config: ConfigService): WorkforceRules {
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

/** Merges the base rules with any per-employee override registered for `employeeCode`. */
export function effectiveRules(rules: WorkforceRules, employeeCode: string): WorkforceRules {
  const override = rules.employeeOverrides.get(employeeCode);
  return override ? { ...rules, ...override } : rules;
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
      if (raw) override[field] = minutesOfDay(raw);
    }
    for (const [envKey, field] of Object.entries(FINE_FIELDS)) {
      const raw = config.get<string>(`${code}_${envKey}`);
      if (raw) override[field] = Number(raw);
    }

    overrides.set(code, override);
  }
  return overrides;
}
