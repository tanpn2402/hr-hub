import { PrismaService } from '@app/prisma/prisma.service';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { AuthenticatedUser } from '../auth/auth.types';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { PaymentService } from '../payment/payment.service';

dayjs.extend(utc);

export interface CreateFinePaymentDto {
  employeeCode: string;
  monthlyFineIds: string[];
}

export interface RejectFinePaymentDto {
  reason?: string;
}

@Injectable()
export class FinePaymentService {
  private logger: TraceLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    readonly traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, FinePaymentService.name);
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Preview payment options for an employee.
   *
   * Returns:
   * - pendingTransactions:
   *     Existing FinePayment records waiting for payment.
   *
   * - availableMonthlyFines:
   *     EmployeeMonthlyFine records that:
   *       - belong to the employee
   *       - are still pending
   *       - have payableAmount > 0
   *       - are not already included in a pending FinePayment
   */
  async preview(employeeCode: string) {
    const code = this.normalizeEmployeeCode(employeeCode);

    /*
     * Existing pending payment sessions.
     */
    const pendingTransactions = await this.prisma.finePayment.findMany({
      where: {
        employeeCode: code,
        status: 'pending',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    /*
     * Collect EmployeeMonthlyFine IDs already
     * reserved by pending payments.
     */
    const pendingMonthlyFineIds = this.collectMonthlyFineIds(pendingTransactions);

    /*
     * Find unpaid monthly fines.
     */
    const monthlyFines = await this.prisma.employeeMonthlyFine.findMany({
      where: {
        employeeCode: code,
        status: 'pending',
        payableAmount: {
          gt: 0,
        },
      },
      orderBy: {
        month: 'asc',
      },
    });

    /*
     * Exclude monthly fines already included
     * in a pending payment.
     */
    const availableMonthlyFines = monthlyFines.filter((monthlyFine) => !pendingMonthlyFineIds.has(monthlyFine.id));

    return {
      employeeCode: code,
      pendingTransactions: pendingTransactions.map((txn) => {
        const pendingMonthlyFineIds = this.collectMonthlyFineIds([txn]);
        return {
          ...txn,
          monthlyFines: monthlyFines.filter((monthlyFine) => pendingMonthlyFineIds.has(monthlyFine.id)),
        };
      }),
      availableMonthlyFines,
    };
  }

  /**
   * Get a FinePayment by ID.
   */
  async findOne(id: string) {
    const payment = await this.prisma.finePayment.findUnique({
      where: {
        id,
      },
    });

    if (!payment) {
      throw new NotFoundException('Fine payment not found');
    }

    return payment;
  }

  /**
   * Create a FinePayment from selected EmployeeMonthlyFine records.
   *
   * This creates the payment session only.
   *
   * QR/provider interaction should happen after this method.
   */
  async execute(dto: CreateFinePaymentDto, user?: AuthenticatedUser) {
    this.logger.debug('[execute] ' + JSON.stringify({ dto }));

    const code = this.normalizeEmployeeCode(dto.employeeCode);

    const monthlyFineIds = this.normalizeMonthlyFineIds(dto.monthlyFineIds);

    if (!monthlyFineIds.length) {
      throw new BadRequestException('At least one monthly fine is required');
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      /*
       * ----------------------------------------------------------
       * Only one pending payment per employee.
       * ----------------------------------------------------------
       */

      const existingPayment = await tx.finePayment.findFirst({
        where: {
          employeeCode: code,
          status: 'pending',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existingPayment) {
        throw new ConflictException('Employee already has a pending fine payment');
      }

      /*
       * ----------------------------------------------------------
       * Load selected monthly fines.
       * ----------------------------------------------------------
       *
       * Do not trust amount from the client.
       */

      const monthlyFines = await tx.employeeMonthlyFine.findMany({
        where: {
          id: {
            in: monthlyFineIds,
          },
          employeeCode: code,
          status: 'pending',
          payableAmount: {
            gt: 0,
          },
        },
      });

      /*
       * Every requested ID must still be payable.
       */
      if (monthlyFines.length !== monthlyFineIds.length) {
        throw new ConflictException('One or more monthly fines are no longer available for payment');
      }

      const payments = await tx.finePayment.findMany({
        where: {
          status: {
            in: ['pending', 'settled'],
          },
          employeeCode: code,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          monthlyFineIds: true,
          status: true,
        },
      });

      this.logger.debug('[execute] ' + JSON.stringify({ payments }));

      for (const payment of payments) {
        const monthlyFineIds = this.parseMonthlyFineIds(payment.monthlyFineIds);
        for (const monthlyFine of monthlyFines) {
          if (monthlyFineIds.includes(monthlyFine.id)) {
            if (payment.status === 'pending') {
              throw new ConflictException('One or more monthly fines already have a pending payment');
            }
            throw new ConflictException('One or more monthly fines have already been paid');
          }
        }
      }

      /*
       * ----------------------------------------------------------
       * Calculate payment amount from DB values.
       * ----------------------------------------------------------
       */

      const amount = monthlyFines.reduce((sum, monthlyFine) => sum + monthlyFine.payableAmount, 0);

      this.logger.debug('[execute] ' + JSON.stringify({ amount }));

      if (amount <= 0) {
        throw new BadRequestException('Payment amount must be greater than zero');
      }

      /*
       * ----------------------------------------------------------
       * Create FinePayment.
       * ----------------------------------------------------------
       */

      const payment = await tx.finePayment.create({
        data: {
          employeeCode: code,

          employeeName: this.resolveEmployeeName(monthlyFines),

          /*
           * No Prisma relationship.
           *
           * Store IDs as JSON.
           */
          monthlyFineIds: JSON.stringify(monthlyFineIds),

          amount,

          currency: monthlyFines[0]?.currency ?? 'VND',

          status: 'pending',

          paymentMethod: 'QR',

          // providerMetadata: JSON.stringify({}), NULL as default

          createdBy: user?.id ?? null,

          createdByName: user?.username ?? user?.email ?? null,
        },
      });

      return payment;
    });

    // External Payment service call
    try {
      const externalPayment = await this.paymentService.generateQr({
        amount: payment.amount,
        content: payment.id,
      });

      if (externalPayment) {
        await this.prisma.finePayment.update({
          where: { id: payment.id },
          data: {
            providerMetadata: JSON.stringify(externalPayment),
            provider: externalPayment.provider,
          },
        });
      }
    } catch (error) {
      // Rollback payment
      await this.prisma.finePayment.delete({ where: { id: payment.id } });
      throw error;
    }

    const latestPayment = await this.prisma.finePayment.findUnique({ where: { id: payment.id } });
    const monthlyFines = await this.prisma.employeeMonthlyFine.findMany({ where: { id: { in: monthlyFineIds } } });

    return {
      ...latestPayment,
      monthlyFines,
    };
  }

  /**
   * Settle a FinePayment.
   *
   * This operation:
   *
   * 1. Validates the payment.
   * 2. Marks FinePayment as settled.
   * 3. Marks all EmployeeMonthlyFine records as completed.
   * 4. Creates a FinancialTransaction.
   *
   * All operations happen in one DB transaction.
   */
  async settle(paymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.finePayment.findUnique({
        where: {
          id: paymentId,
        },
      });

      if (!payment) {
        throw new NotFoundException('Fine payment not found');
      }

      /*
       * ----------------------------------------------------------
       * Idempotency.
       * ----------------------------------------------------------
       *
       * Payment providers may send the same
       * webhook multiple times.
       */
      if (payment.status === 'settled') {
        return payment;
      }

      if (payment.status !== 'pending') {
        throw new ConflictException(`Fine payment cannot be settled from status "${payment.status}"`);
      }

      /*
       * ----------------------------------------------------------
       * Parse monthly fine IDs.
       * ----------------------------------------------------------
       */

      const monthlyFineIds = this.parseMonthlyFineIds(payment.monthlyFineIds);

      if (!monthlyFineIds.length) {
        throw new ConflictException('Fine payment has no monthly fines');
      }

      /*
       * ----------------------------------------------------------
       * Verify monthly fines.
       * ----------------------------------------------------------
       */

      const monthlyFines = await tx.employeeMonthlyFine.findMany({
        where: {
          id: {
            in: monthlyFineIds,
          },
        },
      });

      if (monthlyFines.length !== monthlyFineIds.length) {
        throw new ConflictException('One or more monthly fines no longer exist');
      }

      /*
       * Every monthly fine must still be pending.
       */
      const unavailable = monthlyFines.filter((monthlyFine) => monthlyFine.status !== 'pending');

      if (unavailable.length) {
        throw new ConflictException('One or more monthly fines have already been settled');
      }

      /*
       * ----------------------------------------------------------
       * Optional integrity check.
       * ----------------------------------------------------------
       *
       * The payment amount was calculated when
       * FinePayment was created. Do not silently change
       * the historical payment amount.
       *
       * We only verify that the selected records still
       * correspond to the same employee.
       */

      const wrongEmployee = monthlyFines.some((monthlyFine) => monthlyFine.employeeCode !== payment.employeeCode);

      if (wrongEmployee) {
        throw new ConflictException('Fine payment contains monthly fines belonging to another employee');
      }

      /*
       * ----------------------------------------------------------
       * Settle payment.
       * ----------------------------------------------------------
       */

      const paidAt = new Date();

      const updatedPayment = await tx.finePayment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: 'settled',
          paidAt,
        },
      });

      /*
       * ----------------------------------------------------------
       * Complete EmployeeMonthlyFine records.
       * ----------------------------------------------------------
       */

      await tx.employeeMonthlyFine.updateMany({
        where: {
          id: {
            in: monthlyFineIds,
          },
          status: 'pending',
        },
        data: {
          status: 'completed',
          paidAt,

          paidBy: payment.createdBy,

          paidByName: payment.createdByName,
        },
      });

      /*
       * ----------------------------------------------------------
       * Create FinancialTransaction.
       * ----------------------------------------------------------
       *
       * No Prisma relationship.
       *
       * referenceId = FinePayment.id
       */
      await tx.financialTransaction.create({
        data: {
          transactionDate: paidAt,

          type: 'fine_payment',

          direction: 'income',

          amount: payment.amount,

          currency: payment.currency,

          referenceId: payment.id,

          createdBy: payment.createdBy,

          createdByName: payment.createdByName,

          provider: payment.provider,

          providerMetadata: payment.providerMetadata,

          paymentMethod: payment.paymentMethod,

          status: 'completed',

          description: `Fine payment for ${payment.employeeCode}`,
        },
      });

      return updatedPayment;
    });
  }

  async reject(paymentId: string, dto: RejectFinePaymentDto, user?: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.finePayment.findUnique({
        where: {
          id: paymentId,
        },
      });

      if (!payment) {
        throw new NotFoundException('Fine payment not found');
      }

      // Idempotent
      if (payment.status === 'cancelled') {
        return payment;
      }

      if (payment.status !== 'pending') {
        throw new ConflictException(`Cannot reject payment with status: ${payment.status}`);
      }

      const updatedPayment = await tx.finePayment.update({
        where: {
          id: paymentId,
        },
        data: {
          status: 'cancelled',
          providerMetadata: dto.reason
            ? JSON.stringify({
                rejectedReason: dto.reason,
                rejectedBy: user?.id ?? null,
                rejectedByName: user?.username ?? user?.email ?? null,
                rejectedAt: new Date().toISOString(),
              })
            : undefined,
        },
      });

      return updatedPayment;
    });
  }

  // ===========================================================================
  // Payment lookup utilities
  // ===========================================================================

  /**
   * Find the currently pending payment for an employee.
   */
  async findPendingPayment(employeeCode: string) {
    const code = this.normalizeEmployeeCode(employeeCode);

    return this.prisma.finePayment.findFirst({
      where: {
        employeeCode: code,
        status: 'pending',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Check whether a monthly fine is already
   * included in a pending FinePayment.
   *
   * Since monthlyFineIds is a JSON string rather
   * than a Prisma relation, the check is performed
   * in application code.
   */
  async hasPendingPayment(monthlyFineId: string, employeeCode?: string): Promise<boolean> {
    const payment = await this.findPaymentForMonthlyFine(monthlyFineId, employeeCode);

    return !!payment;
  }

  /**
   * Return the pending FinePayment containing
   * the specified EmployeeMonthlyFine.
   */
  async findPaymentForMonthlyFine(monthlyFineId: string, employeeCode?: string) {
    const payments = await this.prisma.finePayment.findMany({
      where: {
        status: 'pending',

        ...(employeeCode
          ? {
              employeeCode: this.normalizeEmployeeCode(employeeCode),
            }
          : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    for (const payment of payments) {
      const monthlyFineIds = this.parseMonthlyFineIds(payment.monthlyFineIds);

      if (monthlyFineIds.includes(monthlyFineId)) {
        return payment;
      }
    }

    return null;
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  private normalizeEmployeeCode(employeeCode: string): string {
    const code = employeeCode?.trim();

    if (!code) {
      throw new BadRequestException('Employee code is required');
    }

    return code;
  }

  private normalizeMonthlyFineIds(ids: string[]): string[] {
    if (!Array.isArray(ids)) {
      throw new BadRequestException('monthlyFineIds must be an array');
    }

    const normalized = [
      ...new Set(
        ids
          .filter((id) => typeof id === 'string')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];

    return normalized;
  }

  private parseMonthlyFineIds(value: string): string[] {
    try {
      const parsed = JSON.parse(value);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
    } catch {
      return [];
    }
  }

  private collectMonthlyFineIds(
    payments: Array<{
      monthlyFineIds: string;
    }>,
  ): Set<string> {
    const ids = new Set<string>();

    for (const payment of payments) {
      const monthlyFineIds = this.parseMonthlyFineIds(payment.monthlyFineIds);

      for (const id of monthlyFineIds) {
        ids.add(id);
      }
    }

    return ids;
  }

  private resolveEmployeeName(
    monthlyFines: Array<{
      employeeName: string | null;
    }>,
  ): string | null {
    return monthlyFines.find((item) => item.employeeName)?.employeeName ?? null;
  }
}
