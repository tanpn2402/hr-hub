import { useMemo, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
} from "lucide-react";
import dayjs from "dayjs";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  stockFeatures,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

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

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return dayjs(value).format("DD/MM/YYYY");
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function buildReviewRows(
  result: WorkforceImportResult,
): ReviewTableRow[] {
  const grouped = new Map<string, WorkforceRow[]>();

  for (const row of result.rows) {
    const existing = grouped.get(row.employeeCode) ?? [];
    existing.push(row);
    grouped.set(row.employeeCode, existing);
  }

  const summaryMap = new Map(
    result.employeeSummaries.map((summary) => [
      summary.employeeCode,
      summary,
    ]),
  );

  const output: ReviewTableRow[] = [];

  for (const [employeeCode, rows] of grouped) {
    const sortedRows = [...rows].sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    for (let index = 0; index < sortedRows.length; index++) {
      const row = sortedRows[index];

      output.push({
        ...row,
        rowType: "detail",
        id: `${employeeCode}-${row.date}-${index}`,
      });
    }

    const summary = summaryMap.get(employeeCode);

    output.push({
      rowType: "summary",
      id: `summary-${employeeCode}`,
      employeeCode,
      employeeName:
        summary?.employeeName ??
        rows[0]?.employeeName ??
        employeeCode,
      totalFine:
        summary?.totalFine ??
        rows.reduce(
          (total, row) => total + row.fineAmount,
          0,
        ),
      violationCount: rows.length,
    });
  }

  return output;
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

const features = tableFeatures(stockFeatures);

type Props = {
  data: WorkforceImportResult;
};

const GRID_COLUMNS =
  "minmax(220px, 2fr) minmax(120px, 1fr) minmax(100px, 0.8fr) minmax(100px, 0.8fr) minmax(220px, 2fr) minmax(140px, 1fr)";

export function LateHubReviewTable({ data }: Props) {
  const tableData = useMemo(
    () => buildReviewRows(data),
    [data],
  );

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
              <div className="flex items-center gap-3 pl-11">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <CalendarDays className="size-3.5 text-primary" />
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tổng kết
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {item.violationCount} lần vi phạm
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {getInitials(item.employeeName)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="truncate font-medium">
                  {item.employeeName}
                </div>

                <div className="font-mono text-[11px] text-muted-foreground">
                  {item.employeeCode}
                </div>
              </div>
            </div>
          );
        },
      },

      {
        id: "date",
        accessorFn: (row) =>
          row.rowType === "detail" ? row.date : "",
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
                Thứ {item.dayOfWeek}
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
        accessorFn: (row) =>
          row.rowType === "detail" ? row.checkOut : "",
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
            return (
              <div className="text-right text-xs text-muted-foreground">
                Tổng tiền phạt
              </div>
            );
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
    ],
    [],
  );

  const table = useTable({
    features,
    data: tableData,
    columns,
  });

  const rows = table.getRowModel().rows;

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
        className="max-h-[calc(92vh-240px)] overflow-auto"
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
            {table.getHeaderGroups()[0].headers.map((header) => (
              <div
                key={header.id}
                className="flex h-10 items-center px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {header.isPlaceholder
                  ? null
                  : header.column.getCanSort()
                    ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <table.FlexRender
                          header={header}
                        />

                        {header.column.getIsSorted() ===
                          "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : header.column.getIsSorted() ===
                          "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    )
                    : (
                      <table.FlexRender
                        header={header}
                      />
                    )}
              </div>
            ))}
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
    </div>
  );
}
