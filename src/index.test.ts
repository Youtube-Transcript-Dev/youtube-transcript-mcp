import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import { listTools, callTool, createMcpServer, configSchema } from './mcp.js';

describe('YouTubeTranscript-MiniSaaS MCP', () => {
  const testConfig = configSchema.parse({
    baseUrl: 'http://localhost:3000',
    apiKey: 'test-api-key',
    timeoutMs: 5000,
    debug: false,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listTools returns all tool schemas', () => {
    const tools = listTools();
    expect(tools).toHaveLength(5);
    const names = tools.map((t) => t.name);
    expect(names).toContain('get_stats');
    expect(names).toContain('transcribe_v2');
    expect(names).toContain('list_transcripts');
    expect(names).toContain('get_transcript');
    expect(names).toContain('delete_transcript');
  });

  test('delete_transcript validates arguments', async () => {
    await expect(callTool('delete_transcript', {}, testConfig)).rejects.toThrow(
      'Provide `ids` or `video_id` to delete transcripts.'
    );
  });

  test('callTool throws for unknown tool', async () => {
    await expect(callTool('unknown_tool', {}, testConfig)).rejects.toThrow(
      'Unknown tool: unknown_tool'
    );
  });

  test('createMcpServer returns server with handlers', () => {
    const { server } = createMcpServer(testConfig);
    expect(server).toBeDefined();
    expect(typeof server.setRequestHandler).toBe('function');
  });
});
