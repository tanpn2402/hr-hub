import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BaseHTTPService } from '../../../core/base/base-http.service';
import { TraceContextService } from '../../app/trace/trace-context.service';

import { GenerateQrRequest, GenerateQrResult, IntegratedPaymentProvider } from './integrated-payment.provider';

interface VietQrResponse {
  code: string;
  desc: string;
  data?: {
    acpId: number;
    accountName: string;
    qrCode: string;
    qrDataURL: string;
  };
}

interface VietQrError {
  code?: string;
  desc?: string;
}

@Injectable()
export class VietQrProvider extends BaseHTTPService implements IntegratedPaymentProvider {
  private readonly clientId: string;
  private readonly apiKey: string;

  constructor(
    readonly config: ConfigService,
    traceContext: TraceContextService,
  ) {
    super(
      {
        baseURL: config.getOrThrow<string>('VIETQR_HOST').replace(/\/$/, ''),
        timeout: config.get<number>('VIETQR_HTTP_TIMEOUT_MS', 10000),
      },
      VietQrProvider.name,
      traceContext,
    );

    this.clientId = config.getOrThrow<string>('VIETQR_CLIENT_ID');
    this.apiKey = config.getOrThrow<string>('VIETQR_API_KEY');
  }

  async generateQr(request: GenerateQrRequest): Promise<GenerateQrResult> {
    const body = {
      accountNo: this.config.getOrThrow<string>('VIETQR_ACCOUNT_NO'),
      accountName: this.config.getOrThrow<string>('VIETQR_ACCOUNT_NAME'),
      acqId: this.config.getOrThrow<number>('VIETQR_ACQ_ID'),
      amount: request.amount,
      addInfo: "",
      format: 'text',
      template: 'compact',
    };

    this.logger.log(`Generating VietQR for amount=${request.amount}, accountNo=${body.accountNo}, acqId=${body.acqId}`);

    try {
      const response = await this.request<VietQrResponse, VietQrError>('POST', '/v2/generate', body, {
        'x-client-id': this.clientId,
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      });

      if (response.status !== 200) {
        const errorData = response.data as VietQrError | undefined;

        throw new BadGatewayException(errorData?.desc ?? 'VietQR generation failed');
      }

      const paymentResponse = response.data as VietQrResponse;

      if (paymentResponse.code !== '00' || !paymentResponse.data) {
        throw new BadGatewayException(paymentResponse.desc ?? 'VietQR generation failed');
      }

      const { data } = paymentResponse;

      this.logger.log(`VietQR generated accountNo=${this.config.getOrThrow<string>('VIETQR_ACCOUNT_NO')}`);

      return {
        publicId: data.qrCode,
        payUrl: data.qrDataURL,
        qrUrl: data.qrDataURL,
        bankCode: String(data.acpId),
        accountNumber: this.config.getOrThrow<string>('VIETQR_ACCOUNT_NO'),
        amount: request.amount,
        content: request.content,
        provider: 'VIETQR',
      };
    } catch (error: any) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException('VietQR generation failed');
    }
  }

  async isTransactionFullyFilled(_externalId: string): Promise<boolean> {
    throw new BadGatewayException('VietQR does not provide payment status checking through the QR generation API');
  }
}
