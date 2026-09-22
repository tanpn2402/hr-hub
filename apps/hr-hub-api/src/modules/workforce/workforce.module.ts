import { Module } from '@nestjs/common';
import { WorkforceController } from './workforce.controller';
import { WorkforceService } from './workforce.service';
import { LateFineCalculatorService } from './late-fine-calculator.service';
import { MonthlyReportsRepository } from './monthly-reports.repository';
import { AuthModule } from '../auth/auth.module';
import { StageOneWorkforceService } from './stage-one-workforce.service';
import { TraceModule } from '../app/trace/trace.module';

@Module({
  imports: [TraceModule, AuthModule],
  controllers: [WorkforceController],
  providers: [WorkforceService, LateFineCalculatorService, MonthlyReportsRepository, StageOneWorkforceService],
})
export class WorkforceModule {}
