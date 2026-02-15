#!/usr/bin/env node
/** Usage: npm run build && npx tsx scripts/test-docker.ts */

import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const apiKey = process.env.YTSM_API_KEY;
  if (!apiKey) {
    console.error('Set YTSM_API_KEY environment variable');
    process.exit(1);
  }
  const baseUrl =
    process.env.YTSM_BASE_URL ?? 'https://youtubetranscript.dev';
  const transport = new StdioClientTransport({
    command: 'docker',
    args: [
      'run',
      '-i',
      '--rm',
      '-e',
      `YTSM_API_KEY=${apiKey}`,
      '-e',
      `YTSM_BASE_URL=${baseUrl}`,
      'youtube-transcript-mcp:latest',
    ],
    env: {},
  });

  const client = new Client(
    { name: 'mcp-docker-test', version: '1.0.0' },
    { capabilities: {} }
  );

  console.log('Connecting to Docker MCP...');
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('✓ listTools:', tools.tools.length, 'tools');

  const listResult = await client.callTool({
    name: 'list_transcripts',
    arguments: { limit: 5, page: 1 },
  });
  console.log(
    '✓ list_transcripts:',
    listResult.content[0].type === 'text' ? 'OK' : 'FAIL'
  );

  await client.close();
  console.log('Docker MCP test passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
