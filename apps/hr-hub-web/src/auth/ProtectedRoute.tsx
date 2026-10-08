import { type ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

type ProtectedRouteProps = {
  children: ReactNode;
  /** When set, the signed-in user needs at least one of these roles (the API enforces the same rule). */
  roles?: string[];
};

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, login, hasAnyRole, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const returnTo = location.pathname + location.search + location.hash;

      sessionStorage.setItem('auth:returnTo', returnTo);

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

  if (roles && roles.length > 0 && !hasAnyRole(roles)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{t('access_denied')}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t('access_denied_description')}</p>
        <div className="flex items-center gap-4 text-sm">
          <Button variant="outline" className="w-64 mt-4" onClick={() => void logout()}>
            <LogOut className="mr-2 size-4" />
            {t('sign_out')}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
