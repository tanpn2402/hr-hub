import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdenplaneClient } from './idenplane.client';

@Module({
  imports: [ConfigModule],
  providers: [IdenplaneClient],
  exports: [IdenplaneClient],
})
export class IdenplaneModule {}
