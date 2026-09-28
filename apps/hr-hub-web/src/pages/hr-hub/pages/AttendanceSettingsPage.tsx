import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  metaHelper,
  stockFeatures,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/api/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { HRPageHeader } from "../components/HRPageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import dayjs from "dayjs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type WorkforceRule = {
  id: string;
  kind: string;
  property: string;
  value: string;
  employeeCode: string | null;
  weekday: number | null;
  startDate: string | null;
  endDate: string | null;
  priority: number;
  reason: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type RuleFormValues = {
  property: string;
  value: string;
  employeeCode: string;
  weekday: string;
  startDate: string;
  endDate: string;
  priority: string;
  reason: string;
  enabled: boolean;
};

const RULE_PROPERTIES = [
  {
    value: "MORNING_START",
    label: "Giờ bắt đầu buổi sáng",
  },
  {
    value: "MORNING_END",
    label: "Giờ kết thúc buổi sáng",
  },
  {
    value: "MORNING_CHECKOUT_DEADLINE",
    label: "Hạn chấm công buổi sáng",
  },
  {
    value: "AFTERNOON_START",
    label: "Giờ bắt đầu buổi chiều",
  },
  {
    value: "AFTERNOON_CHECKOUT_DEADLINE",
    label: "Hạn chấm công buổi chiều",
  },
  // {
  //   value: "LEAVE_DAY_START",
  //   label: "Giờ bắt đầu ngày nghỉ",
  // },
  // {
  //   value: "LEAVE_DAY_END",
  //   label: "Giờ kết thúc ngày nghỉ",
  // },
  {
    value: "FINE_LATE_MORNING",
    label: "Phạt đi muộn buổi sáng",
  },
  {
    value: "FINE_LATE_AFTERNOON",
    label: "Phạt đi muộn buổi chiều",
  },
  {
    value: "FINE_NO_CHECKOUT_HALF_DAY",
    label: "Phạt thiếu chấm công ra về (nửa ngày)",
  },
  {
    value: "FINE_NO_CHECKOUT_FULL_DAY",
    label: "Phạt thiếu chấm công ra về (cả ngày)",
  },

  // {
  //   value: "CHECKIN_REQUIRED",
  //   label: "Bắt buộc chấm công vào",
  // },
  // {
  //   value: "CHECKOUT_REQUIRED",
  //   label: "Bắt buộc chấm công ra",
  // },
  // {
  //   value: "WORKING_DAY",
  //   label: "Ngày làm việc",
  // },
] as const;

const WEEKDAYS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
];

async function getWorkforceRules() {
  const { data } = await apiClient.get<
    WorkforceRule[]
  >("/workforce/rules?includeDisabled=true");

  return data;
}

const RULE_QUERY_KEY = ["workforce", "rules"];

function useWorkforceRules() {
  return useQuery({
    queryKey: RULE_QUERY_KEY,
    queryFn: getWorkforceRules,
  });
}

