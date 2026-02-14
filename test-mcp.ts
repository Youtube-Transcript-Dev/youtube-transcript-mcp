import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const EventSource = require("eventsource");

// Polyfill EventSource for Node environment
// @ts-ignore
global.EventSource = EventSource;

async function main() {
    const apiKey = process.argv[2];
    if (!apiKey) {
        console.error("Please provide an API Key as the first argument.");
        process.exit(1);
    }

    const mcpUrl = process.env.MCP_URL || "http://localhost:3000/api/mcp";
    const transport = new SSEClientTransport(
        new URL(mcpUrl),
        {
            eventSourceInit: {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            },
            // In SDK 1.0.1+, we might need to handle fetch options too?
            // SSEClientTransport handles the GET via EventSource.
            // But it sends POST requests for messages via fetch.
            // We need to inject headers into fetch too?
            // The SDK defines `_fetch` but doesn't expose headers config easily in constructor for the POST request?
            // Actually, SSEClientTransport takes `opts` which has `eventSourceInit` and `requestInit`.
            requestInit: {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                }
            }
        }
    );

    const client = new Client(
        {
            name: "mcp-test-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    console.log("Connecting to MCP Server...");
    await client.connect(transport);
    console.log("Connected!");

    console.log("\n--- Listing Tools ---");
    const tools = await client.listTools();
    console.log(JSON.stringify(tools, null, 2));

    // Test arguments
    const videoArg = process.argv[3];
    const videosToTest = videoArg ? [videoArg] : [
        "https://www.youtube.com/watch?v=jNQXAC9IVRw", // Me at the zoo (Short)
        "https://www.youtube.com/watch?v=ScMzIvxBSi4", // Stack Overflow in 100 Seconds (Short, Code)
    ];

    for (const videoUrl of videosToTest) {
        console.log(`\n--- Calling create_transcript for ${videoUrl} ---`);
        try {
            const result = await client.callTool({
                name: "create_transcript",
                arguments: {
                    video_url: videoUrl,
                },
            });
            console.log("Result:", JSON.stringify(result, null, 2));
        } catch (error) {
            console.error(`Error calling create_transcript for ${videoUrl}:`, error);
        }
    }

    console.log("\n--- Listing Recent Transcripts ---");
    try {
        const transcripts = await client.callTool({
            name: "list_transcripts",
            arguments: { limit: 5 }
        });
        console.log("Result:", JSON.stringify(transcripts, null, 2));
    } catch (error) {
        console.error("Error calling list_transcripts:", error);
    }

    console.log("\nClosing connection...");
    await client.close();
}

main().catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
});
