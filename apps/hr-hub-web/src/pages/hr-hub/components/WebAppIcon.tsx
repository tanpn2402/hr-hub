import { AppWindow } from 'lucide-react';
import { useState } from 'react';

import { webAppIconUrl } from '../api/web-apps';

type Props = {
  app: { slug: string; icon: string | null; currentVersion: number | null };
  className?: string;
};

/** The app's favicon, or a generic icon when the package has none (or it can't be loaded, e.g. unpublished). */
export function WebAppIcon({ app, className = 'size-4' }: Props) {
  const url = webAppIconUrl(app);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!url || failedUrl === url) return <AppWindow className={className} />;
  return <img src={url} alt="" className={`${className} object-contain`} onError={() => setFailedUrl(url)} />;
}
