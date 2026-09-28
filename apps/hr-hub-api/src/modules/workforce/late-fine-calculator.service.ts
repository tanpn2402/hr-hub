import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

import { AttendanceRecord } from './models/attendance-record.model';
import { LeaveCoverage, LeaveCoverageMap, leaveCoverageKey } from './models/leave-coverage.model';
import { EmployeeFineSummary, LateFineReport, LateFineRow } from './models/late-fine-report.model';
import { WorkforceRules } from './models/workforce-rules.model';
import { formatMinutesOfDay, formatTimeOfDay, timeOfDayMinutes } from './utils/time.util';
import { WorkforceRulesService } from './workforce-rules.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { TraceContextService } from '../app/trace/trace-context.service';

@Injectable()
export class LateFineCalculatorService {
  private readonly logger: TraceLogger;

  constructor(
    private workforceRules: WorkforceRulesService,
    readonly traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, 'StageOneWorkforceService');
  }

  calculate(attendance: AttendanceRecord[], leave: LeaveCoverageMap): LateFineReport {
    const rows: LateFineRow[] = [];
    const totalsByEmployee = new Map<string, EmployeeFineSummary>();

    const baseRules = this.workforceRules.getBaseRules();
    for (const record of attendance) {
      if (baseRules.excludedEmployeeCodes.has(record.employeeCode)) continue; // e.g. staff who have since left the company

      const isHoliday = baseRules.holidays.has(record.date);
      if (isHoliday) continue;

      const makeupWorkday = baseRules.makeupWorkdays.get(record.date);

      const isMakeupWorkday = !!makeupWorkday;

      const isRequiredWorkday = baseRules.workdays.has(String(dayjs.utc(record.date).day())) || isMakeupWorkday;
      if (!isRequiredWorkday) continue; // fines only apply on configured working days, plus any configured compensatory ("làm bù") dates

      const coverage = (makeupWorkday
        ? leave.get(leaveCoverageKey(record.employeeCode, makeupWorkday.LeaveDate))
        : leave.get(leaveCoverageKey(record.employeeCode, record.date))) ?? { morning: false, afternoon: false };

      this.logger.debug(
        '[Employee ' +
          record.employeeCode +
          '] ' +
          '[calc] ' +
          JSON.stringify({
            date: record.date,
            isMakeupWorkday,
            makeupWorkday,
            coverage,
            attendance: record,
          }),
      );

      const rules = this.workforceRules.resolve(record.employeeCode, record.date);

      this.logger.debug(
        '[Employee ' +
          record.employeeCode +
          '] ' +
          '[rules] ' +
          JSON.stringify({
            date: record.date,
            rules,
          }),
      );

      const { fineAmount, note } = this.evaluateDay(record, coverage, isMakeupWorkday, rules);

      this.logger.debug(
        '[Employee ' +
          record.employeeCode +
          '] ' +
          '[evaluateDay] ' +
          JSON.stringify({
            date: record.date,
            fineAmount,
            note,
          }),
      );

      rows.push({
        employeeCode: record.employeeCode,
        employeeName: record.employeeName,
        date: record.date,
        checkIn: record.checkIn ? formatTimeOfDay(record.checkIn) : null,
        checkOut: record.checkOut ? formatTimeOfDay(record.checkOut) : null,
        note,
        fineAmount,
      });

      const summary = totalsByEmployee.get(record.employeeCode) ?? {
        employeeCode: record.employeeCode,
        employeeName: record.employeeName,
        totalFine: 0,
      };

      summary.totalFine = Math.min(summary.totalFine + Number(fineAmount ?? 0), rules.maxFinePerMonth);
      totalsByEmployee.set(record.employeeCode, summary);
    }

    const employeeSummaries = [...totalsByEmployee.values()];
    const grandTotal = employeeSummaries.reduce((sum, item) => sum + item.totalFine, 0);

    return { rows, employeeSummaries, grandTotal };
  }

  /**
   * Applies the four company rules for a single employee/day:
   *  1. Morning not on leave, no check-in or check-in after morningStart -> fineLateMorning
   *  2. Morning on leave (afternoon worked), no check-in or check-in after afternoonStart -> fineLateAfternoon
   *  3. Morning worked, afternoon on leave, no checkout or checkout before morningCheckoutDeadline (left too early) -> fineNoCheckoutHalfDay
   *  4. Full day expected (or afternoon worked after a morning leave), no checkout or checkout before
   *     afternoonCheckoutDeadline -> fineNoCheckoutFullDay
   * A full-day leave (both halves covered) is exempt from every fine. On a compensatory ("làm bù")
   * workday, rules 3 and 4 (early/missing checkout) are skipped - only late check-in is fined.
   * `rules` is the base config merged with any override registered for this employee (see
   * WORKFORCE_OVERRIDE_RULE_EMPLOYEES).
   */
  private evaluateDay(
    record: AttendanceRecord,
    coverage: LeaveCoverage,
    isMakeupWorkday: boolean,
    rules: WorkforceRules,
  ): { fineAmount: number; note: string | null } {
    if (coverage.morning && coverage.afternoon) {
      return { fineAmount: 0, note: 'P' };
    }

    const notes: string[] = [];
    if (coverage.morning) notes.push('P/2 (Nghỉ sáng)');
    else if (coverage.afternoon) notes.push('P/2 (Nghỉ chiều)');
    let fineAmount = 0;

    // No leave + no attendance at all
    if (!coverage.morning && !coverage.afternoon && !record.checkIn && !record.checkOut) {
      fineAmount += rules.fineLateMorning;
      fineAmount += rules.fineNoCheckoutFullDay;

      notes.push(`Không checkin/checkout (${formatMoney(rules.fineLateMorning + rules.fineNoCheckoutFullDay)})`);

      return {
        fineAmount,
        note: notes.join('; '),
      };
    }

    if (!coverage.morning) {
      if (!record.checkIn) {
        fineAmount += rules.fineLateMorning;
        notes.push(`Không có giờ vào buổi sáng (${formatMoney(rules.fineLateMorning)})`);
      } else if (timeOfDayMinutes(record.checkIn) > rules.morningStartMinutes) {
        fineAmount += rules.fineLateMorning;
        notes.push(`Trễ giờ vào buổi sáng (${formatMinutesOfDay(rules.morningStartMinutes)} - ${formatMoney(rules.fineLateMorning)})`);
      }
    } else if (!record.checkIn) {
      fineAmount += rules.fineLateAfternoon;
      notes.push(`Không có giờ vào buổi chiều (${formatMoney(rules.fineLateAfternoon)})`);
    } else if (timeOfDayMinutes(record.checkIn) > rules.afternoonStartMinutes) {
      fineAmount += rules.fineLateAfternoon;
      notes.push(`Trễ giờ vào buổi chiều (${formatMinutesOfDay(rules.afternoonStartMinutes)} - ${formatMoney(rules.fineLateAfternoon)})`);
    }

    if (!isMakeupWorkday) {
      if (coverage.afternoon) {
        if (!record.checkOut || timeOfDayMinutes(record.checkOut) < rules.morningCheckoutDeadlineMinutes) {
          fineAmount += rules.fineNoCheckoutHalfDay;
          notes.push(
            `Checkout trước giờ quy định (nghỉ chiều) (${formatMinutesOfDay(rules.morningCheckoutDeadlineMinutes)} - ${formatMoney(rules.fineNoCheckoutHalfDay)})`,
          );
        }
      } else if (!record.checkOut || timeOfDayMinutes(record.checkOut) < rules.afternoonCheckoutDeadlineMinutes) {
        fineAmount += rules.fineNoCheckoutFullDay;
        notes.push(
          `Không checkout sau giờ quy định (${formatMinutesOfDay(rules.afternoonCheckoutDeadlineMinutes)} - ${formatMoney(rules.fineNoCheckoutFullDay)})`,
        );
      }
    }

    return { fineAmount, note: notes.length > 0 ? notes.join('; ') : null };
  }
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}
