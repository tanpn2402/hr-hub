import { HttpException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Namespace } from 'socket.io';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { WebAppAccessService } from './web-app-access.service';
import { DATA_KEY_PATTERN, WebAppDataService } from './web-app-data.service';
import { CHANNEL_NAME_PATTERN, findChannelRule, RealtimeChannelRule } from './web-app-manifest';
import { WebAppManifestService } from './web-app-manifest.service';
import { userLabel } from './web-apps-actor';
import { Member, Participant, RealtimeError, RtSocket } from './web-app-realtime.types';

export const MESSAGE_TYPE_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_STATE_BYTES = 64 * 1024;
const MAX_PERSISTED_ITEMS = 500;
const PRESENCE_DEBOUNCE_MS = 250;
const MAX_SEND_EACH = 2000;
/** Channel assets (images...): put once by the host, fetched on demand by members. Kept in memory with the channel. */
const MAX_ASSET_BYTES = 256 * 1024;
const MAX_CHANNEL_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_ASSETS = 200;

interface Channel {
  /** "<owner>/<name>" */
  id: string;
  owner: string;
  name: string;
  rule: RealtimeChannelRule;
  host: Member;
  hostSockets: Set<string>;
  participants: Map<string, Participant>;
  kicked: Set<string>;
  assets: Map<string, string>;
  assetBytes: number;
  state: unknown;
  stateAt: number;
  createdAt: number;
  closeTimer?: NodeJS.Timeout;
  presenceTimer?: NodeJS.Timeout;
}

/** Rooms: everyone in a channel, its host sockets, and each participant's sockets. */
const room = (id: string) => `ch:${id}`;
const hostRoom = (id: string) => `ch:${id}:host`;
const memberRoom = (id: string, memberId: string) => `ch:${id}:m:${memberId}`;

/**
 * Channels for web apps: an owner app opens a channel (host), other apps declared in its hrhub.json join it
 * (participants). The host sets a retained state, broadcasts and messages participants one by one; participants only
 * ever talk to the host. Channels live in memory of this (single) API instance; anything durable goes through the
 * owner app's data ("persist").
 */
@Injectable()
export class WebAppRealtimeService implements OnModuleDestroy {
  private readonly channels = new Map<string, Channel>();
  private readonly logger: TraceLogger;
  private ns!: Namespace;

