import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { GenerateQrResult, IntegratedPaymentProvider } from './providers/integrated-payment.provider';
import { INTEGRATED_PAYMENT_PROVIDER } from './providers/payment-provider.factory';

@Injectable()
export class PaymentService {
  constructor(@Inject(INTEGRATED_PAYMENT_PROVIDER) private readonly provider: IntegratedPaymentProvider) {}

  generateQr(request: GenerateQrDto): Promise<GenerateQrResult> {
    if (typeof request.content !== 'string' || request.content.trim().length === 0) {
      throw new BadRequestException('content is required');
    }

    if (!Number.isSafeInteger(request.amount) || request.amount <= 0) {
      throw new BadRequestException('amount must be a positive integer');
    }

    return this.provider.generateQr({
      content: request.content.trim(),
      amount: request.amount,
    });
  }
}
