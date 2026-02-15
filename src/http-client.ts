/** HTTP client for YouTubeTranscript-MiniSaaS API. */

export class HttpError extends Error {
  status: number;
  bodyText: string;

  constructor(message: string, status: number, bodyText: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.bodyText = bodyText;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBodyTextSafe(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

export async function requestJson(params: {
  baseUrl: string;
  path: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs: number;
}): Promise<any> {
  const url = new URL(joinUrl(params.baseUrl, params.path));
  if (params.query) {
    for (const [k, v] of Object.entries(params.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetchWithTimeout(
    url.toString(),
    {
      method: params.method,
      headers: params.headers,
      body:
        params.method === 'POST'
          ? JSON.stringify(params.body ?? {})
          : undefined,
    },
    params.timeoutMs
  );

  if (!res.ok) {
    const text = await readBodyTextSafe(res);
    throw new HttpError(
      `HTTP ${res.status} ${res.statusText}`,
      res.status,
      text
    );
  }

  const text = await readBodyTextSafe(res);
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
