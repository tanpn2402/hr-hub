import { HttpException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Namespace, Socket } from 'socket.io';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { WebAppAccessService } from './web-app-access.service';
import { WebAppRealtimeService } from './web-app-realtime.service';
import { RealtimeError, RealtimeIdentity, RtSocket } from './web-app-realtime.types';
import { clientIp } from './web-apps-actor';
import { SLUG_PATTERN } from './web-apps.config';

type Ack = (response: { ok: true; result: unknown } | { ok: false; error: { code: string; message: string } }) => void;

/** Token bucket per socket: bursts of 40 events, 20 per second sustained. */
const BUCKET_SIZE = 40;
const BUCKET_REFILL_PER_MS = 20 / 1000;
/** The server pings every socket this often and keeps the median of the last samples. */
const PING_INTERVAL_MS = 5000;
const PING_TIMEOUT_MS = 4000;
const PING_SAMPLES = 5;
/** setTimeout overflows above ~24.8 days. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Socket.io endpoint of web app channels: path /realtime/, namespace /web-apps (nginx: /hr-hub/api/realtime/).
 * Only the HR Hub viewer connects (web apps are sandboxed and talk to the viewer through postMessage), with
 * handshake auth { app, token?, anonToken? }. The app is access-checked once here, like every REST call is.
 */
