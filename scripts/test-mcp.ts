#!/usr/bin/env node
/** Usage: YTSM_API_KEY=xxx npx tsx scripts/test-mcp.ts [videoUrl] */

import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const apiKey = process.argv[2] ?? process.env.YTSM_API_KEY;
  if (!apiKey) {
    console.error('Usage: YTSM_API_KEY=xxx tsx scripts/test-mcp.ts [videoUrl]');
    process.exit(1);
  }
  const baseUrl = process.env.YTSM_BASE_URL ?? 'https://youtubetranscript.dev';
  const video =
    process.argv[3] ?? 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: {
      YTSM_BASE_URL: baseUrl,
      YTSM_API_KEY: apiKey,
    },
  });

  const client = new Client(
    { name: 'mcp-test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  console.log('Connecting (stdio)...');
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('\n✓ listTools:', tools.tools.length, 'tools');
  tools.tools.forEach((t) => console.log('  -', t.name));

  const listResult = await client.callTool({
    name: 'list_transcripts',
    arguments: { limit: 10, page: 1 },
  });
  console.log('\n✓ list_transcripts:', listResult.isError ? 'ERROR' : 'OK');

  try {
    const transResult = await client.callTool({
      name: 'transcribe_v2',
      arguments: { video, format: { timestamp: true } },
    });
    const hasError = transResult.isError ?? false;
    console.log(
      '\n✓ transcribe_v2:',
      hasError ? 'API error (check base URL)' : 'OK'
    );
    if (transResult.content[0]?.type === 'text') {
      const text = (transResult.content[0] as { text: string }).text;
      console.log('  Response length:', text.length, 'chars');
    }
  } catch (e) {
    console.log('\n✗ transcribe_v2 failed:', (e as Error).message);
  }

  await client.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
