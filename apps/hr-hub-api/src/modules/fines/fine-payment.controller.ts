import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateFinePaymentDto, FinePaymentService } from './fine-payment.service';

@Controller('fines')
export class FinePaymentController {
  constructor(private readonly finePaymentService: FinePaymentService) {}

  @Get('payment/preview')
  preview(@Query('employeeCode') employeeCode: string) {
    return this.finePaymentService.preview(employeeCode);
  }

  @Get('payment/:id')
  findOne(@Param('id') id: string) {
    return this.finePaymentService.findOne(id);
  }

  @Post('payment')
  execute(@Body() dto: CreateFinePaymentDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.finePaymentService.execute(dto, user);
  }

  @Post('payment/:id/settle')
  settle(@Param('id') id: string, @Body() body: unknown) {
    return this.finePaymentService.settle(id);
  }
}
