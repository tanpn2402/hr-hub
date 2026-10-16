import { SLUG_PATTERN } from './web-apps.config';

/**
 * hrhub.json: optional file at the root of an uploaded version that describes the app to HR Hub:
 *
 *   {
 *     "name": "Quizzy", "description": "...", "slug": "quizzy", "icon": "favicon.svg",
 *     "settings": { "hostApp": { "type": "app", "label": "Host app", "required": true } },
 *     "realtime": { "channels": [{ "prefix": "event:", "participants": [{ "$setting": "playerApp" }] }] }
 *   }
 *
 * name / description / slug only pre-fill the admin form. `settings` declares the values an administrator enters per
 * app (stored in the database, kept across versions); apps read them at runtime instead of hard-coding other slugs.
 */
export const MANIFEST_FILE = 'hrhub.json';

/** Channel names (the part after "<ownerSlug>/"), e.g. "event:8F3K". */
export const CHANNEL_NAME_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
export const SETTING_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
export const SETTING_TYPES = ['app', 'string', 'text', 'number', 'boolean', 'select'] as const;
export const ICON_EXTENSIONS = ['svg', 'png', 'ico', 'webp'];
const MAX_SETTINGS = 30;

export type SettingType = (typeof SETTING_TYPES)[number];

export interface SettingDefinition {
  type: SettingType;
  label: string;
  description: string | null;
  required: boolean;
  default: string | number | boolean | null;
  /** select only */
  options: Array<{ value: string; label: string }>;
  /** number only */
  min: number | null;
  max: number | null;
}

/** A participant app of a channel: a fixed slug, or the slug an administrator entered in an "app" setting. */
export type ParticipantRef = { slug: string } | { setting: string };

export interface RealtimeChannelRule {
  /** Channels whose name starts with this prefix ("" = every name). The longest matching prefix wins. */
  prefix: string;
  /** Other apps whose users may join these channels. The owner app itself may always join. */
  participants: ParticipantRef[];
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
  name: string | null;
  description: string | null;
  /** Suggested slug for a new app. */
  slug: string | null;
  /** Icon file at the archive root (checked to exist when the version is staged). */
  icon: string | null;
  settings: Record<string, SettingDefinition>;
  realtime: { channels: RealtimeChannelRule[] };
}

export const EMPTY_MANIFEST: WebAppManifest = {
  name: null,
  description: null,
  slug: null,
  icon: null,
  settings: {},
  realtime: { channels: [] },
};

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
  const manifest: WebAppManifest = { ...EMPTY_MANIFEST, settings: {}, realtime: { channels: [] } };

  manifest.name = optionalText(raw.name, 'name', 100, errors);
  manifest.description = optionalText(raw.description, 'description', 500, errors);
  manifest.slug = optionalText(raw.slug, 'slug', 63, errors);
  if (manifest.slug && !SLUG_PATTERN.test(manifest.slug)) errors.push('"slug" must use lowercase letters, digits and hyphens (2-63)');
  manifest.icon = optionalText(raw.icon, 'icon', 100, errors);
  if (manifest.icon && !new RegExp(`^[A-Za-z0-9._-]+\\.(${ICON_EXTENSIONS.join('|')})$`, 'i').test(manifest.icon)) {
    errors.push(`"icon" must be a file at the archive root (.${ICON_EXTENSIONS.join(', .')})`);
  }

  if (raw.settings !== undefined) {
    if (!isObject(raw.settings)) errors.push('"settings" must be an object { key: { type, label, ... } }');
    else {
      const entries = Object.entries(raw.settings);
      if (entries.length > MAX_SETTINGS) errors.push(`"settings": at most ${MAX_SETTINGS} keys`);
      for (const [key, value] of entries.slice(0, MAX_SETTINGS)) {
        if (!SETTING_KEY_PATTERN.test(key)) {
          errors.push(`settings: "${key}" must start with a letter and use letters, digits, _ (max 40)`);
          continue;
        }
        const definition = parseSetting(value, `settings.${key}`, errors);
        if (definition) manifest.settings[key] = definition;
      }
    }
  }

  if (raw.realtime !== undefined) {
    if (!isObject(raw.realtime) || !Array.isArray(raw.realtime.channels)) {
      errors.push('"realtime" must be { "channels": [...] }');
    } else {
      raw.realtime.channels.forEach((item, index) => {
        const rule = parseRule(item, `realtime.channels[${index}]`, manifest.settings, errors);
        if (rule) manifest.realtime.channels.push(rule);
      });
      const prefixes = manifest.realtime.channels.map((rule) => rule.prefix);
      if (new Set(prefixes).size !== prefixes.length) errors.push('realtime.channels: prefixes must be unique');
    }
  }

  if (errors.length) throw new ManifestError(errors);
  return manifest;
}

/** The rule that governs a channel name: the longest matching prefix. */
export function findChannelRule(manifest: WebAppManifest, name: string): RealtimeChannelRule | null {
  let best: RealtimeChannelRule | null = null;
  for (const rule of manifest.realtime.channels) {
    if (name.startsWith(rule.prefix) && (!best || rule.prefix.length > best.prefix.length)) best = rule;
  }
  return best;
}

