import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinesController } from './fines.controller';
import { FinesService } from './fines.service';
import { TraceModule } from '../app/trace/trace.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { FinePaymentController } from './fine-payment.controller';
import { FinePaymentService } from './fine-payment.service';
import { PaymentModule } from '../payment/payment.module';
import { TransactionPollingQueue } from './transaction-polling-queue';

@Module({
  imports: [AuthModule, TraceModule, WorkforceModule, PaymentModule],
  controllers: [FinesController, FinePaymentController],
  providers: [FinesService, FinePaymentService, TransactionPollingQueue],
})
export class FinesModule {}
