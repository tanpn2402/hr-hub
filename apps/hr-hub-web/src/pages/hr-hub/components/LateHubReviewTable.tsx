import { useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
} from "lucide-react";

import {
  createSortedRowModel,
  rowSortingFeature,
  stockFeatures,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  employeeName: string;
  totalFine: number;
};

export type WorkforceImportResult = {
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
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
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
                <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
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
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
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
          row.rowType === "detail"
            ? row.checkIn
            : "",
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
          row.rowType === "detail"
            ? row.checkOut
            : "",
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
          row.rowType === "detail"
            ? row.note
            : "",
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

  return (
    <div className="overflow-auto rounded-lg border">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b bg-muted/30"
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="h-10 whitespace-nowrap px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
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
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.map((row) => {
            const item = row.original;

            if (item.rowType === "summary") {
              return (
                <tr
                  key={row.id}
                  className="border-b bg-muted/20"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2.5"
                    >
                      <table.FlexRender
                        cell={cell}
                      />
                    </td>
                  ))}
                </tr>
              );
            }

            return (
              <tr
                key={row.id}
                className="group border-b transition-colors hover:bg-muted/20"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-2.5"
                  >
                    <table.FlexRender
                      cell={cell}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 bg-muted/40">
            <td
              colSpan={5}
              className="px-4 py-3 text-right text-sm font-semibold"
            >
              Tổng cộng
            </td>

            <td className="px-4 py-3 text-right font-mono text-sm font-bold">
              {formatMoney(data.grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}