function parseSetting(value: unknown, at: string, errors: string[]): SettingDefinition | null {
  if (!isObject(value)) {
    errors.push(`${at} must be an object { type, label }`);
    return null;
  }
  const start = errors.length;
  const type = value.type as SettingType;
  if (!SETTING_TYPES.includes(type)) errors.push(`${at}.type must be one of ${SETTING_TYPES.join(', ')}`);
  const label = optionalText(value.label, `${at}.label`, 100, errors);
  if (!label) errors.push(`${at}.label is required`);
  const description = optionalText(value.description, `${at}.description`, 300, errors);
  if (value.required !== undefined && typeof value.required !== 'boolean') errors.push(`${at}.required must be true or false`);

  let options: SettingDefinition['options'] = [];
  if (type === 'select') {
    if (!Array.isArray(value.options) || value.options.length === 0 || value.options.length > 50) {
      errors.push(`${at}.options must list 1-50 choices`);
    } else {
      options = value.options.map((option) =>
        typeof option === 'string'
          ? { value: option, label: option }
          : isObject(option) && typeof option.value === 'string'
            ? { value: option.value, label: typeof option.label === 'string' ? option.label : option.value }
            : { value: '', label: '' },
      );
      if (options.some((option) => !option.value)) errors.push(`${at}.options: each choice is a string or { value, label }`);
    }
  }

  const min = value.min === undefined ? null : value.min;
  const max = value.max === undefined ? null : value.max;
  if (type === 'number' && ((min !== null && typeof min !== 'number') || (max !== null && typeof max !== 'number'))) {
    errors.push(`${at}.min / max must be numbers`);
  }

  if (errors.length > start) return null;
  const definition: SettingDefinition = {
    type,
    label: label as string,
    description,
    required: value.required === true,
    default: null,
    options,
    min: typeof min === 'number' ? min : null,
    max: typeof max === 'number' ? max : null,
  };
  if (value.default !== undefined && value.default !== null) {
    const checked = checkSettingValue(definition, value.default);
    if (typeof checked === 'string') errors.push(`${at}.default: ${checked}`);
    else definition.default = checked.value;
  }
  return errors.length > start ? null : definition;
}

/**
 * Checks one value against its definition (shape only; "app" values are checked against existing apps by the caller).
 * Returns { value } normalized, or an error message.
 */
export function checkSettingValue(definition: SettingDefinition, input: unknown): { value: string | number | boolean } | string {
  switch (definition.type) {
    case 'app': {
      const slug = typeof input === 'string' ? input.trim().toLowerCase() : '';
      return SLUG_PATTERN.test(slug) ? { value: slug } : 'must be an app slug';
    }
    case 'string':
    case 'text': {
      if (typeof input !== 'string') return 'must be text';
      const max = definition.type === 'string' ? 200 : 2000;
      return input.length <= max ? { value: input.trim() } : `must be at most ${max} characters`;
    }
    case 'number': {
      const value = typeof input === 'number' ? input : typeof input === 'string' && input.trim() ? Number(input) : NaN;
      if (!Number.isFinite(value)) return 'must be a number';
      if (definition.min !== null && value < definition.min) return `must be at least ${definition.min}`;
      if (definition.max !== null && value > definition.max) return `must be at most ${definition.max}`;
      return { value };
    }
    case 'boolean':
      return typeof input === 'boolean'
        ? { value: input }
        : input === 'true' || input === 'false'
          ? { value: input === 'true' }
          : 'must be true or false';
    case 'select': {
      const value = typeof input === 'string' ? input : '';
      return definition.options.some((option) => option.value === value) ? { value } : 'is not one of the choices';
    }
  }
}

function parseRule(item: unknown, at: string, settings: Record<string, SettingDefinition>, errors: string[]): RealtimeChannelRule | null {
  if (!isObject(item)) {
    errors.push(`${at} must be an object`);
    return null;
  }
  const start = errors.length;

  const prefix = item.prefix ?? '';
  if (typeof prefix !== 'string' || (prefix !== '' && !/^[A-Za-z0-9._:-]{1,48}$/.test(prefix))) {
    errors.push(`${at}.prefix must use letters, digits, . _ : - (max 48)`);
  }

  const participants: ParticipantRef[] = [];
  if (item.participants !== undefined && !Array.isArray(item.participants)) errors.push(`${at}.participants must be a list`);
  for (const entry of Array.isArray(item.participants) ? item.participants : []) {
    if (typeof entry === 'string' && SLUG_PATTERN.test(entry.trim())) participants.push({ slug: entry.trim() });
    else if (isObject(entry) && typeof entry.$setting === 'string') {
      const setting = settings[entry.$setting];
      if (!setting || setting.type !== 'app') errors.push(`${at}.participants: "$setting": "${entry.$setting}" must name an "app" setting`);
      else participants.push({ setting: entry.$setting });
    } else {
      errors.push(`${at}.participants: each entry is an app slug or { "$setting": "<app setting>" }`);
    }
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
    participants,
    hostRoles: [...new Set(hostRoles)],
    maxParticipants: maxParticipants as number,
    allowAnonymous: item.allowAnonymous === true,
    presenceVisible: item.presenceVisible === true,
    hostGraceSeconds: hostGraceSeconds as number,
  };
}

function optionalText(value: unknown, at: string, max: number, errors: string[]): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > max) {
    errors.push(`"${at}" must be text (max ${max})`);
    return null;
  }
  return value.trim() || null;
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
