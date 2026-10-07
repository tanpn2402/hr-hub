import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from 'react-i18next';
import { formatMonth } from '@/lib/time-utils';
import { FinePayment, FinePaymentPreviewResponse } from '../api/workforce';
import { cn } from 'cn';
import { formatMoney } from '@/lib/format-utils';

export function FinePaymentPreview({
  preview,
  selectedIds,
  onSelectedIdsChange,
  onViewPendingPayment,
}: {
  preview: FinePaymentPreviewResponse;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onViewPendingPayment: (payment: FinePayment) => void;
}) {
  const { t } = useTranslation();

  const pendingPayment = preview.pendingTransactions[0] ?? null;

  const selectedFines = useMemo(
    () => preview.availableMonthlyFines.filter((item) => selectedIds.includes(item.id)),
    [preview.availableMonthlyFines, selectedIds],
  );

  const totalAmount = selectedFines.reduce((sum, item) => sum + item.payableAmount, 0);

  const allSelected =
    preview.availableMonthlyFines.length > 0 &&
    selectedIds.length === preview.availableMonthlyFines.length;

  const toggleAll = () => {
    if (allSelected) {
      onSelectedIdsChange([]);
      return;
    }

    onSelectedIdsChange(preview.availableMonthlyFines.map((item) => item.id));
  };

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((item) => item !== id));
      return;
    }

    onSelectedIdsChange([...selectedIds, id]);
  };

  return (
    <div className="space-y-4">
      {pendingPayment ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-yellow-900">{t('employee_has_pending_payment')}</div>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-yellow-800">
                {!pendingPayment.monthlyFines?.length
                  ? null
                  : pendingPayment.monthlyFines.map((fine) => formatMonth(fine.month)).join(' • ')}

                <div className="text-sm text-yellow-800">{formatMoney(pendingPayment.amount)}</div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onViewPendingPayment(pendingPayment)}
            >
              {t('view_transaction')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{t('monthly_fines')}</div>

          <div className="text-sm text-muted-foreground">{t('select_months_to_pay')}</div>
        </div>

        {preview.availableMonthlyFines.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
            {allSelected ? t('deselect_all') : t('select_all')}
          </Button>
        ) : null}
      </div>

      {preview.availableMonthlyFines.length === 0 ? (
        <div className="flex min-h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          {t('no_available_fines')}
        </div>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {preview.availableMonthlyFines.map((monthlyFine) => {
            const selected = selectedIds.includes(monthlyFine.id);

            return (
              <label
                key={monthlyFine.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3',
                  'cursor-pointer hover:bg-muted/50',
                )}
              >
                <Checkbox checked={selected} onCheckedChange={() => toggleItem(monthlyFine.id)} />

                <div className="min-w-0 flex-1">
                  <div className="font-medium">{formatMonth(monthlyFine.month, 'MMMM, YYYY')}</div>
                </div>

                <div className="font-mono font-semibold">
                  {formatMoney(monthlyFine.payableAmount)}
                </div>
              </label>
            );
          })}
        </div>
      )}

      <div className="rounded-lg bg-muted p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">{t('total')}</span>

          <span className="font-mono text-xl font-bold">{formatMoney(totalAmount)}</span>
        </div>

        <div className="mt-1 text-right text-sm text-muted-foreground">
          {t('selected_months')}: {selectedIds.length}
        </div>
      </div>
    </div>
  );
}
