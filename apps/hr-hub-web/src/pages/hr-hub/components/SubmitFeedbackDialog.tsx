import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";


import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WorkforceRow } from "../api/workforce";
import dayjs from "dayjs";
import { dateOfWeek } from "@/lib/time-utils";
import { formatMoney } from "@/lib/format-utils";
import { Loader2, SendIcon } from "lucide-react";


const FEEDBACK_REASONS = [
  {
    value: "early_leave_permission",
    label: "Có phép về sớm",
  },
  {
    value: "late_permission",
    label: "Có phép đi muộn",
  },
  {
    value: "wrong_time",
    label: "Sai thời gian chấm công",
  },
  {
    value: "wrong_fine",
    label: "Sai tiền phạt",
  },
  {
    value: "other",
    label: "Khác",
  },
] as const;

type FeedbackReason = (typeof FEEDBACK_REASONS)[number]["value"];

type Props = {
  feedbackEmployee: WorkforceRow | null;
  onOpenChange: (open: boolean) => void;
};

type FeedbackPayload = {
  fineId: string;
  reason: string;
  description: string;
};

async function createFineFeedback(payload: FeedbackPayload) {
  const { data } = await axios.post("/api/fines/" + payload.fineId + "/feedback", {
    reason: payload.reason,
    description: payload.description,
  });

  return data;
}

function useCreateFineFeedbackMutation() {
  return useMutation({
    mutationFn: createFineFeedback,
  });
}

export function SubmitFeedbackDialog({ feedbackEmployee, onOpenChange }: Props) {
  const [feedbackReason, setFeedbackReason] = useState<FeedbackReason | "">("");
  const [feedbackDescription, setFeedbackDescription] = useState("");

  const feedbackMutation = useCreateFineFeedbackMutation();

  const handleSubmitFeedback = () => {
    if (!feedbackEmployee || !feedbackReason || !feedbackEmployee.fineId) {
      return;
    }

    feedbackMutation.mutate(
      {
        fineId: feedbackEmployee.fineId,
        reason: feedbackReason,
        description: feedbackDescription.trim(),
      },
      {
        onSuccess: () => {
          setFeedbackReason("");
          setFeedbackDescription("");
          onOpenChange(false);
        },
      },
    );
  };

  useEffect(() => {
    setFeedbackReason("");
    setFeedbackDescription("");
  }, [open]);

  return (
    <>
      <Dialog
        open={!!feedbackEmployee}
        onOpenChange={(open) => {
          if (!open && !feedbackMutation.isPending) {
            setFeedbackReason("");
            setFeedbackDescription("");
            onOpenChange(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo Feedback</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">
                {feedbackEmployee?.employeeName}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {feedbackEmployee?.employeeCode} · {feedbackEmployee?.date ? dateOfWeek(feedbackEmployee?.date) : "—"} · {dayjs(feedbackEmployee?.date).format("DD/MM/YYYY")}
              </p>

              <hr className="my-6" />

              <h5 className="font-medium">Attendance</h5>

              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <dt className="text-muted-foreground">Check-in</dt>
                <dd>
                  {feedbackEmployee?.checkIn
                    ? feedbackEmployee?.checkIn
                    : "—"}
                </dd>

                <dt className="text-muted-foreground">Check-out</dt>
                <dd>
                  {feedbackEmployee?.checkOut
                    ? feedbackEmployee?.checkOut
                    : "—"}
                </dd>

                <dt className="text-muted-foreground">Note</dt>
                <dd>{feedbackEmployee?.note || "—"}</dd>

                <dt className="text-muted-foreground">Fine Amount</dt>
                <dd>
                  {feedbackEmployee?.fineAmount
                    ? formatMoney(feedbackEmployee.fineAmount)
                    : "—"}
                </dd>
              </dl>

              <hr className="my-6" />

              <h5 className="font-medium mb-4">Employee feedback</h5>

              <Label className="text-muted-foreground">Reason</Label>

              <Select
                value={feedbackReason}
                onValueChange={(value) =>
                  setFeedbackReason(value as FeedbackReason)
                }
                disabled={feedbackMutation.isPending}
                items={FEEDBACK_REASONS}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {FEEDBACK_REASONS.map((reason) => (
                    <SelectItem
                      key={reason.value}
                      value={reason.value}
                    >
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Description</Label>

              <Textarea
                value={feedbackDescription}
                onChange={(event) =>
                  setFeedbackDescription(event.target.value)
                }
                placeholder=""
                rows={5}
                disabled={feedbackMutation.isPending}
              />
            </div>

            {feedbackMutation.isError && (
              <p className="text-sm text-destructive">
                Không thể gửi feedback. Vui lòng thử lại.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={feedbackMutation.isPending}
              className="min-w-32"
            >
              Hủy
            </Button>

            <Button
              type="button"
              onClick={handleSubmitFeedback}
              disabled={
                !feedbackReason ||
                (!feedbackDescription.trim() && feedbackReason === "other") ||
                feedbackMutation.isPending ||
                !feedbackEmployee?.fineId
              }
              className="min-w-32"
            >
              {feedbackMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <SendIcon />
              )}
              {feedbackMutation.isPending
                ? "Đang gửi..."
                : "Gửi Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </>
  );
}