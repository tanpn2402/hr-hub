import { FinePaymentHistory } from '../components/FinePaymentHistory';
import { HRPageHeader } from '../components/HRPageHeader';

import { useTranslation } from 'react-i18next';

export function FinePaymentHistoryPage() {
  const { t } = useTranslation();
  return (
    <div>
      <HRPageHeader title={t('attendance_and_leave_fine_payment_history')} />

      <div className="px-6 pb-8">
        <FinePaymentHistory />
      </div>
    </div>
  );
}
