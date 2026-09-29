import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import PQueue from 'p-queue';
import { PaymentService } from '../payment/payment.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { TraceContextService } from '../app/trace/trace-context.service';
import { FinePaymentService } from './fine-payment.service';
import { randomUUID } from 'crypto';

export type TransactionPolling = {
  paymentId: string;
  traceId?: string;
};

@Injectable()
export class TransactionPollingQueue implements OnModuleInit {
  private logger: TraceLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    readonly traceContext: TraceContextService,
    @Inject(forwardRef(() => FinePaymentService)) private readonly finePaymentService: FinePaymentService,
  ) {
    this.logger = new TraceLogger(traceContext, TransactionPollingQueue.name);
  }

  private readonly queue = new PQueue({
    concurrency: 40,
  });

  onModuleInit() {
    this.prisma.finePayment
      .findMany({
        where: { status: 'pending' },
        select: { id: true },
      })
      .then((payments) => {
        for (const payment of payments) {
          this.traceContext.run(randomUUID(), () => {
            this.add({ paymentId: payment.id });
          });
        }
      });
  }

  add({ paymentId, traceId }: TransactionPolling, delayMs = 60 * 2 * 1000) {
    traceId = traceId || this.traceContext.getTraceId() || randomUUID();

    this.logger.log(`Added to queue: ${JSON.stringify({ paymentId, delayMs, queueSize: this.queue.size })}`);

    setTimeout(() => {
      void this.queue.add(() => this.poll({ paymentId, traceId }));
    }, delayMs);
  }

  private async poll({ paymentId, traceId }: TransactionPolling) {
    this.logger.log(`Polled: ${JSON.stringify({ paymentId, traceId })}`);

    const payment = await this.prisma.finePayment.findUnique({ where: { id: paymentId } });

    this.logger.log(`Polled: ${JSON.stringify({ payment })}`);

    if (!payment || payment.status !== 'pending') {
      return;
    }

    if (!payment.providerPaymentId) {
      return;
    }

    const providerMetadata = payment.providerMetadata ? JSON.parse(payment.providerMetadata) : {};

    const isFilled = await this.paymentService.isTransactionFullyFilled(payment.providerPaymentId);

    this.logger.log(`Polled transaction status: ${JSON.stringify({ isFilled })}`);

    if (isFilled) {
      await this.finePaymentService.settle(payment.id, { settledBy: providerMetadata.provider ?? 'PollingQueue' });
      return;
    }

    this.logger.log(`Transaction not yet filled -> move to queue: ${JSON.stringify({ paymentId })}`);

    this.add({ paymentId, traceId }, 2 * 60 * 1000);
  }
}
