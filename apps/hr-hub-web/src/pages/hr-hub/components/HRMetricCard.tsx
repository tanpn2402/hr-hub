import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";

type Props = {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive?: boolean;
  };
};

export function HRMetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: Props) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>

        {trend && (
          <div
            className={[
              "flex items-center gap-1 text-xs font-medium",
              trend.positive
                ? "text-emerald-600"
                : "text-destructive",
            ].join(" ")}
          >
            {trend.positive ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )}

            {trend.value}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="text-2xl font-semibold tracking-tight">
          {value}
        </div>

        <div className="mt-1 text-sm font-medium">
          {title}
        </div>

        {description && (
          <div className="mt-1 text-xs text-muted-foreground">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}