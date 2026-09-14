import apiClient from './client';
import { parseJsonObject } from '../utils/jsonFields';

export interface Plugin {
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  author?: string;
  homepage?: string;
  config?: Record<string, unknown> | null;
}

// SQLite has no native Json column type, so InstalledPlugin.config is stored
// as JSON-serialised TEXT and may come back from the API as a raw string
// rather than a real object. Parse it here so callers always see the clean
// shape declared by the `Plugin` type.
function mapPlugin(raw: Plugin): Plugin {
  return {
    ...raw,
    config: raw.config ? parseJsonObject(raw.config, {}) : raw.config,
  };
}

export async function getPlugins(): Promise<Plugin[]> {
  const { data } = await apiClient.get<Plugin[]>('/plugins');
  return data.map(mapPlugin);
}

export async function getPlugin(name: string): Promise<Plugin> {
  const { data } = await apiClient.get<Plugin>(`/plugins/${name}`);
  return mapPlugin(data);
}

export async function enablePlugin(name: string): Promise<Plugin> {
  const { data } = await apiClient.post<Plugin>(`/plugins/${name}/enable`);
  return mapPlugin(data);
}

export async function disablePlugin(name: string): Promise<Plugin> {
  const { data } = await apiClient.post<Plugin>(`/plugins/${name}/disable`);
  return mapPlugin(data);
}

export async function deletePlugin(name: string): Promise<void> {
  await apiClient.delete(`/plugins/${name}`);
}
