import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AlertCircle,
  Eye,
  History,
  RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  metaHelper,
  stockFeatures,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import { apiClient } from "@/api/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkforceImportResult } from "./LateHubReviewTable";
import { LoadingIndicator } from "@/components/ui/loading-idicator";
import { LateHubReviewDialog } from "./LateHubReviewDialog";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type WorkforceImportHistoryItem = {
  id: string;
  month: string;
  createdAt: string;
  employeeCount: number;
  totalAttendance: number;
  totalLeave: number;
  totalFine: number;
  status: "confirmed" | "preview";
};

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

async function getImportHistory(): Promise<
  WorkforceImportHistoryItem[]
> {
  const { data } = await apiClient.get<
    WorkforceImportHistoryItem[]
  >("/workforce/imports");

  return data;
}


async function getImportBatch(
  batchId: string,
): Promise<WorkforceImportResult> {
  const { data } = await apiClient.get<WorkforceImportResult>(
    `/workforce/imports/${batchId}`,
  );

  return data;
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

function useImportHistory() {
  return useQuery({
    queryKey: ["workforce", "import-history"],
    queryFn: getImportHistory,
  });
}

function useImportBatchData(
  batchId: string | null
) {
  return useQuery({
    queryKey: ["workforce", "import-batch-data", batchId],
    queryFn: () => getImportBatch(batchId!),
    enabled: Boolean(batchId),
    staleTime: 30_000,
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

const features = tableFeatures({
  ...stockFeatures,
  columnMeta: metaHelper<{ textRight?: boolean }>()
});

export function WorkforceImportHistory() {

  const [reviewOpen, setReviewOpen] = useState(false);

  const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);

  const historyQuery = useImportHistory();

  const importBatchData = useImportBatchData(reviewBatchId);

  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "createdAt",
      desc: true,
    },
  ]);

  function handleViewImport(batchId: string) {
    setReviewBatchId(batchId);
    setReviewOpen(true);
  }

  const data = historyQuery.data ?? [];

  const columns = useMemo<
    Array<
      ColumnDef<
        typeof features,
        WorkforceImportHistoryItem
      >
    >
  >(
    () => [
      {
        id: "createdAt",
        accessorFn: (row) => row.createdAt,
        header: "Imported",

        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "month",
        accessorFn: (row) => row.month,
        header: "Month",
        cell: ({ row }) => (
          <span className="font-medium">
            {formatMonth(row.original.month)}
          </span>
        ),
      },
      {
        id: "totalAttendance",
        meta: {
          textRight: true,
        },
        accessorFn: (row) => row.totalAttendance,
        header: () => (
          <div className="text-right">
            Attendance
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.totalAttendance.toLocaleString()}
          </div>
        ),
      },
      {
        id: "totalLeave",
        meta: {
          textRight: true,
        },
        accessorFn: (row) => row.totalLeave,
        header: () => (
          <div className="text-right">
            Leave
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.totalLeave.toLocaleString()}
          </div>
        ),
      },
      {
        id: "totalFine",
        meta: {
          textRight: true,
        },
        accessorFn: (row) => row.totalFine,
        header: () => (
          <div className="text-right">
            Total fines
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono font-medium">
            {formatMoney(row.original.totalFine)} ₫
          </div>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => row.status,
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;

          if (status === "confirmed") {
            return (
              <Badge
                variant="secondary"
                className="gap-1"
              >
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Confirmed
              </Badge>
            );
          }

          return (
            <Badge
              variant="outline"
              className="gap-1"
            >
              <span className="size-1.5 rounded-full bg-amber-500" />
              Preview
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",

        cell: ({ row }) => {
          const isLoading = row.original.id === reviewBatchId && importBatchData.isLoading;
          return (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => !isLoading && handleViewImport(row.original.id)}
              >
                {isLoading ? <LoadingIndicator size="sm" className="mr-2" /> : <Eye className="mr-2 size-4" />}
                View
              </Button>
            </div>
          )
        },
      },
    ],
    [handleViewImport, importBatchData, reviewBatchId],
  );

  const table = useTable({
    features,
    data,
    columns,

    state: {
      sorting,
    },

    onSortingChange: setSorting,
  });

  return (
    <div>
      <div className="mt-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History className="size-4" />

              <h2 className="text-sm font-semibold">
                Import history
              </h2>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Previous attendance and leave imports
            </p>
          </div>

          {historyQuery.isFetching && (
            <RefreshCw className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          {historyQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Loading import history...
            </div>
          ) : historyQuery.isError ? (
            <div className="flex h-32 items-center justify-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              Failed to load import history.
            </div>
          ) : !data.length ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No import history yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="whitespace-nowrap"
                      >
                        {header.isPlaceholder ? null : (
                          <div className={"flex items-center " + (header.column.columnDef.meta?.textRight ? " justify-end" : "")}>
                            {header.column.getCanSort() ? (
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
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
                            ) : (
                              <table.FlexRender
                                header={header}
                              />
                            )}
                          </div>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender
                          cell={cell}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <LateHubReviewDialog
        open={reviewOpen && Boolean(importBatchData)}
        data={importBatchData.data ?? null}
        onOpenChange={setReviewOpen}
      />
    </div>
  );
}