import { useState } from 'react';

import { AppSwitcher } from '../../apps/AppSwitcher';
import { useTranslation } from 'react-i18next';
import { useAvailableMonths, useMonthlyReport } from '../hr-hub/hooks/useWorkforce';
import { formatMonth } from '@/lib/time-utils';
import dayjs from 'dayjs';
import { LateHubReviewTable } from '../hr-hub/components/LateHubReviewTable';
import { Skeleton } from '@/components/ui/skeleton';

const CURRENT_MONTH = dayjs().subtract(1, 'month').format('YYYY-MM');

export function LateHubPage() {
  const { t } = useTranslation();
  const { data = [CURRENT_MONTH], isLoading } = useAvailableMonths();

  const [selectedMonth, setSelectedMonth] = useState<string | null>(CURRENT_MONTH);

  const reportQuery = useMonthlyReport(selectedMonth);

  return (
    <div className="h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-5">
        <div className="flex items-center gap-2">
          <AppSwitcher currentApp="late-hub" />

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold">{t('late_hub')}</h1>

            <span className="text-sm text-muted-foreground">{t('attendance')}</span>
          </div>
        </div>
      </header>

      {/* Spreadsheet table */}
      <div className="flex-1 min-h-0 overflow-auto p-2 flex flex-col">
        {reportQuery.data ? (
          <LateHubReviewTable
            data={{
              batchId: '',
              ...reportQuery.data,
            }}
          />
        ) : (
          <>
            <div className="flex items-center mb-2 gap-4">
              <Skeleton className="h-8.5 w-34 rounded-md" />
              <Skeleton className="h-8.5 w-68.5 rounded-md" />
              <Skeleton className="h-8.5 w-56" />
            </div>

            <div className="space-y-1">
              <Skeleton className="w-full h-8 rounded-sm" />
              <Skeleton className="w-full h-16 rounded-sm" />
              <Skeleton className="w-full h-16 rounded-sm" />
              <Skeleton className="w-full h-16 rounded-sm" />
              <Skeleton className="w-full h-16 rounded-sm" />
              <Skeleton className="w-full h-16 rounded-sm" />
            </div>
          </>
        )}
      </div>

      {/* Sheets */}
      <div className="flex items-center justify-between px-2 pb-2">
        {isLoading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="w-54 h-10 rounded-sm" />
            <Skeleton className="w-54 h-10 rounded-sm" />
          </div>
        ) : (
          <div className="flex items-center rounded-lg border bg-background p-0.5">
            {data.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedMonth(value)}
                className={[
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  selectedMonth === value
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {formatMonth(value, 'MMMM')}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
