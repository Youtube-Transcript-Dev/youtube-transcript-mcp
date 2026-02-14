# YouTube Transcript MCP Server

A Model Context Protocol (MCP) server for YouTube transcript operations.

## Overview

This server provides MCP tools for:
- Listing user transcripts
- Getting transcript details
- Creating new transcripts
- Searching transcripts
- Deleting transcripts
- Checking account usage
- Exporting transcripts in various formats (Markdown, SRT, VTT, plain text)

## Installation

```bash
npm install
```

## Configuration

Set the following environment variables:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Usage

### Running the server

```bash
npm run dev   # Development mode with hot reload
npm run build && npm start  # Production mode
```

### Integration with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "youtube-transcript": {
      "command": "node",
      "args": ["/path/to/mcp/dist/server/index.js"],
      "env": {
        "SUPABASE_URL": "your_supabase_url",
        "SUPABASE_SERVICE_ROLE_KEY": "your_service_role_key"
      }
    }
  }
}
```

## Available Tools

### list_transcripts
List recent transcripts for the authenticated user.

### get_transcript
Get full content of a specific transcript by ID or Video ID.

### create_transcript
Create a new transcript for a YouTube video (captions only, no ASR).

### search_transcripts
Search your video library by title or content keywords.

### delete_transcript
Remove a transcript by ID or video_id.

### get_account_usage
Check remaining credits, subscription status, and plan.

### export_transcript
Get transcript in specific formats (Markdown, SRT, VTT, plain).

## License

MIT
