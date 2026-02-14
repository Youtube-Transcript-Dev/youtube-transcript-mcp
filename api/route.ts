import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { createMcpServer } from "@/lib/mcp/server";
import { NextJsSseTransport } from "@/lib/mcp/transport";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/mcp
 * Establishes the SSE connection.
 * Authentication: Bearer <API_KEY>
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Authenticate the user
        // authenticateApiKey throws errors if invalid
        const { user_id } = await authenticateApiKey(authHeader);

        // Create a new Transport
        const transport = new NextJsSseTransport();

        // Initialize the response stream (sets up the writer)
        const stream = transport.initResponseStream();

        // Create specific session ID
        const sessionId = crypto.randomUUID();
        activeTransports.set(sessionId, transport);

        // Create MCP Server instance for this user
        const mcpServer = createMcpServer(user_id);

        // Connect server to transport (requires writer to be ready)
        // Connect server to transport (requires writer to be ready)
        await mcpServer.connect(transport);

        // Send the endpoint event so the client knows where to send POST requests
        // Send the endpoint event so the client knows where to send POST requests
        setTimeout(() => {
            transport.sendEndpoint(`/api/mcp?sessionId=${sessionId}`).catch(err => console.error("Error sending endpoint:", err));
        }, 100);

        // Return the stream as a Server-Sent Events response
        return new NextResponse(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    } catch (error) {
        console.error("MCP Connection Error:", error);
        return new NextResponse("Unauthorized or Internal Error", { status: 401 });
    }
}

