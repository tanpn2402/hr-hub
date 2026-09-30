import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFinePaymentDetail } from '@/pages/hr-hub/hooks/useFinePayment';
import { FinePaymentDetail } from '@/pages/hr-hub/components/FinePaymentDetail';

export function LateHubPaymentPage() {
  const { t } = useTranslation();

  const { paymentId } = useParams<{ paymentId: string }>();

  const paymentQuery = useFinePaymentDetail(paymentId, {
    refetchInterval(query) {
      return query.state.data?.status === 'settled' ? 0 : 5_000;
    },
  });

  return (
    <div className="h-dvh w-screen bg-background flex items-center justify-center">
      <Dialog
        open={!!paymentQuery.data}
        onOpenChange={(open) => {
          if (!open) {
            window.close();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('fine_payment')}</DialogTitle>

            <DialogDescription>
              {paymentQuery.data?.employeeName} ({paymentQuery.data?.employeeCode})
            </DialogDescription>
          </DialogHeader>
          {paymentQuery.data ? <FinePaymentDetail payment={paymentQuery.data} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
