import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinesController } from './fines.controller';
import { FinesService } from './fines.service';
import { TraceModule } from '../app/trace/trace.module';
import { WorkforceModule } from '../workforce/workforce.module';

@Module({
  imports: [AuthModule, TraceModule, WorkforceModule],
  controllers: [FinesController],
  providers: [FinesService],
})
export class FinesModule {}
