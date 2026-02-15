import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { HttpError, requestJson } from './http-client.js';

export const configSchema = z.object({
  baseUrl: z.string().min(1).default('https://youtubetranscript.dev'),
  apiKey: z.string().min(1),
  timeoutMs: z.coerce.number().int().positive().default(30_000),
  debug: z.boolean().optional().default(false),
});

export type McpConfig = z.infer<typeof configSchema>;

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

async function callYtsmV2(params: {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  path: string;
  method: 'GET' | 'POST';
  args?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | null | undefined>;
}) {
  return requestJson({
    baseUrl: params.baseUrl,
    path: params.path,
    method: params.method,
    headers: authHeaders(params.apiKey),
    body: params.method === 'POST' ? (params.args ?? {}) : undefined,
    query: params.method === 'GET' ? params.query : undefined,
    timeoutMs: params.timeoutMs,
  });
}

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function errText(error: unknown): { message: string; details?: unknown } {
  if (error instanceof HttpError) {
    let details: unknown;
    try {
      details = error.bodyText ? JSON.parse(error.bodyText) : undefined;
    } catch {
      details = error.bodyText;
    }
    return { message: error.message, details };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}

const toolRegistry: Record<
  string,
  {
    schema: { name: string; description: string; inputSchema: object };
    handler: (
      args: Record<string, unknown>,
      config: McpConfig
    ) => Promise<unknown>;
  }
> = {
  transcribe_v2: {
    schema: {
      name: 'transcribe_v2',
      description:
        'POST /api/v2/transcribe. Fast caption-based transcript (no ASR). Use manual or auto captions only.',
      inputSchema: {
        type: 'object',
        properties: {
          video: {
            type: 'string',
            description: 'YouTube video URL or video ID',
          },
          language: {
            type: 'string',
            description: 'Language tag (e.g. en, en-US)',
          },
          source: {
            type: 'string',
            enum: ['auto', 'manual'],
            description: 'Caption source: auto (manual first, fallback to auto) or manual only',
          },
          format: {
            type: 'object',
            properties: {
              timestamp: { type: 'boolean' },
              paragraphs: { type: 'boolean' },
              words: { type: 'boolean' },
            },
            additionalProperties: false,
          },
        },
        required: ['video'],
        additionalProperties: false,
      },
    },
    handler: async (args, config) =>
      callYtsmV2({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs,
        path: '/api/v2/transcribe',
        method: 'POST',
        args,
      }),
  },

  list_transcripts: {
    schema: {
      name: 'list_transcripts',
      description:
        'GET /api/v1/history. List or search user transcripts. Use search to find by video id, title, or transcript content.',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search by video id, video title, or transcript text' },
          limit: { type: 'number', description: 'How many to return (default 10)' },
          page: { type: 'number', description: 'Page number (default 1)' },
          status: {
            type: 'string',
            enum: ['all', 'queued', 'processing', 'succeeded', 'failed'],
          },
          language: { type: 'string', description: "Language filter, e.g. 'en'" },
          include_segments: { type: 'boolean', description: 'Include transcript segments in response' },
        },
        additionalProperties: false,
      },
    },
    handler: async (args, config) =>
      callYtsmV2({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs,
        path: '/api/v1/history',
        method: 'GET',
        query: {
          limit: typeof args.limit === 'number' ? args.limit : 10,
          page: typeof args.page === 'number' ? args.page : 1,
          search: typeof args.search === 'string' ? args.search : undefined,
          status: typeof args.status === 'string' ? args.status : undefined,
          language: typeof args.language === 'string' ? args.language : undefined,
          include_segments:
            args.include_segments === true ? 'true' : undefined,
        },
      }),
  },

  get_transcript: {
    schema: {
      name: 'get_transcript',
      description:
        'GET /api/v1/transcripts/{video_id}. Get full transcript for a video.',
      inputSchema: {
        type: 'object',
        properties: {
          video_id: { type: 'string' },
          id: {
            type: 'string',
            description: 'Optional transcript record id if you want a specific version',
          },
          language: { type: 'string' },
          source: { type: 'string', enum: ['auto', 'manual', 'asr'] },
          include_timestamps: { type: 'boolean' },
        },
        required: ['video_id'],
        additionalProperties: false,
      },
    },
    handler: async (args, config) => {
      const videoId = String(args.video_id ?? '');
      return callYtsmV2({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs,
        path: `/api/v1/transcripts/${encodeURIComponent(videoId)}`,
        method: 'GET',
        query: {
          id: typeof args.id === 'string' ? args.id : undefined,
          language: typeof args.language === 'string' ? args.language : undefined,
          source: typeof args.source === 'string' ? args.source : undefined,
          include_timestamps:
            args.include_timestamps === false ? 'false' : undefined,
        },
      });
    },
  },

  get_stats: {
    schema: {
      name: 'get_stats',
      description:
        'Get stats: credits left, transcripts created, plan, rate limit.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    handler: async (_args, config) => {
      const [creditsRes, historyRes] = await Promise.all([
        callYtsmV2({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          timeoutMs: config.timeoutMs,
          path: '/api/v1/credits',
          method: 'GET',
        }),
        callYtsmV2({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          timeoutMs: config.timeoutMs,
          path: '/api/v1/history',
          method: 'GET',
          query: { limit: 1, page: 1 },
        }),
      ]);

      const credits = creditsRes && typeof creditsRes === 'object' ? (creditsRes as Record<string, unknown>) : {};
      const history = historyRes && typeof historyRes === 'object' ? (historyRes as Record<string, unknown>) : {};
      const pagination = history.pagination as { total?: number } | undefined;

      return {
        credits: credits.credits ?? 0,
        transcripts_total: pagination?.total ?? 0,
        plan: credits.plan ?? 'free',
        rate_limit: credits.rate_limit ?? 100,
      };
    },
  },

  delete_transcript: {
    schema: {
      name: 'delete_transcript',
      description:
        'POST /api/v1/transcripts/bulk-delete. Delete transcripts by ids or by video_id.',
      inputSchema: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Transcript record ids to delete',
          },
          video_id: {
            type: 'string',
            description: 'Convenience delete by video id (resolves id first)',
          },
        },
        additionalProperties: false,
      },
    },
    handler: async (args, config) => {
      let ids: string[] = Array.isArray(args.ids)
        ? args.ids.filter((v): v is string => typeof v === 'string')
        : [];

      const videoId =
        typeof args.video_id === 'string' ? args.video_id.trim() : '';

      if (ids.length === 0 && videoId) {
        const transcript = await callYtsmV2({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          timeoutMs: config.timeoutMs,
          path: `/api/v1/transcripts/${encodeURIComponent(videoId)}`,
          method: 'GET',
        });
        const transcriptId =
          transcript && typeof transcript.id === 'string' ? transcript.id : '';
        if (transcriptId) ids = [transcriptId];
      }

      if (ids.length === 0) {
        throw new Error("Provide `ids` or `video_id` to delete transcripts.");
      }

      return callYtsmV2({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs,
        path: '/api/v1/transcripts/bulk-delete',
        method: 'POST',
        args: { ids },
      });
    },
  },
};

export function listTools() {
  return Object.values(toolRegistry).map((t) => t.schema);
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  config: McpConfig
): Promise<unknown> {
  const tool = toolRegistry[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.handler(args ?? {}, config);
}

export function createMcpServer(config: McpConfig) {
  const server = new Server(
    { name: 'youtube-transcript-minisaas', version: '2.0.0' },
    { capabilities: { tools: {} } }
  );

  if (config.debug) {
    console.error('[MCP] Config:', {
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs,
      apiKeyLength: config.apiKey.length,
    });
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listTools(),
  }));

  server.setRequestHandler(
    CallToolRequestSchema,
    async (req: {
      params: { name: string; arguments?: Record<string, unknown> };
    }) => {
      try {
        const result = await callTool(
          req.params.name,
          req.params.arguments ?? {},
          config
        );
        const text = typeof result === 'string' ? result : jsonText(result);
        return { content: [{ type: 'text', text }] };
      } catch (error) {
        if (config.debug) console.error('[MCP] Tool error:', error);
        const e = errText(error);
        return {
          content: [
            {
              type: 'text',
              text: jsonText({ error: e.message, details: e.details }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return { server };
}
