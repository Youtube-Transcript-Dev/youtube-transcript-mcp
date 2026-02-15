#!/usr/bin/env node
/** Usage: YTSM_API_KEY=your_key npx tsx scripts/test-all-tools.ts [videoUrl] */

import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const apiKey = process.env.YTSM_API_KEY;
const baseUrl = process.env.YTSM_BASE_URL ?? 'https://youtubetranscript.dev';
const video =
  process.argv[2] ?? 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

if (!apiKey) {
  console.error(`
Usage:
  YTSM_API_KEY=your_key npx tsx scripts/test-all-tools.ts [videoUrl]

Get your API key from: https://youtubetranscript.dev/dashboard/account
`);
  process.exit(1);
}

async function run() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: { YTSM_BASE_URL: baseUrl, YTSM_API_KEY: apiKey },
  });

  const client = new Client(
    { name: 'test-all-tools', version: '1.0.0' },
    { capabilities: {} }
  );

  console.log('Connecting to MCP server (stdio)...\n');
  await client.connect(transport);

  console.log('=== 1. listTools ===');
  const tools = await client.listTools();
  console.log(`OK - ${tools.tools.length} tools:`, tools.tools.map((t) => t.name).join(', '));

  console.log('\n=== 2. get_stats ===');
  const statsResult = await client.callTool({
    name: 'get_stats',
    arguments: {},
  });
  const statsText = (statsResult.content[0] as { text: string })?.text ?? '';
  console.log(!statsResult.isError ? 'OK' : 'Error');
  if (statsText) {
    try {
      const p = JSON.parse(statsText);
      console.log('  credits:', p?.credits ?? '?', '| plan:', p?.plan ?? '?', '| transcripts:', p?.transcripts_total ?? '?');
    } catch {
      /* ignore */
    }
  }

  console.log('\n=== 3. transcribe_v2 ===');
  const transResult = await client.callTool({
    name: 'transcribe_v2',
    arguments: { video, format: { timestamp: true } },
  });
  const transText = (transResult.content[0] as { text: string })?.text ?? '';
  const transOk = !transResult.isError;
  console.log(transOk ? 'OK' : 'API error');
  if (transText) {
    try {
      const parsed = JSON.parse(transText);
      if (parsed?.data?.transcript?.segments) console.log('  segments:', parsed.data.transcript.segments.length);
    } catch {
      /* ignore */
    }
  }

  console.log('\n=== 4. list_transcripts ===');
  const listResult = await client.callTool({
    name: 'list_transcripts',
    arguments: { limit: 10, page: 1 },
  });
  const listText = (listResult.content[0] as { text: string })?.text ?? '';
  console.log(!listResult.isError ? 'OK' : 'Error');

  let firstVideoId: string | null = null;
  let firstTranscriptId: string | null = null;
  if (listText) {
    try {
      const parsed = JSON.parse(listText);
      const first = parsed?.history?.[0];
      if (first?.video_id) firstVideoId = first.video_id;
      if (first?.id) firstTranscriptId = first.id;
      console.log(
        '  history_count:',
        Array.isArray(parsed?.history) ? parsed.history.length : 0
      );
    } catch {
      /* ignore */
    }
  }

  if (firstVideoId) {
    console.log('\n=== 5. get_transcript ===');
    const getTranscriptResult = await client.callTool({
      name: 'get_transcript',
      arguments: { video_id: firstVideoId },
    });
    console.log(!getTranscriptResult.isError ? 'OK' : 'Error');
  } else {
    console.log('\n=== 5. get_transcript === (skipped - no transcript in history)');
  }

  if (process.env.ALLOW_DELETE === 'true' && firstTranscriptId) {
    console.log('\n=== 6. delete_transcript ===');
    const deleteResult = await client.callTool({
      name: 'delete_transcript',
      arguments: { ids: [firstTranscriptId] },
    });
    console.log(!deleteResult.isError ? 'OK' : 'Error');
  } else {
    console.log(
      '\n=== 6. delete_transcript === (skipped - set ALLOW_DELETE=true to enable)'
    );
  }

  await client.close();
  console.log('\n=== All tools tested ===');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
