import { useMemo, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Check, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  metaHelper,
  stockFeatures,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';

import { apiClient } from '@/api/client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { formatMoney } from '@/lib/format-utils';
import { EmployeesPicker } from './EmployeesPicker';
import { useAvailableMonths } from '../hooks/useWorkforce';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMonth } from '@/lib/time-utils';
import {
  useRejectFinePaymentMutation,
  useSettleFinePaymentMutation,
} from '../hooks/useFinePayment';
import { InlineButtonActionConfirm } from './InlineButtonActionConfirm';
import { FinePayment } from '../api/workforce';

export type FinePaymentHistoryParams = {
  month?: string;
  employeeCode?: string;
  status?: string;
};

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

export async function getFinePaymentHistory(
  params: FinePaymentHistoryParams = {},
): Promise<FinePayment[]> {
  const { data } = await apiClient.get<FinePayment[]>('/fines/payment/history', {
    params,
  });

  return data;
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

export function useFinePaymentHistory(params: FinePaymentHistoryParams = {}) {
  return useQuery({
    queryKey: ['fine-payment', 'history', params],
    queryFn: () => getFinePaymentHistory(params),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

const features = tableFeatures({
  ...stockFeatures,
  columnMeta: metaHelper<{ textRight?: boolean }>(),
});

export function FinePaymentHistory() {
  const { t } = useTranslation();

  const queryClient = useQueryClient();

  const [paymentStatus, setPaymentStatus] = useState<string>('all');

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const [rejectPaymentId, setRejectPaymentId] = useState<string | null>(null);

  const [settlePaymentId, setSettlePaymentId] = useState<string | null>(null);

  const rejectMutation = useRejectFinePaymentMutation();

  const settleMutation = useSettleFinePaymentMutation();

  function confirmRejectPayment() {
    if (!rejectPaymentId) {
      return;
    }

    rejectMutation.mutate(
      { paymentId: rejectPaymentId },
      {
        onSuccess: () => {
          setRejectPaymentId(null);
          queryClient.invalidateQueries({
            queryKey: ['fine-payment', 'history'],
          });
        },
      },
    );
  }

  function confirmSettlePayment() {
    if (!settlePaymentId) {
      return;
    }

    settleMutation.mutate(
      { paymentId: settlePaymentId },
      {
        onSuccess: () => {
          setRejectPaymentId(null);
          queryClient.invalidateQueries({
            queryKey: ['fine-payment', 'history'],
          });
        },
      },
    );
  }

  const { data: months = [] } = useAvailableMonths();

  const [sorting, setSorting] = useState<SortingState>([
    {
      id: 'createdAt',
      desc: true,
    },
  ]);

  const historyQuery = useFinePaymentHistory({
    employeeCode: selectedEmployees[0],
    month: selectedMonth ?? months[0] ?? undefined,
    status: paymentStatus === 'all' ? '' : (paymentStatus ?? undefined),
  });

  const data = historyQuery.data ?? [];

  const columns = useMemo<Array<ColumnDef<typeof features, FinePayment>>>(
    () => [
      {
        id: 'createdAt',
        accessorFn: (row) => row.createdAt,
        header: t('created_at'),

        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {dayjs(row.original.createdAt).locale('vi').format('DD MMM YYYY, HH:mm')}
          </span>
        ),
      },

      {
        id: 'employee',
        accessorFn: (row) => row.employeeCode,
        header: t('employee'),

        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <div className="text-xs font-mono font-medium text-primary relative top-0.5">
              {row.original.employeeCode}
            </div>

            <div className="min-w-0">
              <div className="truncate font-medium text-sm">{row.original.employeeName}</div>
            </div>
          </div>
        ),
      },

      {
        id: 'amount',
        accessorFn: (row) => row.amount,

        meta: {
          textRight: true,
        },

        header: () => <div className="text-right">{t('amount')}</div>,

        cell: ({ row }) => (
          <div className="text-right font-mono font-medium">{formatMoney(row.original.amount)}</div>
        ),
      },

      {
        id: 'paymentMethod',
        accessorFn: (row) => row.paymentMethod ?? '',
        header: t('payment_method'),

        cell: ({ row }) => {
          const value = row.original.paymentMethod;

          if (!value) {
            return <span className="text-muted-foreground">-</span>;
          }

          return (
            <Badge variant="outline" className="min-w-20">
              {value}
            </Badge>
          );
        },
      },

      {
        id: 'paidAt',
        accessorFn: (row) => row.paidAt ?? '',
        header: t('paid_at'),

        cell: ({ row }) => {
          const paidAt = row.original.paidAt;

          if (!paidAt) {
            return <span className="text-muted-foreground text-xs">-</span>;
          }

          return (
            <span className="text-muted-foreground text-xs">
              {dayjs(paidAt).locale('vi').format('DD MMM YYYY, HH:mm')}
            </span>
          );
        },
      },

      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: t('status'),

        cell: ({ row }) => {
          const status = row.original.status;

          if (status === 'settled') {
            return (
              <Badge variant="secondary" className="gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {t('settled')}
              </Badge>
            );
          }

          if (status === 'cancelled') {
            return (
              <Badge variant="outline" className="gap-1">
                <span className="size-1.5 rounded-full bg-red-500" />
                {t('cancelled')}
              </Badge>
            );
          }

          if (status === 'expired') {
            return (
              <Badge variant="outline" className="gap-1">
                <span className="size-1.5 rounded-full bg-gray-500" />
                {t('expired')}
              </Badge>
            );
          }

          return (
            <Badge variant="outline" className="gap-1">
              <span className="size-1.5 rounded-full bg-amber-500" />
              {t('pending')}
            </Badge>
          );
        },
      },

      {
        id: 'actions',
        header: '',

        cell: ({ row }) =>
          row.original.status !== 'pending' ? null : (
            <div className="flex justify-end">
              <InlineButtonActionConfirm
                open={settlePaymentId === row.original.id}
                cancelAction={() => setSettlePaymentId(null)}
                confirmAction={confirmSettlePayment}
                cancelText={t('cancel')}
                confirmText={t('confirm')}
                title={t('settle_this_payment')}
                description={t('payment_will_be_settled')}
                isLoading={rejectMutation.isPending}
                button={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('settle_this_payment')}
                    onClick={() => setSettlePaymentId(row.original.id)}
                    disabled={rejectMutation.isPending}
                  >
                    <Check className="size-4 text-primary" />
                  </Button>
                }
              />

              <InlineButtonActionConfirm
                open={rejectPaymentId === row.original.id}
                cancelAction={() => setRejectPaymentId(null)}
                confirmAction={confirmRejectPayment}
                cancelText={t('cancel')}
                confirmText={t('confirm')}
                title={t('reject_this_payment')}
                description={t('payment_will_be_rejected')}
                isLoading={rejectMutation.isPending}
                button={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('reject_this_payment')}
                    onClick={() => setRejectPaymentId(row.original.id)}
                    disabled={settleMutation.isPending}
                  >
                    <X className="size-4 text-destructive" />
                  </Button>
                }
              />
            </div>
          ),
      },
    ],
    [t, confirmRejectPayment, confirmSettlePayment, rejectPaymentId, setRejectPaymentId],
  );

  const table = useTable({
    features,
    data,
    columns,

    state: {
      sorting,
    },

    onSortingChange: setSorting,
  });

  return (
    <div>
      <div className="mt-4 flex items-center mb-2 gap-4">
        <div className="flex items-center rounded-lg border bg-background p-0.5">
          {[
            ['all', t('all')],
            ['settled', t('settled')],
            ['pending', t('pending')],
            ['rejected', t('rejected')],
            ['cancelled', t('cancelled')],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPaymentStatus(value)}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                paymentStatus === value
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <Select
          value={selectedMonth ?? months[0] ?? ''}
          onValueChange={setSelectedMonth}
          disabled={!months.length}
          items={months.map((month) => ({
            value: month,
            label: formatMonth(month),
          }))}
        >
          <SelectTrigger className="h-8! min-w-55 w-47.5 border border-border bg-white text-xs">
            <SelectValue placeholder={t('select_month')} className="text-xs" />
          </SelectTrigger>

          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {formatMonth(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Employee filter */}
        <EmployeesPicker
          multiple={false}
          selectedEmployees={selectedEmployees}
          setSelectedEmployees={setSelectedEmployees}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        {historyQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {t('loading_payment_history')}
          </div>
        ) : historyQuery.isError ? (
          <div className="flex h-32 items-center justify-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {t('failed_to_load_payment_history')}
          </div>
        ) : !data.length ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {t('no_payment_history_yet')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-8 whitespace-nowrap">
                      {header.isPlaceholder ? null : (
                        <div
                          className={
                            'flex items-center ' +
                            (header.column.columnDef.meta?.textRight ? ' justify-end' : '')
                          }
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="flex items-center gap-1 text-[10px] font-semibold tracking-wider text-muted-foreground hover:text-foreground"
                            >
                              <table.FlexRender header={header} />

                              {header.column.getIsSorted() === 'asc' ? (
                                <ArrowUp className="size-3" />
                              ) : header.column.getIsSorted() === 'desc' ? (
                                <ArrowDown className="size-3" />
                              ) : (
                                <ArrowUpDown className="size-3 opacity-40" />
                              )}
                            </button>
                          ) : (
                            <table.FlexRender header={header} />
                          )}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
