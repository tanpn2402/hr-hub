export interface LateFineRow {
  employeeCode: string;
  employeeName: string;
  date: string; // ISO yyyy-MM-dd
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

export interface LateFineReport {
  rows: LateFineRow[];
  employeeSummaries: EmployeeFineSummary[];
  grandTotal: number;
}
