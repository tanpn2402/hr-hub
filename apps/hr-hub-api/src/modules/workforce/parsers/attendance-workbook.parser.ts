import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { AttendanceRecord } from '../models/attendance-record.model';
import { effectiveRules, WorkforceRules } from '../models/workforce-rules.model';
import { isoDate, timeOfDayMinutes } from '../utils/time.util';

type AttendanceColumn = 'employeeCode' | 'employeeName' | 'date' | 'checkIn' | 'checkOut';

const COLUMN_ALIASES: Record<string, AttendanceColumn> = {
  'mã nhân viên': 'employeeCode',
  'tên nhân viên': 'employeeName',
  ngày: 'date',
  'giờ vào': 'checkIn',
  'giờ ra': 'checkOut',
};

const REQUIRED_COLUMNS: AttendanceColumn[] = ['employeeCode', 'employeeName', 'date', 'checkIn', 'checkOut'];

/** Parses the "BCC_<Mon>.<Year>.xlsx" check-in/checkout workbook into one record per employee/day. */
export function parseAttendanceWorkbook(workbook: XLSX.WorkBook, rules: WorkforceRules): AttendanceRecord[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new BadRequestException('Attendance workbook has no sheets');
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalize(cell) === 'mã nhân viên'));
  if (headerIndex === -1) {
    throw new BadRequestException('Unable to locate header row in attendance workbook (expected column "Mã nhân viên")');
  }

  const columnIndex = new Map<AttendanceColumn, number>();
  rows[headerIndex].forEach((cell, index) => {
    const mapped = COLUMN_ALIASES[normalize(cell)];
    if (mapped) columnIndex.set(mapped, index);
  });

  for (const column of REQUIRED_COLUMNS) {
    if (!columnIndex.has(column)) {
      throw new BadRequestException(`Attendance workbook is missing expected column for "${column}"`);
    }
  }

  const records: AttendanceRecord[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const dateCell = row[columnIndex.get('date')!];
    if (!(dateCell instanceof Date)) continue;

    const employeeCode = String(row[columnIndex.get('employeeCode')!] ?? '').trim();
    if (!employeeCode) continue;

    let checkIn = toDateOrNull(row[columnIndex.get('checkIn')!]);
    let checkOut = toDateOrNull(row[columnIndex.get('checkOut')!]);

    // The timekeeping system always puts a lone scan in the "Giờ vào" column, even when it's
    // clearly a departure (e.g. a forgotten morning badge, scanned only once on the way out). If
    // that lone value falls after the end of the morning shift, treat it as a checkout instead.
    const employeeRules = effectiveRules(rules, employeeCode);
    if (checkIn && !checkOut && timeOfDayMinutes(checkIn) > employeeRules.morningEndMinutes) {
      checkOut = checkIn;
      checkIn = null;
    }

    records.push({
      employeeCode,
      employeeName: String(row[columnIndex.get('employeeName')!] ?? '').trim(),
      date: isoDate(dateCell),
      checkIn,
      checkOut,
    });
  }

  return records;
}

function toDateOrNull(value: unknown): Date | null {
  return value instanceof Date ? value : null;
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
