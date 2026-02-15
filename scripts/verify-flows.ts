#!/usr/bin/env node
/** Usage: YTSM_API_KEY=your_key npx tsx scripts/verify-flows.ts */

import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const apiKey = process.env.YTSM_API_KEY;
const baseUrl = process.env.YTSM_BASE_URL ?? 'https://youtubetranscript.dev';
const video = process.argv[2] ?? 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

if (!apiKey) {
  console.error('Usage: YTSM_API_KEY=your_key npx tsx scripts/verify-flows.ts [videoUrl]');
  process.exit(1);
}

let passed = 0;
let failed = 0;

function ok(msg: string) {
  console.log('  ✓', msg);
  passed++;
}
function fail(msg: string) {
  console.error('  ✗', msg);
  failed++;
}

async function run() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: { YTSM_BASE_URL: baseUrl, YTSM_API_KEY: apiKey },
  });

  const client = new Client(
    { name: 'verify-flows', version: '1.0.0' },
    { capabilities: {} }
  );

  console.log('Connecting to MCP server...\n');
  await client.connect(transport);

  console.log('=== 1. get_stats ===');
  const statsResult = await client.callTool({ name: 'get_stats', arguments: {} });
  const statsText = (statsResult.content[0] as { text: string })?.text ?? '';

  if (statsResult.isError) {
    fail('get_stats failed');
  } else {
    try {
      const p = JSON.parse(statsText);
      if (typeof p.credits === 'number') ok('credits present');
      else fail('credits missing');
      if (p.plan) ok('plan present');
      else fail('plan missing');
      if (typeof p.transcripts_total === 'number') ok('transcripts_total present');
      else ok('transcripts_total optional');
      if (typeof p.rate_limit === 'number') ok('rate_limit present');
      else ok('rate_limit optional');
    } catch (e) {
      fail('Invalid JSON: ' + String(e));
    }
  }

  console.log('\n=== 2. transcribe_v2 (caption-based) ===');
  const transResult = await client.callTool({
    name: 'transcribe_v2',
    arguments: {
      video,
      source: 'auto',
      format: { timestamp: true, paragraphs: true },
    },
  });
  const transText = (transResult.content[0] as { text: string })?.text ?? '';

  if (transResult.isError) {
    fail('transcribe_v2 failed');
  } else {
    try {
      const p = JSON.parse(transText);
      if (p.status === 'completed') {
        ok('transcribe completed');
        if (p.data?.transcript?.text) ok('transcript text present');
        if (p.data?.transcript?.segments?.length) ok('segments present');
      } else {
        fail('Unexpected status: ' + p.status);
      }
    } catch (e) {
      fail('Invalid transcribe response: ' + String(e));
    }
  }

  console.log('\n=== 3. list_transcripts + search + get_transcript ===');
  const listResult = await client.callTool({
    name: 'list_transcripts',
    arguments: { limit: 5, page: 1 },
  });
  const listText = (listResult.content[0] as { text: string })?.text ?? '';
  let firstVideoId: string | null = null;
  if (listText) {
    try {
      const parsed = JSON.parse(listText);
      const first = parsed?.history?.[0];
      if (first?.video_id) firstVideoId = first.video_id;
      if (Array.isArray(parsed?.history)) ok('list_transcripts returns history');
      else fail('list_transcripts missing history');
    } catch (e) {
      fail('Invalid list_transcripts response: ' + String(e));
    }
  } else {
    fail('list_transcripts failed');
  }

  if (firstVideoId) {
    const searchResult = await client.callTool({
      name: 'list_transcripts',
      arguments: { search: firstVideoId.slice(0, 8), limit: 5 },
    });
    const searchText = (searchResult.content[0] as { text: string })?.text ?? '';
    if (searchResult.isError) fail('list_transcripts search failed');
    else {
      try {
        const parsed = JSON.parse(searchText);
        if (Array.isArray(parsed?.history)) ok('list_transcripts search works');
        else fail('list_transcripts search returned no history');
      } catch {
        fail('Invalid search response');
      }
    }
  }

  if (firstVideoId) {
    const getResult = await client.callTool({
      name: 'get_transcript',
      arguments: { video_id: firstVideoId },
    });
    const getText = (getResult.content[0] as { text: string })?.text ?? '';
    if (getResult.isError) fail('get_transcript failed');
    else {
      try {
        const p = JSON.parse(getText);
        if (p?.text !== undefined || p?.segments) ok('get_transcript returns transcript');
        else fail('get_transcript missing transcript data');
      } catch {
        fail('Invalid get_transcript response');
      }
    }
  }

  await client.close();

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
