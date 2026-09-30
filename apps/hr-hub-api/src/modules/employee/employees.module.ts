import { Module } from '@nestjs/common';

import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { TraceModule } from '../app/trace/trace.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, TraceModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
