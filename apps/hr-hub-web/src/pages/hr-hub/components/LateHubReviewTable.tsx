import { useMemo, useState } from "react";

import { LateHubSummaryTable } from "./LateHubSummaryTable";
import { LateHubDetailTable } from "./LateHubDetailTable";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { EmployeeSummary, WorkforceRow } from "../api/workforce";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type WorkforceImportResult = {
  batchId: string;
  month: string;
  status?: "preview" | "confirmed";
  rows: WorkforceRow[];
  employeeSummaries: EmployeeSummary[];
  grandTotal: number;
  paidAmount: number;
};

type Props = {
  data: WorkforceImportResult;
};

export function LateHubReviewTable({ data }: Props) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<string>("detail");

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);

  const employees = useMemo(() => {
    const map = new Map<string, EmployeeSummary>();

    for (const employee of data.employeeSummaries) {
      map.set(employee.employeeCode, employee);
    }

    return Array.from(map.values()).sort((a, b) =>
      `${a.employeeName ?? ""} ${a.employeeCode}`.localeCompare(
        `${b.employeeName ?? ""} ${b.employeeCode}`,
      ),
    );
  }, [data.employeeSummaries]);

  const toggleEmployee = (employeeCode: string) => {
    setSelectedEmployees((current) =>
      current.includes(employeeCode)
        ? current.filter((code) => code !== employeeCode)
        : [...current, employeeCode],
    );
  };

  const clearEmployees = () => {
    setSelectedEmployees([]);
  };

  const aggregatedData = useMemo(() => {
    let rows = selectedEmployees.length ? data.rows.filter(row => selectedEmployees.includes(row.employeeCode)) : data.rows;
    return {
      ...data,
      rows,
    }
  }, [data, selectedEmployees])

  return (
    <>
      <div className="flex items-center mb-2 gap-4">
        <div className="flex items-center rounded-lg border bg-background p-0.5">
          {[
            ["detail", t("detail")],
            ["summary", t("summary")],
          ].map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setViewMode(value)}
                className={[
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === value
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {/* Employee filter */}
        <div className="flex items-center gap-1">
          <Popover
            open={employeePickerOpen}
            onOpenChange={setEmployeePickerOpen}
          >
            <PopoverTrigger render={(
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={employeePickerOpen}
                className="h-8 min-w-55 justify-between text-xs"
              >
                <span className="truncate">
                  {selectedEmployees.length === 0
                    ? t("select_employee")
                    : `${selectedEmployees.length} ${t("employees_selected")}`}
                </span>

                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            )}
            />

            <PopoverContent
              className="w-[320px] p-0"
              align="start"
            >
              <Command>
                <CommandInput
                  placeholder={t("search_employee")}
                  className="h-9"
                />

                <CommandList>
                  <CommandEmpty>
                    {t("no_employee_found")}
                  </CommandEmpty>

                  <CommandGroup>
                    {employees.map((employee) => {
                      const selected = selectedEmployees.includes(
                        employee.employeeCode,
                      );

                      return (
                        <CommandItem
                          key={employee.employeeCode}
                          value={`${employee.employeeCode} ${employee.employeeName ?? ""}`}
                          onSelect={() =>
                            toggleEmployee(employee.employeeCode)
                          }
                        >
                          <div
                            className={[
                              "mr-2 flex size-4.5 items-center justify-center rounded-sm border p-1",
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50",
                            ].join(" ")}
                          >
                            {selected && (
                              <Check className="size-3" />
                            )}
                          </div>

                          <div className="flex min-w-0 items-center gap-1">
                            <span className="text-xs font-mono font-medium text-primary relative top-0.5">
                              {employee.employeeCode}
                            </span>

                            <span className="truncate text-sm">
                              {employee.employeeName ||
                                employee.employeeCode}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Clear filter */}
          {selectedEmployees.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={clearEmployees}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              {t("clear")}
            </Button>
          )}
        </div>
      </div>

      {viewMode === "detail" ? (
        <LateHubDetailTable data={aggregatedData} />
      ) : (
        <LateHubSummaryTable data={aggregatedData} onEmployeeClick={employeeCode => {
          setSelectedEmployees([employeeCode]);
          setViewMode("detail");
        }} />
      )}
    </>
  );
}
