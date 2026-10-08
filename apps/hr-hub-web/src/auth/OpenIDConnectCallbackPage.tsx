import { useEffect, useState } from 'react';

import { idenplane } from '@/lib/idenplane';
import { useTranslation } from 'react-i18next';

export function OpenIDConnectCallbackPage() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      // Landing here without an authorization response means we returned from the IdP's logout
      // (post_logout_redirect_uri): go back to the page the user logged out from. Protected pages start a
      // fresh login themselves and come back to the same URL; public apps just open anonymously.
      const params = new URLSearchParams(window.location.search);
      if (!params.has('code') && !params.has('error')) {
        // Read only, never remove: React StrictMode runs this effect twice in dev, and a second run that finds
        // nothing would navigate to /hr-hub/ over the first one. The next login overwrites the key anyway.
        const previous = sessionStorage.getItem('auth:returnTo');
        const safe = previous && previous.startsWith('/') && !previous.startsWith('//');
        window.location.replace(safe ? previous : '/hr-hub/');
        return;
      }

      try {
        const success = await idenplane.handleCallback();

        if (cancelled) {
          return;
        }

        if (!success) {
          setError(t('authentication_failed_message'));
          return;
        }

        const returnTo = sessionStorage.getItem('auth:returnTo') || '/';
        sessionStorage.removeItem('auth:returnTo');

        // OAuth callbacks may be mounted outside the application router. Only
        // accept an internal path before returning to the original page.
        const destination = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

        window.location.replace(destination);
      } catch (err) {
        console.error('Idenplane callback failed:', err);

        if (!cancelled) {
          setError(t('authentication_failed_message'));
        }
      }
    }

    void handleCallback();

    return () => {
      cancelled = true;
    };
  }, [idenplane, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-lg font-semibold">{t('authentication_failed')}</h1>

          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{t('signing_you_in')}</p>
    </div>
  );
}
