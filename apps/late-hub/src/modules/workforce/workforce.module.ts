import { Module } from '@nestjs/common';
import { WorkforceController } from './workforce.controller';
import { WorkforceService } from './workforce.service';
import { LateFineCalculatorService } from './late-fine-calculator.service';
import { MonthlyReportsRepository } from './monthly-reports.repository';

@Module({
  controllers: [WorkforceController],
  providers: [WorkforceService, LateFineCalculatorService, MonthlyReportsRepository],
})
export class WorkforceModule {}
