import { useMemo, useRef, useState } from "react";
import {
  stockFeatures,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CheckIcon,
  MoreVertical,
  QrCode,
} from "lucide-react";

import type {
  EmployeeSummary,
  WorkforceImportResult,
} from "./LateHubReviewTable";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SubmitFinePaymentDialog } from "./SubmitFinePaymentDialog";
import { useAuth } from "@/auth/useAuth";
import { cn } from "cn";

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

const features = tableFeatures(stockFeatures);

type Props = {
  data: WorkforceImportResult;
};

export function LateHubSummaryTable({ data }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const isReviewing = useMemo(() => data.batchId !== "", [data]);

  const { hasPermission } = useAuth();

  const [paymentEmployee, setPaymentEmployee] = useState<EmployeeSummary | null>(null);

  const columns = useMemo<
    Array<ColumnDef<typeof features, EmployeeSummary>>
  >(
    () => [
      {
        id: "employeeName",
        accessorFn: (row) => row.employeeName ?? "",
        header: "Nhân viên",

        cell: ({ row }) => {
          const item = row.original;

          return (
            <div className="flex min-w-0 items-center gap-2">
              <div className="shrink-0 font-mono text-xs font-medium text-primary">
                {item.employeeCode}
              </div>

              <div className="truncate font-medium">
                {item.employeeName ?? "—"}
              </div>
            </div>
          );
        },
      },

      {
        id: "totalFine",
        accessorKey: "totalFine",
        header: "Tổng tiền phạt",

        cell: ({ row }) => (
          <div className="text-right font-mono text-sm font-semibold">
            {formatMoney(row.original.totalFine)}
          </div>
        ),
      },

      {
        id: "actions",
        header: "",

        cell: ({ row }) => {
          const employee = row.original;

          if (employee.totalFine === 0) return null;

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">
                    Thao tác với {employee.employeeName}
                  </span>
                </Button>}
                />

                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() => {
                      setPaymentEmployee(employee);
                    }}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Thanh toán
                  </DropdownMenuItem>
                  {!hasPermission("hr") ? null : (
                    <DropdownMenuItem
                      onClick={() => {
                        setPaymentEmployee(employee);
                      }}
                    >
                      <CheckIcon className="mr-2 h-4 w-4" />
                      Xác nhận thanh toán
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

  const table = useTable({
    features,
    data: data.employeeSummaries,
    columns,
    initialState: {
      columnVisibility: {
        actions: !isReviewing,
      }
    }
  });

  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <>
      <div className="overflow-hidden rounded-lg border flex-1">

        {/* ------------------------------------------------------------------ */}
        {/* Scroll container                                                   */}
        {/* ------------------------------------------------------------------ */}

        <div
          ref={parentRef}
          className="max-h-[calc(100%-40px)] overflow-auto"
        >
          {/* -------------------------------------------------------------- */}
          {/* Header                                                         */}
          {/* -------------------------------------------------------------- */}

          <div className={
            cn("sticky top-0 z-20 grid border-b bg-muted/95",
              isReviewing ? "grid-cols-[minmax(300px,2fr)_minmax(180px,1fr)]" : "grid-cols-[minmax(300px,2fr)_minmax(180px,1fr)_52px]"
            )
          }>
            {table.getHeaderGroups()[0].headers.map((header) => (
              <div
                key={header.id}
                className="flex h-10 items-center px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <table.FlexRender header={header} />
              </div>
            ))}
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Virtualized rows                                                */}
          {/* -------------------------------------------------------------- */}

          <div
            className="relative min-w-140"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];

              return (
                <div
                  key={row.id}
                  className={
                    cn("absolute left-0 right-0 grid border-b transition-colors hover:bg-muted/20",
                      isReviewing ? "grid-cols-[minmax(300px,2fr)_minmax(180px,1fr)]" : "grid-cols-[minmax(300px,2fr)_minmax(180px,1fr)_52px]"
                    )
                  }
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      className="min-w-0 px-4 py-2.5"
                    >
                      <table.FlexRender cell={cell} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Grand total */}
        <div className="border-t-2 bg-muted/95">
          <div className="flex items-center justify-end px-4 py-3">
            <div className="mr-8 text-sm font-semibold">
              Tổng cộng
            </div>

            <div className="w-32 text-right font-mono text-sm font-bold">
              {formatMoney(data.grandTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <SubmitFinePaymentDialog
        paymentEmployee={paymentEmployee}
        onOpenChange={() => setPaymentEmployee(null)}
      />
    </>
  );
}