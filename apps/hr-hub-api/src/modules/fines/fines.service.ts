import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { monthRange } from '../workforce/utils/time.util';

const feedbackReasons = new Set(['early_leave_permission', 'late_permission', 'wrong_time', 'wrong_fine', 'other']);

@Injectable()
export class FinesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: any) {
    const where: any = {};
    if (query.employeeCode) where.employeeCode = query.employeeCode;
    if (query.status) where.status = query.status;
    if (query.month) where.date = monthRange(query.month);
    return this.withPayable(await this.prisma.fine.findMany({ where, orderBy: { date: 'desc' } }));
  }

  async employee(code: string, query: any) {
    return this.list({ ...query, employeeCode: code });
  }

  async get(id: string) {
    const fine = await this.prisma.fine.findUnique({ where: { id } });
    if (!fine) throw new NotFoundException('Fine not found');
    const feedback = await this.prisma.fineFeedback.findMany({ where: { fineId: id }, orderBy: { createdAt: 'desc' } });
    return { ...this.payable(fine), feedback };
  }

  async report(month: string) {
    const where: any = { date: monthRange(month), status: { not: 'cancelled' } };
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

  async submit(fineId: string, body: any) {
    if (!feedbackReasons.has(body?.reason)) throw new BadRequestException('Invalid feedback reason');

    if (body.description !== undefined && typeof body.description !== 'string') throw new BadRequestException('Invalid description');

    const fine = await this.prisma.fine.findUnique({ where: { id: fineId } });

    if (!fine) throw new NotFoundException('Fine not found');

    if (fine.status !== 'unpaid') throw new ConflictException('This fine cannot receive feedback');

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
    const fine = await this.prisma.fine.findUnique({ where: { id: fineId }, select: { id: true } });
    if (!fine) throw new NotFoundException('Fine not found');
    return this.prisma.fineFeedback.findMany({ where: { fineId }, orderBy: { createdAt: 'desc' } });
  }

  async feedbackList(query: any) {
    const where: any = {};
    if (query.employeeCode) where.employeeCode = query.employeeCode;
    if (query.status) where.status = query.status;
    if (query.month) {
      const ids = await this.prisma.fine.findMany({ where: { date: monthRange(query.month) }, select: { id: true } });
      where.fineId = { in: ids.map((x) => x.id) };
    }
    return this.prisma.fineFeedback.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async approve(id: string, body: any, user?: AuthenticatedUser) {
    const reduction = body?.reductionAmount;
    if (!Number.isInteger(reduction) || reduction < 0 || (body.reviewNote !== undefined && typeof body.reviewNote !== 'string'))
      throw new BadRequestException('Invalid approval data');
    return this.prisma.$transaction(async (tx) => {
      const feedback = await tx.fineFeedback.findUnique({ where: { id } });
      if (!feedback) throw new NotFoundException('Fine feedback not found');
      if (feedback.status !== 'pending') throw new ConflictException('Feedback has already been reviewed');
      const fine = await tx.fine.findUnique({ where: { id: feedback.fineId } });
      if (!fine) throw new NotFoundException('Fine not found');
      if (fine.status === 'paid') throw new ConflictException('Paid fines cannot be adjusted');
      const payable = fine.adjustedAmount ?? fine.amount;
      if (reduction > payable) throw new BadRequestException('Reduction exceeds current payable amount');
      const updated = await tx.fineFeedback.updateMany({
        where: { id, status: 'pending' },
        data: {
          status: 'approved',
          reductionAmount: reduction,
          reviewedBy: user?.id ?? null,
          reviewedByName: user?.username ?? user?.email ?? null,
          reviewedAt: new Date(),
          reviewNote: body.reviewNote ?? null,
        },
      });
      if (updated.count !== 1) throw new ConflictException('Feedback has already been reviewed');
      await tx.fine.update({ where: { id: fine.id }, data: { adjustedAmount: payable - reduction } });
      return { id, status: 'approved', payableAmount: payable - reduction };
    });
  }

  async reject(id: string, body: any, user?: AuthenticatedUser) {
    if (body?.reviewNote !== undefined && typeof body.reviewNote !== 'string') throw new BadRequestException('Invalid review note');
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
    if (result.count) return { id, status: 'rejected' };
    const found = await this.prisma.fineFeedback.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Fine feedback not found');
    throw new ConflictException('Feedback has already been reviewed');
  }

  private payable(fine: any) {
    return { ...fine, payableAmount: fine.adjustedAmount ?? fine.amount };
  }

  private withPayable(fines: any[]) {
    return fines.map((fine) => this.payable(fine));
  }
}
