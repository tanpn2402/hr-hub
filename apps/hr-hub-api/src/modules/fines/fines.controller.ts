import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { FinesService } from './fines.service';

@Controller()
export class FinesController {
  constructor(private readonly fines: FinesService) {}

  @Get('fines/reports/:month')
  report(@Param('month') month: string) {
    return this.fines.report(month);
  }

  @UseGuards(AuthGuard)
  @Get('fines/employee/:employeeCode')
  employee(@Param('employeeCode') code: string, @Query() query: any) {
    return this.fines.employee(code, query);
  }

  @UseGuards(AuthGuard)
  @Get('fines/:id')
  get(@Param('id') id: string) {
    return this.fines.get(id);
  }

  @UseGuards(AuthGuard)
  @Get('fines')
  list(@Query() query: any) {
    return this.fines.list(query);
  }

  @Post('fines/:fineId/feedback') submit(@Param('fineId') id: string, @Body() body: any) {
    return this.fines.submit(id, body);
  }

  @UseGuards(AuthGuard)
  @Get('fines/:fineId/feedback')
  feedback(@Param('fineId') id: string) {
    return this.fines.feedbackForFine(id);
  }

  @UseGuards(AuthGuard)
  @Get('fine-feedback')
  feedbackList(@Query() query: any) {
    return this.fines.feedbackList(query);
  }

  @UseGuards(AuthGuard)
  @Post('fine-feedback/:id/approve')
  approve(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.fines.approve(id, body, user);
  }

  @UseGuards(AuthGuard)
  @Post('fine-feedback/:id/reject')
  reject(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.fines.reject(id, body, user);
  }
}
