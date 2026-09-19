import { Module } from '@nestjs/common';
import { TraceContextService } from './trace-context.service';

@Module({
  providers: [TraceContextService],
  exports: [TraceContextService],
})
export class TraceModule {}
