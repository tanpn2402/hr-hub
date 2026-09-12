import { Body, Controller, Post } from '@nestjs/common';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('qr')
  generateQr(@Body() request: GenerateQrDto) {
    return this.paymentService.generateQr(request);
  }
}
