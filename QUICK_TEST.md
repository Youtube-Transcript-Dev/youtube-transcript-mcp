# Quick Testing Guide

All commands to set up and test the MCP server.

---

## Setup

```bash
cd /path/to/mcp
npm install
npm run build
```

---

## 1. Unit Tests (no API key)

```bash
npm test
```

Runs Jest: listTools, delete_transcript validation, createMcpServer.

---

## 2. Local HTTP Server

```bash
npm run start:http
```

Server at `http://localhost:8080`. API key comes from client headers. Keep running.

---

## 3. Connect Clients (HTTP)

Get API key from [youtubetranscript.dev/dashboard/account](https://youtubetranscript.dev/dashboard/account).

**Claude Code:**
```bash
claude mcp add --transport http ytscribe http://localhost:8080 --header "x-api-token: YOUR_API_KEY"
```

**Cursor** – `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "ytscribe": {
      "url": "http://localhost:8080",
      "headers": { "x-api-token": "YOUR_API_KEY" }
    }
  }
}
```

**Antigravity:** URL `http://localhost:8080`, header `x-api-token: YOUR_API_KEY`

---

## 4. E2E Tests (needs API key)

```bash
# Set API key first
export YTSM_API_KEY=your_key   # bash/mac
$env:YTSM_API_KEY="your_key"   # PowerShell

# Test all tools (transcribe, list, get, etc.)
npm run test:all

# Verify flows (account details, ASR, get_job)
npm run verify

# Integration test (listTools + list_transcripts + transcribe)
npm run test:integration
```

---

## 5. Docker

**Build stdio image:**
```bash
docker build -t youtube-transcript-mcp:latest .
```

**Run stdio (for subprocess clients):**
```bash
docker run -it --rm -e YTSM_API_KEY=your_key youtube-transcript-mcp:latest
```

**Build HTTP image:**
```bash
docker build -f Dockerfile.cloudrun -t youtube-transcript-mcp:http .
```

**Run HTTP (for Cursor/Claude etc.):**
```bash
docker run -p 8080:8080 youtube-transcript-mcp:http
```

Then connect clients to `http://localhost:8080` with `x-api-token` header.

**Docker Compose (stdio):**
```bash
YTSM_API_KEY=your_key docker compose run --rm mcp
```

**Test Docker image:**
```bash
YTSM_API_KEY=your_key npm run test:docker
```

---

## 6. Lint & Typecheck

```bash
npm run lint
npm run typecheck
```

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `npm test` | Unit tests |
| `npm run start:http` | Start HTTP server (localhost:8080) |
| `npm run test:all` | E2E all tools (needs YTSM_API_KEY) |
| `npm run verify` | E2E flow verification (needs YTSM_API_KEY) |
| `npm run test:integration` | Integration test (needs YTSM_API_KEY) |
| `npm run test:docker` | Test Docker stdio image (needs YTSM_API_KEY) |

**Tools:** get_stats, transcribe_v2, list_transcripts, get_transcript, delete_transcript
