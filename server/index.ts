/**
 * Standalone MCP Server for GCP Cloud Run
 *
 * Long-running SSE connections are not suitable for Vercel serverless.
 * This Express server runs on Cloud Run and handles MCP over SSE.
 *
 * Environment variables:
 *   PORT - Server port (default: 8080)
 *   MCP_BASE_URL - Public URL for this server (e.g. https://mcp-xxx.run.app)
 *   NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 */

import express, { Request, Response } from "express";
import { Readable } from "stream";
import { authenticateApiKey } from "../lib/api-auth";
import { createMcpServer } from "../lib/mcp/server";
import { NextJsSseTransport } from "../lib/mcp/transport";
import crypto from "crypto";

const app = express();
app.use(express.json());

const activeTransports = new Map<string, NextJsSseTransport>();

const PORT = parseInt(process.env.PORT || "8080", 10);
const BASE_URL = process.env.MCP_BASE_URL || `http://localhost:${PORT}`;

/**
 * GET /api/mcp - Establish SSE connection
 */
app.get("/api/mcp", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).send("Unauthorized");
        return;
    }

    try {
        const { user_id } = await authenticateApiKey(authHeader);

        const transport = new NextJsSseTransport();
        const stream = transport.initResponseStream();

        const sessionId = crypto.randomUUID();
        activeTransports.set(sessionId, transport);

        const mcpServer = createMcpServer(user_id);
        await mcpServer.connect(transport);

        // Send endpoint so client knows where to POST
        const endpoint = `${BASE_URL}/api/mcp?sessionId=${sessionId}`;
        setTimeout(() => {
            transport.sendEndpoint(endpoint).catch((err) => console.error("Error sending endpoint:", err));
        }, 100);

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        });

        const nodeStream = Readable.fromWeb(stream as any);
        nodeStream.pipe(res);

        req.on("close", () => {
            activeTransports.delete(sessionId);
        });
    } catch (error) {
        console.error("MCP Connection Error:", error);
        res.status(401).send("Unauthorized or Internal Error");
    }
});

/**
 * POST /api/mcp - Handle JSON-RPC messages
 */
app.post("/api/mcp", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).send("Unauthorized");
        return;
    }

    try {
        await authenticateApiKey(authHeader);

        const sessionId = req.query.sessionId as string;
        if (!sessionId) {
            res.status(400).send("Missing sessionId");
            return;
        }

        const transport = activeTransports.get(sessionId);
        if (!transport) {
            res.status(404).send("Session not found");
            return;
        }

        const message = req.body;
        await transport.handlePostMessage(message);

        res.status(202).send("Accepted");
    } catch (error) {
        console.error("MCP Message Error:", error);
        res.status(500).send("Internal Error");
    }
});

/**
 * Health check for Cloud Run
 */
app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`MCP Server listening on port ${PORT}`);
});
