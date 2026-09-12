export interface LateFineRow {
  employeeCode: string;
  employeeName: string;
  date: string; // ISO yyyy-MM-dd
  dayOfWeek: string;
  checkIn: string | null; // HH:mm
  checkOut: string | null; // HH:mm
  note: string | null;
  fineAmount: number;
}

export interface EmployeeFineSummary {
  employeeCode: string;
  employeeName: string;
  totalFine: number;
}

export interface MonthlyReportSummary {
  month: string; // ISO yyyy-MM
  label: string; // e.g. "Báo cáo đi trễ T8.2026"
  batchId: string;
  updatedAt: string;
  grandTotal: number;
}

export interface MonthlyReport extends MonthlyReportSummary {
  rows: LateFineRow[];
  employeeSummaries: EmployeeFineSummary[];
}

export interface ImportResult {
  batchId: string;
  month: string | null;
  message: string;
}
