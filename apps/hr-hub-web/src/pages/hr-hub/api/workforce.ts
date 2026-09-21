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

export type FeedbackStatus = "pending" | "approved" | "rejected";

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

export async function getWorkforceFeedback(
  month: string,
): Promise<WorkforceFeedbackList> {
  const { data } = await apiClient.get<WorkforceFeedbackList>(
    "/fine-feedback",
    { params: { month } },
  );
  return data;
}

export async function getWorkforceFeedbackDetail(
  id: string,
): Promise<WorkforceFeedbackDetail> {
  const { data } = await apiClient.get<WorkforceFeedbackDetail>(
    `/fine-feedback/${id}`,
  );
  return data;
}

export async function approveWorkforceFeedback(
  id: string,
  payload: { reductionAmount: number; reviewNote?: string },
) {
  const { data } = await apiClient.post<WorkforceFeedback>(
    `/fine-feedback/${id}/approve`,
    payload,
  );
  return data;
}

export async function rejectWorkforceFeedback(
  id: string,
  payload: { reviewNote?: string },
) {
  const { data } = await apiClient.post<WorkforceFeedback>(
    `/fine-feedback/${id}/reject`,
    payload,
  );
  return data;
}

export async function importWorkforceFiles({
  attendanceFile,
  leaveFile,
}: ImportWorkforceFilesParams): Promise<ImportWorkforceResponse> {
  const formData = new FormData();

  formData.append("files", attendanceFile);
  formData.append("files", leaveFile);

  const { data } = await apiClient.post<ImportWorkforceResponse>(
    "/workforce/import/preview",
    formData,
  );

  return data;
}
