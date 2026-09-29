import { useMemo, useRef, useState } from "react";
import {
  metaHelper,
  stockFeatures,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CheckIcon,
  ListTree,
  MoreVertical,
  QrCode,
} from "lucide-react";

import type {
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
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmFinePaymentDialog } from "./ConfirmFinePaymentDialog";
import { EmployeeSummary } from "../api/workforce";

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

const features = tableFeatures({
  ...stockFeatures,
  columnMeta: metaHelper<{ textRight?: boolean }>(),
});

type Props = {
  data: WorkforceImportResult;
  onEmployeeClick: (employeeCode: string) => void;
};

export function LateHubSummaryTable({ data, onEmployeeClick }: Props) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const isReviewing = useMemo(() => data.batchId !== "", [data]);

  const { hasPermission } = useAuth();

  const [paymentEmployee, setPaymentEmployee] = useState<EmployeeSummary | null>(null);
  const [confirmPaymentEmployee, setConfirmPaymentEmployee] = useState<EmployeeSummary | null>(null);

  const columns = useMemo<
    Array<ColumnDef<typeof features, EmployeeSummary>>
  >(
    () => [
      {
        id: "employeeName",
        accessorFn: (row) => row.employeeName ?? "",
        header: t("employee"),

        cell: ({ row }) => {
          const item = row.original;

          return (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => onEmployeeClick(item.employeeCode)}
                    className="group flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="shrink-0 font-mono text-xs font-medium text-primary">
                      {item.employeeCode}
                    </span>

                    <span className="truncate font-medium group-hover:text-primary">
                      {item.employeeName ?? "—"}
                    </span>
                  </button>
                }
              />

              <TooltipContent>
                <p>{t("click_on_employee_to_view_attendance_detail")}</p>
              </TooltipContent>
            </Tooltip>
          );
        },
      },

      {
        id: "totalFine",
        accessorKey: "totalFine",
        header: t("total_fine"),
        meta: { textRight: true },

        cell: ({ row }) => (
          <div className="text-right font-mono text-sm font-semibold">
            {formatMoney(row.original.monthFinePaidStatus === "completed" ? 0 : row.original.totalFine)}
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
            <div className="flex justify-end relative -top-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">
                    {t("actions_for_employee", { name: employee.employeeName })}
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
                    {t("payment")}
                  </DropdownMenuItem>
                  {!hasPermission("hr") ? null : (
                    <DropdownMenuItem
                      onClick={() => {
                        setConfirmPaymentEmployee(employee);
                      }}
                    >
                      <ListTree className="mr-2 h-4 w-4" />
                      {t("list_payment")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [t, hasPermission],
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
                className={cn(
                  "flex h-10 items-center px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                  header.column.columnDef.meta?.textRight ? "justify-end" : ""
                )}
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

            <div className="text-right font-mono text-sm font-bold">
              {isReviewing ? "" : (formatMoney(data.paidAmount) + " / ")}{formatMoney(data.grandTotal)}
            </div>

            {isReviewing ? null : <div className="w-16.5" />}
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <SubmitFinePaymentDialog
        paymentEmployee={paymentEmployee}
        onOpenChange={() => setPaymentEmployee(null)}
      />

      <ConfirmFinePaymentDialog
        paymentEmployee={confirmPaymentEmployee}
        onOpenChange={() => setConfirmPaymentEmployee(null)}
      />
    </>
  );
}