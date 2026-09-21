import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinesController } from './fines.controller';
import { FinesService } from './fines.service';

@Module({
  imports: [AuthModule],
  controllers: [FinesController],
  providers: [FinesService],
})
export class FinesModule {}
