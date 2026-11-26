/**
 * Where the HTTP server finds a caller's API key, in order:
 *   1. Authorization: Bearer <token> (OAuth or API key)
 *   2. x-api-token header
 *   3. ?key=<API key> on the URL — for clients such as ChatGPT ("Add custom
 *      MCP server") and Claude.ai ("Add custom connector") that only accept a
 *      URL. Never log the returned value.
 */
export interface KeyedRequest {
  headers: Record<string, string | string[] | undefined>;
  url?: string;
}

export function getApiKeyFromRequest(req: KeyedRequest): string | null {
  const headers = req.headers;
  const auth = headers['authorization'];
  if (auth) {
    const m = (Array.isArray(auth) ? auth[0] : auth).match(/^Bearer\s+(.+)$/i);
    if (m && m[1].trim()) return m[1].trim();
  }
  const token = headers['x-api-token'];
  if (token) {
    const t = (Array.isArray(token) ? token[0] : token).trim();
    if (t) return t;
  }
  try {
    const key = new URL(req.url ?? '/', 'http://localhost').searchParams.get('key')?.trim();
    if (key) return key;
  } catch {
    // Malformed URL: treat as no key.
  }
  return null;
}

/** Removes ?key= so the API key never reaches the MCP transport (or its logs). */
export function stripKeyFromUrl(originalUrl: string): string {
  try {
    const url = new URL(originalUrl, 'http://localhost');
    url.searchParams.delete('key');
    const qs = url.searchParams.toString();
    return url.pathname + (qs ? '?' + qs : '');
  } catch {
    return originalUrl;
  }
}
