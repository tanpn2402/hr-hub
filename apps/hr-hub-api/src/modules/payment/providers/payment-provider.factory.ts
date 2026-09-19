import { ConfigService } from '@nestjs/config';
import { TraceContextService } from '../../app/trace/trace-context.service';
import { ApiPayProvider } from './apipay.provider';
import { IntegratedPaymentProvider } from './integrated-payment.provider';

export const INTEGRATED_PAYMENT_PROVIDER = Symbol('INTEGRATED_PAYMENT_PROVIDER');

export function paymentProviderFactory(config: ConfigService, traceContext: TraceContextService): IntegratedPaymentProvider {
  const provider = config.getOrThrow<string>('PAYMENT_PROVIDER').trim().toUpperCase();

  switch (provider) {
    case 'APIPAY':
      return new ApiPayProvider(config, traceContext);
    default:
      throw new Error(`Unsupported payment provider: ${provider}`);
  }
}
