import { IdenplaneClient, IdenplaneConfig } from 'idenplane-sdk';

const resolveIAMUrl = (url: string) => {
  if (url === undefined || url === null || url.trim() === '') {
    return window.location.origin;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return window.location.origin + url;
};

export const config: IdenplaneConfig = {
  url: resolveIAMUrl(import.meta.env.VITE_IAM_URL),
  realm: import.meta.env.VITE_IAM_REALM || 'tts',
  clientId: import.meta.env.VITE_IAM_CLIENT_ID || 'hr-hub-1',
  redirectUri: resolveIAMUrl(import.meta.env.VITE_IAM_REDIRECT_URI),
  storage: 'localStorage',
  allowInsecureHttp: true,
};

export const idenplane = new IdenplaneClient(config);
