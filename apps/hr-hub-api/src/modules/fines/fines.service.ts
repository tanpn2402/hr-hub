import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { monthRange } from '../workforce/utils/time.util';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { WorkforceRulesService } from '../workforce/workforce-rules.service';

const feedbackReasons = new Set(['early_leave_permission', 'late_permission', 'wrong_time', 'wrong_fine', 'other']);

export interface SubmitFineFeedback {
  reason: string;
  description?: string;
}

export interface ApproveFineFeedback {
  reductionAmount: number;
  reviewNote?: string;
}

export interface RejectFineFeedback {
  reviewNote: string;
}

export interface FeedbackQuery {
  employeeCode?: string;
  status?: string;
  month?: string;
}

@Injectable()
export class FinesService {
  private logger: TraceLogger;

  constructor(
    private readonly prisma: PrismaService,
    readonly traceContext: TraceContextService,
    private readonly workforceRules: WorkforceRulesService,
  ) {
    this.logger = new TraceLogger(traceContext, FinesService.name);
  }

  async list(query: FeedbackQuery) {
    const where: any = {};

    if (query.employeeCode) {
      where.employeeCode = query.employeeCode;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.month) {
      where.date = monthRange(query.month);
    }

    return this.withPayable(await this.prisma.fine.findMany({ where, orderBy: { date: 'desc' } }));
  }

  async employee(code: string, query: any) {
    return this.list({ ...query, employeeCode: code });
  }

