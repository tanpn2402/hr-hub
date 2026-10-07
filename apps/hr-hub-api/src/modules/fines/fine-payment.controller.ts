import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { HrRolesGuard } from '../auth/hr-roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateFinePaymentDto, FinePaymentService, RejectFinePaymentDto } from './fine-payment.service';

@Controller('fines')
export class FinePaymentController {
  constructor(private readonly finePaymentService: FinePaymentService) {}

  @Get('payment/preview')
  preview(@Query('employeeCode') employeeCode: string) {
    return this.finePaymentService.preview(employeeCode);
  }

  @Get('payment/history')
  @UseGuards(AuthGuard, HrRolesGuard)
  getHistory(@Query('month') month?: string, @Query('employeeCode') employeeCode?: string, @Query('status') status?: string) {
    return this.finePaymentService.getHistory({
      month,
      employeeCode,
      status,
    });
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
  @UseGuards(AuthGuard, HrRolesGuard)
  settle(@Param('id') id: string, @Body() body: unknown) {
    return this.finePaymentService.settle(id);
  }

  @Delete('payment/:id')
  reject(@Param('id') paymentId: string, @Body() dto: RejectFinePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.finePaymentService.reject(paymentId, dto, user);
  }
}
