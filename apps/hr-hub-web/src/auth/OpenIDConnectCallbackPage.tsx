import { useEffect, useState } from "react";

import { idenplane } from "@/lib/idenplane";

export function OpenIDConnectCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        const success = await idenplane.handleCallback();

        if (cancelled) {
          return;
        }

        if (!success) {
          setError("Authentication failed.");
          return;
        }

        const returnTo = sessionStorage.getItem("auth:returnTo") || "/";
        sessionStorage.removeItem("auth:returnTo");

        // OAuth callbacks may be mounted outside the application router. Only
        // accept an internal path before returning to the original page.
        const destination =
          returnTo.startsWith("/") && !returnTo.startsWith("//")
            ? returnTo
            : "/";

        window.location.replace(destination);
      } catch (err) {
        console.error("Idenplane callback failed:", err);

        if (!cancelled) {
          setError("Authentication failed.");
        }
      }
    }

    void handleCallback();

    return () => {
      cancelled = true;
    };
  }, [idenplane]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-lg font-semibold">
            Authentication failed
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">
        Signing you in...
      </p>
    </div>
  );
}
