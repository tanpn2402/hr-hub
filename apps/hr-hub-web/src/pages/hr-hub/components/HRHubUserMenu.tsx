import { LogOut, User } from "lucide-react";

import { useAuth } from "@/auth/useAuth";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  onLogout: () => void;
};

export function HRHubUserMenu({ onLogout }: Props) {
  const { user } = useAuth();

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {initials}
            </div>

            <div className="hidden text-left sm:block">
              <div className="text-sm font-medium leading-none">
                {displayName}
              </div>

              {user?.email && (
                <div className="mt-1 max-w-48 truncate text-xs text-muted-foreground">
                  {user.email}
                </div>
              )}
            </div>
          </button>
        }
      />

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
          onClick={onLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}