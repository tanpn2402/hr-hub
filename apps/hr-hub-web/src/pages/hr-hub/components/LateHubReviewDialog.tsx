import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import {
  LateHubReviewTable,
  type WorkforceImportResult,
} from "./LateHubReviewTable";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

type Props = {
  open: boolean;
  data: WorkforceImportResult | null;
  onOpenChange: (open: boolean) => void;
};


type ConfirmImportPayload = { overrides?: Record<string, unknown> };
async function confirmImport(
  batchId: string,
  payload: ConfirmImportPayload = {},
) {
  const { data } = await apiClient.post(
    `/workforce/import/${batchId}/confirm`,
    payload,
  );
  return data;
}

function useConfirmImport() {
  return useMutation({
    mutationFn: ({
      batchId,
      overrides,
    }: {
      batchId: string;
      overrides?: Record<string, unknown>;
    }) => confirmImport(batchId, { overrides }),
  });
}

export function LateHubReviewDialog({
  open,
  data,
  onOpenChange,
}: Props) {
  const [fullscreen, setFullscreen] = useState(true);

  const isReviewing = useMemo(() => data?.batchId !== "", [data]);

  const queryClient = useQueryClient();
  const confirmMutation = useConfirmImport();
  const isConfirming = confirmMutation.isPending;

  const handleOpenChange = (value: boolean) => {
    onOpenChange(value);
  };

  function handleConfirm() {
    if (!data || !data.batchId || data.status !== "preview") {
      return;
    }

    confirmMutation.mutate(
      { batchId: data.batchId },
      {
        onSuccess: () => {
          onOpenChange(false);

          queryClient.invalidateQueries({
            queryKey: ["workforce", "import-history"],
          });

          queryClient.invalidateQueries({
            queryKey: ["workforce", "report-months"],
          });

          // TODO: invalidate query batchImportMonth
        },
      },
    );
  }

  function handleClose() {
    if (isConfirming) {
      return;
    }
    onOpenChange(false);
  }


  if (!data) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent
        showCloseButton={false}
        className={[
          "flex flex-col gap-0 overflow-hidden p-0",
          open ? "transition-[width,height,max-width,border-radius] duration-200" : "",
          fullscreen
            ? "h-screen w-screen sm:max-w-none rounded-none max-w-full"
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
                  {isReviewing ? "Review imported attendance" : "Attendance view"}
                </DialogTitle>

                <DialogDescription className="mt-0.5 text-xs">
                  {isReviewing ? "Review attendance violations and calculated fines before continuing." : ""}
                </DialogDescription>
              </div>
            </div>

            {/* Header actions */}
            <div className="flex shrink-0 items-center gap-2">
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
        <div className="min-h-0 flex-1 overflow-auto bg-background p-2 flex flex-col">
          <LateHubReviewTable data={data} />
        </div>

        <DialogFooter className="shrink-0 border-t bg-muted/20 px-6 py-4">
          <Button variant="outline"
            className="min-w-32"
            onClick={handleClose} disabled={isConfirming}>
            Close
          </Button>

          {isReviewing ? (
            <Button
              onClick={handleConfirm}
              className="min-w-32"
              disabled={!data || !data.batchId || data.status !== "preview" || isConfirming}
            >
              {isConfirming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Confirm Import
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>

    </Dialog>
  );
}