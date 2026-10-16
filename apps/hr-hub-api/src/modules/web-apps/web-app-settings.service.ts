import { BadRequestException, Injectable } from '@nestjs/common';
import type { WebApp, WebAppVersion } from '@generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { checkSettingValue, ParticipantRef, parseManifest, SettingDefinition, WebAppManifest } from './web-app-manifest';

export type SettingValues = Record<string, string | number | boolean>;
export type SettingsSchema = Record<string, SettingDefinition>;

/**
 * Settings: the values an administrator enters for what an app's hrhub.json declares ("settings"). Stored per app
 * (WebApp.settings), so they survive new versions; the schema comes from the version (WebAppVersion.manifest).
 */
@Injectable()
export class WebAppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The validated manifest stored with a version (null when the package has none). */
  manifestOf(version: Pick<WebAppVersion, 'manifest'> | null | undefined): WebAppManifest | null {
    if (!version?.manifest) return null;
    try {
      return parseManifest(version.manifest);
    } catch {
      return null;
    }
  }

  storedValues(app: Pick<WebApp, 'settings'>): SettingValues {
    try {
      const parsed: unknown = JSON.parse(app.settings || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as SettingValues) : {};
    } catch {
      return {};
    }
  }

  /** Values the app sees at runtime: the declared keys only, defaults filled in. */
  effectiveValues(schema: SettingsSchema, stored: SettingValues): Record<string, string | number | boolean | null> {
    const values: Record<string, string | number | boolean | null> = {};
    for (const [key, definition] of Object.entries(schema)) values[key] = stored[key] ?? definition.default ?? null;
    return values;
  }

  /** Labels of required settings that have neither a value nor a default. */
  missingRequired(schema: SettingsSchema, stored: SettingValues): string[] {
    return Object.entries(schema)
      .filter(([key, definition]) => definition.required && (stored[key] ?? definition.default) == null)
      .map(([key, definition]) => `${definition.label} (${key})`);
  }

  /**
   * Validates `input` (an object, or its JSON text from a multipart form) against the schema and merges it into the
   * stored values. Empty strings / null clear a value. "app" values must name an existing app. Throws 400 listing
   * every problem.
   */
  async merge(schema: SettingsSchema, stored: SettingValues, input: unknown): Promise<SettingValues> {
    if (input === undefined || input === null || input === '') return { ...stored };
    let raw = input;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        throw new BadRequestException('settings must be a JSON object');
      }
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new BadRequestException('settings must be an object');

    const values: SettingValues = { ...stored };
    const errors: string[] = [];
    const apps: string[] = [];
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const definition = schema[key];
      if (!definition) continue; // keys of another version: ignored, the stored value is kept
      if (value === null || value === '') {
        delete values[key];
        continue;
      }
      const checked = checkSettingValue(definition, value);
      if (typeof checked === 'string') errors.push(`${definition.label}: ${checked}`);
      else {
        values[key] = checked.value;
        if (definition.type === 'app') apps.push(checked.value as string);
      }
    }

    if (apps.length) {
      const found = await this.prisma.webApp.findMany({
        where: { slug: { in: apps }, status: { not: 'deleted' } },
        select: { slug: true },
      });
      const known = new Set(found.map((app) => app.slug));
      for (const [key, definition] of Object.entries(schema)) {
        if (
          definition.type === 'app' &&
          typeof values[key] === 'string' &&
          apps.includes(values[key] as string) &&
          !known.has(values[key] as string)
        ) {
          errors.push(`${definition.label}: app "${values[key]}" does not exist`);
        }
      }
    }

    if (errors.length) throw new BadRequestException({ message: 'Invalid settings', errors });
    return values;
  }

  /** Runtime values of a published app, by slug (for the SDK and for channel participants). */
  async valuesOf(slug: string): Promise<Record<string, string | number | boolean | null>> {
    const app = await this.prisma.webApp.findUnique({ where: { slug } });
    if (!app?.currentVersionId) return {};
    const version = await this.prisma.webAppVersion.findUnique({ where: { id: app.currentVersionId } });
    const manifest = this.manifestOf(version);
    return manifest ? this.effectiveValues(manifest.settings, this.storedValues(app)) : {};
  }

  /** Slugs of a channel's participant apps, "$setting" references resolved with the owner app's settings. */
  async participantSlugs(owner: string, participants: ParticipantRef[]): Promise<string[]> {
    if (!participants.some((ref) => 'setting' in ref)) return participants.map((ref) => (ref as { slug: string }).slug);
    const values = await this.valuesOf(owner);
    return participants
      .map((ref) => ('slug' in ref ? ref.slug : values[ref.setting]))
      .filter((slug): slug is string => typeof slug === 'string' && !!slug);
  }
}
