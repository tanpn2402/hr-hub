import { useState } from "react";

import {
  CalendarCheck,
  Clock3,
  FileWarning,
  Upload,
  Users,
} from "lucide-react";

import { HRMetricCard } from "../components/HRMetricCard"
import { ImportDataDialog } from "../components/ImportDataDialog"
import { Button } from "@/components/ui/button";
import { HRPageHeader } from "../components/HRPageHeader";

export function AttendanceLeavePage() {
  const [importOpen, setImportOpen] = useState(false);

  return <div>
    <HRPageHeader
      title="Attendance & Leave"
      description="Review employee attendance, late hours, and leave records."
      actions={
        <Button onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 size-4" />
          Import data
        </Button>
      }
    />
    <div className="px-6">
      {/* Metrics */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HRMetricCard
          title="Total employees"
          value="248"
          description="Active employees"
          icon={Users}
        />

        <HRMetricCard
          title="Present today"
          value="231"
          description="93.1% attendance rate"
          icon={CalendarCheck}
          trend={{
            value: "2.4%",
            positive: true,
          }}
        />

        <HRMetricCard
          title="Late check-ins"
          value="17"
          description="Employees arrived late today"
          icon={Clock3}
          trend={{
            value: "8.2%",
            positive: false,
          }}
        />

        <HRMetricCard
          title="Leave today"
          value="9"
          description="Approved leave requests"
          icon={FileWarning}
        />
      </div>

      {/* Recent activity */}
      <div className="mt-8">
        <div className="flex justify-between">
          <div>
            <h3 className="text-sm font-semibold">
              Recent activity
            </h3>

            <p className="mt-1 text-xs text-muted-foreground">
              Latest HR data updates
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-medium">
              Data status
            </span>

            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600">
              Up to date
            </span>
          </div>

          <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="p-4">
              <div className="text-xs text-muted-foreground">
                Attendance data
              </div>

              <div className="mt-1 text-sm font-medium">
                September 19, 2026
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                248 employee records
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs text-muted-foreground">
                Leave data
              </div>

              <div className="mt-1 text-sm font-medium">
                September 19, 2026
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                34 leave records
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ImportDataDialog
      open={importOpen}
      onOpenChange={setImportOpen}
    />
  </div >
}