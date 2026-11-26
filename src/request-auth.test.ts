import { describe, expect, test } from '@jest/globals';
import { getApiKeyFromRequest, stripKeyFromUrl } from './request-auth.js';

describe('getApiKeyFromRequest', () => {
  test('reads ?key= from the URL', () => {
    expect(getApiKeyFromRequest({ headers: {}, url: '/?key=abc123' })).toBe('abc123');
    expect(getApiKeyFromRequest({ headers: {}, url: '/mcp?foo=1&key=%20abc123%20' })).toBe('abc123');
  });

  test('Authorization header wins over ?key=', () => {
    expect(
      getApiKeyFromRequest({ headers: { authorization: 'Bearer header-key' }, url: '/?key=url-key' })
    ).toBe('header-key');
  });

  test('x-api-token wins over ?key=', () => {
    expect(getApiKeyFromRequest({ headers: { 'x-api-token': 'tok' }, url: '/?key=url-key' })).toBe('tok');
  });

  test('no key anywhere → null (server answers 401)', () => {
    expect(getApiKeyFromRequest({ headers: {}, url: '/' })).toBeNull();
    expect(getApiKeyFromRequest({ headers: {}, url: '/?key=' })).toBeNull();
    expect(getApiKeyFromRequest({ headers: {}, url: '/?key=%20%20' })).toBeNull();
    expect(getApiKeyFromRequest({ headers: {} })).toBeNull();
  });
});

describe('stripKeyFromUrl', () => {
  test('removes key but keeps path and other params', () => {
    expect(stripKeyFromUrl('/?key=secret')).toBe('/');
    expect(stripKeyFromUrl('/mcp?key=secret&foo=1')).toBe('/mcp?foo=1');
  });
});

import { listTools } from './mcp.js';

describe('tool annotations (required by ChatGPT and Claude app directories)', () => {
  const byName = Object.fromEntries(listTools().map((t) => [t.name, t]));

  test('every tool has a title and the full set of hints', () => {
    for (const t of listTools()) {
      expect(t.title).toBeTruthy();
      expect(t.annotations).toMatchObject({
        title: expect.any(String),
        readOnlyHint: expect.any(Boolean),
        destructiveHint: expect.any(Boolean),
        idempotentHint: expect.any(Boolean),
        openWorldHint: expect.any(Boolean),
      });
    }
  });

  test('only delete_transcript is destructive; readers are read-only', () => {
    for (const n of ['get_transcript', 'list_transcripts', 'get_stats']) {
      expect(byName[n].annotations?.readOnlyHint).toBe(true);
    }
    for (const t of listTools()) {
      expect(t.annotations?.destructiveHint).toBe(t.name === 'delete_transcript');
    }
    expect(byName['transcribe_v2'].annotations?.openWorldHint).toBe(true);
  });
});
