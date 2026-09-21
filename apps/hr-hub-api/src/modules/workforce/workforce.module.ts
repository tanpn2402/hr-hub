import { Module } from '@nestjs/common';
import { WorkforceController } from './workforce.controller';
import { WorkforceService } from './workforce.service';
import { LateFineCalculatorService } from './late-fine-calculator.service';
import { MonthlyReportsRepository } from './monthly-reports.repository';
import { AuthModule } from '../auth/auth.module';
import { StageOneWorkforceService } from './stage-one-workforce.service';

@Module({
  imports: [AuthModule],
  controllers: [WorkforceController],
  providers: [WorkforceService, LateFineCalculatorService, MonthlyReportsRepository, StageOneWorkforceService],
})
export class WorkforceModule {}
