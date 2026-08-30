<p align="center">
  <img src="https://www.youtubetranscript.dev/logo.svg" alt="YouTubeTranscript.dev" width="80" />
</p>

<h1 align="center">YouTube Transcript MCP Server</h1>

<p align="center">
  <strong>MCP server for YouTubeTranscript.dev — extract transcripts, manage history, and power AI assistants with YouTube content.</strong>
</p>

<p align="center">
  <a href="https://www.youtubetranscript.dev">Website</a> •
  <a href="https://mcp.youtubetranscript.dev">Hosted MCP</a> •
  <a href="https://www.youtubetranscript.dev/api-docs">API Docs</a> •
  <a href="https://www.youtubetranscript.dev/pricing">Pricing</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#tools-reference">Tools</a>
</p>

<p align="center">
  <a href="https://www.youtubetranscript.dev"><img src="https://img.shields.io/badge/API-v2-brightgreen" alt="API Version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
</p>

<p align="center">
  <a href="https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=YouTube%20Transcript&connectorUrl=https%3A%2F%2Fmcp.youtubetranscript.dev"><img src="https://img.shields.io/badge/Add_to-Claude-d97706" alt="Add to Claude" /></a>
  <a href="https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt"><img src="https://img.shields.io/badge/ChatGPT_setup-10a37f" alt="ChatGPT MCP setup" /></a>
  <a href="https://cursor.com/install-mcp?name=youtubetranscript&config=eyJ1cmwiOiJodHRwczovL21jcC55b3V0dWJldHJhbnNjcmlwdC5kZXYifQ=="><img src="https://img.shields.io/badge/Add_to-Cursor-000000" alt="Add to Cursor" /></a>
</p>

---

## Why This MCP Server?

