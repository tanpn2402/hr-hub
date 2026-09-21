import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Maximize2, Minimize2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingIndicator } from "@/components/ui/loading-idicator";
import { cn } from "@/lib/utils";
import {
  approveWorkforceFeedback,
  getWorkforceFeedback,
  getWorkforceFeedbackDetail,
  rejectWorkforceFeedback,
  type FeedbackStatus,
  type WorkforceFeedback,
} from "../api/workforce";
import dayjs from "dayjs";

type Props = {
  open: boolean;
  month: string;
  initialFilter: "all" | FeedbackStatus;
  onOpenChange: (open: boolean) => void;
};
const filters: Array<"all" | FeedbackStatus> = [
  "all",
  "pending",
  "approved",
  "rejected",
];

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
function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}-01T00:00:00`));
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

export function FeedbackReviewDialog({
  open,
  month,
  initialFilter,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const [fullscreen, setFullscreen] = useState(false);
  const [filter, setFilter] = useState<"all" | FeedbackStatus>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [reduction, setReduction] = useState("0");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const feedbackQuery = useQuery({
    queryKey: ["workforce", "feedback", month],
    queryFn: () => getWorkforceFeedback(month),
    enabled: open && Boolean(month),
  });
  const items = feedbackQuery.data?.items ?? [];
  const visible = useMemo(
    () =>
      filter === "all" ? items : items.filter((item) => item.status === filter),
    [filter, items],
  );
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const detailQuery = useQuery({
    queryKey: ["workforce", "feedback-detail", selectedId],
    queryFn: () => getWorkforceFeedbackDetail(selectedId ?? ""),
    enabled: open && Boolean(selectedId),
  });

  useEffect(() => {
    if (open) {
      setFilter(initialFilter);
      setSelectedId(null);
      setMobileDetail(false);
      setRejecting(false);
    } else setFullscreen(false);
  }, [open, initialFilter, month]);

  useEffect(() => {
    if (!selectedId && visible[0]) setSelectedId(visible[0].id);
    else if (selectedId && !visible.some((item) => item.id === selectedId))
      setSelectedId(visible[0]?.id ?? null);
  }, [selectedId, visible]);

  useEffect(() => {
    setReduction(String(selected?.reductionAmount ?? 0));
    setReason("");
    setRejecting(false);
  }, [selectedId, selected?.reductionAmount]);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["workforce", "feedback", month],
      }),
      queryClient.invalidateQueries({
        queryKey: ["workforce", "report", month],
      }),
    ]);
  const nextPending = () => {
    const next = items.find(
      (item) => item.status === "pending" && item.id !== selectedId,
    );
    setSelectedId(next?.id ?? null);
  };
  const approve = useMutation({
    mutationFn: () =>
      approveWorkforceFeedback(selectedId ?? "", {
        reductionAmount: Number(reduction),
      }),
    onSuccess: async () => {
      await refresh();
      nextPending();
    },
  });
  const reject = useMutation({
    mutationFn: () =>
      rejectWorkforceFeedback(selectedId ?? "", {
        reviewNote: reason || undefined,
      }),
    onSuccess: async () => {
      await refresh();
      nextPending();
    },
  });
  const fine = detailQuery.data?.fine;
  const reductionValue = Number(reduction);
  const validReduction =
    Number.isInteger(reductionValue) &&
    reductionValue >= 0 &&
    (!fine || reductionValue <= (fine.adjustedAmount ?? fine.amount));
  const pending = approve.isPending || reject.isPending;

  const choose = (item: WorkforceFeedback) => {
    setSelectedId(item.id);
    setMobileDetail(true);
  };

  if (!month) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={[
          "flex flex-col gap-0 overflow-hidden p-0",
          open
            ? "transition-[width,height,max-width,border-radius] duration-200"
            : "",
          fullscreen
            ? "h-screen w-screen sm:max-w-none rounded-none"
            : "h-[92vh] w-[96vw] sm:max-w-none max-w-none",
        ].join(" ")}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>
              Feedback · {month ? formatMonth(month) : ""}
            </DialogTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFullscreen((value) => !value)}
                title="Fullscreen"
              >
                {fullscreen ? <Minimize2 /> : <Maximize2 />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                title="Close"
              >
                <X />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 md:grid md:grid-cols-[34%_1fr]">
          <aside
            className={[
              "min-h-0 border-r md:flex md:flex-col",
              mobileDetail ? "hidden md:flex" : "flex flex-col",
            ].join(" ")}
          >
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b p-3">
              {filters.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={filter === value ? "secondary" : "ghost"}
                  onClick={() => setFilter(value)}
                >
                  {label(value)}
                </Button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {feedbackQuery.isLoading ? (
                <LoadingIndicator className="h-full" label="Loading feedback" />
              ) : feedbackQuery.isError ? (
                <p className="p-4 text-sm text-destructive">
                  {errorMessage(feedbackQuery.error)}
                </p>
              ) : visible.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  {items.length
                    ? `No ${filter} feedback.`
                    : `No feedback for ${formatMonth(month)}.`}
                </p>
              ) : (
                visible.map((item) => (
                  <button
                    key={item.id}
                    className={[
                      "w-full border-b p-4 text-left hover:bg-muted/50",
                      selectedId === item.id ? "bg-muted" : "",
                    ].join(" ")}
                    onClick={() => choose(item)}
                  >
                    <div className="flex justify-between gap-2 font-medium">
                      <span className="truncate">
                        {item.employeeName ?? item.employeeCode}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {label(item.reason)}
                    </p>
                    <span className="mt-2 inline-block text-xs capitalize text-muted-foreground">
                      {item.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>
          <section
            className={[
              "min-h-0 bg-background",
              mobileDetail ? "block" : "hidden md:block",
            ].join(" ")}
          >
            {mobileDetail && (
              <Button
                variant="ghost"
                className="m-2 md:hidden"
                onClick={() => setMobileDetail(false)}
              >
                ← Feedback list
              </Button>
            )}
            <div className="h-full overflow-y-auto p-5">
              {!selected ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Select a feedback item to review.
                </div>
              ) : detailQuery.isLoading ? (
                <LoadingIndicator className="h-full" label="Loading details" />
              ) : detailQuery.isError ? (
                <p className="text-destructive">
                  {errorMessage(detailQuery.error)}
                </p>
              ) : !detailQuery.data ? (
                <div>NULL</div>
              ) : (
                <div className="mx-auto max-w-2xl">
                  <h3 className="text-xl font-semibold">
                    {selected.employeeName ?? selected.employeeCode}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected.employeeCode} ·{" "}
                    {formatDate(detailQuery.data!.fine.date)}
                  </p>
                  <h4 className="mt-7 text-lg font-medium">
                    {label(selected.reason)}
                  </h4>
                  <hr className="my-6" />
                  <h5 className="font-medium">Attendance</h5>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <dt className="text-muted-foreground">Check-in</dt>
                    <dd>
                      {detailQuery.data!.attendance?.checkIn
                        ? dayjs
                            .utc(detailQuery.data!.attendance.checkIn)
                            .format("HH:mm")
                        : "—"}
                    </dd>
                    <dt className="text-muted-foreground">Check-out</dt>
                    <dd>
                      {detailQuery.data!.attendance?.checkOut
                        ? dayjs
                            .utc(detailQuery.data!.attendance.checkOut)
                            .format("HH:mm")
                        : "—"}
                    </dd>
                    <dt className="text-muted-foreground">Leave</dt>
                    <dd>
                      {detailQuery.data!.leave
                        ? label(detailQuery.data!.leave.type)
                        : "—"}
                    </dd>
                    <dt className="text-muted-foreground">Note</dt>
                    <dd>
                      {detailQuery.data!.fine?.reason
                        ? detailQuery.data!.fine?.reason
                        : "—"}
                    </dd>
                  </dl>
                  <hr className="my-6" />
                  <h5 className="font-medium">Employee feedback</h5>
                  <p className="mt-3 whitespace-pre-wrap text-sm">
                    {selected.description ||
                      "No additional description provided."}
                  </p>
                  <hr className="my-6" />
                  <h5 className="font-medium">Fine</h5>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <dt className="text-muted-foreground">Original fine</dt>
                    <dd>{formatMoney(fine!.amount)}</dd>
                    <dt className="self-center text-muted-foreground">
                      Reduction amount
                    </dt>
                    <dd>
                      <div className="flex flex-wrap gap-2">
                        {[10000, 20000, 30000].map((amount) => {
                          const maxAmount =
                            fine!.adjustedAmount ?? fine!.amount;
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
                        (fine!.adjustedAmount ?? fine!.amount) -
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
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
