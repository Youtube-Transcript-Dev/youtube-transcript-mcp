#!/usr/bin/env node
/** HTTP MCP server. API key from x-api-token, Authorization: Bearer, or ?key= query param. */

import 'dotenv/config';
import { createServer } from 'node:http';
import { createMcpServer, configSchema } from './mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

const port = parseInt(process.env.PORT ?? '8080', 10);
const baseUrl = process.env.YTSM_BASE_URL ?? 'https://youtubetranscript.dev';
const timeoutMs = parseInt(process.env.YTSM_TIMEOUT_MS ?? '30000', 10);

function getApiKeyFromRequest(req: { headers: Record<string, string | string[] | undefined>; url?: string }): string | null {
  const headers = req.headers;
  // 1. Check x-api-token header
  const token = headers['x-api-token'];
  if (token) return Array.isArray(token) ? token[0] : token;
  // 2. Check Authorization: Bearer header
  const auth = headers['authorization'];
  if (auth) {
    const m = (Array.isArray(auth) ? auth[0] : auth).match(/^Bearer\s+(.+)$/i);
    if (m) return m[1];
  }
  // 3. Check ?key= query parameter (for Claude.ai MCP connector)
  try {
    const url = new URL(req.url ?? '', 'http://localhost');
    const key = url.searchParams.get('key');
    if (key) return key;
  } catch {}
  return null;
}

const httpServer = createServer(async (nodeReq, nodeRes) => {
  const apiKey = getApiKeyFromRequest(nodeReq);
  if (!apiKey) {
    nodeRes.writeHead(401, { 'Content-Type': 'application/json' });
    nodeRes.end(JSON.stringify({ error: 'Missing API key. Use x-api-token header, Authorization: Bearer <token>, or ?key=<token>' }));
    return;
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

  const url = `http://${nodeReq.headers.host ?? 'localhost'}${nodeReq.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(nodeReq.headers)) {
    if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }
  let body: ArrayBuffer | undefined;
  if (nodeReq.method !== 'GET' && nodeReq.method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of nodeReq) chunks.push(chunk);
    body = Buffer.concat(chunks).buffer;
  }
  const request = new Request(url, {
    method: nodeReq.method ?? 'GET',
    headers,
    body: body?.byteLength ? body : undefined,
  });

  try {
    const response = await transport.handleRequest(request);
    const res = response ?? new Response('Not Found', { status: 404 });
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      resHeaders[k] = v;
    });
    nodeRes.writeHead(res.status, resHeaders);
    if (res.body) {
      const reader = res.body.getReader();
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        nodeRes.write(chunk.value);
      }
    }
    nodeRes.end();
  } catch (err) {
    console.error('Server error:', err);
    nodeRes.writeHead(500, { 'Content-Type': 'text/plain' });
    nodeRes.end('Internal Server Error');
  } finally {
    await server.close();
  }
});

httpServer.listen(port, () => {
  console.log(`MCP HTTP server on port ${port} (API key from request headers or ?key= param)`);
});
