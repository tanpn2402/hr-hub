import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import dayjs from "dayjs";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  approveWorkforceFeedback,
  rejectWorkforceFeedback,
  type WorkforceFeedback,
} from "../api/workforce";

type Props = {
  month: string;
  selected: WorkforceFeedback;
  detail: {
    fine: {
      amount: number;
      adjustedAmount?: number | null;
      date: string;
      reason?: string | null;
    };
    attendance?: {
      checkIn?: string | null;
      checkOut?: string | null;
    } | null;
    leave?: {
      type: string;
    } | null;
  };
  onReviewed: () => Promise<void>;
};

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to review feedback. Please try again.";
}

export function FeedbackDetail({
  month,
  selected,
  detail,
  onReviewed,
}: Props) {
  const queryClient = useQueryClient();

  const [reduction, setReduction] = useState("0");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const fine = detail.fine;

  useEffect(() => {
    setReduction(String(selected.reductionAmount ?? 0));
    setReason("");
    setRejecting(false);
  }, [selected.id, selected.reductionAmount]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["workforce", "feedback", month],
      }),
      queryClient.invalidateQueries({
        queryKey: ["workforce", "report", month],
      }),
    ]);

    await onReviewed();
  };

  const approve = useMutation({
    mutationFn: () =>
      approveWorkforceFeedback(selected.id, {
        reductionAmount: Number(reduction),
      }),
    onSuccess: refresh,
  });

  const reject = useMutation({
    mutationFn: () =>
      rejectWorkforceFeedback(selected.id, {
        reviewNote: reason || undefined,
      }),
    onSuccess: refresh,
  });

  const reductionValue = Number(reduction);

  const validReduction =
    Number.isInteger(reductionValue) &&
    reductionValue >= 0 &&
    reductionValue <= (fine.adjustedAmount ?? fine.amount);

  const pending = approve.isPending || reject.isPending;

  return (
    <div className="mx-auto max-w-2xl">
      <h3 className="text-xl font-semibold">
        {selected.employeeName ?? selected.employeeCode}
      </h3>

      <p className="mt-1 text-sm text-muted-foreground">
        {selected.employeeCode} · {formatDate(fine.date)}
      </p>

      <h4 className="mt-7 text-lg font-medium">
        {label(selected.reason)}
      </h4>

      <hr className="my-6" />

      <h5 className="font-medium">Attendance</h5>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <dt className="text-muted-foreground">Check-in</dt>
        <dd>
          {detail.attendance?.checkIn
            ? dayjs.utc(detail.attendance.checkIn).format("HH:mm")
            : "—"}
        </dd>

        <dt className="text-muted-foreground">Check-out</dt>
        <dd>
          {detail.attendance?.checkOut
            ? dayjs.utc(detail.attendance.checkOut).format("HH:mm")
            : "—"}
        </dd>

        <dt className="text-muted-foreground">Leave</dt>
        <dd>
          {detail.leave ? label(detail.leave.type) : "—"}
        </dd>

        <dt className="text-muted-foreground">Note</dt>
        <dd>{fine.reason || "—"}</dd>
      </dl>

      <hr className="my-6" />

      <h5 className="font-medium">Employee feedback</h5>

      <p className="mt-3 whitespace-pre-wrap text-sm">
        {selected.description || "No additional description provided."}
      </p>

      <hr className="my-6" />

      <h5 className="font-medium">Fine</h5>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <dt className="text-muted-foreground">Original fine</dt>
        <dd>{formatMoney(fine.amount)}</dd>

        <dt className="self-center text-muted-foreground">
          Reduction amount
        </dt>

        <dd>
          <div className="flex flex-wrap gap-2">
            {[10000, 20000, 30000].map((amount) => {
              const maxAmount = fine.adjustedAmount ?? fine.amount;

              const disabled =
                selected.status !== "pending" ||
                pending ||
                amount > maxAmount;

              return (
                <button
                  key={amount}
                  type="button"
                  disabled={disabled}
                  onClick={() => setReduction(String(amount))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    "bg-background hover:bg-muted",
                    reduction === String(amount) &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  {amount.toLocaleString("vi-VN")} ₫
                </button>
              );
            })}
          </div>
        </dd>

        <dt className="text-muted-foreground">Final fine</dt>
        <dd>
          {formatMoney(
            (fine.adjustedAmount ?? fine.amount) -
            (validReduction ? reductionValue : 0),
          )}
        </dd>
      </dl>

      {selected.status === "pending" ? (
        <>
          <p className="mt-2 text-xs text-destructive">
            {!validReduction
              ? "Reduction must be a whole amount between 0 and the current fine."
              : approve.isError || reject.isError
                ? errorMessage(approve.error ?? reject.error)
                : ""}
          </p>

          {rejecting && (
            <div className="mt-5 rounded-lg border p-3">
              <label className="text-sm font-medium">
                Reject feedback
              </label>

              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-2 min-h-20 w-full rounded-md border p-2"
                placeholder="Reason (optional)"
                disabled={pending}
              />
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setRejecting((value) => !value)}
            >
              {rejecting ? "Cancel" : "Reject"}
            </Button>

            {rejecting ? (
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => reject.mutate()}
              >
                {reject.isPending && (
                  <Loader2 className="animate-spin" />
                )}
                Reject
              </Button>
            ) : (
              <Button
                disabled={!validReduction || pending}
                onClick={() => approve.mutate()}
              >
                {approve.isPending && (
                  <Loader2 className="animate-spin" />
                )}
                Approve
              </Button>
            )}
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          This feedback was {selected.status}
          {selected.reviewNote ? `: ${selected.reviewNote}` : "."}
        </p>
      )}
    </div>
  );
}
