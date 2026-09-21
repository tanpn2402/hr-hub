import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PaymentModule } from './modules/payment/payment.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { AuthModule } from './modules/auth/auth.module';
import { RequestLoggingInterceptor } from './modules/app/trace/request-logging.interceptor';
import { TraceModule } from './modules/app/trace/trace.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, TraceModule, AuthModule, PaymentModule, WorkforceModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule {}
