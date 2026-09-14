// The backend runs on SQLite for local dev (see prisma/schema.sqlite.prisma),
// which has no native String[] or Json column type. Fields annotated there
// with "SQLite: String[] → String (JSON array text)" or
// "SQLite: Json → String (JSON-serialised text)" are stored as JSON-encoded
// TEXT and *should* be parsed back into a real array/object by the REST
// endpoint before it reaches the browser (see e.g. toClientResponse() on the
// backend) — but not every endpoint has been audited for this yet, and a
// raw JSON string slipping through crashes call sites that expect a real
// array (e.g. `client.redirectUris.join('\n')`).
//
// Parse any such field through these helpers instead of using the value
// directly, so the UI degrades to the fallback instead of throwing when a
// field comes back un-parsed.

/** Parses a field that should be a `T[]` but may still be a JSON-array string
 * (or missing/invalid) coming from the API. Passes an already-real array
 * through unchanged. */
export function parseJsonArray<T = string>(
  value: T[] | string | null | undefined,
  fallback: T[] = [],
): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

/** Parses a field that should be a `T` object but may still be a
 * JSON-serialised string (or missing/invalid) coming from the API. Passes an
 * already-real object through unchanged. */
export function parseJsonObject<T extends Record<string, unknown>>(
  value: T | string | null | undefined,
  fallback: T,
): T {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as T)
      : fallback;
  } catch {
    return fallback;
  }
}

/** Serialises a `T[]` to the JSON-array-text shape the SQLite-backed API
 * expects on write. A no-op if `value` is already a JSON-encoded string. */
export function stringifyJsonArray<T>(value: T[] | string): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Serialises a `T` object to the JSON-text shape the SQLite-backed API
 * expects on write. A no-op if `value` is already a JSON-encoded string. */
export function stringifyJsonObject<T extends Record<string, unknown>>(
  value: T | string,
): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
