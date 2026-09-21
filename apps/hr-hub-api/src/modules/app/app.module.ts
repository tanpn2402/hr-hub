import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PaymentModule } from '../payment/payment.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { AuthModule } from '../auth/auth.module';
import { RequestLoggingInterceptor } from './trace/request-logging.interceptor';
import { TraceModule } from './trace/trace.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), TraceModule, AuthModule, PaymentModule, WorkforceModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule {}
