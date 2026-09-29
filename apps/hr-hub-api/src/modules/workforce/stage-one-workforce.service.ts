import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

import { PrismaService } from '../../prisma/prisma.service';
import { LateFineCalculatorService } from './late-fine-calculator.service';
import { parseAttendanceWorkbook } from './parsers/attendance-workbook.parser';
import { parseLeaveWorkbook } from './parsers/leave-workbook.parser';
import { ConfirmWorkforceImportDto, OverrideWorkforceRowDto } from './dto/confirm-workforce-import.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { TraceContextService } from '../app/trace/trace-context.service';
import { WorkforceRulesService } from './workforce-rules.service';

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
  private readonly logger: TraceLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: LateFineCalculatorService,
    private readonly workforceRules: WorkforceRulesService,
    readonly traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, 'StageOneWorkforceService');
  }

  // @ts-ignore
  async preview(files: Express.Multer.File[], user?: AuthenticatedUser) {
    if (!files || files.length !== 2) throw new BadRequestException('Exactly two Excel files are required');

    const attendanceFiles = files.filter((file) => /bcc/i.test(file.originalname));

    if (attendanceFiles.length !== 1) throw new BadRequestException('Exactly one attendance file name must contain BCC');

    const attendanceFile = attendanceFiles[0];
    const leaveFile = files.find((file) => file !== attendanceFile)!;
    const attendance = parseAttendanceWorkbook(this.read(attendanceFile), {
      resolve: (employeeCode, date) => this.workforceRules.resolve(employeeCode, date),
    });
    const leaveCoverage = parseLeaveWorkbook(
      this.read(leaveFile),
      {
        resolve: (employeeCode, date) => this.workforceRules.resolve(employeeCode, date),
      },
      this.logger,
    );

    const report = this.calculator.calculate(attendance, leaveCoverage);

    const dates = attendance.map((record) => record.date);
    const firstDate = dates.length ? Math.min(...dates.map(Date.parse)) : null;
    const lastDate = dates.length ? Math.max(...dates.map(Date.parse)) : null;
    const isSameMonth = dayjs(firstDate).isSame(lastDate, 'month');

    if (!isSameMonth) {
      throw new BadRequestException('Not same month exception: first-date: ' + firstDate + ', last-date: ' + lastDate);
    }

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

      const employeeRules = this.workforceRules.resolve(row.employeeCode, row.date);
      employee.totalFine = Math.min(employee.totalFine + Number(row.fineAmount ?? 0), employeeRules.maxFinePerMonth);
    }

    const batch = await this.prisma.workforceImport.create({
      data: {
        month: dayjs(dates[0]).format('YYYY-MM'),
        attendanceFileName: attendanceFile.originalname,
        leaveFileName: leaveFile.originalname,
        totalAttendance: rows.length,
        totalLeave: leaves.length,
        totalFine: Array.from(employeeSummaries.values()).reduce((sum, employee) => sum + employee.totalFine, 0),
        previewData: JSON.stringify({ rows, leaves }),
        createdBy: user?.id,
        createdByName: user?.username ?? user?.email,
      },
    });

    this.logger.log(`Import batch ${batch.month}`);

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
      /*
       * ------------------------------------------------------------
       * Claim import batch
       * ------------------------------------------------------------
       */

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
       * ------------------------------------------------------------
       * Business keys
       * ------------------------------------------------------------
       */

      const attendanceKeys = rows.map((row) => ({
        employeeCode: row.employeeCode,
        date: dbDate(row.date),
      }));

      const leaveKeys = data.leaves.map((row) => ({
        employeeCode: row.employeeCode,
        date: dbDate(row.date),
      }));

      const fineKeys = rows
        .filter((row) => row.fineAmount > 0)
        .map((row) => ({
          employeeCode: row.employeeCode,
          date: dbDate(row.date),
        }));

      /*
       * ------------------------------------------------------------
       * Helpers
       * ------------------------------------------------------------
       */

      const businessKey = (employeeCode: string, date: Date) => {
        return `${employeeCode}|${dayjs(date).format('YYYY-MM-DD')}`;
      };

      /*
       * ------------------------------------------------------------
       * Preserve existing FineFeedback
       *
       * Fine IDs are regenerated during import, so preserve the
       * feedback first and attach it to the new Fine later.
       * ------------------------------------------------------------
       */

      type PreservedFeedback = {
        employeeCode: string;
        employeeName: string | null;
        reason: string;
        description: string | null;
        status: string;
        reductionAmount: number | null;
        reviewedBy: string | null;
        reviewedByName: string | null;
        reviewedAt: Date | null;
        reviewNote: string | null;
      };

      const preservedFeedback = new Map<string, PreservedFeedback[]>();

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

          if (!existingFines.length) {
            continue;
          }

          const existingFeedback = await tx.fineFeedback.findMany({
            where: {
              fineId: {
                in: existingFines.map((fine) => fine.id),
              },
            },
          });

          if (existingFeedback.length) {
            preservedFeedback.set(
              businessKey(key.employeeCode, key.date),
              existingFeedback.map((feedback) => ({
                employeeCode: feedback.employeeCode,
                employeeName: feedback.employeeName,
                reason: feedback.reason,
                description: feedback.description,
                status: feedback.status,
                reductionAmount: feedback.reductionAmount,
                reviewedBy: feedback.reviewedBy,
                reviewedByName: feedback.reviewedByName,
                reviewedAt: feedback.reviewedAt,
                reviewNote: feedback.reviewNote,
              })),
            );
          }

          /*
           * FineFeedback references Fine, so remove feedback first.
           */
          await tx.fineFeedback.deleteMany({
            where: {
              fineId: {
                in: existingFines.map((fine) => fine.id),
              },
            },
          });

          await tx.fine.deleteMany({
            where: {
              employeeCode: key.employeeCode,
              date: key.date,
            },
          });
        }
      }

      /*
       * ------------------------------------------------------------
       * Replace Attendance
       * ------------------------------------------------------------
       */

      for (const key of attendanceKeys) {
        await tx.attendance.deleteMany({
          where: {
            employeeCode: key.employeeCode,
            date: key.date,
          },
        });
      }

      /*
       * ------------------------------------------------------------
       * Replace Leave
       * ------------------------------------------------------------
       */

      for (const key of leaveKeys) {
        await tx.leave.deleteMany({
          where: {
            employeeCode: key.employeeCode,
            date: key.date,
          },
        });
      }

      /*
       * ------------------------------------------------------------
       * Insert Attendance
       * ------------------------------------------------------------
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

      /*
       * ------------------------------------------------------------
       * Insert Leave
       * ------------------------------------------------------------
       */

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

      /*
       * ------------------------------------------------------------
       * Insert Fine
       * ------------------------------------------------------------
       */

      const fines = rows.filter((row) => row.fineAmount > 0);

      /*
       * employeeCode|yyyy-MM-dd -> new Fine.id
       */
      const fineByKey = new Map<string, string>();

      if (fines.length) {
        for (const row of fines) {
          const date = dbDate(row.date);

          const fine = await tx.fine.create({
            data: {
              employeeCode: row.employeeCode,
              employeeName: row.employeeName,
              date,
              amount: row.fineAmount,
              type: 'attendance',
              reason: row.note,
              status: 'unpaid',
            },
          });

          fineByKey.set(businessKey(row.employeeCode, date), fine.id);
        }
      }

      /*
       * ------------------------------------------------------------
       * Restore FineFeedback
       *
       * Also restore Fine.adjustedAmount based on approved
       * feedback.
       * ------------------------------------------------------------
       */

      for (const [key, feedbackList] of preservedFeedback) {
        const fineId = fineByKey.get(key);

        /*
         * The new import no longer has a fine for this date.
         * There is nothing to attach the feedback to.
         */
        if (!fineId) {
          continue;
        }

        const fine = await tx.fine.findUnique({
          where: {
            id: fineId,
          },
          select: {
            amount: true,
          },
        });

        if (!fine) {
          continue;
        }

        const approvedReduction = feedbackList
          .filter((feedback) => feedback.status === 'approved')
          .reduce((sum, feedback) => sum + (feedback.reductionAmount ?? 0), 0);

        /*
         * Never allow adjustedAmount below zero.
         */
        const adjustedAmount = Math.max(0, fine.amount - approvedReduction);

        await tx.fine.update({
          where: {
            id: fineId,
          },
          data: {
            adjustedAmount,
          },
        });

        await tx.fineFeedback.createMany({
          data: feedbackList.map((feedback) => ({
            fineId,
            employeeCode: feedback.employeeCode,
            employeeName: feedback.employeeName,
            reason: feedback.reason,
            description: feedback.description,
            status: feedback.status,
            reductionAmount: feedback.reductionAmount,
            reviewedBy: feedback.reviewedBy,
            reviewedByName: feedback.reviewedByName,
            reviewedAt: feedback.reviewedAt,
            reviewNote: feedback.reviewNote,
          })),
        });
      }

      /*
       * ------------------------------------------------------------
       * Recalculate EmployeeMonthlyFine
       * ------------------------------------------------------------
       */

      const month = batch.month;

      if (month) {
        const monthStart = dayjs.utc(month).startOf('month').toDate();

        const monthEnd = dayjs.utc(month).endOf('month').toDate();

        /*
         * Fine is now the source of truth.
         *
         * amount          = original amount
         * adjustedAmount  = current payable amount
         *
         * No need to query FineFeedback here.
         */
        const monthlyFines = await tx.fine.findMany({
          where: {
            date: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
          select: {
            employeeCode: true,
            employeeName: true,
            amount: true,
            adjustedAmount: true,
          },
        });

        /*
         * Aggregate by employee.
         */
        const employeeTotals = new Map<
          string,
          {
            employeeName: string | null;
            originalAmount: number;
            payableAmount: number;
          }
        >();

        for (const fine of monthlyFines) {
          const current = employeeTotals.get(fine.employeeCode) ?? {
            employeeName: fine.employeeName,
            originalAmount: 0,
            payableAmount: 0,
          };

          const payable = fine.adjustedAmount ?? fine.amount;

          current.originalAmount += fine.amount;

          current.payableAmount += payable;

          employeeTotals.set(fine.employeeCode, current);
        }

        /*
         * ----------------------------------------------------------
         * Upsert EmployeeMonthlyFine
         * ----------------------------------------------------------
         */

        for (const [employeeCode, total] of employeeTotals) {
          const employeeRules = this.workforceRules.resolve(employeeCode, monthStart);

          /*
           * Reduction is derived from:
           *
           * original - current payable
           */
          const reductionAmount = Math.max(0, total.originalAmount - total.payableAmount);

          /*
           * Monthly maximum fine applies to the
           * final payable amount.
           */
          const payableAmount = Math.min(Math.max(0, total.payableAmount), employeeRules.maxFinePerMonth);

          const existing = await tx.employeeMonthlyFine.findUnique({
            where: {
              employeeCode_month: {
                employeeCode,
                month: monthStart,
              },
            },
          });

          /*
           * Do not modify an already completed
           * monthly settlement.
           */
          if (existing?.status === 'completed') {
            continue;
          }

          await tx.employeeMonthlyFine.upsert({
            where: {
              employeeCode_month: {
                employeeCode,
                month: monthStart,
              },
            },
            create: {
              employeeCode,
              employeeName: total.employeeName,
              month: monthStart,
              originalAmount: total.originalAmount,
              reductionAmount,
              payableAmount,
              currency: 'VND',
              status: 'pending',
            },
            update: {
              employeeName: total.employeeName,
              originalAmount: total.originalAmount,
              reductionAmount,
              payableAmount,
              status: 'pending',
              paidAt: null,
              paidBy: null,
              paidByName: null,
            },
          });
        }

        /*
         * ----------------------------------------------------------
         * Reset pending monthly fines for employees who no longer
         * have any Fine records after the re-import.
         * ----------------------------------------------------------
         */

        const existingMonthlyFines = await tx.employeeMonthlyFine.findMany({
          where: {
            month: monthStart,
            status: 'pending',
          },
          select: {
            id: true,
            employeeCode: true,
          },
        });

        for (const monthlyFine of existingMonthlyFines) {
          if (!employeeTotals.has(monthlyFine.employeeCode)) {
            await tx.employeeMonthlyFine.update({
              where: {
                id: monthlyFine.id,
              },
              data: {
                originalAmount: 0,
                reductionAmount: 0,
                payableAmount: 0,
              },
            });
          }
        }
      }

      /*
       * ------------------------------------------------------------
       * Update import batch
       * ------------------------------------------------------------
       */

      await (tx as any).workforceImport.update({
        where: {
          id: batchId,
        },
        data: {
          totalFine: rows.reduce((sum, row) => sum + row.fineAmount, 0),
        },
      });
    });

    this.logger.log(`Confirm import batch ${batch.month}`);

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
        month: true,
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
      month: result.month,
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
