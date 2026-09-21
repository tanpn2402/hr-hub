import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingIndicatorProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
};

export function LoadingIndicator({
  className,
  label,
  size = "md",
}: LoadingIndicatorProps) {
  const sizes = {
    sm: "size-4",
    md: "size-6",
    lg: "size-8",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-muted-foreground",
        className,
      )}
    >
      <Loader2
        className={cn(sizes[size], "animate-spin")}
        aria-hidden="true"
      />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}