export function AttendanceSettingsPage() {
  const [editingRule, setEditingRule] = useState<WorkforceRule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteRule, setDeleteRule] = useState<WorkforceRule | null>(null);
  const [cloningRule, setCloningRule] = useState<WorkforceRule | null>(null);

  const { data = [], isLoading } = useWorkforceRules();

  const queryClient = useQueryClient();

  const ruleLabel = useMemo(() => new Map<string, string>(RULE_PROPERTIES.map(({ label, value }) => [value, label])), [RULE_PROPERTIES]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/workforce/rules/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: RULE_QUERY_KEY,
      });
    },
  });

  function handleClone(rule: WorkforceRule) {
    setCloningRule(rule);
    setEditingRule(null);
    setDialogOpen(true);
  }

  function handleAdd() {
    setEditingRule(null);
    setDialogOpen(true);
  }

  function handleEdit(rule: WorkforceRule) {
    setEditingRule(rule);
    setDialogOpen(true);
  }

  function handleDelete(rule: WorkforceRule) {
    setDeleteRule(rule);
  }

  function confirmDelete() {
    if (!deleteRule) {
      return;
    }

    deleteMutation.mutate(deleteRule.id, {
      onSuccess: () => {
        setDeleteRule(null);
      },
    });
  }

  const features = tableFeatures({
    ...stockFeatures,
    columnMeta: metaHelper<{ textRight?: boolean }>()
  });

  const columns = useMemo<ColumnDef<typeof features, WorkforceRule>[]>(
    () => [
      {
        accessorKey: "property",
        header: "Rule",
        cell: ({ row }) => ruleLabel.get(row.original.property) ?? row.original.property,
      },
      {
        accessorKey: "value",
        header: "Value",
      },
      {
        accessorKey: "employeeCode",
        header: "Employee",
        cell: ({ row }) => row.original.employeeCode ?? "All employees",
      },
      {
        accessorKey: "weekday",
        header: "Weekday",
        cell: ({ row }) => {
          const weekday = row.original.weekday;

          if (!weekday) {
            return "Every day";
          }

          return (
            WEEKDAYS.find((item) => item.value === String(weekday))
              ?.label ?? weekday
          );
        },
      },
      {
        accessorKey: "startDate",
        header: "Start",
        cell: ({ row }) =>
          !row.original.startDate ? "—" : dayjs.utc(row.original.startDate).format("DD-MM-YYYY"),
      },
      {
        accessorKey: "endDate",
        header: "End",
        cell: ({ row }) =>
          !row.original.endDate ? "—" : dayjs.utc(row.original.endDate).format("DD-MM-YYYY"),
      },
      {
        accessorKey: "priority",
        header: "Priority",
      },
      {
        accessorKey: "enabled",
        header: "Status",

        cell: ({ row }) => {
          const enabled = row.original.enabled;

          if (enabled) {
            return (
              <Badge
                variant="secondary"
                className="gap-1"
              >
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Enabled
              </Badge>
            );
          }

          return (
            <Badge
              variant="outline"
              className="gap-1"
            >
              <span className="size-1.5 rounded-full bg-red-500" />
              Disabled
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const rule = row.original;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleClone(rule)}
                disabled={deleteMutation.isPending}
              >
                <Copy className="size-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(rule)}
                disabled={deleteMutation.isPending}
              >
                <Pencil className="size-4" />
              </Button>

              <Popover
                open={deleteRule?.id === rule.id}
                onOpenChange={(open) => {
                  if (!open) {
                    setDeleteRule(null);
                  }
                }}
              >
                <PopoverTrigger render={<Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(rule)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>} />

                <PopoverContent
                  side="bottom"
                  align="end"
                  className="w-64"
                >
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">
                        Delete this rule?
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        This action cannot be undone.
                      </p>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteRule(null)}
                        disabled={deleteMutation.isPending}
                      >
                        Cancel
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={confirmDelete}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending
                          ? "Deleting..."
                          : "Delete"}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        },
      },
    ],
    [deleteMutation.isPending, deleteRule?.id],
  );

  const table = useTable({
    data,
    columns,
    features,
  });

  return (
    <div>

      <HRPageHeader
        title="Attendance & Leave  >  Settings"
        description="Attendance & Leave Settings"
      />

      <div className="px-6 pb-8">
        {/* Tabs */}
        <div className="border-b">
          <div className="flex h-11 items-center gap-6 px-1">
            <button
              type="button"
              className="relative h-full px-1 text-sm font-medium"
            >
              Rules
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Workforce Rules</h2>
              <p className="text-sm text-muted-foreground">
                Configure attendance exceptions and overrides.
              </p>
            </div>

            <Button onClick={handleAdd}>
              <Plus className="mr-2 size-4" />
              Add Rule
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Loading rules...
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
      </div>

      <RuleDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditingRule(null);
            setCloningRule(null);
          }
        }}
        rule={editingRule ?? cloningRule}
        clone={!!cloningRule}
      />
    </div>
  );
}

