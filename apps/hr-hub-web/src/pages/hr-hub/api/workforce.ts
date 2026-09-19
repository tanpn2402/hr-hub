import { apiClient } from "@/api/client";

export type WorkforceRow = {
  employeeCode: string;
  employeeName: string;
  date: string;
  dayOfWeek: string;
  checkIn: string;
  checkOut: string;
  note: string;
  fineAmount: number;
};

export type EmployeeSummary = {
  employeeCode: string;
  employeeName: string;
  totalFine: number;
};

export type WorkforceImportResult = {
  rows: WorkforceRow[];
  employeeSummaries: EmployeeSummary[];
  grandTotal: number;
};

export type ImportWorkforceResponse = {
  lateFineReport: WorkforceImportResult;
};

export type ImportWorkforceFilesParams = {
  attendanceFile: File;
  leaveFile: File;
};

export async function importWorkforceFiles({
  attendanceFile,
  leaveFile,
}: ImportWorkforceFilesParams): Promise<ImportWorkforceResponse> {
  const formData = new FormData();

  formData.append("files", attendanceFile);
  formData.append("files", leaveFile);

  const { data } = await apiClient.post<ImportWorkforceResponse>(
    "/workforce/import",
    formData,
  );

  return data;
}
