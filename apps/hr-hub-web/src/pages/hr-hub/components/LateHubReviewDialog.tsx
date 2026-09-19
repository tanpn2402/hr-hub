import { useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import {
  LateHubReviewTable,
  type WorkforceImportResult,
} from "./LateHubReviewTable";

type Props = {
  open: boolean;
  data: WorkforceImportResult | null;
  onOpenChange: (open: boolean) => void;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function LateHubReviewDialog({
  open,
  data,
  onOpenChange,
}: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  if (!data) {
    return null;
  }

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setFullscreen(false);
    }

    onOpenChange(value);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent
        showCloseButton={false}
        className={[
          "flex flex-col gap-0 overflow-hidden p-0",
          "transition-[width,height,max-width,border-radius] duration-200",
          fullscreen
            ? "h-screen w-screen sm:max-w-none rounded-none"
            : "h-[92vh] w-[96vw] sm:max-w-none max-w-none",
        ].join(" ")}
      >
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileSpreadsheet className="size-4 text-primary" />
              </div>

              <div className="min-w-0">
                <DialogTitle className="truncate">
                  Review imported attendance
                </DialogTitle>

                <DialogDescription className="mt-0.5">
                  Review attendance violations and calculated
                  fines before continuing.
                </DialogDescription>
              </div>
            </div>

            {/* Header actions */}
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 sm:flex">
                <CheckCircle2 className="size-4 text-emerald-600" />

                <div>
                  <div className="text-[10px] text-muted-foreground">
                    Imported
                  </div>

                  <div className="text-xs font-medium">
                    {data.rows.length.toLocaleString("vi-VN")} records
                  </div>
                </div>
              </div>

              <div className="hidden rounded-lg border bg-muted/30 px-3 py-1.5 md:block">
                <div className="text-[10px] text-muted-foreground">
                  Total fine
                </div>

                <div className="font-mono text-xs font-semibold">
                  {formatMoney(data.grandTotal)}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() =>
                  setFullscreen((value) => !value)
                }
                title={
                  fullscreen
                    ? "Exit full screen"
                    : "Full screen"
                }
              >
                {fullscreen ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => handleOpenChange(false)}
                title="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto bg-background p-6">
          <LateHubReviewTable data={data} />
        </div>
      </DialogContent>
    </Dialog>
  );
}