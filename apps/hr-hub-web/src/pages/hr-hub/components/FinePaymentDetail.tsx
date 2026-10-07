import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { formatMonth } from '@/lib/time-utils';
import { FinePayment } from '../api/workforce';
import { PaymentQRCode } from './PaymentQRCode';
import { formatMoney } from '@/lib/format-utils';

export function FinePaymentDetail({ payment }: { payment: FinePayment }) {
  const { t } = useTranslation();

  const qrUrl = useMemo(
    () => (payment.providerMetadata ? JSON.parse(payment.providerMetadata) : { qrUrl: null }).qrUrl,
    [payment],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center">
        {qrUrl ? (
          <PaymentQRCode qrCodeUrl={qrUrl} completed={payment.status === 'settled'} />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            {t('payment_qr_missing')}
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm text-muted-foreground">{t('amount')}</span>

          <span className="font-mono font-bold">{formatMoney(payment.amount)}</span>
        </div>

        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm text-muted-foreground">{t('month')}</span>

          <div className="font-normal">
            {!payment.monthlyFines?.length
              ? null
              : payment.monthlyFines.map((fine) => (
                  <div key={fine.month}>{formatMonth(fine.month)}</div>
                ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-3">
          <span className="text-sm text-muted-foreground">{t('status')}</span>

          <span className="font-medium">{t('payment_qr_' + payment.status)}</span>
        </div>
      </div>

      {payment.description ? (
        <p className="text-center text-sm text-muted-foreground">{payment.description}</p>
      ) : null}
    </div>
  );
}
