
import { HRPageHeader } from "../components/HRPageHeader";

import { WorkforceImportHistory } from "../components/WorkforceImportHistory";
import { useTranslation } from "react-i18next";

export function AttendanceImportHistoryPage() {
  const { t } = useTranslation();
  return (
    <div>
      <HRPageHeader
        title={t("attendance_and_leave_import_history")}
        description={t("previous_attendance_and_leave_imports")}
      />

      <div className="px-6 pb-8">
        <WorkforceImportHistory />
      </div>
    </div>
  );
}
