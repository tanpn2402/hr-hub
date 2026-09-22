import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, Minimize2, X } from "lucide-react";
import dayjs from "dayjs";

import { Badge } from "@/components/ui/badge";
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
  getWorkforceFeedback,
  getWorkforceFeedbackDetail,
  WorkforceFeedbackDetail,
  type FeedbackStatus,
  type WorkforceFeedback,
} from "../api/workforce";
import { FeedbackDetail } from "./FeedbackDetail";

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

const statusConfig: Record<
  FeedbackStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: {
    label: "Pending",
    variant: "secondary",
  },
  approved: {
    label: "Approved",
    variant: "default",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
  },
};

function formatDate(value: string) {
  return dayjs(value).format("D MMM YYYY");
}

function formatMonth(value: string) {
  return dayjs(`${value}-01`).format("MMMM YYYY");
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

function FeedbackStatusBadge({
  status,
}: {
  status: FeedbackStatus;
}) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className="mt-2">
      {config.label}
    </Badge>
  );
}

function FeedbackListItem({
  item,
  selected,
  onClick,
}: {
  item: WorkforceFeedback;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full border-b p-4 text-left transition-colors",
        "hover:bg-muted/50",
        selected && "bg-muted",
      )}
      onClick={onClick}
    >
      <div className="flex justify-between gap-2 font-medium">
        <span className="truncate">
          {item.employeeName ?? item.employeeCode}
        </span>

        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDate(item.createdAt)}
        </span>
      </div>

      <p className="mt-1 truncate text-sm text-muted-foreground">
        {label(item.reason)}
      </p>

      <FeedbackStatusBadge status={item.status} />
    </button>
  );
}

function FeedbackListContent({
  loading,
  error,
  items,
  visible,
  filter,
  month,
  selectedId,
  onSelect,
}: {
  loading: boolean;
  error: unknown;
  items: WorkforceFeedback[];
  visible: WorkforceFeedback[];
  filter: "all" | FeedbackStatus;
  month: string;
  selectedId: string | null;
  onSelect: (item: WorkforceFeedback) => void;
}) {
  if (loading) {
    return (
      <LoadingIndicator
        className="h-full"
        label="Loading feedback"
      />
    );
  }

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive">
        {errorMessage(error)}
      </p>
    );
  }

  if (visible.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {items.length
          ? `No ${filter} feedback.`
          : `No feedback for ${formatMonth(month)}.`}
      </p>
    );
  }

  return (
    <>
      {visible.map((item) => (
        <FeedbackListItem
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          onClick={() => onSelect(item)}
        />
      ))}
    </>
  );
}

function FeedbackDetailContent({
  selected,
  query,
  month,
  onReviewed,
}: {
  selected: WorkforceFeedback | null;
  query: ReturnType<typeof useQuery<WorkforceFeedbackDetail>>;
  month: string;
  onReviewed: () => Promise<void>;
}) {
  if (!selected) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Select a feedback item to review.
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <LoadingIndicator
        className="h-full"
        label="Loading details"
      />
    );
  }

  if (query.isError) {
    return (
      <p className="text-sm text-destructive">
        {errorMessage(query.error)}
      </p>
    );
  }

  if (!query.data) {
    return (
      <div className="text-sm text-muted-foreground">
        Feedback details are unavailable.
      </div>
    );
  }

  return (
    <FeedbackDetail
      month={month}
      selected={selected}
      detail={query.data}
      onReviewed={onReviewed}
    />
  );
}

export function FeedbackReviewDialog({
  open,
  month,
  initialFilter,
  onOpenChange,
}: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [filter, setFilter] = useState<"all" | FeedbackStatus>(
    initialFilter,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);

  const feedbackQuery = useQuery({
    queryKey: ["workforce", "feedback", month],
    queryFn: () => getWorkforceFeedback(month),
    enabled: open && Boolean(month),
  });

  const items = feedbackQuery.data?.items ?? [];

  const visible = useMemo(() => {
    if (filter === "all") {
      return items;
    }

    return items.filter((item) => item.status === filter);
  }, [filter, items]);

  const selected =
    items.find((item) => item.id === selectedId) ?? null;

  const detailQuery = useQuery({
    queryKey: ["workforce", "feedback-detail", selectedId],
    queryFn: () => getWorkforceFeedbackDetail(selectedId ?? ""),
    enabled: open && Boolean(selectedId),
  });

  useEffect(() => {
    if (!open) {
      setFullscreen(false);
      return;
    }

    setFilter(initialFilter);
    setSelectedId(null);
    setMobileDetail(false);
  }, [open, initialFilter, month]);

  useEffect(() => {
    if (!selectedId && visible[0]) {
      setSelectedId(visible[0].id);
      return;
    }

    if (
      selectedId &&
      !visible.some((item) => item.id === selectedId)
    ) {
      setSelectedId(visible[0]?.id ?? null);
    }
  }, [selectedId, visible]);

  const nextPending = () => {
    const next = items.find(
      (item) =>
        item.status === "pending" &&
        item.id !== selectedId,
    );

    setSelectedId(next?.id ?? null);
  };

  const choose = (item: WorkforceFeedback) => {
    setSelectedId(item.id);
    setMobileDetail(true);
  };

  if (!month) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          open &&
          "transition-[width,height,max-width,border-radius] duration-200",
          fullscreen
            ? "h-screen w-screen max-w-full rounded-none sm:max-w-none"
            : "h-[92vh] w-[96vw] max-w-none sm:max-w-none",
        )}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>
              Feedback · {formatMonth(month)}
            </DialogTitle>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setFullscreen((value) => !value)
                }
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
            className={cn(
              "min-h-0 border-r md:flex md:flex-col",
              mobileDetail
                ? "hidden md:flex"
                : "flex flex-col",
            )}
          >
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b p-3">
              {filters.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={
                    filter === value
                      ? "secondary"
                      : "ghost"
                  }
                  onClick={() => setFilter(value)}
                >
                  {label(value)}
                </Button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <FeedbackListContent
                loading={feedbackQuery.isLoading}
                error={feedbackQuery.error}
                items={items}
                visible={visible}
                filter={filter}
                month={month}
                selectedId={selectedId}
                onSelect={choose}
              />
            </div>
          </aside>

          <section
            className={cn(
              "min-h-0 bg-background",
              mobileDetail
                ? "block"
                : "hidden md:block",
            )}
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
              <FeedbackDetailContent
                selected={selected}
                query={detailQuery}
                month={month}
                onReviewed={async () => {
                  nextPending();
                }}
              />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}