  async get(id: string) {
    const fine = await this.prisma.fine.findUnique({ where: { id } });

    if (!fine) {
      throw new NotFoundException('Fine not found');
    }

    const feedback = await this.prisma.fineFeedback.findMany({
      where: { fineId: id },
      orderBy: { createdAt: 'desc' },
    });

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        date: fine.date,
        employeeCode: fine.employeeCode,
      },
    });

    return { ...this.payable(fine), feedback, attendance };
  }

  async report(month: string) {
    const where: any = {
      date: monthRange(month),
      status: { not: 'cancelled' },
    };

    const fines = await this.prisma.fine.findMany({ where });

    const employees = new Map<string, any>();

    for (const fine of fines) {
      const key = `${fine.employeeCode}|${fine.employeeName ?? ''}`;
      const row = employees.get(key) ?? {
        employeeCode: fine.employeeCode,
        employeeName: fine.employeeName,
        originalAmount: 0,
        payableAmount: 0,
        unpaidPayableAmount: 0,
        fineCount: 0,
      };
      row.originalAmount += fine.amount;
      row.payableAmount += fine.adjustedAmount ?? fine.amount;
      if (fine.status === 'unpaid') row.unpaidPayableAmount += fine.adjustedAmount ?? fine.amount;
      row.fineCount++;
      employees.set(key, row);
    }

    return {
      month,
      rows: fines,
      totalOriginalAmount: fines.reduce((sum, fine) => sum + fine.amount, 0),
      totalPayableAmount: fines.reduce((sum, fine) => sum + (fine.adjustedAmount ?? fine.amount), 0),
      totalUnpaidPayableAmount: fines
        .filter((fine) => fine.status === 'unpaid')
        .reduce((sum, fine) => sum + (fine.adjustedAmount ?? fine.amount), 0),
      employees: [...employees.values()],
    };
  }

  async submit(fineId: string, body: SubmitFineFeedback) {
    if (!feedbackReasons.has(body?.reason)) {
      throw new BadRequestException('Invalid feedback reason');
    }

    if (body.description !== undefined && typeof body.description !== 'string') {
      throw new BadRequestException('Invalid description');
    }

    const fine = await this.prisma.fine.findUnique({ where: { id: fineId } });

    if (!fine) {
      throw new NotFoundException('Fine not found');
    }

    if (fine.status !== 'unpaid') {
      throw new ConflictException('This fine cannot receive feedback');
    }

    const month = dayjs.utc(fine.date).startOf('month').toDate();

    const monthlyFine = await this.prisma.employeeMonthlyFine.findUnique({
      where: {
        employeeCode_month: {
          employeeCode: fine.employeeCode,
          month,
        },
      },
    });

    if (!monthlyFine) {
      throw new NotFoundException('Employee monthly fine not found');
    }

    if (monthlyFine.status === 'completed') {
      throw new ConflictException('Completed monthly fine cannot be received new feedback');
    }

    return this.prisma.fineFeedback.create({
      data: {
        fineId,
        employeeCode: fine.employeeCode,
        employeeName: fine.employeeName,
        reason: body.reason,
        description: body.description ?? null,
      },
    });
  }

  async feedbackForFine(fineId: string) {
    const fine = await this.prisma.fine.findUnique({
      where: { id: fineId },
      select: { id: true },
    });

    if (!fine) {
      throw new NotFoundException('Fine not found');
    }

    return this.prisma.fineFeedback.findMany({
      where: { fineId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async feedbackList(query: FeedbackQuery) {
    const where: any = {};

    if (query.employeeCode) {
      throw new NotFoundException('Fine not found');
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.month) {
      const ids = await this.prisma.fine.findMany({
        where: { date: monthRange(query.month) },
        select: { id: true },
      });
      where.fineId = { in: ids.map((x) => x.id) };
    }

    const items = await this.prisma.fineFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      items,
      summary: {
        total: items.length,
        reviewed: items.filter((item) => item.status !== 'pending').length,
        approved: items.filter((item) => item.status === 'approved').length,
        pending: items.filter((item) => item.status === 'pending').length,
        rejected: items.filter((item) => item.status === 'rejected').length,
      },
    };
  }

  async feedbackDetail(id: string) {
    const feedback = await this.prisma.fineFeedback.findUnique({ where: { id } });

    if (!feedback) {
      throw new NotFoundException('Fine feedback not found');
    }

    const fine = await this.prisma.fine.findUnique({
      where: { id: feedback.fineId },
    });

    if (!fine) {
      throw new NotFoundException('Fine not found');
    }

    const day = {
      gte: new Date(fine.date),
      lt: new Date(new Date(fine.date).getTime() + 24 * 60 * 60 * 1000),
    };

    const [attendance, leave] = await Promise.all([
      this.prisma.attendance.findFirst({ where: { employeeCode: fine.employeeCode, date: day } }),
      this.prisma.leave.findFirst({ where: { employeeCode: fine.employeeCode, date: day } }),
    ]);

    return { feedback, fine: this.payable(fine), attendance, leave };
  }

  async approve(id: string, body: ApproveFineFeedback, user?: AuthenticatedUser) {
    this.logger.log('[ApproveFineFeedback] ' + JSON.stringify({ id, body, user }));

    const reduction = body.reductionAmount ?? 0;

    if (!Number.isInteger(reduction) || reduction < 0 || (body.reviewNote !== undefined && typeof body.reviewNote !== 'string')) {
      throw new BadRequestException('Invalid approval data');
    }

    return this.prisma.$transaction(async (tx) => {
      /*
       * ------------------------------------------------------------
       * Load feedback
       * ------------------------------------------------------------
       */

      const feedback = await tx.fineFeedback.findUnique({
        where: { id },
      });

      if (!feedback) {
        throw new NotFoundException('Fine feedback not found');
      }

      if (feedback.status !== 'pending') {
        throw new ConflictException('Feedback has already been reviewed');
      }

      /*
       * ------------------------------------------------------------
       * Load Fine
       * ------------------------------------------------------------
       */

      const fine = await tx.fine.findUnique({
        where: {
          id: feedback.fineId,
        },
      });

      if (!fine) {
        throw new NotFoundException('Fine not found');
      }

      if (fine.status === 'paid') {
        throw new ConflictException('Paid fines cannot be adjusted');
      }

      /*
       * ------------------------------------------------------------
       * Load EmployeeMonthlyFine
       * ------------------------------------------------------------
       *
       * It should already exist because it is created
       * during workforce import confirmation.
       */

      const month = dayjs.utc(fine.date).startOf('month').toDate();

      const monthlyFine = await tx.employeeMonthlyFine.findUnique({
        where: {
          employeeCode_month: {
            employeeCode: fine.employeeCode,
            month,
          },
        },
      });

      this.logger.log(
        '[ApproveFineFeedback] MonthlyFine: ' +
          JSON.stringify({
            month,
            monthlyFine,
          }),
      );

      if (!monthlyFine) {
        throw new NotFoundException('Employee monthly fine not found');
      }

      /*
       * A completed monthly settlement is immutable.
       *
       * Check this BEFORE changing FineFeedback/Fine.
       */

      if (monthlyFine.status === 'completed') {
        throw new ConflictException('Completed monthly fine cannot be adjusted');
      }

      /*
       * ------------------------------------------------------------
       * Validate reduction
       * ------------------------------------------------------------
       */

      const currentPayable = fine.adjustedAmount ?? fine.amount;

      if (reduction > currentPayable) {
        throw new BadRequestException('Reduction exceeds current payable amount');
      }

      /*
       * ------------------------------------------------------------
       * Calculate new Fine payable
       * ------------------------------------------------------------
       *
       * Fine.adjustedAmount is the source of truth for the
       * individual fine after approved feedback.
       */

      const adjustedAmount = currentPayable - reduction;

      this.logger.log(
        '[ApproveFineFeedback] Fine adjustment: ' +
          JSON.stringify({
            fineId: fine.id,
            originalAmount: fine.amount,
            currentPayable,
            reduction,
            adjustedAmount,
          }),
      );

      /*
       * ------------------------------------------------------------
       * Approve feedback
       * ------------------------------------------------------------
       */

      const updated = await tx.fineFeedback.updateMany({
        where: {
          id,
          status: 'pending',
        },
        data: {
          status: 'approved',
          reductionAmount: reduction,
          reviewedBy: user?.id ?? null,
          reviewedByName: user?.username ?? user?.email ?? null,
          reviewedAt: new Date(),
          reviewNote: body.reviewNote ?? null,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Feedback has already been reviewed');
      }

      /*
       * ------------------------------------------------------------
       * Update individual Fine
       * ------------------------------------------------------------
       */

      await tx.fine.update({
        where: {
          id: fine.id,
        },
        data: {
          adjustedAmount,
        },
      });

      /*
       * ------------------------------------------------------------
       * Recalculate EmployeeMonthlyFine
       * ------------------------------------------------------------
       *
       * Do NOT increment/decrement the existing monthly values.
       *
       * Recalculate from Fine records so the monthly settlement
       * remains deterministic.
       */

      const monthStart = dayjs.utc(fine.date).startOf('month').toDate();

      const monthEnd = dayjs.utc(fine.date).endOf('month').toDate();

      const monthlyFines = await tx.fine.findMany({
        where: {
          employeeCode: fine.employeeCode,
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        select: {
          amount: true,
          adjustedAmount: true,
        },
      });

      /*
       * Original fine total.
       */
      const originalAmount = monthlyFines.reduce((sum, item) => sum + item.amount, 0);

      /*
       * Payable before monthly employee cap.
       *
       * adjustedAmount is already the payable amount
       * after approved feedback for each Fine.
       */
      const rawPayableAmount = monthlyFines.reduce((sum, item) => sum + (item.adjustedAmount ?? item.amount), 0);

      /*
       * Total reduction caused by feedback.
       */
      const reductionAmount = Math.max(0, originalAmount - rawPayableAmount);

      /*
       * Resolve employee-specific monthly rules.
       */
      const employeeRules = this.workforceRules.resolve(fine.employeeCode, monthStart);

      /*
       * Apply monthly maximum AFTER feedback reductions.
       */
      const payableAmount = Math.min(Math.max(0, rawPayableAmount), employeeRules.maxFinePerMonth);

      this.logger.log(
        '[ApproveFineFeedback] MonthlyFine recalculated: ' +
          JSON.stringify({
            employeeCode: fine.employeeCode,
            monthStart,
            originalAmount,
            rawPayableAmount,
            reductionAmount,
            maxFinePerMonth: employeeRules.maxFinePerMonth,
            payableAmount,
          }),
      );

      /*
       * ------------------------------------------------------------
       * Update EmployeeMonthlyFine
       * ------------------------------------------------------------
       */

      await tx.employeeMonthlyFine.update({
        where: {
          id: monthlyFine.id,
        },
        data: {
          originalAmount,
          reductionAmount,
          payableAmount,
        },
      });

      /*
       * Return the updated feedback.
       */

      return tx.fineFeedback.findUniqueOrThrow({
        where: {
          id,
        },
      });
    });
  }

  async reject(id: string, body: RejectFineFeedback, user?: AuthenticatedUser) {
    if (body?.reviewNote !== undefined && typeof body.reviewNote !== 'string') {
      throw new BadRequestException('Invalid review note');
    }

    const result = await this.prisma.fineFeedback.updateMany({
      where: { id, status: 'pending' },
      data: {
        status: 'rejected',
        reviewedBy: user?.id ?? null,
        reviewedByName: user?.username ?? user?.email ?? null,
        reviewedAt: new Date(),
        reviewNote: body?.reviewNote ?? null,
      },
    });

    if (result.count) {
      return { id, status: 'rejected' };
    }

    const found = await this.prisma.fineFeedback.findUnique({ where: { id } });

    if (!found) {
      throw new NotFoundException('Fine feedback not found');
    }

    throw new ConflictException('Feedback has already been reviewed');
  }

  private payable(fine: any) {
    return { ...fine, payableAmount: fine.adjustedAmount ?? fine.amount };
  }

  private withPayable(fines: any[]) {
    return fines.map((fine) => this.payable(fine));
  }
}
