import { SLUG_PATTERN } from './web-apps.config';

/** Optional file at the root of an uploaded version that declares what the app needs from HR Hub. */
export const MANIFEST_FILE = 'hrhub.json';

/** Channel names (the part after "<ownerSlug>/"), e.g. "event:8F3K". */
export const CHANNEL_NAME_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

export interface RealtimeChannelRule {
  /** Channels whose name starts with this prefix ("" = every name). The longest matching prefix wins. */
  prefix: string;
  /** Other apps whose users may join these channels. The owner app itself may always join. */
  participants: string[];
  /** Roles allowed to open (host) these channels. [] = anyone who may open the owner app. */
  hostRoles: string[];
  maxParticipants: number;
  /** Visitors who are not signed in may join (with a nickname). The joining app must be public too. */
  allowAnonymous: boolean;
  /** Participants see who else is in the channel; otherwise only the count. Hosts always see everyone. */
  presenceVisible: boolean;
  /** How long a channel stays open while its host is offline (reload, network drop) before it is closed. */
  hostGraceSeconds: number;
}

export interface WebAppManifest {
  realtime: { channels: RealtimeChannelRule[] };
}

export const EMPTY_MANIFEST: WebAppManifest = { realtime: { channels: [] } };

const DEFAULT_MAX_PARTICIPANTS = 200;
const MAX_PARTICIPANTS_LIMIT = 2000;
const DEFAULT_HOST_GRACE_SECONDS = 300;

export class ManifestError extends Error {
  constructor(readonly errors: string[]) {
    super(`Invalid ${MANIFEST_FILE}: ${errors.join('; ')}`);
  }
}

/** Validates the raw text of hrhub.json. Throws ManifestError listing every problem. */
export function parseManifest(text: string): WebAppManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new ManifestError([`not valid JSON (${(error as Error).message})`]);
  }
  if (!isObject(raw)) throw new ManifestError(['must be a JSON object']);

  const errors: string[] = [];
  const channels: RealtimeChannelRule[] = [];

  if (raw.realtime !== undefined) {
    if (!isObject(raw.realtime) || !Array.isArray(raw.realtime.channels)) {
      errors.push('"realtime" must be { "channels": [...] }');
    } else {
      raw.realtime.channels.forEach((item, index) => {
        const rule = parseRule(item, `realtime.channels[${index}]`, errors);
        if (rule) channels.push(rule);
      });
      const prefixes = channels.map((rule) => rule.prefix);
      if (new Set(prefixes).size !== prefixes.length) errors.push('realtime.channels: prefixes must be unique');
    }
  }

  if (errors.length) throw new ManifestError(errors);
  return { realtime: { channels } };
}

/** The rule that governs a channel name: the longest matching prefix. */
export function findChannelRule(manifest: WebAppManifest, name: string): RealtimeChannelRule | null {
  let best: RealtimeChannelRule | null = null;
  for (const rule of manifest.realtime.channels) {
    if (name.startsWith(rule.prefix) && (!best || rule.prefix.length > best.prefix.length)) best = rule;
  }
  return best;
}

function parseRule(item: unknown, at: string, errors: string[]): RealtimeChannelRule | null {
  if (!isObject(item)) {
    errors.push(`${at} must be an object`);
    return null;
  }
  const start = errors.length;

  const prefix = item.prefix ?? '';
  if (typeof prefix !== 'string' || (prefix !== '' && !/^[A-Za-z0-9._:-]{1,48}$/.test(prefix))) {
    errors.push(`${at}.prefix must use letters, digits, . _ : - (max 48)`);
  }

  const participants = stringList(item.participants, `${at}.participants`, errors);
  for (const slug of participants) {
    if (!SLUG_PATTERN.test(slug)) errors.push(`${at}.participants: "${slug}" is not a valid app slug`);
  }
  const hostRoles = stringList(item.hostRoles, `${at}.hostRoles`, errors);

  const maxParticipants = item.maxParticipants ?? DEFAULT_MAX_PARTICIPANTS;
  if (!Number.isInteger(maxParticipants) || (maxParticipants as number) < 1 || (maxParticipants as number) > MAX_PARTICIPANTS_LIMIT) {
    errors.push(`${at}.maxParticipants must be an integer 1-${MAX_PARTICIPANTS_LIMIT}`);
  }

  const hostGraceSeconds = item.hostGraceSeconds ?? DEFAULT_HOST_GRACE_SECONDS;
  if (!Number.isInteger(hostGraceSeconds) || (hostGraceSeconds as number) < 0 || (hostGraceSeconds as number) > 3600) {
    errors.push(`${at}.hostGraceSeconds must be an integer 0-3600`);
  }

  for (const flag of ['allowAnonymous', 'presenceVisible'] as const) {
    if (item[flag] !== undefined && typeof item[flag] !== 'boolean') errors.push(`${at}.${flag} must be true or false`);
  }

  if (errors.length > start) return null;
  return {
    prefix: prefix as string,
    participants: [...new Set(participants)],
    hostRoles: [...new Set(hostRoles)],
    maxParticipants: maxParticipants as number,
    allowAnonymous: item.allowAnonymous === true,
    presenceVisible: item.presenceVisible === true,
    hostGraceSeconds: hostGraceSeconds as number,
  };
}

function stringList(value: unknown, at: string, errors: string[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim() || item.length > 100)) {
    errors.push(`${at} must be a list of names`);
    return [];
  }
  return value.map((item: string) => item.trim());
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
