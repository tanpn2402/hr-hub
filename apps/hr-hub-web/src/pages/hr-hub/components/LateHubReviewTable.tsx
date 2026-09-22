import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LateHubSummaryTable } from "./LateHubSummaryTable";
import { LateHubDetailTable } from "./LateHubDetailTable";

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

type Props = {
  data: WorkforceImportResult;
};

export function LateHubReviewTable({ data }: Props) {
  const [viewMode, setViewMode] = useState<"detail" | "summary">("detail");

  return (
    <div>
      <div className="flex items-center mb-2">
        <div className="inline-flex rounded-4xl border bg-muted p-1">
          <Button
            type="button"
            variant={viewMode === "detail" ? "default" : "ghost"}
            size="sm"
            className="h-8 px-3 w-26"
            onClick={() => setViewMode("detail")}
          >
            Detail
          </Button>

          <Button
            type="button"
            variant={viewMode === "summary" ? "default" : "ghost"}
            size="sm"
            className="h-8 px-3 w-26"
            onClick={() => setViewMode("summary")}
          >
            Summary
          </Button>
        </div>
      </div>

      {viewMode === "detail" ? (
        <LateHubDetailTable data={data} />
      ) : (
        <LateHubSummaryTable data={data} />
      )}
    </div>
  );
}