Connect Claude, Cursor, Windsurf, or any MCP client to [YouTubeTranscript.dev](https://www.youtubetranscript.dev) — no custom code. Your AI assistant gets tools to extract transcripts, list history, and manage content at scale.

- ⚡ **Fast caption extraction** — Manual or auto captions, returns in seconds
- 📚 **Transcript history** — List, search, and paginate your transcripts
- 🎯 **Full control** — Get stats, delete transcripts, fetch by video ID
- 🔌 **One config** — Works with Claude, Cursor, Windsurf, VS Code, Cline
- 🔒 **User-owned keys** — API key per connection, no server-side secrets

**→ [Get your free API key](https://www.youtubetranscript.dev)**

---

## Quick Start

Remote MCP URL: **https://mcp.youtubetranscript.dev**

Claude, Cursor, and VS Code can add this as a remote MCP connector. ChatGPT users must enable Developer mode and create a custom app with this URL; availability depends on the workspace plan. OAuth-capable clients sign in once, so no API key is needed in the chat.

| Client | One-click |
| --- | --- |
| Claude | [Add custom connector](https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=YouTube%20Transcript&connectorUrl=https%3A%2F%2Fmcp.youtubetranscript.dev) |
| ChatGPT | [Developer mode / custom MCP app setup](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt) or [Custom GPT](https://chatgpt.com/g/g-6a039b00ddf881918f2590c6312d2c15-video-transcript-extractor) |
| Cursor | [Install](cursor://anysphere.cursor-deeplink/mcp/install?name=youtubetranscript&config=eyJ1cmwiOiJodHRwczovL21jcC55b3V0dWJldHJhbnNjcmlwdC5kZXYifQ==) |
| VS Code | [Install](vscode:mcp/install?%7B%22name%22%3A%22youtubetranscript%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.youtubetranscript.dev%22%7D) |
| Claude Code | `claude mcp add --transport http youtubetranscript https://mcp.youtubetranscript.dev` |
| Grok | `grok mcp add --transport http youtubetranscript https://mcp.youtubetranscript.dev` |

Full walkthrough: [youtubetranscript.dev/resources/mcp-server](https://www.youtubetranscript.dev/resources/mcp-server)

**API key clients** (if the tool has no OAuth): send `Authorization: Bearer YOUR_API_KEY`. `x-api-token` still works. Get a key from the [account page](https://www.youtubetranscript.dev/dashboard/account).

**Run locally (optional):** `npm install && npm run build && npm run start:http` — then connect to `http://localhost:8080`.

---

## MCP Connection Settings

### Claude Code

```bash
claude mcp add --transport http youtubetranscript https://mcp.youtubetranscript.dev
```

### Claude Desktop

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "youtubetranscript": {
      "url": "https://mcp.youtubetranscript.dev",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "youtubetranscript": {
      "url": "https://mcp.youtubetranscript.dev",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "youtubetranscript": {
      "serverUrl": "https://mcp.youtubetranscript.dev",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

### VS Code + Copilot

`settings.json`:

```json
{
  "mcp": {
    "servers": {
      "youtubetranscript": {
        "url": "https://mcp.youtubetranscript.dev",
        "headers": { "Authorization": "Bearer YOUR_API_KEY" }
      }
    }
  }
}
```

### Cline

Add to your Cline MCP config (format may vary by Cline version):

```json
{
  "youtubetranscript": {
    "url": "https://mcp.youtubetranscript.dev",
    "headers": { "Authorization": "Bearer YOUR_API_KEY" }
  }
}
```

---

Replace `YOUR_API_KEY` with your API key from [youtubetranscript.dev/dashboard/account](https://www.youtubetranscript.dev/dashboard/account).

---

## Configuration

### Server Environment (for deployment)

| Variable          | Description           | Default                         |
| ----------------- | --------------------- | ------------------------------- |
| `YTSM_BASE_URL`   | Base URL of the API   | `https://www.youtubetranscript.dev` |
| `MCP_PUBLIC_URL`  | Public MCP origin     | `https://mcp.youtubetranscript.dev` |
| `YTSM_TIMEOUT_MS` | Request timeout in ms | `30000`                         |
| `PORT`            | HTTP server port      | `8080`                          |
| `DEBUG`           | Enable debug logging  | `false` (set `true` to enable)  |

**Note:** HTTP mode uses OAuth where the client supports it, including compatible Claude, Cursor, VS Code, and Grok clients. ChatGPT requires Developer mode and a custom MCP app. API-key clients can send `Authorization: Bearer` / `x-api-token` from the client. Do not put user keys in server env. For stdio mode, set `YTSM_API_KEY`. Always set `YTSM_BASE_URL` to `https://www.youtubetranscript.dev` — the apex host 301s and breaks POST/auth.

---

## Tools Reference

| Tool                | Best for                         | Returns                                      |
| ------------------- | -------------------------------- | -------------------------------------------- |
| `get_stats`         | Credits, transcripts count, plan | credits, transcripts_total, plan, rate_limit |
| `transcribe_v2`     | Create/fetch transcript (fast)   | Transcript JSON                              |
| `list_transcripts`  | List user transcripts            | History list with pagination                 |
| `get_transcript`    | Get full transcript by video_id  | Transcript detail                            |
| `delete_transcript` | Delete transcript(s)             | Delete result                                |

### get_stats

Credits left, transcripts created, plan, rate limit. No parameters.

### transcribe_v2

Fast caption-based transcript (no ASR). Uses manual or auto captions only.

| Parameter  | Required | Description                                 |
| ---------- | -------- | ------------------------------------------- |
| `video`    | Yes      | YouTube URL or 11-character video ID        |
| `language` | No       | Language tag (e.g. `en`, `en-US`)           |
| `source`   | No       | `auto` (default) or `manual`                |
| `format`   | No       | `{ timestamp, paragraphs, words }` booleans |

### list_transcripts

List transcript history for the authenticated user.

| Parameter          | Required | Description                                          |
| ------------------ | -------- | ---------------------------------------------------- |
| `search`           | No       | Search by video id, title, or transcript text        |
| `limit`            | No       | How many to return (default 10)                      |
| `page`             | No       | Page number (default 1)                              |
| `status`           | No       | `all`, `queued`, `processing`, `succeeded`, `failed` |
| `language`         | No       | Language filter (e.g. `en`)                          |
| `include_segments` | No       | Include transcript segments in response              |

### get_transcript

Get full transcript by `video_id`.

| Parameter            | Required | Description                               |
| -------------------- | -------- | ----------------------------------------- |
| `video_id`           | Yes      | YouTube video ID                          |
| `id`                 | No       | Transcript record id for specific version |
| `language`           | No       | Language filter                           |
| `source`             | No       | `auto`, `manual`, or `asr`                |
| `include_timestamps` | No       | Include timestamps in response            |

### delete_transcript

Delete transcript records.

| Parameter  | Required | Description                                   |
| ---------- | -------- | --------------------------------------------- |
| `ids`      | No\*     | Array of transcript record ids to delete      |
| `video_id` | No\*     | Convenience: delete by video id (resolves id) |

\*Provide at least one of `ids` or `video_id`.

---

## Deployment (Optional)

For production, deploy to a service that supports long-lived connections (e.g. Cloud Run, Railway, Fly.io). Avoid serverless (Vercel, Lambda) for MCP — timeouts and concurrency limits cause issues.

```bash
docker build -f Dockerfile.cloudrun -t gcr.io/YOUR_PROJECT/youtube-transcript-mcp .
docker push gcr.io/YOUR_PROJECT/youtube-transcript-mcp
gcloud run deploy youtube-transcript-mcp --image gcr.io/YOUR_PROJECT/youtube-transcript-mcp ...
```

---

## Stdio (Alternative)

Run as a subprocess instead of HTTP. **Required:** set `YTSM_API_KEY` in env (API key is not passed per-request for stdio).

```json
{
  "mcpServers": {
    "youtubetranscript": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": { "YTSM_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

Run from the project directory after `npm run build`. For globally installed package, use the path to `dist/index.js` in the package.

---

## Development

```bash
npm install
npm run build
npm test
npm run start:http   # Local HTTP server (port 8080)
```

**Quick test all tools** (requires `YTSM_API_KEY` in env):

```bash
npm install && npm run build
export YTSM_API_KEY=your_key   # bash/mac
$env:YTSM_API_KEY="your_key"   # PowerShell
npm run test:all
```

See [QUICK_TEST.md](QUICK_TEST.md) for full testing instructions.

---

## Links

- 🌐 [YouTubeTranscript.dev](https://www.youtubetranscript.dev)
- 🔌 [Hosted MCP](https://mcp.youtubetranscript.dev)
- 📖 [API Documentation](https://www.youtubetranscript.dev/api-docs)
- 💰 [Pricing](https://www.youtubetranscript.dev/pricing)

---

## License

MIT License — see [LICENSE](./LICENSE) for details.
