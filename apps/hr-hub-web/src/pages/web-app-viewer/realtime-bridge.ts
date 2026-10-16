import { io, type Socket } from 'socket.io-client';

import { apiClient } from '@/api/client';
import { idenplane } from '@/lib/idenplane';

/** Anonymous visitors keep the same identity (and seat in a channel) across reloads through this signed token. */
const ANON_TOKEN_KEY = 'hrhub:rt-anon';

/** SDK op -> socket event. */
const EVENTS: Record<string, string> = {
  'rt.open': 'rt:open',
  'rt.join': 'rt:join',
  'rt.state': 'rt:state',
  'rt.broadcast': 'rt:broadcast',
  'rt.sendTo': 'rt:sendTo',
  'rt.sendEach': 'rt:sendEach',
  'rt.send': 'rt:send',
  'rt.kick': 'rt:kick',
  'rt.assetPut': 'rt:assetPut',
  'rt.assetGet': 'rt:assetGet',
  'rt.close': 'rt:close',
  'rt.leave': 'rt:leave',
};

export const isRealtimeOp = (op: string | undefined): op is string => !!op && op in EVENTS;

type Ack = { ok: true; result: unknown } | { ok: false; error: { code: string; message: string } };

export class RealtimeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Socket.io connection of one web app viewer. The sandboxed app never sees the socket or the token: it asks through
 * postMessage (ops "rt.*"), and server events are forwarded to it as { type: 'hrhub:realtime', event, data }.
 * Connects lazily on the first op, so apps that don't use channels cost nothing. After a reconnect (network drop,
 * expired token) every channel the app had opened or joined is opened/joined again and the app gets a "resync".
 */
export class RealtimeBridge {
  private socket: Socket | null = null;
  private readonly channels = new Map<string, { event: string; args: Record<string, unknown> }>();
  private connectedOnce = false;

  constructor(
    private readonly slug: string,
    private readonly post: (event: string, data: unknown) => void,
  ) {}

  async handle(op: string, args: Record<string, unknown>): Promise<unknown> {
    const event = EVENTS[op];
    const socket = this.connect();
    const ack = (await socket.timeout(10_000).emitWithAck(event, args)) as Ack;
    if (!ack.ok) throw new RealtimeError(ack.error.code, ack.error.message);

    const result = ack.result as { channel?: string };
    if ((event === 'rt:open' || event === 'rt:join') && result.channel) {
      this.channels.set(result.channel, { event, args });
    } else if ((event === 'rt:leave' || event === 'rt:close') && typeof args.channel === 'string') {
      this.channels.delete(args.channel);
    }
    return ack.result;
  }

  dispose() {
    this.socket?.disconnect();
    this.socket = null;
    this.channels.clear();
  }

  private connect(): Socket {
    if (this.socket) return this.socket;

    const socket = io('/web-apps', {
      path: `${apiClient.defaults.baseURL}/realtime`,
      // Evaluated on every (re)connect, so a refreshed access token is picked up.
      auth: (cb) =>
        cb({
          app: this.slug,
          token: idenplane.getAccessToken() ?? undefined,
          anonToken: readAnonToken(),
        }),
    });
    this.socket = socket;

    socket.on('rt:session', (session: { anonToken?: string | null }) => {
      if (session.anonToken) writeAnonToken(session.anonToken);
    });
    // The server measures the round trip (its own clock) and tells us the result in the next ping.
    socket.on('rt:ping', (data: { at?: number; rtt?: number | null }, ack?: () => void) => {
      if (typeof ack === 'function') ack();
      if (typeof data?.rtt === 'number') this.post('ping', { ms: data.rtt, at: data.at });
    });
    for (const name of ['state', 'message', 'presence', 'closed', 'latency'] as const) {
      socket.on(`rt:${name}`, (data: { channel?: string }) => {
        if (name === 'closed' && data.channel) this.channels.delete(data.channel);
        this.post(name, data);
      });
    }

    socket.on('connect', () => {
      this.post('status', { connected: true });
      if (this.connectedOnce) void this.resync();
      this.connectedOnce = true;
    });
    socket.on('disconnect', (reason) => {
      this.post('status', { connected: false, reason });
      // The server drops the socket when the access token expires: come back with a fresh one.
      if (reason === 'io server disconnect') setTimeout(() => socket.connect(), 1000);
    });
    socket.on('connect_error', (error: Error) => {
      this.post('status', { connected: false, reason: error.message });
    });

    return socket;
  }

  private async resync() {
    for (const [channel, { event, args }] of [...this.channels]) {
      try {
        const ack = (await this.socket!.timeout(10_000).emitWithAck(event, args)) as Ack;
        if (ack.ok) this.post('resync', ack.result);
        else {
          this.channels.delete(channel);
          this.post('closed', { channel, reason: ack.error.code, at: Date.now() });
        }
      } catch {
        // Timed out: the next reconnect tries again.
      }
    }
  }
}

function readAnonToken(): string | undefined {
  try {
    return localStorage.getItem(ANON_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeAnonToken(token: string) {
  try {
    localStorage.setItem(ANON_TOKEN_KEY, token);
  } catch {
    // Storage blocked: the visitor simply gets a new identity next time.
  }
}
