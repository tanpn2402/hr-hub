import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { LeaveCoverageMap, leaveCoverageKey } from '../models/leave-coverage.model';
import { WorkforceRules } from '../models/workforce-rules.model';
import { isoDate, nextLocalDay, startOfLocalDay, timeOfDayMinutes } from '../utils/time.util';
import { TraceLogger } from '@app/modules/app/trace/trace-logger.service';
import dayjs from 'dayjs';

interface WorkforceRuleResolver {
  resolve(employeeCode: string, date: string | Date): WorkforceRules;
}

/** Parses the "leavedetailsreportbydate_*.xlsx" workbook into per-day AM/PM leave coverage. */
export function parseLeaveWorkbook(workbook: XLSX.WorkBook, ruleResolver: WorkforceRuleResolver, logger?: TraceLogger): LeaveCoverageMap {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new BadRequestException('Leave workbook has no sheets');
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalize(cell) === 'placement number'));
  if (headerIndex === -1) {
    throw new BadRequestException('Unable to locate header row in leave workbook (expected column "Placement Number")');
  }

  let employeeCodeIndex = -1;
  let leaveFromIndex = -1;
  let leaveToIndex = -1;
  let leaveStatusIndex = -1;
  rows[headerIndex].forEach((cell, index) => {
    const key = normalize(cell);
    if (key === 'placement number') employeeCodeIndex = index;
    if (key === 'leave from') leaveFromIndex = index;
    if (key === 'leave to') leaveToIndex = index;
    if (key === 'status') leaveStatusIndex = index;
  });

  if (employeeCodeIndex === -1 || leaveFromIndex === -1 || leaveToIndex === -1 || leaveStatusIndex === -1) {
    throw new BadRequestException('Leave workbook is missing expected columns "Placement Number" / "Leave From" / "Leave To" / "Status"');
  }

  const coverage: LeaveCoverageMap = new Map();
  for (const row of rows.slice(headerIndex + 1)) {
    const employeeCode = String(row[employeeCodeIndex] ?? '').trim();
    const leaveFrom = row[leaveFromIndex];
    const leaveTo = row[leaveToIndex];
    const leaveStatus = normalize(row[leaveStatusIndex]);

    if (employeeCode === '510') {
      logger?.debug(
        '[parseLeaveWorkbook]' +
          JSON.stringify({
            employeeCode,
            leaveFrom,
            leaveTo,
            leaveStatus,
          }),
      );
    }

    if (!employeeCode || !(leaveFrom instanceof Date) || !(leaveTo instanceof Date)) continue;

    if (leaveStatus === 'rejected' || leaveStatus === 'cancelled') {
      logger?.debug(
        '[parseLeaveWorkbook] skipping leave for employee ' +
          employeeCode +
          ' from ' +
          leaveFrom +
          ' to ' +
          leaveTo +
          ' due to status: ' +
          leaveStatus,
      );
      continue;
    }

    const employeeRules = ruleResolver.resolve(employeeCode, dayjs.utc(leaveFrom).toDate());
    markDailyCoverage(coverage, employeeCode, leaveFrom, leaveTo, employeeRules, logger);
  }

  return coverage;
}

/**
 * Marks each calendar day spanned by [leaveFrom, leaveTo] as morning/afternoon covered.
 * A multi-day leave is treated as fully off on every day strictly between the first and last;
 * the first/last day's coverage instead depends on the actual start/end time of the request.
 */
function markDailyCoverage(
  coverage: LeaveCoverageMap,
  employeeCode: string,
  leaveFrom: Date,
  leaveTo: Date,
  rules: WorkforceRules,
  logger?: TraceLogger,
): void {
  const lastDay = startOfLocalDay(leaveTo);
  const isSingleDay = startOfLocalDay(leaveFrom).getTime() === lastDay.getTime();

  for (let cursor = startOfLocalDay(leaveFrom); cursor.getTime() <= lastDay.getTime(); cursor = nextLocalDay(cursor)) {
    const isFirstDay = cursor.getTime() === startOfLocalDay(leaveFrom).getTime();
    const isLastDay = cursor.getTime() === lastDay.getTime();

    logger?.debug('[Employee ' + employeeCode + '] ' + '[markDailyCoverage]' + JSON.stringify({ cursor }));

    let morning: boolean;
    let afternoon: boolean;
    if (isSingleDay) {
      morning = timeOfDayMinutes(leaveFrom) <= rules.leaveDayStartMinutes;
      afternoon = timeOfDayMinutes(leaveTo) >= rules.leaveDayEndMinutes;
    } else if (isFirstDay) {
      morning = timeOfDayMinutes(leaveFrom) <= rules.leaveDayStartMinutes;
      afternoon = true;
    } else if (isLastDay) {
      morning = true;
      afternoon = timeOfDayMinutes(leaveTo) >= rules.leaveDayEndMinutes;
    } else {
      morning = true;
      afternoon = true;
    }

    const key = leaveCoverageKey(employeeCode, isoDate(cursor));
    const existing = coverage.get(key) ?? { morning: false, afternoon: false };
    const leave = { morning: existing.morning || morning, afternoon: existing.afternoon || afternoon };

    logger?.debug('[Employee ' + employeeCode + '] ' + '[markDailyCoverage]' + JSON.stringify({ key, existing, leave }));

    coverage.set(key, leave);
  }
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
