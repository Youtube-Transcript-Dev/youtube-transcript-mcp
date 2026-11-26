import { afterEach, describe, expect, test } from '@jest/globals';
import { mcpPublicOrigin } from './oauth-metadata.js';

describe('mcpPublicOrigin', () => {
  const saved = process.env.MCP_PUBLIC_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.MCP_PUBLIC_URL;
    else process.env.MCP_PUBLIC_URL = saved;
  });

  test('defaults to the custom domain', () => {
    delete process.env.MCP_PUBLIC_URL;
    expect(mcpPublicOrigin()).toBe('https://mcp.youtubetranscript.dev');
  });

  test('ignores a Render hosting address', () => {
    process.env.MCP_PUBLIC_URL = 'https://youtube-transcript-mcp-727q.onrender.com';
    expect(mcpPublicOrigin()).toBe('https://mcp.youtubetranscript.dev');
  });

  test('keeps another configured address', () => {
    process.env.MCP_PUBLIC_URL = 'https://mcp.example.com/';
    expect(mcpPublicOrigin()).toBe('https://mcp.example.com');
  });
});
