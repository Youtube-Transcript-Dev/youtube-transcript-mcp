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
