import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceModule } from '../app/trace/trace.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { INTEGRATED_PAYMENT_PROVIDER, paymentProviderFactory } from './providers/payment-provider.factory';

@Module({
  imports: [ConfigModule, TraceModule],
  controllers: [PaymentController],
  providers: [
    {
      provide: INTEGRATED_PAYMENT_PROVIDER,
      inject: [ConfigService, TraceContextService],
      useFactory: paymentProviderFactory,
    },
    PaymentService,
  ],
})
export class PaymentModule {}
