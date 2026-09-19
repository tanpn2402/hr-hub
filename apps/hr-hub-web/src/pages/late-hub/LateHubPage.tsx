import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";

import {
  ArrowDown,
  ArrowUpDown,
  ArrowUp,
  CalendarDays,
  Clock3,
  CreditCard,
  Flag,
  MoreHorizontal,
  Search,
  Wallet,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AppSwitcher } from "../../apps/AppSwitcher";

type LateStatus =
  | "unpaid"
  | "paid"
  | "reviewing"
  | "approved";

type LateRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  checkIn: string;
  checkOut: string;
  lateMinutes: number;
  fine: number;
  status: LateStatus;
};

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

async function fetchLateHub(): Promise<LateRow[]> {
  return [
    {
      id: "1",
      employeeId: "EMP001",
      employeeName: "Nguyễn Văn An",
      department: "Engineering",
      date: "2026-09-18",
      checkIn: "08:42",
      checkOut: "17:35",
      lateMinutes: 42,
      fine: 210000,
      status: "unpaid",
    },
    {
      id: "2",
      employeeId: "EMP002",
      employeeName: "Trần Minh Đức",
      department: "Engineering",
      date: "2026-09-18",
      checkIn: "08:15",
      checkOut: "17:30",
      lateMinutes: 15,
      fine: 75000,
      status: "paid",
    },
    {
      id: "3",
      employeeId: "EMP003",
      employeeName: "Lê Hoàng Nam",
      department: "Product",
      date: "2026-09-17",
      checkIn: "09:05",
      checkOut: "18:00",
      lateMinutes: 65,
      fine: 325000,
      status: "reviewing",
    },
    {
      id: "4",
      employeeId: "EMP004",
      employeeName: "Phạm Thu Hà",
      department: "HR",
      date: "2026-09-17",
      checkIn: "08:08",
      checkOut: "17:30",
      lateMinutes: 8,
      fine: 40000,
      status: "approved",
    },
  ];
}

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
  }).format(new Date(`${value}T00:00:00`));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function StatusBadge({
  status,
}: {
  status: LateStatus;
}) {
  const config = {
    unpaid: {
      label: "Chưa thanh toán",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
    },
    paid: {
      label: "Đã thanh toán",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    reviewing: {
      label: "Đang phúc khảo",
      className:
        "border-blue-200 bg-blue-50 text-blue-700",
    },
    approved: {
      label: "Đã duyệt",
      className:
        "border-violet-200 bg-violet-50 text-violet-700",
    },
  }[status];

  return (
    <Badge
      variant="outline"
      className={config.className}
    >
      {config.label}
    </Badge>
  );
}

function RowActions({
  row,
}: {
  row: LateRow;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full opacity-50 group-hover:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </Button>} />

      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            console.log("Detail", row)
          }
        >
          <Clock3 />
          Xem chi tiết
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() =>
            console.log("Dispute", row)
          }
        >
          <Flag />
          Phúc khảo
        </DropdownMenuItem>

        {row.status === "unpaid" && (
          <>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() =>
                console.log("Pay", row)
              }
            >
              <CreditCard />
              Thanh toán
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() =>
                console.log(
                  "History",
                  row,
                )
              }
            >
              <Wallet />
              Lịch sử thanh toán
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LateHubPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    LateStatus | "all"
  >("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["late-hub"],
    queryFn: fetchLateHub,
    staleTime: 30_000,
  });

  const filteredData = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    return data.filter((row) => {
      const matchesSearch =
        !keyword ||
        row.employeeName
          .toLowerCase()
          .includes(keyword) ||
        row.employeeId
          .toLowerCase()
          .includes(keyword) ||
        row.department
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        status === "all" ||
        row.status === status;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [data, search, status]);

  const columns = useMemo<
    Array<ColumnDef<typeof features, LateRow>>
  >(
    () => [
      {
        accessorKey: "employeeName",
        header: "Nhân viên",

        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {getInitials(
                  row.original.employeeName,
                )}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="font-medium">
                {
                  row.original
                    .employeeName
                }
              </div>

              <div className="font-mono text-[11px] text-muted-foreground">
                {row.original.employeeId}
              </div>
            </div>
          </div>
        ),
      },

      {
        accessorKey: "department",
        header: "Phòng ban",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.department}
          </span>
        ),
      },

      {
        accessorKey: "date",
        header: "Ngày",
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {formatDate(
              row.original.date,
            )}
          </span>
        ),
      },

      {
        accessorKey: "checkIn",
        header: "Check-in",
        cell: ({ row }) => (
          <span
            className={[
              "font-mono text-sm",
              row.original.lateMinutes >=
                30
                ? "font-semibold text-rose-600"
                : "",
            ].join(" ")}
          >
            {row.original.checkIn}
          </span>
        ),
      },

      {
        accessorKey: "checkOut",
        header: "Check-out",
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.checkOut}
          </span>
        ),
      },

      {
        accessorKey: "lateMinutes",
        header: () => (
          <div className="text-right">
            Đi trễ
          </div>
        ),

        cell: ({ row }) => (
          <div className="text-right font-mono text-sm">
            <span
              className={
                row.original.lateMinutes >=
                  30
                  ? "font-semibold text-rose-600"
                  : ""
              }
            >
              {row.original.lateMinutes}
            </span>

            <span className="ml-1 text-xs text-muted-foreground">
              phút
            </span>
          </div>
        ),
      },

      {
        accessorKey: "fine",
        header: () => (
          <div className="text-right">
            Tiền phạt
          </div>
        ),

        cell: ({ row }) => (
          <div className="text-right font-mono text-sm font-medium">
            {formatMoney(
              row.original.fine,
            )}
          </div>
        ),
      },

      {
        accessorKey: "status",
        header: "Trạng thái",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
          />
        ),
      },

      {
        id: "actions",
        header: "",

        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions
              row={row.original}
            />
          </div>
        ),
      },
    ],
    [],
  );

  const table = useTable({
    features,
    data: filteredData,
    columns,
  });

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-5">
        <div className="flex items-center gap-2">
          <AppSwitcher currentApp="late-hub" />

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold">
              Late Hub
            </h1>

            <span className="text-sm text-muted-foreground">
              Attendance
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <CalendarDays className="size-4 text-muted-foreground" />

          <span className="font-medium">
            September 2026
          </span>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex h-14 items-center justify-between border-b px-5">
        <div className="flex items-center gap-2">
          <div className="relative w-70">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search employees..."
              className="h-9 border-0 bg-muted/60 pl-9 shadow-none focus-visible:ring-1"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center rounded-lg border bg-background p-0.5">
            {[
              ["all", "All"],
              ["unpaid", "Unpaid"],
              ["reviewing", "Reviewing"],
              ["paid", "Paid"],
            ].map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setStatus(
                      value as
                      | LateStatus
                      | "all",
                    )
                  }
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    status === value
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        <span className="text-xs text-muted-foreground">
          {filteredData.length} employees
        </span>
      </div>

      {/* Spreadsheet table */}
      <div className="overflow-auto">
        <table className="w-full min-w-262.5 border-collapse">
          <thead>
            {table
              .getHeaderGroups()
              .map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b bg-muted/30"
                >
                  {headerGroup.headers.map(
                    (header, index) => (
                      <th
                        key={header.id}
                        className={[
                          "h-10 whitespace-nowrap px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                          index === 0
                            ? "sticky left-0 z-20 bg-muted/30"
                            : "",
                          header.id ===
                            "actions"
                            ? "sticky right-0 z-20 w-12 bg-muted/30"
                            : "",
                        ].join(" ")}
                      >
                        {header.isPlaceholder
                          ? null
                          : header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="flex items-center gap-1 transition-colors hover:text-foreground"
                              aria-label={`Sort by ${header.column.id}`}
                            >
                              <table.FlexRender header={header} />

                              {header.column.getIsSorted() === "asc" ? (
                                <ArrowUp className="size-3" />
                              ) : header.column.getIsSorted() === "desc" ? (
                                <ArrowDown className="size-3" />
                              ) : (
                                <ArrowUpDown className="size-3 opacity-40" />
                              )}
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <table.FlexRender header={header} />
                            </div>
                          )}
                      </th>
                    ),
                  )}
                </tr>
              ))}
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : (
              table
                .getRowModel()
                .rows
                .map((row) => (
                  <tr
                    key={row.id}
                    className="group border-b hover:bg-muted/30"
                  >
                    {row
                      .getAllCells()
                      .map(
                        (
                          cell,
                          index,
                        ) => (
                          <td
                            key={cell.id}
                            className={[
                              "px-4 py-2.5",
                              index === 0
                                ? "sticky left-0 z-10 bg-background group-hover:bg-muted/30"
                                : "",
                              cell.column
                                .id ===
                                "actions"
                                ? "sticky right-0 z-10 bg-background group-hover:bg-muted/30"
                                : "",
                            ].join(" ")}
                          >
                            <table.FlexRender cell={cell} />
                          </td>
                        ),
                      )}
                  </tr>
                ))
            )}

            {!isLoading &&
              table.getRowModel()
                .rows.length ===
              0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No employees found.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
