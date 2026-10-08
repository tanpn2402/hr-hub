import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/auth/useAuth';
import {
  getErrorMessage,
  getMyAccessRequest,
  requestWebAppAccess,
} from '@/pages/hr-hub/api/web-apps';

export type RequestAccessApp = {
  slug: string;
  name: string;
  description: string | null;
  requiredRoles: string[];
};

/**
 * Shown to a signed-in user who lacks the roles of a web app: app info, a "request access" button (the request
 * lands in the manage-app-accesses app so administrators know who asks; roles themselves are granted in Idenplane),
 * the request status, and a sign-out button.
 */
export function RequestAccessPanel({ app }: { app: RequestAccessApp }) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  const queryKey = ['web-apps', 'access-request', app.slug];
  const request = useQuery({ queryKey, queryFn: () => getMyAccessRequest(app.slug), retry: false });

  const send = useMutation({
    mutationFn: () => requestWebAppAccess(app.slug, message),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const status = request.data?.status ?? 'none';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <ShieldAlert className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{app.name}</h1>
            {app.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{app.description}</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {status === 'pending' ? (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">{t('access_request_sent')}</div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t('request_access_description')}</p>

              {status === 'approved' && (
                <div className="rounded-md bg-muted px-3 py-2 text-sm">
                  {t('access_request_approved')}
                </div>
              )}

              {status === 'rejected' && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {t('access_request_rejected')}
                  {request.data?.note ? ` ${request.data.note}` : ''}
                </div>
              )}

              <Textarea
                rows={2}
                maxLength={500}
                value={message}
                disabled={send.isPending}
                placeholder={t('request_access_message_placeholder')}
                onChange={(event) => setMessage(event.target.value)}
              />

              {send.isError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {getErrorMessage(send.error, t('access_request_failed'))}
                </div>
              )}

              <Button
                className="w-full"
                disabled={send.isPending || request.isLoading}
                onClick={() => send.mutate()}
              >
                {send.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t('request_access')}
              </Button>
            </>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={() => void logout()}>
          <LogOut className="mr-2 size-4" />
          {t('sign_out')}
        </Button>
      </div>
    </div>
  );
}