type RuleDialogProps = {
  open: boolean;
  rule: WorkforceRule | null;
  clone: boolean;
  onOpenChange: (open: boolean) => void;
};

function RuleDialog({
  open,
  rule,
  clone,
  onOpenChange,
}: RuleDialogProps) {
  const queryClient = useQueryClient();

  const isEdit = !!rule && !clone;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<RuleFormValues>({
    defaultValues: getDefaultValues(rule),
  });

  const weekday = watch("weekday");
  const enabled = watch("enabled");

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(rule));
    }
  }, [open, rule, reset]);

  function handleOpenChange(value: boolean) {
    if (value) {
      reset(getDefaultValues(rule));
    }

    onOpenChange(value);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: RuleFormValues) => {
      const payload = {
        kind: "OVERRIDE",
        property: values.property,
        value: values.value,
        employeeCode: values.employeeCode || null,
        weekday: values.weekday
          ? Number(values.weekday)
          : null,
        startDate: values.startDate
          ? `${values.startDate}T00:00:00.000Z`
          : null,
        endDate: values.endDate
          ? `${values.endDate}T23:59:59.999Z`
          : null,
        priority: Number(values.priority || 0),
        reason: values.reason || null,
        enabled: values.enabled,
      };

      if (rule && !clone) {
        await apiClient.patch(
          `/workforce/rules/${rule.id}`,
          payload,
        );
      } else {
        await apiClient.post(
          "/workforce/rules",
          payload,
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: RULE_QUERY_KEY,
      });

      onOpenChange(false);
    },
  });

  function onSubmit(values: RuleFormValues) {
    saveMutation.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {clone
              ? "Clone Workforce Rule"
              : isEdit
                ? "Edit Workforce Rule"
                : "Add Workforce Rule"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Rule</Label>

            <Select
              value={watch("property")}
              items={RULE_PROPERTIES}
              onValueChange={(value) => setValue("property", value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select rule" />
              </SelectTrigger>

              <SelectContent>
                {RULE_PROPERTIES.map(({ label, value }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              placeholder="08:30 / 30000 / true"
              {...register("value", { required: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="employeeCode">Employee</Label>
            <Input
              id="employeeCode"
              placeholder="Leave empty for all employees"
              {...register("employeeCode")}
            />
          </div>

          <div className="space-y-2">
            <Label>Weekday</Label>

            <Select
              value={weekday || "none"}
              items={WEEKDAYS}
              onValueChange={(value) =>
                setValue("weekday", value === "none" ? "" : (value ?? ""))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Every day" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="none">Every day</SelectItem>

                {WEEKDAYS.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                {...register("startDate")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End date</Label>
              <Input
                id="endDate"
                type="date"
                {...register("endDate")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              {...register("priority")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              placeholder="Optional reason"
              {...register("reason")}
            />
          </div>

          <Field orientation="horizontal">
            <Checkbox
              id="terms-checkbox"
              checked={enabled}
              onCheckedChange={(event) =>
                setValue("enabled", event)
              } />
            <Label htmlFor="terms-checkbox">Enabled</Label>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEdit
                  ? "Save changes"
                  : "Add rule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getDefaultValues(
  rule: WorkforceRule | null,
): RuleFormValues {
  return {
    property: rule?.property ?? "",
    value: rule?.value ?? "",
    employeeCode: rule?.employeeCode ?? "",
    weekday: rule?.weekday ? String(rule.weekday) : "",
    startDate: toDateInput(rule?.startDate),
    endDate: toDateInput(rule?.endDate),
    priority: String(rule?.priority ?? 100),
    reason: rule?.reason ?? "",
    enabled: rule?.enabled ?? true,
  };
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";

  return new Date(value).toISOString().slice(0, 10);
}
