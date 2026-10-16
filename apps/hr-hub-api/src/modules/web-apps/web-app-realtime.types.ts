import type { Socket } from 'socket.io';
import type { AuthenticatedUser } from '../auth/auth.types';

/** Who is behind a socket: a signed-in user, or an anonymous visitor identified by a server-signed token. */
export interface RealtimeIdentity {
  /** User id (token "sub") or "anon-<hex>". */
  id: string;
  /** Username/e-mail of signed-in users, null for anonymous visitors. */
  username: string | null;
  anonymous: boolean;
}

/** Per-socket data, set by the handshake middleware. */
export interface RealtimeSocketData {
  /** The app this socket was opened from (the viewer's :slug), already access-checked. */
  app: string;
  user: AuthenticatedUser | null;
  identity: RealtimeIdentity;
  ip: string | null;
  /** channel id -> role of this socket in it */
  channels: Map<string, 'host' | 'participant'>;
  bucket: { tokens: number; at: number };
  /** Round trips measured by the server (ms, newest last) and their median: the socket's ping. */
  rttSamples: number[];
  rtt: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RtSocket = Socket<any, any, any, RealtimeSocketData>;

export interface Member {
  id: string;
  name: string;
  username: string | null;
  anonymous: boolean;
  /** App the member joined from. */
  app: string;
}

export interface Participant extends Member {
  sockets: Set<string>;
  joinedAt: number;
  /** Client IP of the latest join (shown to the host only). */
  ip: string | null;
}

export class RealtimeError extends Error {
  constructor(
    readonly code:
      | 'bad_request'
      | 'not_found'
      | 'forbidden'
      | 'login_required'
      | 'full'
      | 'in_use'
      | 'nickname_taken'
      | 'too_large'
      | 'rate_limited'
      | 'persist_failed',
    message: string,
  ) {
    super(message);
  }
}
