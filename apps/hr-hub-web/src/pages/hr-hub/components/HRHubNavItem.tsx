import { Link, useLocation } from "react-router-dom";

import type { HRHubNavItem } from "../config/navigation";
import { config } from "../config/page";

type Props = {
  item: HRHubNavItem;
  collapsed?: boolean;
};

export function HRHubNavItem({
  item,
  collapsed = false,
}: Props) {
  const location = useLocation();

  const isActive =
    item.path === ""
      ? location.pathname === "/hr-hub"
      : location.pathname.startsWith(
        `/hr-hub/${item.path}`,
      );

  const Icon = item.icon;

  return (
    <Link
      to={config.path + (item.path || ".")}
      title={collapsed ? item.label : undefined}
      className={[
        "flex h-9 items-center gap-3 rounded-md px-3 text-sm",
        "transition-colors hover:bg-muted",
        isActive
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground",
        collapsed && "justify-center px-0",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon className="size-4 shrink-0" />

      {!collapsed && (
        <span className="truncate">
          {item.label}
        </span>
      )}
    </Link>
  );
}