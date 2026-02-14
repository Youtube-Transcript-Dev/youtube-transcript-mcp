import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const apiKey = req.nextUrl.searchParams.get("key") || "<YOUR_API_KEY>";
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    const config = {
        mcpServers: {
            "youtube-transcript-minisaas": {
                url: `${baseUrl}/api/mcp`,
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            },
        },
    };

    return NextResponse.json(config, {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });
}