  constructor(
    private readonly manifests: WebAppManifestService,
    private readonly access: WebAppAccessService,
    private readonly data: WebAppDataService,
    traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, WebAppRealtimeService.name);
  }

  attach(ns: Namespace) {
    this.ns = ns;
  }

  onModuleDestroy() {
    for (const channel of this.channels.values()) {
      clearTimeout(channel.closeTimer);
      clearTimeout(channel.presenceTimer);
    }
    this.channels.clear();
  }

  // ---------------------------------------------------------------- host

  async open(socket: RtSocket, args: { channel?: unknown }) {
    const { app: owner, identity, user } = socket.data;
    const name = this.channelName(args.channel);
    const rule = await this.ruleFor(owner, name);

    if (rule.hostRoles.length > 0) {
      if (!user) throw new RealtimeError('login_required', 'Sign in to host this channel');
      if (!this.access.isAdmin(user) && !user.roles.some((role) => rule.hostRoles.includes(role))) {
        throw new RealtimeError('forbidden', 'You may not host this channel');
      }
    }

    const id = `${owner}/${name}`;
    let channel = this.channels.get(id);
    if (channel && channel.host.id !== identity.id) {
      throw new RealtimeError('in_use', 'This channel is already hosted by someone else');
    }
    if (channel?.participants.has(identity.id)) throw new RealtimeError('bad_request', 'Already a participant of this channel');

    if (!channel) {
      channel = {
        id,
        owner,
        name,
        rule,
        host: this.member(socket, null),
        hostSockets: new Set(),
        participants: new Map(),
        kicked: new Set(),
        assets: new Map(),
        assetBytes: 0,
        state: null,
        stateAt: Date.now(),
        createdAt: Date.now(),
      };
      this.channels.set(id, channel);
      this.logger.log(`Channel ${id} opened by ${identity.id}`);
    } else {
      this.logger.log(`Channel ${id}: host ${identity.id} reconnected`);
    }

    clearTimeout(channel.closeTimer);
    channel.closeTimer = undefined;
    channel.hostSockets.add(socket.id);
    socket.data.channels.set(id, 'host');
    await socket.join([room(id), hostRoom(id)]);
    this.schedulePresence(channel);

    return {
      channel: id,
      state: channel.state,
      stateAt: channel.stateAt,
      you: this.publicMember(channel.host),
      presence: this.presenceFor(channel, true),
      at: Date.now(),
    };
  }

  setState(socket: RtSocket, args: { channel?: unknown; state?: unknown }) {
    const channel = this.hosted(socket, args.channel);
    this.assertSize(args.state ?? null, MAX_STATE_BYTES);
    channel.state = args.state ?? null;
    channel.stateAt = Date.now();
    this.ns.to(room(channel.id)).emit('rt:state', { channel: channel.id, state: channel.state, at: channel.stateAt });
    return { at: channel.stateAt };
  }

  broadcast(socket: RtSocket, args: { channel?: unknown; type?: unknown; payload?: unknown }) {
    const channel = this.hosted(socket, args.channel);
    const type = this.messageType(args.type);
    this.assertSize(args.payload ?? null, MAX_MESSAGE_BYTES);
    const at = Date.now();
    this.ns.to(room(channel.id)).emit('rt:message', {
      channel: channel.id,
      type,
      payload: args.payload ?? null,
      meta: { from: this.publicMember(channel.host), at, host: true },
      at,
    });
    return { at };
  }

  sendTo(socket: RtSocket, args: { channel?: unknown; to?: unknown; type?: unknown; payload?: unknown }) {
    const channel = this.hosted(socket, args.channel);
    const type = this.messageType(args.type);
    const to = (Array.isArray(args.to) ? args.to : [args.to]).filter((value): value is string => typeof value === 'string');
    if (to.length === 0 || to.length > 500) throw new RealtimeError('bad_request', '"to" must list 1-500 participant ids');
    this.assertSize(args.payload ?? null, MAX_MESSAGE_BYTES);

    const at = Date.now();
    const rooms = to.filter((id) => channel.participants.has(id)).map((id) => memberRoom(channel.id, id));
    if (rooms.length) {
      this.ns.to(rooms).emit('rt:message', {
        channel: channel.id,
        type,
        payload: args.payload ?? null,
        meta: { from: this.publicMember(channel.host), at, host: true, direct: true },
        at,
      });
    }
    return { at, delivered: rooms.length };
  }

  /**
   * Stores a string asset (typically an image data URL) in the channel; members fetch it with getAsset. Lets the host
   * share content larger than a message once, instead of resending it in every state. Re-putting a key replaces it.
   */
  putAsset(socket: RtSocket, args: { channel?: unknown; key?: unknown; data?: unknown }) {
    const channel = this.hosted(socket, args.channel);
    const key = this.messageType(args.key);
    if (typeof args.data !== 'string') throw new RealtimeError('bad_request', '"data" must be a string (e.g. a data URL)');
    const bytes = Buffer.byteLength(args.data);
    if (bytes > MAX_ASSET_BYTES) throw new RealtimeError('too_large', `Asset exceeds ${MAX_ASSET_BYTES} bytes`);

    const previous = channel.assets.get(key);
    const total = channel.assetBytes - (previous ? Buffer.byteLength(previous) : 0) + bytes;
    if (!previous && channel.assets.size >= MAX_ASSETS) throw new RealtimeError('too_large', `At most ${MAX_ASSETS} assets per channel`);
    if (total > MAX_CHANNEL_ASSET_BYTES) throw new RealtimeError('too_large', `Channel assets exceed ${MAX_CHANNEL_ASSET_BYTES} bytes`);

    channel.assets.set(key, args.data);
    channel.assetBytes = total;
    return { key, bytes };
  }

  /** Any member (host or participant) of the channel reads an asset. */
  getAsset(socket: RtSocket, args: { channel?: unknown; key?: unknown }) {
    const id = typeof args.channel === 'string' ? args.channel : '';
    const channel = this.channels.get(id);
    if (!channel || !socket.data.channels.has(id)) throw new RealtimeError('forbidden', 'You are not in this channel');
    const key = this.messageType(args.key);
    const data = channel.assets.get(key);
    if (data === undefined) throw new RealtimeError('not_found', 'Asset not found');
    return { key, data };
  }

  /** A different payload for each participant in one call ({ id: payload }), e.g. everyone's own score. */
  sendEach(socket: RtSocket, args: { channel?: unknown; type?: unknown; messages?: unknown }) {
    const channel = this.hosted(socket, args.channel);
    const type = this.messageType(args.type);
    const messages = args.messages;
    if (typeof messages !== 'object' || messages === null || Array.isArray(messages)) {
      throw new RealtimeError('bad_request', '"messages" must be { participantId: payload }');
    }
    const entries = Object.entries(messages as Record<string, unknown>);
    if (entries.length > MAX_SEND_EACH) throw new RealtimeError('bad_request', `At most ${MAX_SEND_EACH} recipients`);
    for (const [, payload] of entries) this.assertSize(payload ?? null, MAX_MESSAGE_BYTES);

    const at = Date.now();
    const meta = { from: this.publicMember(channel.host), at, host: true, direct: true };
    let delivered = 0;
    for (const [id, payload] of entries) {
      if (!channel.participants.has(id)) continue;
      this.ns.to(memberRoom(channel.id, id)).emit('rt:message', { channel: channel.id, type, payload: payload ?? null, meta, at });
      delivered++;
    }
    return { at, delivered };
  }

  kick(socket: RtSocket, args: { channel?: unknown; participant?: unknown }) {
    const channel = this.hosted(socket, args.channel);
    const participant = typeof args.participant === 'string' ? channel.participants.get(args.participant) : undefined;
    if (!participant) throw new RealtimeError('not_found', 'Participant not found');

    channel.kicked.add(participant.id);
    channel.participants.delete(participant.id);
    const target = memberRoom(channel.id, participant.id);
    this.ns.to(target).emit('rt:closed', { channel: channel.id, reason: 'kicked', at: Date.now() });
    for (const socketId of participant.sockets) this.forget(socketId, channel.id);
    this.ns.in(target).socketsLeave([room(channel.id), target]);
    this.logger.log(`Channel ${channel.id}: ${participant.id} kicked`);
    this.schedulePresence(channel);
    return { kicked: participant.id };
  }

  close(socket: RtSocket, args: { channel?: unknown }) {
    const channel = this.hosted(socket, args.channel);
    this.closeChannel(channel, 'closed');
    return { closed: channel.id };
  }

  // ---------------------------------------------------------------- participant

  async join(socket: RtSocket, args: { app?: unknown; channel?: unknown; nickname?: unknown }) {
    const { app: from, identity } = socket.data;
    const owner = typeof args.app === 'string' && args.app ? args.app : from;
    const name = this.channelName(args.channel);
    const rule = await this.ruleFor(owner, name);

    if (from !== owner && !rule.participants.includes(from)) {
      throw new RealtimeError('forbidden', `App ${from} may not join channels of ${owner}`);
    }
    if (identity.anonymous && !rule.allowAnonymous) throw new RealtimeError('login_required', 'Sign in to join this channel');

    const id = `${owner}/${name}`;
    const channel = this.channels.get(id);
    if (!channel) throw new RealtimeError('not_found', 'Channel not found or not open');
    if (channel.kicked.has(identity.id)) throw new RealtimeError('forbidden', 'You were removed from this channel');
    if (channel.host.id === identity.id) throw new RealtimeError('bad_request', 'You are the host of this channel');

    let participant = channel.participants.get(identity.id);
    // A returning member keeps their seat and name; only newcomers must pick a nickname.
    const nickname = this.nickname(args.nickname, identity.anonymous && !participant);
    const display = nickname ?? participant?.name ?? socket.data.identity.username ?? identity.id;
    for (const other of channel.participants.values()) {
      if (other.id !== identity.id && other.name.toLowerCase() === display.toLowerCase()) {
        throw new RealtimeError('nickname_taken', 'This name is already used in the channel');
      }
    }

    if (!participant) {
      if (channel.participants.size >= channel.rule.maxParticipants) throw new RealtimeError('full', 'Channel is full');
      participant = { ...this.member(socket, display), sockets: new Set(), joinedAt: Date.now(), ip: socket.data.ip };
      channel.participants.set(identity.id, participant);
      this.logger.log(`Channel ${id}: ${identity.id} joined from ${from}`);
    } else {
      participant.name = display;
      participant.ip = socket.data.ip;
    }

    participant.sockets.add(socket.id);
    socket.data.channels.set(id, 'participant');
    await socket.join([room(id), memberRoom(id, identity.id)]);
    this.schedulePresence(channel);

    return {
      channel: id,
      state: channel.state,
      stateAt: channel.stateAt,
      you: this.publicMember(participant),
      presence: this.presenceFor(channel, false),
      at: Date.now(),
    };
  }

  /** Participant -> host. With `persist`, the message is also stored in the owner app's data before it is relayed. */
  send(socket: RtSocket, args: { channel?: unknown; type?: unknown; payload?: unknown; persist?: unknown }) {
    const channel = this.joined(socket, args.channel);
    const type = this.messageType(args.type);
    this.assertSize(args.payload ?? null, MAX_MESSAGE_BYTES);
    const participant = channel.participants.get(socket.data.identity.id)!;
    const at = Date.now();

    let persisted: string | undefined;
    if (args.persist !== undefined && args.persist !== null && args.persist !== false) {
      if (typeof args.persist !== 'string' || !MESSAGE_TYPE_PATTERN.test(args.persist)) {
        throw new RealtimeError('bad_request', '"persist" must be an id: letters, digits, . _ : - (max 64)');
      }
      this.persist(channel, participant, socket, args.persist, type, args.payload ?? null, at);
      persisted = args.persist;
    }

    this.ns.to(hostRoom(channel.id)).emit('rt:message', {
      channel: channel.id,
      type,
      payload: args.payload ?? null,
      meta: { from: this.publicMember(participant), at, ...(persisted ? { persisted } : {}) },
      at,
    });
    return { at, delivered: channel.hostSockets.size > 0, persisted: persisted ?? null };
  }

  leave(socket: RtSocket, args: { channel?: unknown }) {
    const id = typeof args.channel === 'string' ? args.channel : '';
    const role = socket.data.channels.get(id);
    const channel = this.channels.get(id);
    if (!role || !channel) return { left: id };

    if (role === 'host') {
      this.detachHost(channel, socket.id);
    } else {
      const participant = channel.participants.get(socket.data.identity.id);
      participant?.sockets.delete(socket.id);
      // Leaving on purpose (not a disconnect) frees the seat once no tab of that member is left.
      if (participant && participant.sockets.size === 0) channel.participants.delete(participant.id);
      this.schedulePresence(channel);
    }
    socket.data.channels.delete(id);
    void socket.leave(room(id));
    void socket.leave(hostRoom(id));
    void socket.leave(memberRoom(id, socket.data.identity.id));
    return { left: id };
  }

  // ---------------------------------------------------------------- lifecycle

  disconnected(socket: RtSocket) {
    for (const [id, role] of socket.data.channels) {
      const channel = this.channels.get(id);
      if (!channel) continue;
      if (role === 'host') {
        this.detachHost(channel, socket.id);
      } else {
        // Keep the seat (and nickname) so a reconnecting participant comes back as the same member.
        channel.participants.get(socket.data.identity.id)?.sockets.delete(socket.id);
        this.schedulePresence(channel);
      }
    }
    socket.data.channels.clear();
  }

  private detachHost(channel: Channel, socketId: string) {
    channel.hostSockets.delete(socketId);
    this.schedulePresence(channel);
    if (channel.hostSockets.size > 0 || channel.closeTimer) return;

    const grace = channel.rule.hostGraceSeconds;
    this.logger.log(`Channel ${channel.id}: host offline, closing in ${grace}s unless they come back`);
    channel.closeTimer = setTimeout(() => this.closeChannel(channel, 'host_left'), grace * 1000);
    channel.closeTimer.unref();
  }

  private closeChannel(channel: Channel, reason: 'closed' | 'host_left') {
    if (this.channels.get(channel.id) !== channel) return;
    clearTimeout(channel.closeTimer);
    clearTimeout(channel.presenceTimer);
    this.channels.delete(channel.id);

    this.ns.to(room(channel.id)).emit('rt:closed', { channel: channel.id, reason, at: Date.now() });
    for (const socketId of channel.hostSockets) this.forget(socketId, channel.id);
    for (const participant of channel.participants.values()) {
      for (const socketId of participant.sockets) this.forget(socketId, channel.id);
    }
    for (const participant of channel.participants.values()) {
      this.ns.in(memberRoom(channel.id, participant.id)).socketsLeave(memberRoom(channel.id, participant.id));
    }
    this.ns.in(room(channel.id)).socketsLeave(room(channel.id));
    this.ns.in(hostRoom(channel.id)).socketsLeave(hostRoom(channel.id));
    this.logger.log(`Channel ${channel.id} closed (${reason}, ${channel.participants.size} participants)`);
  }

  private forget(socketId: string, channelId: string) {
    (this.ns.sockets.get(socketId) as RtSocket | undefined)?.data.channels.delete(channelId);
  }

  // ---------------------------------------------------------------- latency

  /** Every host gets the ping (ms) of each participant online, and its own: { host, pings: { id: ms } }. */
  publishLatency() {
    const at = Date.now();
    for (const channel of this.channels.values()) {
      if (channel.hostSockets.size === 0 || channel.participants.size === 0) continue;
      const pings: Record<string, number> = {};
      for (const participant of channel.participants.values()) {
        const rtt = this.bestRtt(participant.sockets);
        if (rtt !== null) pings[participant.id] = rtt;
      }
      this.ns.to(hostRoom(channel.id)).emit('rt:latency', { channel: channel.id, host: this.bestRtt(channel.hostSockets), pings, at });
    }
  }

  /** A member with several tabs: the best connection counts. */
  private bestRtt(socketIds: Set<string>): number | null {
    let best: number | null = null;
    for (const id of socketIds) {
      const rtt = (this.ns.sockets.get(id) as RtSocket | undefined)?.data.rtt ?? null;
      if (rtt !== null && (best === null || rtt < best)) best = rtt;
    }
    return best;
  }

  // ---------------------------------------------------------------- presence

  /** Debounced: a burst of joins sends one update instead of one per join to everyone. */
  private schedulePresence(channel: Channel) {
    if (channel.presenceTimer) return;
    channel.presenceTimer = setTimeout(() => {
      channel.presenceTimer = undefined;
      if (this.channels.get(channel.id) !== channel) return;
      const at = Date.now();
      this.ns.to(hostRoom(channel.id)).emit('rt:presence', { channel: channel.id, presence: this.presenceFor(channel, true), at });
      this.ns
        .to(room(channel.id))
        .except(hostRoom(channel.id))
        .emit('rt:presence', { channel: channel.id, presence: this.presenceFor(channel, false), at });
    }, PRESENCE_DEBOUNCE_MS);
  }

  private presenceFor(channel: Channel, forHost: boolean) {
    const participants = [...channel.participants.values()];
    const base = {
      hostOnline: channel.hostSockets.size > 0,
      count: participants.length,
      online: participants.filter((participant) => participant.sockets.size > 0).length,
    };
    if (!forHost && !channel.rule.presenceVisible) return base;
    return {
      ...base,
      host: this.publicMember(channel.host),
      participants: participants.map((participant) => ({
        ...this.publicMember(participant),
        online: participant.sockets.size > 0,
        joinedAt: participant.joinedAt,
        ...(forHost ? { ip: participant.ip } : {}),
      })),
    };
  }

  // ---------------------------------------------------------------- persistence

  /**
   * One record per participant and channel in the owner app's data: key "rt:<channel name>:<member id>",
   * value { channel, participant, items: { <persist id>: { type, payload, at } } }. Re-sending an id replaces it.
   */
  private persist(
    channel: Channel,
    participant: Participant,
    socket: RtSocket,
    persistId: string,
    type: string,
    payload: unknown,
    at: number,
  ) {
    let key = `rt:${channel.name}:${participant.id}`;
    if (!DATA_KEY_PATTERN.test(key)) {
      key = `rt:${channel.name}:${createHash('sha256').update(participant.id).digest('hex').slice(0, 24)}`;
    }

    const existing = this.data.peek(channel.owner, key) as { items?: Record<string, unknown> } | null;
    const items = { ...(existing?.items ?? {}) };
    if (!(persistId in items) && Object.keys(items).length >= MAX_PERSISTED_ITEMS) {
      throw new RealtimeError('too_large', `At most ${MAX_PERSISTED_ITEMS} persisted messages per participant`);
    }
    items[persistId] = { type, payload, at };

    try {
      this.data.put(channel.owner, key, { channel: channel.name, participant: this.publicMember(participant), items }, undefined, {
        by: userLabel(socket.data.user),
        device: socket.data.ip,
        isAdmin: false,
      });
    } catch (error) {
      const message = error instanceof HttpException ? error.message : 'Could not store the message';
      this.logger.error(`Channel ${channel.id}: persist ${persistId} for ${participant.id} failed: ${(error as Error).message}`);
      throw new RealtimeError('persist_failed', message);
    }
  }

  // ---------------------------------------------------------------- helpers

  private async ruleFor(owner: string, name: string): Promise<RealtimeChannelRule> {
    const manifest = await this.manifests.current(owner);
    const rule = manifest ? findChannelRule(manifest, name) : null;
    // Same answer for "no such app" and "no such channel kind": nothing to learn by probing.
    if (!rule) throw new RealtimeError('not_found', 'Channel not found or not open');
    return rule;
  }

  private hosted(socket: RtSocket, value: unknown): Channel {
    const id = typeof value === 'string' ? value : '';
    const channel = this.channels.get(id);
    if (!channel || socket.data.channels.get(id) !== 'host') throw new RealtimeError('forbidden', 'You are not the host of this channel');
    return channel;
  }

  private joined(socket: RtSocket, value: unknown): Channel {
    const id = typeof value === 'string' ? value : '';
    const channel = this.channels.get(id);
    if (!channel || socket.data.channels.get(id) !== 'participant' || !channel.participants.has(socket.data.identity.id)) {
      throw new RealtimeError('forbidden', 'You have not joined this channel');
    }
    return channel;
  }

  private member(socket: RtSocket, name: string | null): Member {
    const { identity, app } = socket.data;
    return { id: identity.id, name: name ?? identity.username ?? 'Host', username: identity.username, anonymous: identity.anonymous, app };
  }

  private publicMember(member: Member) {
    return { id: member.id, name: member.name, username: member.username, anonymous: member.anonymous, app: member.app };
  }

  private channelName(value: unknown): string {
    if (typeof value !== 'string' || !CHANNEL_NAME_PATTERN.test(value)) {
      throw new RealtimeError('bad_request', 'Channel names use letters, digits, . _ : - (max 64)');
    }
    return value;
  }

  private messageType(value: unknown): string {
    if (typeof value !== 'string' || !MESSAGE_TYPE_PATTERN.test(value)) {
      throw new RealtimeError('bad_request', 'Message types use letters, digits, . _ : - (max 64)');
    }
    return value;
  }

  /** Anonymous members must pick a nickname; signed-in members may (otherwise their username is shown). */
  private nickname(value: unknown, required: boolean): string | null {
    const nickname = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    if (!nickname) {
      if (required) throw new RealtimeError('bad_request', 'A nickname is required');
      return null;
    }
    if (nickname.length > 40) throw new RealtimeError('bad_request', 'Nickname is too long (max 40)');
    return nickname;
  }

  private assertSize(value: unknown, max: number) {
    let size: number;
    try {
      size = Buffer.byteLength(JSON.stringify(value));
    } catch {
      throw new RealtimeError('bad_request', 'Payload must be JSON');
    }
    if (size > max) throw new RealtimeError('too_large', `Payload exceeds ${max} bytes`);
  }
}
