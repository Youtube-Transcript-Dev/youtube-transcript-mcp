#!/usr/bin/env node
/** HTTP MCP server. Auth via OAuth Bearer, then x-api-token. */

import 'dotenv/config';
import { createServer } from 'node:http';
import { createMcpServer, configSchema } from './mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  corsHeaders,
  isPublicMcpPath,
  mcpPublicOrigin,
  protectedResourceMetadata,
  wwwAuthenticateHeader,
} from './oauth-metadata.js';

const port = parseInt(process.env.PORT ?? '8080', 10);
const baseUrl = process.env.YTSM_BASE_URL ?? 'https://www.youtubetranscript.dev';
const timeoutMs = parseInt(process.env.YTSM_TIMEOUT_MS ?? '30000', 10);

function getApiKeyFromRequest(req: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const headers = req.headers;
  const auth = headers['authorization'];
  if (auth) {
    const m = (Array.isArray(auth) ? auth[0] : auth).match(/^Bearer\s+(.+)$/i);
    if (m) return m[1];
  }
  const token = headers['x-api-token'];
  if (token) return Array.isArray(token) ? token[0] : token;
  return null;
}

function stripKeyFromUrl(originalUrl: string): string {
  try {
    const url = new URL(originalUrl, 'http://localhost');
    url.searchParams.delete('key');
    return url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '');
  } catch {
    return originalUrl;
  }
}

function json(res: import('node:http').ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...corsHeaders(),
    ...extra,
  });
  res.end(JSON.stringify(body));
}

// Big enough for any MCP JSON-RPC message; anything larger is refused rather
// than buffered in memory.
const MAX_BODY_BYTES = 1024 * 1024;
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'DELETE']);

class BodyTooLargeError extends Error {}

async function readBody(nodeReq: import('node:http').IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of nodeReq) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new BodyTooLargeError();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Every request goes through here. The handler is async, and a rejection that
// escaped it (a client hanging up mid-body, an odd method) would be unhandled
// and stop the whole process for every user.
const httpServer = createServer((nodeReq, nodeRes) => {
  handleRequest(nodeReq, nodeRes).catch((err) => {
    console.error('Request failed:', err);
    if (!nodeRes.headersSent) {
      nodeRes.writeHead(500, { 'Content-Type': 'text/plain', ...corsHeaders() });
      nodeRes.end('Internal Server Error');
    } else {
      nodeRes.destroy();
    }
  });
});

async function handleRequest(
  nodeReq: import('node:http').IncomingMessage,
  nodeRes: import('node:http').ServerResponse
): Promise<void> {
  const origin = mcpPublicOrigin();
  const reqUrl = nodeReq.url ?? '/';

  if (nodeReq.method === 'OPTIONS') {
    nodeRes.writeHead(204, corsHeaders());
    nodeRes.end();
    return;
  }

  if (isPublicMcpPath(reqUrl)) {
    const pathname = new URL(reqUrl, 'http://localhost').pathname;
    if (pathname === '/.well-known/oauth-protected-resource') {
      json(nodeRes, 200, protectedResourceMetadata(origin));
      return;
    }
    if (pathname === '/.well-known/oauth-authorization-server') {
      nodeRes.writeHead(302, {
        Location: 'https://www.youtubetranscript.dev/.well-known/oauth-authorization-server',
        ...corsHeaders(),
      });
      nodeRes.end();
      return;
    }
    json(nodeRes, 404, { error: 'Not found' });
    return;
  }

  const apiKey = getApiKeyFromRequest(nodeReq);
  if (!apiKey) {
    json(
      nodeRes,
      401,
      {
        error:
          'Authorization required. Use OAuth or Authorization: Bearer <token>.',
      },
      {
        'WWW-Authenticate': wwwAuthenticateHeader(origin),
        'Access-Control-Expose-Headers': 'WWW-Authenticate',
      }
    );
    return;
  }

  const method = nodeReq.method ?? 'GET';
  if (!ALLOWED_METHODS.has(method)) {
    json(nodeRes, 405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD, POST, DELETE, OPTIONS' });
    return;
  }

  let body: Buffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await readBody(nodeReq);
    } catch (err) {
      if (err instanceof BodyTooLargeError) {
        json(nodeRes, 413, { error: 'Request body too large' });
        nodeReq.resume();
        return;
      }
      throw err;
    }
  }

  const config = configSchema.parse({
    baseUrl,
    apiKey,
    timeoutMs,
    debug: process.env.DEBUG === 'true',
  });

  const { server } = createMcpServer(config);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  const cleanPath = stripKeyFromUrl(nodeReq.url ?? '/');
  const url = `http://${nodeReq.headers.host ?? 'localhost'}${cleanPath}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(nodeReq.headers)) {
    if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }
  const request = new Request(url, {
    method,
    headers,
    body: body?.byteLength ? body : undefined,
  } as RequestInit);

  try {
    const response = await transport.handleRequest(request);
    const res = response ?? new Response('Not Found', { status: 404 });
    const resHeaders: Record<string, string> = { ...corsHeaders() };
    res.headers.forEach((v, k) => {
      resHeaders[k] = v;
    });
    nodeRes.writeHead(res.status, resHeaders);
    if (res.body) {
      const reader = res.body.getReader();
      // A client that hangs up must not leave the stream, and this request's
      // MCP server, open forever.
      nodeRes.on('close', () => {
        reader.cancel().catch(() => {});
      });
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        if (nodeRes.destroyed) break;
        nodeRes.write(chunk.value);
      }
    }
    nodeRes.end();
  } catch (err) {
    console.error('Server error:', err);
    nodeRes.writeHead(500, { 'Content-Type': 'text/plain', ...corsHeaders() });
    nodeRes.end('Internal Server Error');
  } finally {
    await server.close();
  }
}

httpServer.listen(port, () => {
  console.log(`MCP HTTP server on port ${port}`);
});
