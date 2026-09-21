import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LateFineCalculatorService } from './late-fine-calculator.service';
import { parseAttendanceWorkbook } from './parsers/attendance-workbook.parser';
import { parseLeaveWorkbook } from './parsers/leave-workbook.parser';
import * as XLSX from 'xlsx';
import { ConfirmWorkforceImportDto, OverrideWorkforceRowDto } from './dto/confirm-workforce-import.dto';
import { AuthenticatedUser } from '../auth/auth.types';

type PreviewRow = {
  rowId: string;
  employeeCode: string;
  employeeName: string | null;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  note: string | null;
  fineAmount: number;
};

type PreviewData = {
  rows: PreviewRow[];
  leaves: Array<{
    employeeCode: string;
    date: string;
    type: string;
  }>;
};

@Injectable()
export class StageOneWorkforceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: LateFineCalculatorService,
  ) {}

  // @ts-ignore
  async preview(files: Express.Multer.File[], user?: AuthenticatedUser) {
    if (!files || files.length !== 2) throw new BadRequestException('Exactly two Excel files are required');

    const attendanceFiles = files.filter((file) => /bcc/i.test(file.originalname));

    if (attendanceFiles.length !== 1) throw new BadRequestException('Exactly one attendance file name must contain BCC');

    const attendanceFile = attendanceFiles[0];
    const leaveFile = files.find((file) => file !== attendanceFile)!;
    const attendance = parseAttendanceWorkbook(this.read(attendanceFile), this.calculator.rules);
    const leaveCoverage = parseLeaveWorkbook(this.read(leaveFile), this.calculator.rules);
    const report = this.calculator.calculate(attendance, leaveCoverage);

    const rows: PreviewRow[] = report.rows.map((row, index) => ({
      ...row,
      rowId: `row_${String(index + 1).padStart(6, '0')}`,
    }));

    const leaves = [...leaveCoverage.entries()].map(([key, value]) => {
      const [employeeCode, date] = key.split('|');
      return {
        employeeCode,
        date,
        type: value.morning && value.afternoon ? 'full_day' : value.morning ? 'morning' : 'afternoon',
      };
    });

    const employeeSummaries = new Map<
      string,
      {
        employeeCode: string;
        employeeName: string | null;
        totalFine: number;
        attendanceCount: number;
      }
    >();

    for (const row of rows) {
      let employee = employeeSummaries.get(row.employeeCode);

      if (!employee) {
        employee = {
          employeeCode: row.employeeCode,
          employeeName: row.employeeName,
          totalFine: 0,
          attendanceCount: 0,
        };

        employeeSummaries.set(row.employeeCode, employee);
      }

      employee.attendanceCount++;
      employee.totalFine += Number(row.fineAmount ?? 0);
    }

    const batch = await this.prisma.workforceImport.create({
      data: {
        month: '2026-08',
        attendanceFileName: attendanceFile.originalname,
        leaveFileName: leaveFile.originalname,
        totalAttendance: rows.length,
        totalLeave: leaves.length,
        totalFine: rows.reduce((sum, row) => sum + row.fineAmount, 0),
        previewData: JSON.stringify({ rows, leaves }),
        createdBy: user?.id,
        createdByName: user?.username ?? user?.email,
      },
    });

    return {
      batchId: batch.id,
      status: 'preview',
      employeeSummaries: Array.from(employeeSummaries.values()),
      rows,
      grandTotal: batch.totalFine,
    };
  }

  async confirm(batchId: string, dto: ConfirmWorkforceImportDto) {
    const batch = await this.prisma.workforceImport.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundException('Import batch not found');
    }

    if (batch.status !== 'preview') {
      throw new ConflictException('Import batch has already been processed');
    }

    const data = this.parseData(batch.previewData);

    const rows = this.applyOverrides(data.rows, dto?.overrideRows ?? []);

    this.validateRows(rows);

    const names = new Map(rows.map((row) => [row.employeeCode, row.employeeName]));

    await this.prisma.$transaction(async (tx) => {
      const claimed = await (tx as any).workforceImport.updateMany({
        where: {
          id: batchId,
          status: 'preview',
        },
        data: {
          status: 'confirmed',
          confirmedAt: new Date(),
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException('Import batch has already been processed');
      }

      /*
       * The business key is:
       *   employeeCode + date
       * Remove existing imported data before inserting the new version.
       */
      const attendanceKeys = rows.map((row) => ({
        employeeCode: row.employeeCode,
        date: dbDate(row.date),
      }));

      const leaveKeys = data.leaves.map((row) => ({
        employeeCode: row.employeeCode,
        date: dbDate(row.date),
      }));

      const fineKeys = rows.map((row) => ({
        employeeCode: row.employeeCode,
        date: dbDate(row.date),
      }));

      /*
       * Delete existing records first.
       *
       * FineFeedback must be removed before Fine because feedback
       * references Fine.
       */
      if (fineKeys.length) {
        for (const key of fineKeys) {
          const existingFines = await tx.fine.findMany({
            where: {
              employeeCode: key.employeeCode,
              date: key.date,
            },
            select: {
              id: true,
            },
          });

          if (existingFines.length) {
            await tx.fineFeedback.deleteMany({
              where: {
                fineId: {
                  in: existingFines.map((fine) => fine.id),
                },
              },
            });
          }

          await tx.fine.deleteMany({
            where: {
              employeeCode: key.employeeCode,
              date: key.date,
            },
          });
        }
      }

      if (attendanceKeys.length) {
        for (const key of attendanceKeys) {
          await tx.attendance.deleteMany({
            where: {
              employeeCode: key.employeeCode,
              date: key.date,
            },
          });
        }
      }

      if (leaveKeys.length) {
        for (const key of leaveKeys) {
          await tx.leave.deleteMany({
            where: {
              employeeCode: key.employeeCode,
              date: key.date,
            },
          });
        }
      }

      /*
       * Insert the confirmed data.
       */
      if (rows.length) {
        await tx.attendance.createMany({
          data: rows.map((row) => ({
            employeeCode: row.employeeCode,
            employeeName: row.employeeName,
            date: dbDate(row.date),
            checkIn: dbTime(row.date, row.checkIn),
            checkOut: dbTime(row.date, row.checkOut),
            note: row.note,
          })),
        });
      }

      if (data.leaves.length) {
        await tx.leave.createMany({
          data: data.leaves.map((row) => ({
            employeeCode: row.employeeCode,
            employeeName: names.get(row.employeeCode) ?? null,
            date: dbDate(row.date),
            type: row.type,
            status: 'approved',
          })),
        });
      }

      const fines = rows.filter((row) => row.fineAmount > 0);

      if (fines.length) {
        await tx.fine.createMany({
          data: fines.map((row) => ({
            employeeCode: row.employeeCode,
            employeeName: row.employeeName,
            date: dbDate(row.date),
            amount: row.fineAmount,
            type: 'attendance',
            reason: row.note,
            status: 'unpaid',
          })),
        });
      }

      await (tx as any).workforceImport.update({
        where: { id: batchId },
        data: {
          totalFine: rows.reduce((sum, row) => sum + row.fineAmount, 0),
        },
      });
    });

    return {
      batchId,
      status: 'confirmed',
    };
  }

  async list() {
    return this.prisma.workforceImport.findMany({
      select: {
        id: true,
        status: true,
        attendanceFileName: true,
        leaveFileName: true,
        totalAttendance: true,
        totalLeave: true,
        totalFine: true,
        createdAt: true,
        confirmedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(batchId: string) {
    const result = await this.prisma.workforceImport.findUnique({ where: { id: batchId } });
    if (!result) throw new NotFoundException('Import batch not found');
    // return { ...result, previewData: this.parseData(result.previewData) };

    const previewData = this.parseData(result.previewData);

    const employeeSummaries = new Map<
      string,
      {
        employeeCode: string;
        employeeName: string | null;
        totalFine: number;
        attendanceCount: number;
      }
    >();

    for (const row of previewData.rows) {
      let employee = employeeSummaries.get(row.employeeCode);

      if (!employee) {
        employee = {
          employeeCode: row.employeeCode,
          employeeName: row.employeeName,
          totalFine: 0,
          attendanceCount: 0,
        };

        employeeSummaries.set(row.employeeCode, employee);
      }

      employee.attendanceCount++;
      employee.totalFine += Number(row.fineAmount ?? 0);
    }

    return {
      batchId: result.id,
      status: result.status,
      employeeSummaries: Array.from(employeeSummaries.values()),
      rows: previewData.rows,
      grandTotal: result.totalFine,
    };
  }

  // @ts-ignore
  private read(file: Express.Multer.File) {
    try {
      return XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    } catch {
      throw new BadRequestException(`Unable to read Excel file: ${file.originalname}`);
    }
  }

  private parseData(value: string | null): PreviewData {
    try {
      const data = JSON.parse(value ?? '');
      if (!Array.isArray(data.rows) || !Array.isArray(data.leaves)) throw new Error();
      return data;
    } catch {
      throw new BadRequestException('Import batch preview data is invalid');
    }
  }

  private applyOverrides(original: PreviewRow[], overrides: OverrideWorkforceRowDto[]) {
    if (!Array.isArray(overrides)) throw new BadRequestException('overrideRows must be an array');
    const map = new Map(original.map((row) => [row.rowId, row]));
    const seen = new Set<string>();
    for (const item of overrides) {
      if (!item || typeof item.rowId !== 'string' || !map.has(item.rowId))
        throw new BadRequestException('Override rowId does not belong to this batch');
      if (seen.has(item.rowId)) throw new BadRequestException('A row may only be overridden once');
      seen.add(item.rowId);
      if (
        Object.keys(item).some(
          (key) => !['rowId', 'employeeCode', 'employeeName', 'date', 'checkIn', 'checkOut', 'note', 'fineAmount'].includes(key),
        )
      )
        throw new BadRequestException('Invalid override field');
      map.set(item.rowId, { ...map.get(item.rowId)!, ...item, rowId: item.rowId });
    }
    return [...map.values()];
  }

  private validateRows(rows: PreviewRow[]) {
    for (const row of rows) {
      if (!row.employeeCode?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || Number.isNaN(Date.parse(`${row.date}T00:00:00Z`)))
        throw new BadRequestException(`Invalid employee or date for ${row.rowId}`);
      for (const time of [row.checkIn, row.checkOut])
        if (time !== null && (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))
          throw new BadRequestException(`Invalid time for ${row.rowId}`);
      if (!Number.isInteger(row.fineAmount) || row.fineAmount < 0) throw new BadRequestException(`Invalid fine amount for ${row.rowId}`);
    }
  }
}

function dbDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function dbTime(date: string, time: string | null) {
  return time ? new Date(`${date}T${time}:00.000Z`) : null;
}
