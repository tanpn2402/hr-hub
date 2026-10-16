import type { IncomingHttpHeaders } from 'node:http';
import type { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth.types';

/** Who performed a write, and from where. `by` is null for anonymous callers of public apps. */
export interface DataActor {
  by: string | null;
  device: string | null;
  isAdmin: boolean;
}

/** "username <email>" (or whichever part exists) so records show who created or changed them. */
export function userLabel(user: Pick<AuthenticatedUser, 'id' | 'username' | 'email'> | null | undefined): string | null {
  if (!user) return null;
  if (user.username && user.email) return `${user.username} <${user.email}>`;
  return user.username || user.email || user.id;
}

/** Client IP as seen by the API: nginx's X-Real-IP, else the right-most X-Forwarded-For hop, else the socket. */
export function requestIp(request: Request): string | null {
  return clientIp(request.headers, request.socket?.remoteAddress);
}

/** Same rule for any transport (HTTP requests, socket.io handshakes). */
export function clientIp(headers: IncomingHttpHeaders, remoteAddress: string | null | undefined): string | null {
  const realIp = headers['x-real-ip'];
  const forwarded = headers['x-forwarded-for'];
  const lastForwarded = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded)?.split(',').pop();

  const ip = (Array.isArray(realIp) ? realIp[0] : realIp) || lastForwarded || remoteAddress || null;
  return ip ? ip.trim().replace(/^::ffff:/, '') : null;
}

/** Device id for auditing: the client IP as seen by the API (from the headers nginx forwards). */
export function deviceId(request: Request): string | null {
  return requestIp(request);
}
