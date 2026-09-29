import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useTranslation } from "react-i18next";


const FEEDBACK_REASONS = [
  {
    value: "early_leave_permission",
    label: "early_leave_permission",
  },
  {
    value: "late_permission",
    label: "late_permission",
  },
  {
    value: "wrong_time",
    label: "wrong_time",
  },
  {
    value: "wrong_fine",
    label: "wrong_fine",
  },
  {
    value: "other",
    label: "other",
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
  const { t } = useTranslation();
  const [feedbackReason, setFeedbackReason] = useState<FeedbackReason | "">("");
  const [feedbackDescription, setFeedbackDescription] = useState("");

  const feedbackMutation = useCreateFineFeedbackMutation();

  const queryClient = useQueryClient();

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

          queryClient.invalidateQueries({
            queryKey: ["workforce", "report"]
          })
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
            <DialogTitle>{t("new_feedback")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">
                {feedbackEmployee?.employeeName}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {feedbackEmployee?.employeeCode} ·{" "}
                {feedbackEmployee?.date
                  ? dateOfWeek(feedbackEmployee?.date)
                  : "—"}{" "}
                · {dayjs(feedbackEmployee?.date).format("DD/MM/YYYY")}
              </p>

              <hr className="my-6" />

              <h5 className="font-medium">{t("attendance_details")}</h5>

              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <dt className="text-muted-foreground">{t("check_in")}</dt>
                <dd>
                  {feedbackEmployee?.checkIn ? feedbackEmployee?.checkIn : "—"}
                </dd>

                <dt className="text-muted-foreground">{t("check_out")}</dt>
                <dd>
                  {feedbackEmployee?.checkOut
                    ? feedbackEmployee?.checkOut
                    : "—"}
                </dd>

                <dt className="text-muted-foreground">{t("note")}</dt>
                <dd>
                  {feedbackEmployee?.note
                    ? feedbackEmployee?.note
                      .split(";")
                      .map((note) => <div key={note}>{note}</div>)
                    : "—"}
                </dd>

                <dt className="text-muted-foreground">{t("fine_amount")}</dt>
                <dd>
                  {feedbackEmployee?.fineAmount
                    ? formatMoney(feedbackEmployee.fineAmount)
                    : "—"}
                </dd>
              </dl>

              <hr className="my-6" />

              <h5 className="font-medium mb-4">{t("employee_feedback")}</h5>

              <Label className="text-muted-foreground">{t("reason")}</Label>

              <Select
                value={feedbackReason}
                onValueChange={(value) =>
                  setFeedbackReason(value as FeedbackReason)
                }
                disabled={feedbackMutation.isPending}
                items={FEEDBACK_REASONS.map(({ label, value }) => ({
                  value,
                  label: t(label),
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {FEEDBACK_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {t(reason.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">
                {t("description")}
              </Label>

              <Textarea
                value={feedbackDescription}
                onChange={(event) => setFeedbackDescription(event.target.value)}
                placeholder=""
                rows={5}
                disabled={feedbackMutation.isPending}
              />
            </div>

            {feedbackMutation.isError && (
              <p className="text-sm text-destructive">
                {t("feedback_submit_failed")}
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
              {t("cancel")}
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
              {feedbackMutation.isPending ? t("sending") : t("send_feedback")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}