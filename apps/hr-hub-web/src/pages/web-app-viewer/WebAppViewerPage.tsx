import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';

import { apiClient } from '@/api/client';
import { AppSwitcher } from '@/apps/AppSwitcher';
import { useAuth } from '@/auth/useAuth';

import {
  getErrorMessage,
  getWebAppAccess,
  runWebAppDataOp,
  type WebAppDataOp,
} from '@/pages/hr-hub/api/web-apps';

const OPS: WebAppDataOp[] = ['list', 'get', 'set', 'remove', 'employees', 'readApp'];

/**
 * Served at /hr-hub/apps/:slug (login is enforced client-side by ProtectedRoute). Hosts a web app inside a sandboxed iframe (no allow-same-origin => opaque origin, so the app cannot read
 * the session token from localStorage). The app talks to the data API only through postMessage; this page
 * performs the call with the user's token and the slug taken from the route, never from the app.
 */
export function WebAppViewerPage() {
  const { t } = useTranslation();
  const { slug = '' } = useParams<{ slug: string }>();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { login, isLoading: authLoading } = useAuth();
  const location = useLocation();

  /** Same flow as ProtectedRoute: remember where we were, then go to the identity provider. */
  const requireLogin = useCallback(() => {
    sessionStorage.setItem('auth:returnTo', location.pathname + location.search + location.hash);
    void login();
  }, [login, location]);

  const access = useQuery({
    queryKey: ['web-apps', 'access', slug],
    queryFn: () => getWebAppAccess(slug),
    retry: false,
    // Re-check once auth state is known (a stale/expired token is treated as anonymous by the API).
    enabled: !authLoading,
  });

  const status = (access.error as { response?: { status?: number } } | null)?.response?.status;
  const needsLogin = status === 401;

  // Restricted app opened anonymously: log in first.
  useEffect(() => {
    if (needsLogin) requireLogin();
  }, [needsLogin, requireLogin]);

  useEffect(() => {
    if (!access.data) return;

    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame || event.source !== frame) return;

      const message = event.data as {
        type?: string;
        id?: number;
        op?: WebAppDataOp;
        args?: Record<string, unknown>;
      };
      if (message?.type !== 'hrhub:request' || typeof message.id !== 'number') return;

      // Public apps work anonymously, including the employee directory: no login is forced here. A 401 from
      // the API (restricted target, expired token) is handled below.

      const reply = (payload: Record<string, unknown>) =>
        // Sandboxed frames have an opaque origin, so '*' is the only possible target; event.source pins the window.
        frame.postMessage({ type: 'hrhub:response', id: message.id, ...payload }, '*');

      if (!message.op || !OPS.includes(message.op)) {
        reply({ ok: false, error: { message: 'Unsupported operation', status: 400 } });
        return;
      }

      runWebAppDataOp(slug, message.op, message.args ?? {})
        .then((result) => reply({ ok: true, result }))
        .catch((error: unknown) => {
          const status = (error as { response?: { status?: number } }).response?.status ?? 500;
          // Token expired or the app/target needs a login: authenticate, then come back.
          if (status === 401) {
            requireLogin();
            return;
          }
          reply({ ok: false, error: { message: getErrorMessage(error), status } });
        });
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [access.data, slug, requireLogin]);

  if (authLoading || access.isLoading || needsLogin) return null;

  if (access.isError || !access.data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm">
        <div className="text-destructive">
          {getErrorMessage(access.error, t('web_app_not_found'))}
        </div>
        <Link to="/hr-hub/" className="text-muted-foreground underline">
          {t('back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b px-3 text-sm">
        <AppSwitcher currentApp={`web-app:${slug}`} />
        <Link
          to="/hr-hub/"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          HR Hub
        </Link>
        <span className="font-medium">{access.data.name}</span>
      </div>

      <iframe
        ref={frameRef}
        title={access.data.name}
        src={`${apiClient.defaults.baseURL}/apps/${encodeURIComponent(slug)}/`}
        sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-popups"
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}
