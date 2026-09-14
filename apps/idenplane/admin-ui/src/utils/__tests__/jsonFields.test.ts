import { describe, it, expect } from 'vitest';
import {
  parseJsonArray,
  parseJsonObject,
  stringifyJsonArray,
  stringifyJsonObject,
} from '../jsonFields';

describe('parseJsonArray', () => {
  it('passes a real array through unchanged', () => {
    expect(parseJsonArray(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('parses a JSON-array string', () => {
    expect(parseJsonArray('["a","b"]')).toEqual(['a', 'b']);
  });

  it('parses an empty JSON-array string', () => {
    expect(parseJsonArray('[]')).toEqual([]);
  });

  it('falls back on null/undefined', () => {
    expect(parseJsonArray(null)).toEqual([]);
    expect(parseJsonArray(undefined)).toEqual([]);
  });

  it('falls back on an empty string', () => {
    expect(parseJsonArray('')).toEqual([]);
  });

  it('falls back on invalid JSON', () => {
    expect(parseJsonArray('not json')).toEqual([]);
  });

  it('falls back when the parsed JSON is not an array', () => {
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });

  it('uses a custom fallback', () => {
    expect(parseJsonArray(undefined, ['default'])).toEqual(['default']);
  });
});

describe('parseJsonObject', () => {
  it('passes a real object through unchanged', () => {
    expect(parseJsonObject({ a: 1 }, {})).toEqual({ a: 1 });
  });

  it('parses a JSON-object string', () => {
    expect(parseJsonObject('{"a":1}', {})).toEqual({ a: 1 });
  });

  it('falls back on null/undefined', () => {
    expect(parseJsonObject(null, { a: 1 })).toEqual({ a: 1 });
    expect(parseJsonObject(undefined, { a: 1 })).toEqual({ a: 1 });
  });

  it('falls back on invalid JSON', () => {
    expect(parseJsonObject('not json', { a: 1 })).toEqual({ a: 1 });
  });

  it('falls back when the parsed JSON is an array, not an object', () => {
    expect(parseJsonObject('[1,2]', { a: 1 })).toEqual({ a: 1 });
  });
});

describe('stringifyJsonArray', () => {
  it('serialises a real array', () => {
    expect(stringifyJsonArray(['a', 'b'])).toBe('["a","b"]');
  });

  it('passes an already-serialised string through unchanged', () => {
    expect(stringifyJsonArray('["a","b"]')).toBe('["a","b"]');
  });
});

describe('stringifyJsonObject', () => {
  it('serialises a real object', () => {
    expect(stringifyJsonObject({ a: 1 })).toBe('{"a":1}');
  });

  it('passes an already-serialised string through unchanged', () => {
    expect(stringifyJsonObject('{"a":1}')).toBe('{"a":1}');
  });
});
