import { useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Flag,
  MoreVertical,
  QrCode,
} from "lucide-react";
import dayjs from "dayjs";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  metaHelper,
  stockFeatures,
  tableFeatures,
  type ColumnDef,
} from "@tanstack/react-table";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ReviewDetailRow, ReviewSummaryRow, useLateHubTable, WorkforceImportResult } from "../hooks/useLateHubTable";
import { Button } from "@/components/ui/button";
import { SubmitFeedbackDialog } from "./SubmitFeedbackDialog";
import { SubmitFinePaymentDialog } from "./SubmitFinePaymentDialog";
import { dateOfWeek } from "@/lib/time-utils";
import { formatMoney } from "@/lib/format-utils";
import { cn } from "cn";
import { WorkforceFeedback } from "../api/workforce";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */


type ReviewTableRow = ReviewDetailRow | ReviewSummaryRow;


/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(value: string) {
  return dayjs(value).format("DD/MM/YYYY");
}

function feedbackLabel(value: string) {
  return value.replaceAll(" ", "_").toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

const features = tableFeatures({
  ...stockFeatures,
  columnMeta: metaHelper<{ textRight?: boolean }>()
});

type Props = {
  data: WorkforceImportResult;
};

const GRID_COLUMNS =
  "minmax(220px, 2fr) minmax(120px, 1fr) minmax(100px, 0.8fr) minmax(100px, 0.8fr) minmax(220px, 2fr) minmax(140px, 1fr) 50px";
const GRID_COLUMNS_NO_ACTION =
  "minmax(220px, 2fr) minmax(120px, 1fr) minmax(100px, 0.8fr) minmax(100px, 0.8fr) minmax(220px, 2fr) minmax(140px, 1fr)";

export function LateHubDetailTable({ data }: Props) {
  const { t } = useTranslation();

  const isReviewing = useMemo(() => data.batchId !== "", [data]);

  const [feedbackEmployee, setFeedbackEmployee] = useState<ReviewDetailRow | null>(null);
  const [paymentEmployee, setPaymentEmployee] = useState<ReviewSummaryRow | null>(null);


  const columns = useMemo<
    Array<ColumnDef<typeof features, ReviewTableRow>>
  >(
    () => [
      {
        id: "employeeName",
        accessorFn: (row) => row.employeeName,
        header: t("employee"),

        cell: ({ row }) => {
          const item = row.original;

          if (item.rowType === "summary") {

            return (
              <div className="text-xs text-muted-foreground">
                {t("total_fine")}
              </div>
            );
          }

          return (
            <div className="flex min-w-0 items-center gap-2">
              <div className="text-xs font-mono font-medium text-primary relative top-0.5">
                {item.employeeCode}
              </div>

              <div className="min-w-0">
                <div className="truncate font-medium">
                  {item.employeeName}
                </div>
              </div>
            </div>
          );
        },
      },

      {
        id: "date",
        accessorFn: (row) => row.rowType === "detail" ? row.date : "",
        header: t("date"),

        cell: ({ row }) => {
          const item = row.original;

          if (item.rowType === "summary") {
            return null;
          }

          return (
            <div>
              <div className="font-mono text-sm">
                {formatDate(item.date)}
              </div>

              <div className="text-[11px] text-muted-foreground">
                {dateOfWeek(item.date)}
              </div>
            </div>
          );
        },
      },

      {
        id: "checkIn",
        accessorFn: (row) =>
          row.rowType === "detail" ? row.checkIn : "",
        header: t("check_in"),

        cell: ({ row }) => {
          const item = row.original;

          if (item.rowType === "summary") {
            return null;
          }

          return (
            <span className="font-mono text-sm">
              {item.checkIn}
            </span>
          );
        },
      },

      {
        id: "checkOut",
        accessorFn: (row) => row.rowType === "detail" ? row.checkOut : "",
        header: t("check_out"),

        cell: ({ row }) => {
          const item = row.original;

          if (item.rowType === "summary") {
            return null;
          }

          return (
            <span className="font-mono text-sm">
              {item.checkOut}
            </span>
          );
        },
      },

      {
        id: "note",
        accessorFn: (row) =>
          row.rowType === "detail" ? row.note : "",
        header: t("note"),

        cell: ({ row }) => {
          const item = row.original;

          if (item.rowType === "summary" || !item.note) {
            return null;
          }

          const notes = item.note.split(";").map(note => note.trim()).filter(note => note.length > 0);

          return (
            <div className="space-y-1">
              {notes.map((note) => (
                <div key={note + "_" + row.original.employeeCode} className="text-sm text-muted-foreground">
                  {note}
                </div>
              ))}
            </div>
          )
        },
      },

      {
        id: "fineAmount",
        meta: {
          textRight: true,
        },
        accessorFn: (row) =>
          row.rowType === "detail"
            ? row.fineAmount
            : row.totalFine,

        header: () => (
          <div className="text-right">
            {t("fine")}
          </div>
        ),

        cell: ({ row }) => {
          const item = row.original;

          if (item.rowType === "summary") {
            return (
              <div className="text-right font-mono text-sm font-semibold">
                {formatMoney(item.monthFinePaidStatus === "completed" ? 0 : item.totalFine)}
              </div>
            );
          }

          const feedback = item.feedback || [];

          return (
            <div className="flex items-center justify-end gap-2">
              {feedback.length ? (
                feedback.map(({ id, status, reason, reductionAmount }) => (
                  <Tooltip key={id}>
                    <TooltipTrigger render={<Flag className={cn("size-3.5", status === "approved" ? "text-primary" : status === "rejected" ? "text-destructive" : "")} />} />
                    <TooltipContent>
                      <p>{t("status_feedback_reason_reduction", {
                        status: t(feedbackLabel(status)),
                        reason: t(feedbackLabel(reason)),
                        reduction: status === "approved" ? `(-${formatMoney(reductionAmount ?? 0)})` : "",
                      })}</p>
                    </TooltipContent>
                  </Tooltip>
                ))
              ) : null}
              <div className={cn("text-right font-mono text-sm", item.monthFinePaidStatus === "completed" ? "line-through" : "")}>
                {formatMoney(item.fineAmount)}
              </div>
            </div>
          );
        },
      },



      {
        id: "actions",
        header: "",

        cell: ({ row }) => {
          const employee = row.original;

          const workforceSummary = employee.rowType === "summary" ? employee : null;
          const workforceDetail = employee.rowType === "detail" ? employee : null;

          const isEmpty = employee.rowType === "summary" ? workforceSummary?.totalFine === 0 : (!workforceDetail || !workforceDetail.fineId || workforceDetail.fineAmount === 0);

          if (isEmpty) return null;

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">
                    {t("actions_for_employee", { name: employee.employeeName })}
                  </span>
                </Button>}
                />

                <DropdownMenuContent align="end" className="w-44">
                  {(!workforceDetail || !workforceDetail.fineId || workforceDetail.fineAmount === 0) ? null : (
                    <DropdownMenuItem
                      onClick={() => {
                        setFeedbackEmployee(workforceDetail);
                      }}
                    >
                      <Flag className="mr-2 h-4 w-4" />
                      {t("feedback")}
                    </DropdownMenuItem>
                  )}

                  {!workforceSummary ? null : (
                    <DropdownMenuItem
                      onClick={() => {
                        setPaymentEmployee(workforceSummary);
                      }}
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      {t("payment")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [t],
  );

  const { table, sortedData, toggleSort, getSortDirection, } = useLateHubTable({
    data,
    columns,
    initialState: {
      columnVisibility: {
        actions: !isReviewing,
      }
    }
  });

  const rows = table.getRowModel().rows;

  const sortableColumns = new Set(["employeeName", "date",]);

  /* ------------------------------------------------------------------------ */
  /* Virtualization                                                           */
  /* ------------------------------------------------------------------------ */

  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => sortedData[index].rowType === "summary" ? 54 : (60 + (sortedData[index].feedback || []).length * 12),
    overscan: 15,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <>
      <div className="overflow-hidden rounded-lg border flex-1">
        {/* ------------------------------------------------------------------ */}
        {/* Scroll container                                                   */}
        {/* ------------------------------------------------------------------ */}

        <div
          ref={scrollRef}
          className="max-h-[calc(100%-40px)] overflow-auto"
        >
          <div className="min-w-225">
            {/* -------------------------------------------------------------- */}
            {/* Header                                                         */}
            {/* -------------------------------------------------------------- */}

            <div
              className="sticky top-0 z-20 grid border-b bg-muted/95 backdrop-blur"
              style={{
                gridTemplateColumns: isReviewing ? GRID_COLUMNS_NO_ACTION : GRID_COLUMNS,
              }}
            >
              {table.getHeaderGroups()[0].headers.map((header) => {
                const canSort = sortableColumns.has(header.column.id);
                const direction = canSort ? getSortDirection(header.column.id) : undefined;

                return (
                  <div
                    key={header.id}
                    className={cn(
                      "flex h-10 items-center px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                      header.column.columnDef.meta?.textRight ? "justify-end" : ""
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(header.column.id)}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <table.FlexRender header={header} />

                        {direction === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : direction === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* -------------------------------------------------------------- */}
            {/* Virtualized rows                                                */}
            {/* -------------------------------------------------------------- */}

            <div
              className="relative"
              style={{
                height: rowVirtualizer.getTotalSize(),
              }}
            >
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                const item = row.original;

                return (
                  <div
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={
                      item.rowType === "summary"
                        ? "absolute left-0 grid w-full border-b bg-muted/20"
                        : "absolute left-0 grid w-full border-b transition-colors hover:bg-muted/20"
                    }
                    style={{
                      gridTemplateColumns: isReviewing ? GRID_COLUMNS_NO_ACTION : GRID_COLUMNS,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div
                        key={cell.id}
                        className="min-w-0 px-4 py-2.5"
                      >
                        <table.FlexRender
                          cell={cell}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Grand total                                                        */}
        {/* ------------------------------------------------------------------ */}

        <div className="border-t-2 bg-muted/95">
          <div className="flex min-w-225 items-center justify-end px-4 py-3">
            <div className="mr-8 text-sm font-semibold">
              {t("grand_total")}
            </div>

            <div className="w-32 text-right font-mono text-sm font-bold">
              {formatMoney(data.grandTotal)}
            </div>
          </div>
        </div>
      </div>


      {/* Feedback Dialog */}
      <SubmitFeedbackDialog
        feedbackEmployee={feedbackEmployee}
        onOpenChange={() => setFeedbackEmployee(null)}
      />

      {/* Payment Dialog */}
      <SubmitFinePaymentDialog
        paymentEmployee={
          !paymentEmployee ? null : {
            employeeCode: paymentEmployee.employeeCode,
            employeeName: paymentEmployee.employeeName,
            totalFine: paymentEmployee.totalFine,
          }}
        onOpenChange={() => setPaymentEmployee(null)}
      />
    </>
  );
}
