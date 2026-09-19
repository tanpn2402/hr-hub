import { type ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";

type ProtectedRouteProps = {
  children: ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const {
    isAuthenticated,
    isLoading,
    login,
  } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const returnTo =
        location.pathname +
        location.search +
        location.hash;

      sessionStorage.setItem("auth:returnTo", returnTo);

      void login();
    }
  }, [isLoading, isAuthenticated, login, location]);

  // Still checking existing authentication
  if (isLoading) {
    return null;
  }

  // Idenplane login() redirects the browser.
  if (!isAuthenticated) {
    return null;
  }


  return <>{children}</>;
}
