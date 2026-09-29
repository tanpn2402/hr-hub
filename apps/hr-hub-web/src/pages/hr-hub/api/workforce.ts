import { apiClient } from '@/api/client';

export type WorkforceRow = {
  employeeCode: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  note: string;
  fineId?: string;
  fineAmount: number;
  monthFinePaidAmount: number;
  monthFinePaidStatus: string;
};

export type EmployeeSummary = {
  employeeCode: string;
  employeeName?: string | null;
  attendanceCount: number;
  totalFine: number;
  monthFinePaidStatus: string;
};

export type ImportWorkforceResponse = {
  batchId: string;
  rows: WorkforceRow[];
  employeeSummaries: EmployeeSummary[];
  grandTotal: number;
};

export type ImportWorkforceFilesParams = {
  attendanceFile: File;
  leaveFile: File;
};

export type FeedbackStatus = 'pending' | 'approved' | 'rejected';

export type WorkforceFeedback = {
  id: string;
  fineId: string;
  employeeCode: string;
  employeeName: string | null;
  reason: string;
  description: string | null;
  status: FeedbackStatus;
  reductionAmount: number | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkforceFeedbackList = {
  items: WorkforceFeedback[];
  summary: {
    total: number;
    reviewed: number;
    approved: number;
    pending: number;
    rejected: number;
  };
};

export type WorkforceFeedbackDetail = {
  feedback: WorkforceFeedback;
  fine: {
    id: string;
    employeeCode: string;
    employeeName: string | null;
    date: string;
    amount: number;
    adjustedAmount: number | null;
    payableAmount: number;
    currency: string;
    type: string;
    reason: string | null;
    status: string;
  };
  attendance: {
    checkIn: string | null;
    checkOut: string | null;
    note: string | null;
  } | null;
  leave: { type: string; reason: string | null; status: string } | null;
};

export type MonthlyFine = {
  id: string;
  employeeCode: string;
  employeeName?: string | null;
  month: string;
  originalAmount: number;
  reductionAmount: number;
  payableAmount: number;
  currency: string;
  status: string;
};

export type FinePayment = {
  id: string;
  employeeCode: string;
  employeeName?: string | null;

  monthlyFineIds: string;
  monthlyFines: MonthlyFine[] | null | undefined;

  amount: number;
  currency: string;

  status: string;

  paymentMethod?: string | null;
  provider?: string | null;
  providerPaymentId?: string | null;
  providerMetadata?: string | null;

  qrCode?: string | null;
  qrUrl?: string | null;

  description?: string | null;

  createdAt: string;
  expiresAt?: string | null;
};

export type FinePaymentPreviewResponse = {
  employeeCode: string;
  pendingTransactions: FinePayment[];
  availableMonthlyFines: MonthlyFine[];
};

export type SettlePaymentResponse = FinePayment;

export type SettlePaymentPayload = {
  paymentId: string;
  providerMetadata?: unknown;
};

export type RejectFinePaymentPayload = {
  paymentId: string;
  reason?: string;
};

export type ExecutePaymentPayload = {
  employeeCode: string;
  monthlyFineIds: string[];
};

export type MonthlyReport = {
  month: string;
  employeeSummaries: EmployeeSummary[];
  grandTotal: number;
  paidAmount: number;
  rows: WorkforceRow[];
};

export async function getWorkforceFeedback(month: string): Promise<WorkforceFeedbackList> {
  const { data } = await apiClient.get<WorkforceFeedbackList>('/fine-feedback', {
    params: { month },
  });
  return data;
}

export async function getWorkforceFeedbackDetail(id: string): Promise<WorkforceFeedbackDetail> {
  const { data } = await apiClient.get<WorkforceFeedbackDetail>(`/fine-feedback/${id}`);
  return data;
}

export async function approveWorkforceFeedback(
  id: string,
  payload: { reductionAmount: number; reviewNote?: string },
) {
  const { data } = await apiClient.post<WorkforceFeedback>(`/fine-feedback/${id}/approve`, payload);
  return data;
}

export async function rejectWorkforceFeedback(id: string, payload: { reviewNote?: string }) {
  const { data } = await apiClient.post<WorkforceFeedback>(`/fine-feedback/${id}/reject`, payload);
  return data;
}

export async function importWorkforceFiles({
  attendanceFile,
  leaveFile,
}: ImportWorkforceFilesParams): Promise<ImportWorkforceResponse> {
  const formData = new FormData();

  formData.append('files', attendanceFile);
  formData.append('files', leaveFile);

  const { data } = await apiClient.post<ImportWorkforceResponse>(
    '/workforce/import/preview',
    formData,
  );

  return data;
}

export async function getPaymentPreview(employeeCode: string): Promise<FinePaymentPreviewResponse> {
  const { data } = await apiClient.get<FinePaymentPreviewResponse>('/fines/payment/preview', {
    params: {
      employeeCode,
    },
  });

  return data;
}

export async function settleFinePayment(
  payload: SettlePaymentPayload,
): Promise<SettlePaymentResponse> {
  const { data } = await apiClient.post<SettlePaymentResponse>(
    `/fines/payment/${payload.paymentId}/settle`,
    {},
  );

  return data;
}

export async function rejectFinePayment(payload: RejectFinePaymentPayload): Promise<FinePayment> {
  const { data } = await apiClient.delete<FinePayment>(`/fines/payment/${payload.paymentId}`);

  return data;
}

export async function executeFinePayment(payload: ExecutePaymentPayload): Promise<FinePayment> {
  const { data } = await apiClient.post<FinePayment>('/fines/payment', payload);

  return data;
}

export async function getAvailableMonths(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/workforce/reports');

  return data;
}

export async function getMonthlyReport(month: string): Promise<MonthlyReport> {
  const { data } = await apiClient.get<MonthlyReport>(`/workforce/reports/${month}`);

  return data;
}