/**
 * POST /api/mcp
 * Handles incoming JSON-RPC messages.
 * Authentication: Bearer <API_KEY>
 * Note: Since HTTP is stateless, we need to re-authenticate and re-create the server/transport
 * for each POST request to process the message contextually?
 *
 * ACTUALLY: The standard MCP over SSE pattern implies the POST messages are sent to an endpoint
 * that forwards them to the *associated* session. However, in a serverless environment (Next.js),
 * we don't have persistent sessions in memory.
 *
 * WORKAROUND:
 * The `NextJsSseTransport` doesn't persist state across requests.
 * But strictly speaking, for a complete MCP implementation in serverless, we'd need a way to route
 * the POST message to the specific active SSE connection writer if it was stateful.
 *
 * LUCKILY: The @modelcontextprotocol/sdk's `SSEServerTransport` is designed where the GET request
 * holds the output stream, and the POST request purely inputs a message. The SDK *Server* class
 * handles the logic.
 *
 * CHALLENGE:
 * When a POST comes in, we need the *same* `McpServer` instance that created the SSE stream to handle it?
 * OR, we can instantiate a fresh `McpServer` for the POST request, process the message, and if the message
 * expects a response, the response needs to go out via the SSE stream (the GET request).
 *
 * PROBLEM: We cannot write to the GET stream from this POST request execution context in stateless serverless.
 *
 * SOLUTION (Serverless MCP):
 * We need to implement a mechanism where the POST request *can* trigger a write to the SSE stream.
 * BUT since we can't share memory, we might need to use a durable store (Redis/Database) to push messages
 * to a queue that the GET request (SSE loop) is polling.
 *
 * SIMPLER SOLUTION (for now):
 * We will assume a single-instance deployment or stick to "Tools" which are stateless.
 * Wait, the Architecture of MCP over SSE:
 * Client GET -> Server (starts SSE)
 * Client POST -> Server (message) -> Server processes -> Server writes to SSE
 *
 * In Vercel/Next.js non-edge, lambda functions are isolated.
 * The GET request lambda is running and holding the connection open.
 * The POST request lambda is a separate process.
 * They cannot communicate directly in memory.
 *
 * REQUIRED: A shared bus (like Redis Pub/Sub or Supabase Realtime) to bridge the POST input to the GET output.
 *
 * HOWEVER: The user's prompt implies a simpler setup might be expected or I misunderstood the "Next.js MCP Server" capabilities without external bus.
 *
 * LET'S CHECK: Does `mcp-adapter` (mentioned in summary) solve this?
 * The summary mentioned "Vercel's MCP Adapter".
 *
 * ALTERNATIVE: Use "stdio" transport? No, this is over HTTP.
 *
 * RE-EVALUATION:
 * If we look at how Vercel AI SDK does `streamText`, it keeps the connection open.
 *
 * SHORTCUT:
 * For this implementation, I will implement a *polling* approach or a simple *broadcast* if possible?
 * No, that's too complex for "minisaas".
 *
 * WAIT, "Cursor/Claude" connect to a *local* server usually (stdio) or a remote SSE.
 * If remote SSE, the server *must* describe how to handle messages.
 *
 * Let's look at `NextJsSseTransport` again.
 * If I cannot bridge the implementation, I might have to use a stateless request/response model if MCP supports it?
 * MCP is strictly JSON-RPC over a transport.
 *
 * ACTUALLY: The client sends a POST, and expects the server to *process* it.
 * If the response is needed, it must go down the SSE.
 *
 * COMPROMISE:
 * I will use a simple in-memory map IF this was a long-running server (Node custom server).
 * But this is Next.js App Router (Serverless).
 *
 * CRITICAL REALIZATION:
 * You cannot easily host a proper stateful MCP SSE server on standard Serverless functions without an external pub/sub.
 *
 * BUT: Validating "Next.js MCP" search results suggests it IS possible.
 * Maybe the `POST` request handles the response directly?
 * No, MCP over SSE defines: "Messages from the server to the client are sent as SSE events... Messages from the client to the server are sent as HTTP POST requests."
 *
 * HYPOTHESIS: The standard `@modelcontextprotocol/sdk` might not support split processes out of the box without a custom transport that uses a bus.
 *
 * REFLECTION:
 * If I implement the POST handler, I must be able to "find" the active transport writer.
 *
 * OPTIONS:
 * 1. (Complex) Use Supabase Realtime to broadcast from POST -> GET.
 * 2. (Simple) The user might be running this locally with `npm run dev` (Node.js server).
 *    In `npm run dev` (or `next start`), the server IS a single process (usually).
 *    We can use a global variable to store active connections?
 *    It's hacky but works for a "minisaas" running on a single instance/local.
 *
 * DECISION: I will use a global `Map<sessionId, Transport>` to bridge the connections.
 * This works perfectly for local development (`npm run dev`) and single-instance deployments (VPS, etc).
 * It will FAIL on Vercel Serverless (multiple lambdas), but the user seems to be "building an MCP server" likely for personal/local use or a specific deployment.
 * Given the "minisaas" context, if they deploy to Vercel, this feature will break.
 *
 * I will add a comment about this limitation.
 */

// Global store for active transports (Session ID -> Transport)
// In a serverless environment (Vercel), this map will be empty for the POST request if it hits a different lambda.
// This ONLY works for local development or single-instance servers.
const activeTransports = new Map<string, NextJsSseTransport>();

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Authenticate (stateless check is fine, verify key validity)
        await authenticateApiKey(authHeader);

        // Parse the JSON-RPC message
        const message = await req.json();

        // In a real robust implementation, the query param or body should contain the session ID.
        // However, the MCP spec for SSE says: "The client includes a query parameter 'sessionId'..."
        // Let's assume the client passes `?sessionId=...` in the POST URL.
        const sessionId = req.nextUrl.searchParams.get("sessionId");

        if (!sessionId) {
            return new NextResponse("Missing sessionId", { status: 400 });
        }

        const transport = activeTransports.get(sessionId);
        if (!transport) {
            return new NextResponse("Session not found (Serverless limitation: ensure single instance)", { status: 404 });
        }

        await transport.handlePostMessage(message);

        return new NextResponse("Accepted", { status: 202 });
    } catch (error) {
        console.error("MCP Message Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
