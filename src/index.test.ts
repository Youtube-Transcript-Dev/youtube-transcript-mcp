import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import { listTools, callTool, createMcpServer, configSchema } from './mcp.js';
import {
  authorizationServerMetadata,
  isPublicMcpPath,
  mcpPublicOrigin,
  protectedResourceMetadata,
  wwwAuthenticateHeader,
} from './oauth-metadata.js';

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

  test('OAuth discovery paths are public', () => {
    expect(isPublicMcpPath('/.well-known/oauth-protected-resource')).toBe(true);
    expect(isPublicMcpPath('/.well-known/oauth-authorization-server')).toBe(true);
    expect(isPublicMcpPath('/')).toBe(false);
  });

  test('protected resource metadata points at the website issuer', () => {
    const meta = protectedResourceMetadata('https://mcp.youtubetranscript.dev');
    expect(meta.authorization_servers).toEqual([
      'https://www.youtubetranscript.dev',
    ]);
    expect(
      authorizationServerMetadata().authorization_endpoint
    ).toBe('https://www.youtubetranscript.dev/api/mcp/oauth/authorize');
    expect(authorizationServerMetadata().client_id_metadata_document_supported).toBe(true);
    expect(wwwAuthenticateHeader('https://mcp.youtubetranscript.dev')).toContain(
      'resource_metadata='
    );
    expect(wwwAuthenticateHeader('https://mcp.youtubetranscript.dev')).toContain(
      'scope="mcp"'
    );
    expect(mcpPublicOrigin()).toBe('https://mcp.youtubetranscript.dev');
  });
});
