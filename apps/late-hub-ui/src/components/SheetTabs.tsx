import type { MonthlyReportSummary } from '../types';

interface Props {
  reports: MonthlyReportSummary[];
  selectedMonth: string | null;
  onSelect: (month: string) => void;
  onAddClick: () => void;
}

/** Bottom tab bar listing one "sheet" per month, mimicking an Excel workbook's sheet tabs. */
export function SheetTabs({ reports, selectedMonth, onSelect, onAddClick }: Props) {
  return (
    <div className="tab-bar">
      {reports.map((report) => (
        <button
          key={report.month}
          type="button"
          className={`tab ${report.month === selectedMonth ? 'active' : ''}`}
          onClick={() => onSelect(report.month)}
        >
          {report.label}
        </button>
      ))}
      <button type="button" className="tab tab-add" onClick={onAddClick} title="Nhập báo cáo tháng mới">
        + Thêm tháng
      </button>
    </div>
  );
}
