import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { callTool, configSchema } from './mcp.js';

const config = configSchema.parse({ baseUrl: 'http://localhost:3000', apiKey: 'k', timeoutMs: 5000, debug: false });
const realFetch = global.fetch;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  global.fetch = realFetch;
});

describe('transcribe_v2 credits', () => {
  test('adds the balance after the request next to credits_used', async () => {
    global.fetch = jest.fn(async (url: unknown) =>
      String(url).includes('/api/v2/credits')
        ? json({ credits: 1918, plan: 'basic' })
        : json({ status: 'completed', credits_used: 1, data: { video_id: 'abc' } })
    ) as unknown as typeof fetch;
    const result = (await callTool('transcribe_v2', { video: 'abc' }, config)) as Record<string, unknown>;
    expect(result.credits_used).toBe(1);
    expect(result.credits_remaining).toBe(1918);
    expect(result.data).toEqual({ video_id: 'abc' });
  });

  test('returns the transcript unchanged if the balance read fails', async () => {
    global.fetch = jest.fn(async (url: unknown) =>
      String(url).includes('/api/v2/credits')
        ? json({ error: 'nope' }, 500)
        : json({ status: 'completed', credits_used: 0, data: { video_id: 'abc' } })
    ) as unknown as typeof fetch;
    const result = (await callTool('transcribe_v2', { video: 'abc' }, config)) as Record<string, unknown>;
    expect(result.credits_used).toBe(0);
    expect(result).not.toHaveProperty('credits_remaining');
  });
});
