import { IdenplaneConfig } from "idenplane-sdk";

export const config: IdenplaneConfig = {
  url: import.meta.env.VITE_IAM_URL || "http://localhost:3004",
  realm: import.meta.env.VITE_IAM_REALM || "tts",
  clientId: import.meta.env.VITE_IAM_CLIENT_ID || "hr-hub-1",
  redirectUri:
    import.meta.env.VITE_IAM_REDIRECT_URI || "http://localhost:5170/auth/openid_connect/callback",
  storage: "localStorage",
};
