import type { ImportResult, MonthlyReport, MonthlyReportSummary } from './types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3003';

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
  }
  return (await response.json()) as T;
}

export function fetchReportList(): Promise<MonthlyReportSummary[]> {
  return fetch(`${BASE_URL}/workforce/reports`).then((res) => parseJsonOrThrow<MonthlyReportSummary[]>(res));
}

export function fetchReport(month: string): Promise<MonthlyReport> {
  return fetch(`${BASE_URL}/workforce/reports/${month}`).then((res) => parseJsonOrThrow<MonthlyReport>(res));
}

export function reportExportUrl(month: string): string {
  return `${BASE_URL}/workforce/reports/${month}/export`;
}

export async function importFiles(attendanceFile: File, leaveFile: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('files', attendanceFile);
  formData.append('files', leaveFile);

  const response = await fetch(`${BASE_URL}/workforce/import`, { method: 'POST', body: formData });
  return parseJsonOrThrow<ImportResult>(response);
}
