#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer, configSchema } from './mcp.js';

dotenv.config();

async function main() {
  const config = configSchema.parse({
    baseUrl: process.env.YTSM_BASE_URL,
    apiKey: process.env.YTSM_API_KEY,
    timeoutMs: process.env.YTSM_TIMEOUT_MS,
    debug: process.env.DEBUG === 'true',
  });

  const { server } = createMcpServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (process.env.RUN_STDIO || isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export function createSandboxServer() {
  return createMcpServer(
    configSchema.parse({
      baseUrl: process.env.YTSM_BASE_URL ?? 'https://youtubetranscript.dev',
      apiKey: process.env.YTSM_API_KEY ?? 'sandbox-only',
      timeoutMs: process.env.YTSM_TIMEOUT_MS ?? 30_000,
      debug: false,
    })
  ).server;
}

export default function () {
  return createSandboxServer();
}
