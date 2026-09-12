import { Module } from '@nestjs/common';
import { WorkforceController } from './workforce.controller';
import { WorkforceService } from './workforce.service';
import { LateFineCalculatorService } from './late-fine-calculator.service';

@Module({
  controllers: [WorkforceController],
  providers: [WorkforceService, LateFineCalculatorService],
})
export class WorkforceModule {}
