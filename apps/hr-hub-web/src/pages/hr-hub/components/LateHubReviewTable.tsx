import { useMemo, useState } from 'react';

import { LateHubSummaryTable } from './LateHubSummaryTable';
import { LateHubDetailTable } from './LateHubDetailTable';
import { useTranslation } from 'react-i18next';
import { EmployeesPicker } from './EmployeesPicker';
import { ImportWorkforceResponse } from '../api/workforce';

type Props = {
  data: ImportWorkforceResponse;
};

export function LateHubReviewTable({ data }: Props) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<string>('detail');
  const [paymentStatus, setPaymentStatus] = useState<string>('all');

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const aggregatedData = useMemo(() => {
    const employeeSummaries =
      paymentStatus === 'all'
        ? data.employeeSummaries
        : data.employeeSummaries.filter(
          ({ monthFinePaidStatus }) => monthFinePaidStatus === paymentStatus,
        );
    let rows =
      paymentStatus === 'all'
        ? data.rows
        : data.rows.filter(({ monthFinePaidStatus }) => monthFinePaidStatus === paymentStatus);
    rows = selectedEmployees.length
      ? rows.filter((row) => selectedEmployees.includes(row.employeeCode))
      : rows;

    return {
      ...data,
      employeeSummaries,
      rows,
    };
  }, [data, selectedEmployees, paymentStatus, viewMode]);

  return (
    <>
      <div className="flex items-center mb-2 gap-4">
        <div className="flex items-center rounded-lg border bg-background p-0.5">
          {[
            ['detail', t('detail')],
            ['summary', t('summary')],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setViewMode(value)}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === value
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center rounded-lg border bg-background p-0.5">
          {[
            ['all', t('all')],
            ['completed', t('payment_completed')],
            ['pending', t('payment_pending')],
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

        {/* Employee filter */}
        <EmployeesPicker
          selectedEmployees={selectedEmployees}
          setSelectedEmployees={setSelectedEmployees}
        />
      </div>

      {viewMode === 'detail' ? (
        <LateHubDetailTable data={aggregatedData} />
      ) : (
        <LateHubSummaryTable
          data={aggregatedData}
          onEmployeeClick={(employeeCode) => {
            setSelectedEmployees([employeeCode]);
            setViewMode('detail');
          }}
        />
      )}
    </>
  );
}
