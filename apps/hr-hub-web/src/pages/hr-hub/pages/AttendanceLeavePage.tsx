import { useMemo, useState } from "react";
import {
  Banknote,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Eye,
  FileWarning,
  MessageSquareText,
  BadgeCheck,
  Upload,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { HRMetricCard } from "../components/HRMetricCard";
import { ImportDataDialog } from "../components/ImportDataDialog";
import { HRPageHeader } from "../components/HRPageHeader";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { apiClient } from "@/api/client";
import { WorkforceImportHistory } from "../components/WorkforceImportHistory";
import { LateHubReviewDialog } from "../components/LateHubReviewDialog";
import { WorkforceRow } from "../api/workforce";
import { getWorkforceFeedback } from "../api/workforce";
import { FeedbackReviewDialog } from "../components/FeedbackReviewDialog";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type EmployeeSummary = {
  employeeCode: string;
  name: string;
  totalFine: number;
  attendanceCount?: number;
};

type MonthlyReport = {
  employeeSummaries: EmployeeSummary[];
  grandTotal: number;
  rows: WorkforceRow[];
};

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

async function getAvailableMonths(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>(
    "/workforce/reports",
  );

  return data;
}

async function getMonthlyReport(
  month: string,
): Promise<MonthlyReport> {
  const { data } = await apiClient.get<MonthlyReport>(
    `/workforce/reports/${month}`,
  );

  return data;
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

function useMonthlyReport(
  currentMonth: string | null
) {
  return useQuery({
    queryKey: ["workforce", "report", currentMonth],
    queryFn: () => getMonthlyReport(currentMonth ?? ""),
    enabled: Boolean(currentMonth),
  });
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatMonth(value: string) {
  const [year, month] = (value ?? "2026-08").split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function AttendanceLeavePage() {
  const [importOpen, setImportOpen] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "approved">("all");

  /* ---------------------------------------------------------------------- */
  /* Queries                                                                */
  /* ---------------------------------------------------------------------- */

  const monthsQuery = useQuery({
    queryKey: ["workforce", "report-months"],
    queryFn: getAvailableMonths,
  });

  const months = monthsQuery.data ?? [];

  const currentMonth = selectedMonth ?? months[0] ?? "";

  const reportQuery = useMonthlyReport(currentMonth);

  const report = reportQuery.data;
  const feedbackQuery = useQuery({
    queryKey: ["workforce", "feedback", currentMonth],
    queryFn: () => getWorkforceFeedback(currentMonth),
    enabled: Boolean(currentMonth),
  });

  /* ---------------------------------------------------------------------- */
  /* Stats                                                                  */
  /* ---------------------------------------------------------------------- */

  const stats = useMemo(() => {
    if (!report) {
      return {
        employees: 0,
        attendance: 0,
        late: 0,
        fines: 0,
      };
    }

    const late = report.employeeSummaries.reduce(
      (count, employee) =>
        count +
        (employee.totalFine > 0 ? 1 : 0),
      0,
    );

    const attendance = report.employeeSummaries.reduce(
      (count, employee) =>
        count + (employee.attendanceCount ?? 0),
      0,
    );

    return {
      employees: report.employeeSummaries.length,
      attendance,
      late,
      fines: report.grandTotal,
    };
  }, [report]);

  /* ---------------------------------------------------------------------- */
  /* Actions                                                                */
  /* ---------------------------------------------------------------------- */

  function handleViewMonthly() {
    setReviewOpen(true);
  }

  function openFeedbackDialog(filter: "all" | "approved") {
    setFeedbackFilter(filter);
    setFeedbackOpen(true);
  }

  const feedbackSummary = feedbackQuery.data?.summary;
  const feedbackTotal = feedbackSummary?.total ?? 0;
  const reviewedPercent = feedbackTotal ? Math.round(((feedbackSummary?.reviewed ?? 0) / feedbackTotal) * 100) : 0;
  const approvedPercent = feedbackTotal ? Math.round(((feedbackSummary?.approved ?? 0) / feedbackTotal) * 100) : 0;

  return (
    <div>
      <HRPageHeader
        title="Attendance & Leave"
        description="Review employee attendance, late hours, and leave records."
        actions={
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 size-4" />
            Import data
          </Button>
        }
      />

      <div className="px-6 pb-8">
        {/* -------------------------------------------------------------- */}
        {/* Month selector                                                   */}
        {/* -------------------------------------------------------------- */}

        <div className="mt-6 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              Attendance overview
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Monthly attendance and leave summary
            </p>
          </div>

          <Select
            value={currentMonth}
            onValueChange={setSelectedMonth}
            disabled={!months.length}
          >
            <SelectTrigger className="w-47.5">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>

            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonth(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Metrics                                                          */}
        {/* -------------------------------------------------------------- */}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <HRMetricCard
            title="Employees"
            value={stats.employees.toLocaleString()}
            description="Employees in this report"
            icon={Users}
          />

          <HRMetricCard
            title="Attendance records"
            value={stats.attendance.toLocaleString()}
            description="Imported attendance records"
            icon={CalendarCheck}
          />

          <HRMetricCard
            title="Late employees"
            value={stats.late.toLocaleString()}
            description="Employees with late records"
            icon={Clock3}
          />

          <HRMetricCard
            title="Total fines"
            value={`${formatMoney(stats.fines)} ₫`}
            description="Total attendance fines"
            icon={Banknote}
          />

          <HRMetricCard
            title="Feedback"
            value={`${feedbackSummary?.reviewed ?? 0} / ${feedbackTotal}`}
            description={`${reviewedPercent}% reviewed`}
            icon={MessageSquareText}
            onClick={() => openFeedbackDialog("all")}
          />

          <HRMetricCard
            title="Approved Feedback"
            value={`${feedbackSummary?.approved ?? 0} / ${feedbackTotal}`}
            description={`${approvedPercent}% approved`}
            icon={BadgeCheck}
            onClick={() => openFeedbackDialog("approved")}
          />
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Current report                                                   */}
        {/* -------------------------------------------------------------- */}

        <div className="mt-8 rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="text-sm font-semibold">
                {currentMonth
                  ? formatMonth(currentMonth)
                  : "Attendance report"}
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Attendance and leave data
              </div>
            </div>

            <Badge
              variant="secondary"
              className="gap-1"
            >
              <CheckCircle2 className="size-3.5" />
              Imported
            </Badge>
          </div>

          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <FileWarning className="size-4 text-muted-foreground" />
              </div>

              <div>
                <div className="text-sm font-medium">
                  Review employee attendance
                </div>

                <div className="text-xs text-muted-foreground">
                  Open the detailed Late Hub review for this month.
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => handleViewMonthly()}
              disabled={!currentMonth}
            >
              <Eye className="mr-2 size-4" />
              View details
            </Button>
          </div>
        </div>

        <WorkforceImportHistory />
      </div>

      <ImportDataDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      <LateHubReviewDialog
        open={reviewOpen}
        data={reportQuery.data ? {
          batchId: "",
          status: "confirmed",
          employeeSummaries: reportQuery.data.employeeSummaries,
          grandTotal: reportQuery.data.grandTotal,
          rows: reportQuery.data.rows,
        } : null}
        onOpenChange={setReviewOpen}
      />

      <FeedbackReviewDialog
        open={feedbackOpen}
        month={currentMonth}
        initialFilter={feedbackFilter}
        onOpenChange={setFeedbackOpen}
      />
    </div>
  );
}
