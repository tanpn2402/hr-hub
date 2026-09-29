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
  DatabaseX,
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

import { LateHubReviewDialog } from "../components/LateHubReviewDialog";
import { getWorkforceFeedback } from "../api/workforce";
import { FeedbackReviewDialog } from "../components/FeedbackReviewDialog";
import { useTranslation } from "react-i18next";
import { formatMonth } from "@/lib/time-utils";
import { useAvailableMonths, useMonthlyReport } from "../hooks/useWorkforce";
import { formatMoney } from "@/lib/format-utils";


export function AttendanceLeavePage() {
  const { t } = useTranslation();
  const [importOpen, setImportOpen] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "approved">("all");

  /* ---------------------------------------------------------------------- */
  /* Queries                                                                */
  /* ---------------------------------------------------------------------- */

  const monthsQuery = useAvailableMonths();

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
        title={t("attendance_and_leave")}
        description={t("review_employee_attendance_late_hours_and_leave_records")}
        actions={
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 size-4" />
            {t("import_data")}
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
              {t("attendance_overview")}
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              {t("monthly_attendance_and_leave_summary")}
            </p>
          </div>

          <Select
            value={currentMonth}
            onValueChange={setSelectedMonth}
            disabled={!months.length}
            items={months.map(month => ({
              value: month,
              label: formatMonth(month),
            }))}
          >
            <SelectTrigger className="w-47.5">
              <SelectValue placeholder={t("select_month")} />
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
            title={t("employees")}
            value={stats.employees.toLocaleString()}
            description={t("employees_in_this_report")}
            icon={Users}
          />

          <HRMetricCard
            title={t("attendance_records")}
            value={stats.attendance.toLocaleString()}
            description={t("imported_attendance_records")}
            icon={CalendarCheck}
          />

          <HRMetricCard
            title={t("late_employees")}
            value={stats.late.toLocaleString()}
            description={t("employees_with_late_records")}
            icon={Clock3}
          />

          <HRMetricCard
            title={t("total_fines")}
            value={`${formatMoney(stats.fines)} ₫`}
            description={t("total_attendance_fines")}
            icon={Banknote}
          />

          <HRMetricCard
            title={t("feedback")}
            value={`${feedbackSummary?.reviewed ?? 0} / ${feedbackTotal}`}
            description={t("percent_reviewed", { percent: reviewedPercent })}
            icon={MessageSquareText}
            onClick={() => openFeedbackDialog("all")}
          />

          <HRMetricCard
            title={t("approved_feedback")}
            value={`${feedbackSummary?.approved ?? 0} / ${feedbackTotal}`}
            description={t("percent_approved", { percent: approvedPercent })}
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
                  : t("attendance_report")}
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                {t("attendance_and_leave_data")}
              </div>
            </div>

            {!currentMonth ? (
              <Badge
                variant="secondary"
                className="gap-1 text-destructive"
              >
                <DatabaseX className="size-3.5" />
                {t("not_yet_imported")}
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="gap-1"
              >
                <CheckCircle2 className="size-3.5" />
                {t("data_imported")}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <FileWarning className="size-4 text-muted-foreground" />
              </div>

              <div>
                <div className="text-sm font-medium">
                  {t("review_employee_attendance")}
                </div>

                <div className="text-xs text-muted-foreground">
                  {t("open_the_detailed_late_hub_review_for_this_month")}
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => handleViewMonthly()}
              disabled={!currentMonth}
            >
              <Eye className="mr-2 size-4" />
              {t("view_details")}
            </Button>
          </div>
        </div>
      </div>

      <ImportDataDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      <LateHubReviewDialog
        open={reviewOpen}
        data={reportQuery.data ? {
          batchId: "",
          month: reportQuery.data.month,
          status: "confirmed",
          employeeSummaries: reportQuery.data.employeeSummaries,
          grandTotal: reportQuery.data.grandTotal,
          paidAmount: reportQuery.data.paidAmount,
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
