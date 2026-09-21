import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('qr')
  generateQr(@Body() request: GenerateQrDto) {
    return this.paymentService.generateQr(request);
  }

  @Get()
  @UseGuards(AuthGuard)
  getPayment() {
    return [];
  }
}
