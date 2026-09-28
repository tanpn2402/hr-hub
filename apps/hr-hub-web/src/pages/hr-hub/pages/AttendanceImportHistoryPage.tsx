
import { HRPageHeader } from "../components/HRPageHeader";

import { WorkforceImportHistory } from "../components/WorkforceImportHistory";

export function AttendanceImportHistoryPage() {
  return (
    <div>
      <HRPageHeader
        title="Attendance & Leave  >  Import History"
        description="Previous attendance and leave imports"
      />

      <div className="px-6 pb-8">
        <WorkforceImportHistory />
      </div>
    </div>
  );
}
