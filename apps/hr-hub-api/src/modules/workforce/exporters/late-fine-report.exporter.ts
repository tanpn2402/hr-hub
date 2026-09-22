import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import ExcelJS from 'exceljs';
import { LateFineReport, LateFineRow } from '../models/late-fine-report.model';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const NAVY = 'FF1F3864';
const BLUE_HEADER = 'FF2E75B6';
const WHITE = 'FFFFFFFF';
const TEXT_NAVY = 'FF1F3864';
const ROW_WHITE = 'FFFFFFFF';
const ROW_BANDED = 'FFEBF3FB';
const SUBTOTAL_FILL = 'FFBDD7EE';
const GRAND_TOTAL_FILL = 'FFC00000';
const FINE_FILL = 'FFFFC7CE';
const NO_FINE_FILL = 'FFFFEB9C';

const HEADERS = ['Mã NV', 'Tên nhân viên', 'Ngày', 'Thứ', 'Giờ vào', 'Giờ ra', 'Ghi chú', 'Phạt đi trễ (VNĐ)'];

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function styleRow(row: ExcelJS.Row, opts: { bold?: boolean; size?: number; color?: string; fill?: string; center?: boolean }): void {
  for (let col = 1; col <= HEADERS.length; col++) {
    const cell = row.getCell(col);
    cell.font = { name: 'Calibri', bold: opts.bold ?? false, size: opts.size ?? 10, color: opts.color ? { argb: opts.color } : undefined };
    if (opts.fill) cell.fill = solidFill(opts.fill);
    if (opts.center) cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
}

// ExcelJS always serializes a JS Date's *UTC* fields into the workbook, regardless of the
// server's local timezone (the opposite convention from the xlsx/SheetJS reader used elsewhere
// in this module, which reproduces the naive value through the *local* fields) - so date/time
// cells here must be parsed in UTC mode, not the local timezone.
function excelDate(dateIso: string, time?: string | null): Date {
  return time ? dayjs.utc(`${dateIso} ${time}`, 'YYYY-MM-DD HH:mm').toDate() : dayjs.utc(dateIso, 'YYYY-MM-DD').toDate();
}

function dayOfWeek(date: string | Date) {
  const dayNames = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

  return dayNames[dayjs(date).day()];
}

/** Builds a single-sheet .xlsx report: day-by-day detail, a "Tổng: <name>" subtotal per employee, and a company grand total. */
export async function buildLateFineReportWorkbook(report: LateFineReport): Promise<Buffer> {
  const firstRow: LateFineRow | undefined = report.rows[0];
  const referenceDate = dayjs(firstRow?.date ?? '1970-01-01', 'YYYY-MM-DD');
  const month = referenceDate.month() + 1;
  const year = referenceDate.year();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Báo cáo đi trễ T${month}.${year}`);

  sheet.columns = [{ width: 10 }, { width: 28 }, { width: 14 }, { width: 8 }, { width: 11 }, { width: 13 }, { width: 40 }, { width: 22 }];

  const titleRow = sheet.addRow([`BÁO CÁO ĐI TRỄ THÁNG ${month}/${year} - TTL VIETNAM`]);
  titleRow.height = 24;
  sheet.mergeCells(titleRow.number, 1, titleRow.number, HEADERS.length);
  styleRow(titleRow, { bold: true, size: 13, color: WHITE, fill: NAVY });

  const headerRow = sheet.addRow(HEADERS);
  styleRow(headerRow, { bold: true, size: 10, color: WHITE, fill: BLUE_HEADER, center: true });

  let currentEmployeeCode: string | null = null;
  let currentEmployeeName = '';
  let employeeFineTotal = 0;
  let bandIndex = 0;

  const closeEmployeeBlock = (): void => {
    if (currentEmployeeCode === null) return;
    const row = sheet.addRow([currentEmployeeCode, `Tổng: ${currentEmployeeName}`, null, null, null, null, null, employeeFineTotal]);
    row.getCell(8).numFmt = '#,##0';
    styleRow(row, { bold: true, color: TEXT_NAVY, fill: SUBTOTAL_FILL });
  };

  for (const dataRow of report.rows) {
    if (currentEmployeeCode !== null && currentEmployeeCode !== dataRow.employeeCode) {
      closeEmployeeBlock();
      bandIndex = 0;
    }
    if (currentEmployeeCode !== dataRow.employeeCode) {
      currentEmployeeCode = dataRow.employeeCode;
      currentEmployeeName = dataRow.employeeName;
      employeeFineTotal = 0;
    }

    const date = excelDate(dataRow.date);
    const checkInDate = dataRow.checkIn ? excelDate(dataRow.date, dataRow.checkIn) : null;
    const checkOutDate = dataRow.checkOut ? excelDate(dataRow.date, dataRow.checkOut) : null;

    const row = sheet.addRow([
      dataRow.employeeCode,
      dataRow.employeeName,
      date,
      dayOfWeek(date),
      checkInDate,
      checkOutDate,
      dataRow.note,
      dataRow.fineAmount,
    ]);
    row.getCell(3).numFmt = 'mm-dd-yy';
    if (checkInDate) row.getCell(5).numFmt = 'hh:mm';
    if (checkOutDate) row.getCell(6).numFmt = 'hh:mm';
    row.getCell(8).numFmt = '#,##0';

    const banded = bandIndex % 2 === 1 ? ROW_BANDED : ROW_WHITE;
    for (let col = 1; col <= HEADERS.length; col++) {
      const cell = row.getCell(col);
      cell.font = { name: 'Calibri', size: 10 };
      if (col !== 8) cell.fill = solidFill(banded);
    }
    row.getCell(8).fill = solidFill(dataRow.fineAmount > 0 ? FINE_FILL : NO_FINE_FILL);

    employeeFineTotal += dataRow.fineAmount;
    bandIndex++;
  }
  closeEmployeeBlock();

  sheet.addRow([]);
  const grandRow = sheet.addRow(['TỔNG CỘNG TOÀN CÔNG TY', null, null, null, null, null, null, report.grandTotal]);
  grandRow.getCell(8).numFmt = '#,##0';
  styleRow(grandRow, { bold: true, size: 11, color: WHITE, fill: GRAND_TOTAL_FILL });

  sheet.views = [{ state: 'frozen', ySplit: 2 }];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
