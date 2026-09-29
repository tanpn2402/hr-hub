import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Check, CreditCardCheck, CreditCardX, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { EmployeeSummary } from '../api/workforce';
import { formatMoney } from '@/lib/format-utils';
import { formatMonth } from '@/lib/time-utils';
import {
  useFinePaymentPreview,
  useRejectFinePaymentMutation,
  useSettleFinePaymentMutation,
} from '../hooks/useFinePayment';

type Props = {
  open: boolean;
  paymentEmployee: EmployeeSummary | null;
  onOpenChange: (open: boolean) => void;
};

/*
 * --------------------------------------------------------------------------
 * Component
 * --------------------------------------------------------------------------
 */

export function ConfirmFinePaymentDialog({ open, paymentEmployee, onOpenChange }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [settledIds, setSettledIds] = useState<string[]>([]);

  const [settlingIds, setSettlingIds] = useState<string[]>([]);

  const pendingQuery = useFinePaymentPreview(paymentEmployee?.employeeCode, open);

  const settleMutation = useSettleFinePaymentMutation();

  const rejectMutation = useRejectFinePaymentMutation();

  const pendingTransactions = pendingQuery.data?.pendingTransactions ?? [];

  const visibleTransactions = useMemo(
    () => pendingTransactions.filter((payment) => !settledIds.includes(payment.id)),
    [pendingTransactions, settledIds],
  );

  const selectedTransactions = useMemo(
    () => visibleTransactions.filter((payment) => selectedIds.includes(payment.id)),
    [visibleTransactions, selectedIds],
  );

  const selectedAmount = selectedTransactions.reduce((sum, payment) => sum + payment.amount, 0);

  const allSelected =
    visibleTransactions.length > 0 && selectedIds.length === visibleTransactions.length;

  const isSettling = settlingIds.length > 0;

  const togglePayment = (paymentId: string) => {
    if (settlingIds.includes(paymentId)) {
      return;
    }

    setSelectedIds((current) => {
      if (current.includes(paymentId)) {
        return current.filter((id) => id !== paymentId);
      }

      return [...current, paymentId];
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(visibleTransactions.map((payment) => payment.id));
  };

  const handleSettle = async () => {
    if (!selectedIds.length) {
      return;
    }

    /*
     * Snapshot the selection before starting.
     */
    const ids = [...selectedIds];

    setSettlingIds(ids);

    const successfulIds: string[] = [];

    try {
      /*
       * Settle sequentially.
       *
       * This is intentional:
       * - avoids sending many settlement requests at once
       * - each transaction is independently idempotent
       * - easier to handle partial failures
       */
      for (const paymentId of ids) {
        try {
          await settleMutation.mutateAsync({
            paymentId,
          });

          successfulIds.push(paymentId);
        } catch {
          /*
           * Continue with the remaining payments.
           */
        }
      }

      setSettledIds((current) => [...current, ...successfulIds]);

      setSelectedIds((current) => current.filter((id) => !successfulIds.includes(id)));

      queryClient.invalidateQueries({
        queryKey: ['fine-payment-preview'],
      });

      queryClient.invalidateQueries({
        queryKey: ['workforce', 'report'],
      });
    } finally {
      setSettlingIds([]);
    }
  };

  const handleReject = async () => {
    if (!selectedIds.length) {
      return;
    }

    /*
     * Snapshot the selection before starting.
     */
    const ids = [...selectedIds];

    setSettlingIds(ids);

    const successfulIds: string[] = [];

    try {
      /*
       * Settle sequentially.
       *
       * This is intentional:
       * - avoids sending many settlement requests at once
       * - each transaction is independently idempotent
       * - easier to handle partial failures
       */
      for (const paymentId of ids) {
        try {
          await rejectMutation.mutateAsync({
            paymentId,
          });

          successfulIds.push(paymentId);
        } catch {
          /*
           * Continue with the remaining payments.
           */
        }
      }

      setSettledIds((current) => [...current, ...successfulIds]);

      setSelectedIds((current) => current.filter((id) => !successfulIds.includes(id)));

      queryClient.invalidateQueries({
        queryKey: ['fine-payment-preview'],
      });

      queryClient.invalidateQueries({
        queryKey: ['workforce', 'report'],
      });
    } finally {
      setSettlingIds([]);
    }
  };

  const handleClose = () => {
    if (isSettling) {
      return;
    }

    setSelectedIds([]);
    setSettledIds([]);
    setSettlingIds([]);
    settleMutation.reset();

    onOpenChange(false);
  };

  const errorMessage = useMemo(() => {
    if (!settleMutation.error) {
      return null;
    }

    if (axios.isAxiosError(settleMutation.error)) {
      return settleMutation.error.response?.data?.message ?? t('payment_settle_failed');
    }

    return t('payment_settle_failed');
  }, [settleMutation.error, t]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('confirm_fine_payment')}</DialogTitle>

          <DialogDescription>
            {paymentEmployee?.employeeName} ({paymentEmployee?.employeeCode})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {pendingQuery.isLoading && (
            <div className="flex min-h-48 items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('loading')}
              </div>
            </div>
          )}

          {pendingQuery.isError && (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3">
              <p className="text-sm text-destructive">{t('payment_transactions_failed')}</p>

              <Button
                type="button"
                variant="outline"
                className="min-w-32"
                onClick={() => pendingQuery.refetch()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('retry')}
              </Button>
            </div>
          )}

          {pendingQuery.data && (
            <>
              {visibleTransactions.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border">
                  <Check className="h-8 w-8 text-green-600" />

                  <div className="font-medium">{t('no_pending_transactions')}</div>

                  <div className="text-sm text-muted-foreground">{t('all_payments_settled')}</div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t('pending_transactions')}</div>

                      <div className="text-sm text-muted-foreground">
                        {visibleTransactions.length} {t('transactions')}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSettling}
                      onClick={toggleAll}
                    >
                      {allSelected ? t('deselect_all') : t('select_all')}
                    </Button>
                  </div>

                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {visibleTransactions.map((payment) => {
                      const selected = selectedIds.includes(payment.id);

                      const settling = settlingIds.includes(payment.id);

                      return (
                        <label
                          key={payment.id}
                          className={[
                            'flex gap-3 rounded-lg border p-4',
                            settling
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer hover:bg-muted/50',
                          ].join(' ')}
                        >
                          <Checkbox
                            className="relative top-1"
                            checked={selected}
                            disabled={settling || isSettling}
                            onCheckedChange={() => togglePayment(payment.id)}
                          />

                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="font-medium">{formatMoney(payment.amount)}</div>

                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  {!payment.monthlyFines?.length
                                    ? null
                                    : payment.monthlyFines
                                        .map((fine) => formatMonth(fine.month))
                                        .join(' • ')}
                                </div>
                              </div>

                              <div className="text-right text-xs text-muted-foreground">
                                {dayjs(payment.createdAt).format('HH:mm DD/MM/YYYY')}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              {payment.paymentMethod && (
                                <span>{payment.paymentMethod.toUpperCase()}</span>
                              )}

                              <span>{payment.status}</span>
                            </div>

                            {settling && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {t('settling_payment')}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="rounded-lg bg-muted p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t('selected_transactions')}</span>

                      <span>{selectedTransactions.length}</span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-medium">{t('total')}</span>

                      <span className="font-mono text-xl font-bold">
                        {formatMoney(selectedAmount)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {errorMessage && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-w-32"
            disabled={isSettling}
            onClick={handleClose}
          >
            {t('close')}
          </Button>

          {visibleTransactions.length > 0 && (
            <>
              <Button
                type="button"
                className="min-w-32"
                disabled={!selectedIds.length || isSettling || pendingQuery.isLoading}
                onClick={handleReject}
                variant="destructive"
              >
                {isSettling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCardX className="mr-2 h-4 w-4" />
                )}

                {t('reject_payment')}
              </Button>

              <Button
                type="button"
                className="min-w-32"
                disabled={!selectedIds.length || isSettling || pendingQuery.isLoading}
                onClick={handleSettle}
              >
                {isSettling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCardCheck className="mr-2 h-4 w-4" />
                )}

                {t('confirm_payment')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
