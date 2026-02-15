<p align="center">
  <img src="https://youtubetranscript.dev/logo.svg" alt="YouTubeTranscript.dev" width="80" />
</p>

<h1 align="center">YouTube Transcript MCP Server</h1>

<p align="center">
  <strong>MCP server for YouTubeTranscript.dev — extract transcripts, manage history, and power AI assistants with YouTube content.</strong>
</p>

<p align="center">
  <a href="https://youtubetranscript.dev">Website</a> •
  <a href="https://mcp.youtubetranscript.dev">Hosted MCP</a> •
  <a href="https://youtubetranscript.dev/api-docs">API Docs</a> •
  <a href="https://youtubetranscript.dev/pricing">Pricing</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#tools-reference">Tools</a>
</p>

<p align="center">
  <a href="https://youtubetranscript.dev"><img src="https://img.shields.io/badge/API-v2-brightgreen" alt="API Version" /></a>
  <a href="https://www.npmjs.com/package/youtube-transcript-mcp"><img src="https://img.shields.io/npm/v/youtube-transcript-mcp?label=npm" alt="npm" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
</p>

---

## Why This MCP Server?

Connect Claude, Cursor, Windsurf, or any MCP client to [YouTubeTranscript.dev](https://youtubetranscript.dev) — no custom code. Your AI assistant gets tools to extract transcripts, list history, and manage content at scale.

- ⚡ **Fast caption extraction** — Manual or auto captions, returns in seconds
- 📚 **Transcript history** — List, search, and paginate your transcripts
- 🎯 **Full control** — Get stats, delete transcripts, fetch by video ID
- 🔌 **One config** — Works with Claude, Cursor, Windsurf, VS Code, Cline
- 🔒 **User-owned keys** — API key per connection, no server-side secrets

**→ [Get your free API key](https://youtubetranscript.dev)**

---

## Quick Start

### 1. Get Your API Key

Sign up at [youtubetranscript.dev](https://youtubetranscript.dev) and grab your API key from the [Dashboard](https://youtubetranscript.dev/dashboard/account).

### 2. Connect Your Client

Connect to **https://mcp.youtubetranscript.dev** with header `x-api-token: YOUR_API_KEY`. No local setup required.

See [QUICK_TEST.md](QUICK_TEST.md) for step-by-step setup and testing.

**Run locally (optional):** `npm install && npm run build && npm run start:http` — then connect to `http://localhost:8080`.

---

## MCP Connection Settings

### Claude Code

```bash
claude mcp add --transport http ytscribe https://mcp.youtubetranscript.dev --header "x-api-token: YOUR_API_KEY"
```

### Claude Desktop

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ytscribe": {
      "url": "https://mcp.youtubetranscript.dev",
      "headers": { "x-api-token": "YOUR_API_KEY" }
    }
  }
}
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ytscribe": {
      "url": "https://mcp.youtubetranscript.dev",
      "headers": { "x-api-token": "YOUR_API_KEY" }
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "ytscribe": {
      "serverUrl": "https://mcp.youtubetranscript.dev",
      "headers": { "x-api-token": "YOUR_API_KEY" }
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
      "ytscribe": {
        "url": "https://mcp.youtubetranscript.dev",
        "headers": { "x-api-token": "YOUR_API_KEY" }
      }
    }
  }
}
```

### Cline

Add to your Cline MCP config (format may vary by Cline version):

```json
{
  "ytscribe": {
    "url": "https://mcp.youtubetranscript.dev",
    "headers": { "x-api-token": "YOUR_API_KEY" }
  }
}
```

---

Replace `YOUR_API_KEY` with your API key from [youtubetranscript.dev/dashboard/account](https://youtubetranscript.dev/dashboard/account).

---

## Configuration

### Server Environment (for deployment)

| Variable          | Description           | Default                         |
| ----------------- | --------------------- | ------------------------------- |
| `YTSM_BASE_URL`   | Base URL of the API   | `https://youtubetranscript.dev` |
| `YTSM_TIMEOUT_MS` | Request timeout in ms | `30000`                         |
| `PORT`            | HTTP server port      | `8080`                          |
| `DEBUG`           | Enable debug logging  | `false` (set `true` to enable)  |

**Note:** The API key is **not** set in server env for HTTP mode. Users provide it via `x-api-token` or `Authorization: Bearer` when connecting. For stdio mode, set `YTSM_API_KEY` in env.

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
    "ytscribe": {
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

- 🌐 [YouTubeTranscript.dev](https://youtubetranscript.dev)
- 🔌 [Hosted MCP](https://mcp.youtubetranscript.dev)
- 📖 [API Documentation](https://youtubetranscript.dev/api-docs)
- 💰 [Pricing](https://youtubetranscript.dev/pricing)

---

## License

MIT License — see [LICENSE](./LICENSE) for details.
