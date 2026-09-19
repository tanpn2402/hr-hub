import { LogOut, User } from "lucide-react";

import { AppSwitcher } from "../../apps/AppSwitcher";
import { useAuth } from "@/auth/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function HRHubPage() {
  const { user, logout } = useAuth();

  const displayName =
    user?.name ||
    user?.preferred_username ||
    user?.email ||
    "User";

  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-full bg-background">
      <header className="flex h-14 items-center justify-between border-b px-5">
        {/* Left */}
        <div className="flex items-center gap-2">
          <AppSwitcher currentApp="hr-hub" />

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold">
              HR Hub
            </h1>

            <span className="text-sm text-muted-foreground">
              Portal
            </span>
          </div>
        </div>

        {/* Right */}
        <DropdownMenu>
          <DropdownMenuTrigger render={<button
            type="button"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {initials}
            </div>

            <div className="hidden text-left sm:block">
              <div className="text-sm font-medium leading-none">
                {displayName}
              </div>

              {user?.email && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {user.email}
                </div>
              )}
            </div>
          </button>} />

          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <div className="text-sm font-medium">
                {displayName}
              </div>

              {user?.email && (
                <div className="truncate text-xs text-muted-foreground">
                  {user.email}
                </div>
              )}
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem disabled>
              <User className="mr-2 size-4" />
              Profile
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => void handleLogout()}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 size-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    </div>
  );
}