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

import { useLateHubTable } from "../hooks/useLateHubTable";
import { Button } from "@/components/ui/button";
import { SubmitFeedbackDialog } from "./SubmitFeedbackDialog";
import { SubmitFinePaymentDialog } from "./SubmitFinePaymentDialog";
import { dateOfWeek } from "@/lib/time-utils";
import { formatMoney } from "@/lib/format-utils";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type WorkforceRow = {
  employeeCode: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  note: string;
  fineAmount: number;
  fineId?: string;
};

export type EmployeeSummary = {
  employeeCode: string;
  employeeName?: string | null;
  totalFine: number;
};

export type WorkforceImportResult = {
  batchId: string;
  status?: "preview" | "confirmed";
  rows: WorkforceRow[];
  employeeSummaries: EmployeeSummary[];
  grandTotal: number;
};

type ReviewDetailRow = WorkforceRow & {
  rowType: "detail";
  id: string;
};

type ReviewSummaryRow = {
  rowType: "summary";
  id: string;
  employeeCode: string;
  employeeName: string;
  totalFine: number;
  violationCount: number;
};

type ReviewTableRow = ReviewDetailRow | ReviewSummaryRow;


/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(value: string) {
  return dayjs(value).format("DD/MM/YYYY");
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

const features = tableFeatures(stockFeatures);

type Props = {
  data: WorkforceImportResult;
};

const GRID_COLUMNS =
  "minmax(220px, 2fr) minmax(120px, 1fr) minmax(100px, 0.8fr) minmax(100px, 0.8fr) minmax(220px, 2fr) minmax(140px, 1fr) 50px";

export function LateHubDetailTable({ data }: Props) {

  const [feedbackEmployee, setFeedbackEmployee] = useState<ReviewDetailRow | null>(null);
  const [paymentEmployee, setPaymentEmployee] = useState<ReviewSummaryRow | null>(null);


  const columns = useMemo<
    Array<ColumnDef<typeof features, ReviewTableRow>>
  >(
    () => [
      {
        id: "employeeName",
        accessorFn: (row) => row.employeeName,
        header: "Nhân viên",

        cell: ({ row }) => {
          const item = row.original;

          if (item.rowType === "summary") {

            return (
              <div className="text-xs text-muted-foreground">
                Tổng tiền phạt
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
        header: "Ngày",

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
        header: "Check-in",

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
        header: "Check-out",

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
        header: "Ghi chú",

        cell: ({ row }) => {
          const item = row.original;

          if (item.rowType === "summary") {
            return null;
          }

          return (
            <span className="text-sm text-muted-foreground">
              {item.note || "—"}
            </span>
          );
        },
      },

      {
        id: "fineAmount",
        accessorFn: (row) =>
          row.rowType === "detail"
            ? row.fineAmount
            : row.totalFine,

        header: () => (
          <div className="text-right">
            Tiền phạt
          </div>
        ),

        cell: ({ row }) => {
          const item = row.original;

          if (item.rowType === "summary") {
            return (
              <div className="text-right font-mono text-sm font-semibold">
                {formatMoney(item.totalFine)}
              </div>
            );
          }

          return (
            <div className="text-right font-mono text-sm">
              {formatMoney(item.fineAmount)}
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
                    Thao tác với {employee.employeeName}
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
                      Feedback
                    </DropdownMenuItem>
                  )}

                  {!workforceSummary ? null : (
                    <DropdownMenuItem
                      onClick={() => {
                        setPaymentEmployee(workforceSummary);
                      }}
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      Thanh toán
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [],
  );

  const { table, toggleSort, getSortDirection, } = useLateHubTable({ data, columns, });

  const rows = table.getRowModel().rows;

  const sortableColumns = new Set(["employeeName", "date",]);

  /* ------------------------------------------------------------------------ */
  /* Virtualization                                                           */
  /* ------------------------------------------------------------------------ */

  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 57,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* ------------------------------------------------------------------ */}
      {/* Scroll container                                                   */}
      {/* ------------------------------------------------------------------ */}

      <div
        ref={scrollRef}
        className="max-h-[calc(92vh-260px)] overflow-auto"
      >
        <div className="min-w-225">
          {/* -------------------------------------------------------------- */}
          {/* Header                                                         */}
          {/* -------------------------------------------------------------- */}

          <div
            className="sticky top-0 z-20 grid border-b bg-muted/95 backdrop-blur"
            style={{
              gridTemplateColumns: GRID_COLUMNS,
            }}
          >
            {table.getHeaderGroups()[0].headers.map((header) => {
              const canSort = sortableColumns.has(header.column.id);
              const direction = canSort ? getSortDirection(header.column.id) : undefined;

              return (
                <div
                  key={header.id}
                  className="flex h-10 items-center px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
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
                    gridTemplateColumns: GRID_COLUMNS,
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
            Tổng cộng
          </div>

          <div className="w-32 text-right font-mono text-sm font-bold">
            {formatMoney(data.grandTotal)}
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
    </div>
  );
}
