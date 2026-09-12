import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseHTTPService } from '../../../core/base/base-http.service';
import { TraceContextService } from '../../app/trace/trace-context.service';
import { IntegratedPaymentAccount } from '../models/integrated-payment-account.model';
import { GenerateQrRequest, GenerateQrResult, IntegratedPaymentProvider } from './integrated-payment.provider';

interface ApiPayResponse {
  data: GenerateQrResult;
}

interface ApiPayPaymentResponse {
  data: {
    status: string;
  };
}

interface ApiPayError {
  status?: string;
  message?: string;
}

@Injectable()
export class ApiPayProvider extends BaseHTTPService implements IntegratedPaymentProvider {
  private readonly account: IntegratedPaymentAccount;

  constructor(
    private readonly config: ConfigService,
    traceContext: TraceContextService,
  ) {
    super(
      {
        baseURL: config.getOrThrow<string>('APIPAY_HOST').replace(/\/$/, ''),
        timeout: config.get<number>('APIPAY_HTTP_TIMEOUT_MS', 10000),
      },
      ApiPayProvider.name,
      traceContext,
    );

    this.account = new IntegratedPaymentAccount(
      'APIPAY',
      config.getOrThrow<string>('APIPAY_ACCESS_KEY'),
      config.getOrThrow<string>('APIPAY_SECRET_KEY'),
      config.getOrThrow<string>('APIPAY_BANK_PUBLIC_ID'),
    );
  }

  async generateQr(request: GenerateQrRequest): Promise<GenerateQrResult> {
    this.logger.log(`Generating QR for amount=${request.amount}`);

    try {
      const response = await this.request<ApiPayResponse, ApiPayError>(
        'POST',
        '/v1/client/payment-requests',
        {
          content: request.content,
          amount: request.amount,
          bankPublicId: this.account.bankPublicId,
        },
        {
          Authorization: this.account.authorizationHeader(),
          'Content-Type': 'application/json',
        },
      );

      if (response.status !== 200) {
        const errorData = response.data as ApiPayError | undefined;
        throw new BadGatewayException(errorData?.message ?? 'Apipay QR generation failed');
      }

      const paymentResponse = response.data as ApiPayResponse;
      this.logger.log(`QR generated publicId=${paymentResponse.data.publicId}`);
      return paymentResponse.data;
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Apipay QR generation failed');
    }
  }

  async isTransactionFullyFilled(externalId: string): Promise<boolean> {
    this.logger.log(`Checking payment status publicId=${externalId}`);

    try {
      const response = await this.request<ApiPayPaymentResponse, ApiPayError>(
        'GET',
        `/v1/payment-requests/${encodeURIComponent(externalId)}`,
        undefined,
        {
          Authorization: this.account.authorizationHeader(),
        },
      );

      const paymentResponse = response.data as ApiPayPaymentResponse | undefined;
      const completed = response.status === 200 && paymentResponse?.data.status === 'COMPLETED';
      this.logger.log(`Payment status publicId=${externalId} completed=${completed}`);
      return completed;
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Apipay payment status check failed');
    }
  }
}
