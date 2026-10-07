import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Check, Copy, CreditCardX, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { EmployeeSummary, FinePayment } from '../api/workforce';
import {
  useExecuteFinePaymentMutation,
  useFinePaymentDetail,
  useFinePaymentPreview,
  useRejectFinePaymentMutation,
} from '../hooks/useFinePayment';
import { FinePaymentDetail } from './FinePaymentDetail';
import { FinePaymentPreview } from './FinePaymentPreview';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';

type Props = {
  open: boolean;
  paymentEmployee: EmployeeSummary | null;
  onOpenChange: (open: boolean) => void;
};

type Step = 'preview' | 'detail';

export function SubmitFinePaymentDialog({ open, paymentEmployee, onOpenChange }: Props) {
  const { t } = useTranslation();

  const { hasPermission } = useAuth();

  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('preview');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [paymentId, setPaymentId] = useState<string | null>(null);

  const previewQuery = useFinePaymentPreview(paymentEmployee?.employeeCode, !!paymentEmployee);

  const paymentQuery = useFinePaymentDetail(paymentId, {
    refetchInterval(query) {
      return query.state.data?.status === 'settled' ? 0 : 5_000;
    },
  });

  const paymentMutation = useExecuteFinePaymentMutation();

  const rejectMutation = useRejectFinePaymentMutation();

  const totalAmount = useMemo(() => {
    if (!previewQuery.data) {
      return 0;
    }

    return previewQuery.data.availableMonthlyFines
      .filter((item) => selectedIds.includes(item.id))
      .reduce((sum, item) => sum + item.payableAmount, 0);
  }, [previewQuery.data, selectedIds]);

  /*
   * Select all available monthly fines
   * when preview is loaded.
   */
  useEffect(() => {
    if (!previewQuery.data) {
      return;
    }

    if (previewQuery.data.pendingTransactions.length > 0) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(previewQuery.data.availableMonthlyFines.map((item) => item.id));
  }, [previewQuery.data]);

  /*
   * Reset everything when employee changes.
   */
  useEffect(() => {
    setStep('preview');
    setSelectedIds([]);
    setPaymentId(null);
    paymentMutation.reset();
    rejectMutation.reset();
  }, [paymentEmployee?.employeeCode]);

  const handleViewPendingPayment = (payment: FinePayment) => {
    setPaymentId(payment.id);
    setStep('detail');
  };

  const handleExecute = () => {
    if (!paymentEmployee) {
      return;
    }

    if (!selectedIds.length) {
      return;
    }

    paymentMutation.mutate(
      {
        employeeCode: paymentEmployee.employeeCode,
        monthlyFineIds: selectedIds,
      },
      {
        onSuccess: (payment) => {
          setPaymentId(payment.id);
          setStep('detail');

          queryClient.invalidateQueries({
            queryKey: ['fine-payment-preview'],
          });

          queryClient.invalidateQueries({
            queryKey: ['workforce', 'report'],
          });
        },

        onError: (error) => {
          const message = axios.isAxiosError(error)
            ? (error.response?.data?.message ?? t('payment_failed'))
            : t('payment_failed');

          toast.error(message, { position: 'bottom-right' });
        },
      },
    );
  };

  const handleReject = () => {
    if (!paymentId) {
      return;
    }

    rejectMutation.mutate(
      {
        paymentId,
      },
      {
        onSuccess: () => {
          setStep('preview');

          queryClient.invalidateQueries({
            queryKey: ['fine-payment-preview'],
          });

          queryClient.invalidateQueries({
            queryKey: ['workforce', 'report'],
          });
        },
      },
    );
  };

  const handleBackToPreview = () => {
    setPaymentId(null);
    setStep('preview');
  };

  const handleClose = () => {
    if (previewQuery.isFetching || paymentMutation.isPending) {
      return;
    }

    paymentMutation.reset();
    rejectMutation.reset();

    onOpenChange(false);
  };

  const handleQueryError = () => {
    if (previewQuery.isError) {
      previewQuery.refetch();
    } else if (paymentQuery.isError) {
      paymentQuery.refetch();
    }
  };

  const paymentQr = paymentQuery.data?.qrCode ?? paymentQuery.data?.qrUrl;

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'detail' ? t('payment_transaction') : t('fine_payment')}
          </DialogTitle>

          <DialogDescription>
            {paymentEmployee?.employeeName} ({paymentEmployee?.employeeCode})
          </DialogDescription>
        </DialogHeader>

        {previewQuery.isLoading || paymentQuery.isLoading || paymentMutation.isPending ? (
          <div className="flex min-h-56 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {paymentMutation.isPending || paymentQuery.isLoading
                ? t('loading_new_transaction')
                : t('loading')}
            </div>
          </div>
        ) : null}

        {previewQuery.isError || paymentQuery.isError ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3">
            <p className="text-sm text-destructive">{t('payment_preview_failed')}</p>

            <Button type="button" variant="outline" onClick={handleQueryError}>
              {t('retry')}
            </Button>
          </div>
        ) : null}

        {step === 'preview' && (
          <>
            {previewQuery.data && !paymentMutation.isPending ? (
              <FinePaymentPreview
                preview={previewQuery.data}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                onViewPendingPayment={handleViewPendingPayment}
              />
            ) : null}
          </>
        )}

        {step === 'detail' ? (
          <>{paymentQuery.data ? <FinePaymentDetail payment={paymentQuery.data} /> : null}</>
        ) : null}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-w-32"
                disabled={previewQuery.isFetching || paymentMutation.isPending}
                onClick={handleClose}
              >
                {t('close')}
              </Button>

              <Button
                type="button"
                className="min-w-32"
                disabled={
                  !selectedIds.length ||
                  totalAmount <= 0 ||
                  previewQuery.isLoading ||
                  paymentMutation.isPending
                }
                onClick={handleExecute}
              >
                {t('create_payment')}

                {paymentMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
              </Button>
            </>
          )}

          {step === 'detail' && paymentId && (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-w-32"
                onClick={handleBackToPreview}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t('back')}
              </Button>

              <div className="flex-1" />

              {paymentQr && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-32"
                  onClick={() => {
                    navigator.clipboard?.writeText(paymentQr);
                  }}
                >
                  <Copy className="mr-1 h-4 w-4" />
                  {t('copy_qr_url')}
                </Button>
              )}

              {paymentQr && (
                <Button
                  type="button"
                  className="min-w-32"
                  onClick={() => {
                    window.open(paymentQr, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {t('open_payment')}
                </Button>
              )}

              <Button type="button" variant="outline" className="min-w-32" onClick={handleClose}>
                {t('close')}
              </Button>

              {paymentQuery.data?.status === 'settled' || !hasPermission('hr') ? null : (
                <Button
                  type="button"
                  className="min-w-32"
                  disabled={!paymentId || rejectMutation.isPending}
                  onClick={handleReject}
                  variant="destructive"
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCardX className="mr-2 h-4 w-4" />
                  )}

                  {t('reject_payment')}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
