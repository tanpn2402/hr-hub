import { EmployeeFineSummary, LateFineRow } from './late-fine-report.model';

export interface MonthlyReportSummary {
  month: string; // ISO yyyy-MM
  label: string; // e.g. "Báo cáo đi trễ T8.2026"
  batchId: string;
  updatedAt: string; // ISO datetime of the last import for this month
  grandTotal: number;
}

export interface MonthlyReport extends MonthlyReportSummary {
  rows: LateFineRow[];
  employeeSummaries: EmployeeFineSummary[];
}