@WebSocketGateway({ namespace: '/web-apps', path: '/realtime', maxHttpBufferSize: 1024 * 1024, serveClient: false })
export class WebAppRealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger: TraceLogger;
  private readonly anonSecret: Buffer;
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();
  private pingTimer?: NodeJS.Timeout;
  private ns!: Namespace;

  constructor(
    private readonly realtime: WebAppRealtimeService,
    private readonly auth: AuthService,
    private readonly access: WebAppAccessService,
    config: ConfigService,
    traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, WebAppRealtimeGateway.name);
    // Anonymous identities only need to survive reconnects; channels themselves do not survive a restart.
    const secret = config.get<string>('WEBAPPS_REALTIME_SECRET');
    this.anonSecret = secret ? Buffer.from(secret) : randomBytes(32);
  }

  afterInit(ns: Namespace) {
    this.ns = ns;
    this.realtime.attach(ns);
    this.pingTimer = setInterval(() => this.pingAll(), PING_INTERVAL_MS);
    this.pingTimer.unref();
    ns.use((socket, next) => {
      this.handshake(socket as RtSocket).then(
        () => next(),
        (error: unknown) => {
          const status = error instanceof HttpException ? error.getStatus() : 500;
          const failure = new Error(status === 401 ? 'login_required' : status === 500 ? 'error' : 'forbidden') as Error & {
            data: unknown;
          };
          failure.data = { status };
          next(failure);
        },
      );
    });
  }

  handleConnection(socket: RtSocket) {
    const { identity, app } = socket.data;
    socket.emit('rt:session', {
      identity,
      anonToken: identity.anonymous ? this.signAnon(identity.id) : null,
      at: Date.now(),
    });

    const on = (event: string, handler: (args: Record<string, unknown>) => unknown) =>
      socket.on(event, (args: unknown, ack?: unknown) => this.run(socket, event, handler, args, ack));

    on('rt:open', (args) => this.realtime.open(socket, args));
    on('rt:join', (args) => this.realtime.join(socket, args));
    on('rt:state', (args) => this.realtime.setState(socket, args));
    on('rt:broadcast', (args) => this.realtime.broadcast(socket, args));
    on('rt:sendTo', (args) => this.realtime.sendTo(socket, args));
    on('rt:sendEach', (args) => this.realtime.sendEach(socket, args));
    on('rt:send', (args) => this.realtime.send(socket, args));
    on('rt:kick', (args) => this.realtime.kick(socket, args));
    on('rt:assetPut', (args) => this.realtime.putAsset(socket, args));
    on('rt:assetGet', (args) => this.realtime.getAsset(socket, args));
    on('rt:close', (args) => this.realtime.close(socket, args));
    on('rt:leave', (args) => this.realtime.leave(socket, args));

    // A first measurement right away, so the ping shows up without waiting for the next round.
    setTimeout(() => this.ping(socket), 300).unref();
    this.logger.debug(`Realtime socket ${socket.id} connected: ${identity.id} in ${app}`);
  }

  onModuleDestroy() {
    clearInterval(this.pingTimer);
  }

  /** One round: hosts get their participants' pings (as measured so far), then every socket is pinged again. */
  private pingAll() {
    this.realtime.publishLatency();
    for (const socket of this.ns.sockets.values()) this.ping(socket as RtSocket);
  }

  /**
   * Measures the round trip on the server's own clock: a client can make itself look slower (late ack) but never
   * faster than it is. The payload carries the socket's current ping so players can show it.
   */
  private ping(socket: RtSocket) {
    if (!socket.connected || !socket.data?.rttSamples) return;
    const sent = Date.now();
    socket.timeout(PING_TIMEOUT_MS).emit('rt:ping', { at: sent, rtt: socket.data.rtt }, (error: Error | null) => {
      if (error) return;
      const samples = socket.data.rttSamples;
      samples.push(Date.now() - sent);
      if (samples.length > PING_SAMPLES) samples.shift();
      const sorted = [...samples].sort((a, b) => a - b);
      socket.data.rtt = sorted[Math.floor(sorted.length / 2)];
    });
  }

  handleDisconnect(socket: RtSocket) {
    clearTimeout(this.expiryTimers.get(socket.id));
    this.expiryTimers.delete(socket.id);
    if (socket.data?.channels) this.realtime.disconnected(socket);
  }

  private async run(socket: RtSocket, event: string, handler: (args: Record<string, unknown>) => unknown, args: unknown, ack: unknown) {
    const reply: Ack = typeof ack === 'function' ? (ack as Ack) : () => undefined;
    try {
      if (!this.take(socket)) throw new RealtimeError('rate_limited', 'Too many messages, slow down');
      const input = typeof args === 'object' && args !== null && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
      reply({ ok: true, result: await handler(input) });
    } catch (error) {
      if (error instanceof RealtimeError) {
        reply({ ok: false, error: { code: error.code, message: error.message } });
        return;
      }
      this.logger.error(`Realtime ${event} failed for ${socket.data.identity.id}: ${(error as Error).stack ?? error}`);
      reply({ ok: false, error: { code: 'error', message: 'Unexpected error' } });
    }
  }

  private async handshake(socket: RtSocket) {
    const auth = (socket.handshake.auth ?? {}) as { app?: unknown; token?: unknown; anonToken?: unknown };
    const app = typeof auth.app === 'string' && SLUG_PATTERN.test(auth.app) ? auth.app : null;
    if (!app) throw new RealtimeHandshakeError(400);

    let user: AuthenticatedUser | null = null;
    if (typeof auth.token === 'string' && auth.token) {
      // A signed-in viewer with a dead token must refresh it, not silently continue as an anonymous visitor.
      user = await this.auth.authenticate({ type: 'bearer', token: auth.token });
      this.scheduleExpiry(socket, auth.token);
    }
    await this.access.assertAccess(app, user);

    const identity: RealtimeIdentity = user
      ? { id: user.id, username: user.username ?? user.email ?? null, anonymous: false }
      : { id: this.verifyAnon(auth.anonToken) ?? `anon-${randomBytes(8).toString('hex')}`, username: null, anonymous: true };

    socket.data = {
      app,
      user,
      identity,
      ip: clientIp(socket.handshake.headers, socket.handshake.address),
      channels: new Map(),
      bucket: { tokens: BUCKET_SIZE, at: Date.now() },
      rttSamples: [],
      rtt: null,
    };
  }

  /** Disconnect when the access token expires; the viewer reconnects with a fresh one and rejoins its channels. */
  private scheduleExpiry(socket: RtSocket, token: string) {
    let exp: unknown;
    try {
      exp = (JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: unknown }).exp;
    } catch {
      return;
    }
    if (typeof exp !== 'number') return;

    const timer = setTimeout(() => socket.disconnect(true), Math.min(Math.max(exp * 1000 - Date.now(), 0), MAX_TIMEOUT_MS));
    timer.unref();
    this.expiryTimers.set(socket.id, timer);
  }

  private take(socket: RtSocket): boolean {
    const bucket = socket.data.bucket;
    const now = Date.now();
    bucket.tokens = Math.min(BUCKET_SIZE, bucket.tokens + (now - bucket.at) * BUCKET_REFILL_PER_MS);
    bucket.at = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  private signAnon(id: string) {
    return `${id}.${createHmac('sha256', this.anonSecret).update(id).digest('base64url')}`;
  }

  private verifyAnon(token: unknown): string | null {
    if (typeof token !== 'string') return null;
    const [id, signature] = token.split('.');
    if (!id || !signature || !/^anon-[0-9a-f]{16}$/.test(id)) return null;
    const expected = Buffer.from(this.signAnon(id).split('.')[1]);
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : null;
  }
}

class RealtimeHandshakeError extends HttpException {
  constructor(status: number) {
    super('Realtime handshake failed', status);
  }
}
