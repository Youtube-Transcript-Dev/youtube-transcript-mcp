import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeLanguageTag } from "@/lib/transcription/language-utils";
import { getUserPreferredLanguage } from "@/lib/transcription/language-utils";
import { fetchCaptionsWithRetry } from "@/lib/captions/fetcher";
import { getVideoTitle } from "@/lib/youtube";
import { exportTranscript, type ExportFormat } from "@/lib/mcp/transcript-formatter";

// Helper to initialize the MCP server instance
// We export a factory function because we need to pass the transport later
export function createMcpServer(userId: string) {
    const server = new McpServer({
        name: "YouTube Transcript MiniSaaS",
        version: "1.0.0",
    });

    // Tool: List Transcripts
    server.tool(
        "list_transcripts",
        "List recent transcripts for the authenticated user.",
        {
            limit: z.number().optional().describe("Number of transcripts to return (default: 10)"),
            offset: z.number().optional().describe("Offset for pagination (default: 0)"),
        },
        async ({ limit = 10, offset = 0 }) => {
            const supabase = createServiceClient();

            const { data: transcripts, error } = await supabase
                .from("user_transcripts")
                .select("id, video_id, video_title, status, created_at, language, source_kind")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                return {
                    content: [{ type: "text", text: `Error fetching transcripts: ${error.message}` }],
                    isError: true,
                };
            }

            return {
                content: [{ type: "text", text: JSON.stringify(transcripts, null, 2) }],
            };
        }
    );

    // Tool: Get Transcript Detail
    server.tool(
        "get_transcript",
        "Get full content of a specific transcript by ID or Video ID.",
        {
            id: z.string().optional().describe("The UUID of the transcript record"),
            video_id: z.string().optional().describe("The YouTube video ID"),
        },
        async ({ id, video_id }) => {
            if (!id && !video_id) {
                return {
                    content: [{ type: "text", text: "Either 'id' or 'video_id' must be provided." }],
                    isError: true,
                };
            }

            const supabase = createServiceClient();
            let query = supabase
                .from("user_transcripts")
                .select("*")
                .eq("user_id", userId);

            if (id) {
                query = query.eq("id", id);
            } else if (video_id) {
                // If multiple exist for same video, take most recent
                query = query.eq("video_id", video_id).order("created_at", { ascending: false }).limit(1);
            }

            const { data, error } = await query;

            if (error) {
                return {
                    content: [{ type: "text", text: `Error fetching transcript: ${error.message}` }],
                    isError: true,
                };
            }

            if (!data || data.length === 0) {
                return {
                    content: [{ type: "text", text: "Transcript not found." }],
                    isError: true,
                };
            }

            const transcript = data[0];

            // Format the output
            const output = {
                meta: {
                    id: transcript.id,
                    video_id: transcript.video_id,
                    title: transcript.video_title,
                    language: transcript.language,
                    status: transcript.status,
                    created_at: transcript.created_at,
                },
                content: transcript.text || "(No transcript text available)",
            };

            return {
                content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            };
        }
    );

    // Tool: Create Transcript
    server.tool(
        "create_transcript",
        "Create a new transcript for a YouTube video. Does NOT support ASR (system-generated captions only).",
        {
            video_url: z.string().describe("The full YouTube URL or Video ID"),
            language: z.string().optional().describe("Preferred language code (e.g., 'en', 'es'). Defaults to auto-detect or user preference."),
        },
        async ({ video_url, language }) => {
            const supabase = createServiceClient();

            // 1. Extract Video ID
            let videoId = video_url;
            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
                /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
                /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
            ];
            for (const pattern of patterns) {
                const match = video_url.match(pattern);
                if (match) {
                    videoId = match[1];
                    break;
                }
            }

            if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
                return {
                    content: [{ type: "text", text: "Invalid YouTube URL or ID." }],
                    isError: true,
                };
            }

            try {
                // 2. Determine effective language
                let effectiveLanguage = language ? normalizeLanguageTag(language) : null;
                if (!effectiveLanguage) {
                    const preferred = await getUserPreferredLanguage(supabase, userId);
                    effectiveLanguage = normalizeLanguageTag(preferred);
                }

                // 3. Check for existing transcript
                const { data: existing } = await supabase
                    .from("user_transcripts")
                    .select("id, status, text")
                    .eq("user_id", userId)
                    .eq("video_id", videoId)
                    .maybeSingle();

                if (existing && existing.status === 'succeeded' && existing.text) {
                    return {
                        content: [{ type: "text", text: `Transcript for video ${videoId} already exists. ID: ${existing.id}` }],
                    };
                }

                // 4. Fetch Video Title
                const videoTitle = await getVideoTitle(videoId);

                // 5. Insert "processing" record
                const nowIso = new Date().toISOString();
                const { data: newTranscript, error: insertError } = await supabase
                    .from("user_transcripts")
                    .insert({
                        user_id: userId,
                        video_id: videoId,
                        video_title: videoTitle || "Unknown Title",
                        language: effectiveLanguage || 'en',
                        source_kind: 'auto',
                        status: 'processing',
                        text: "", // Required to be non-null
                        created_at: nowIso,
                        updated_at: nowIso
                    })
                    .select("id")
                    .single();

                if (insertError) throw insertError;

                // 6. Perform Transcription Locally (Sync)
                try {
                    const captionData = await fetchCaptionsWithRetry({
                        videoId,
                        language: effectiveLanguage || undefined
                    });

                    // 7. Update Record with Success
                    const { error: updateError } = await supabase
                        .from("user_transcripts")
                        .update({
                            status: 'succeeded',
                            text: captionData.text,
                            segments: captionData.segments as any,
                            language: captionData.language,
                            source_kind: captionData.source_kind === 'manual' ? 'manual' : 'auto',
                            updated_at: new Date().toISOString()
                        })
                        .eq("id", newTranscript.id);

                    if (updateError) throw updateError;

                    return {
                        content: [{ type: "text", text: `Transcript created successfully. ID: ${newTranscript.id}. Title: ${videoTitle || 'Unknown'}` }],
                    };

                } catch (processError) {
                    console.error("Local transcription failed:", processError);
                    const msg = processError instanceof Error ? processError.message : "Unknown error";

                    // Mark as failed
                    await supabase
                        .from("user_transcripts")
                        .update({
                            status: 'failed',
                            updated_at: new Date().toISOString(),
                            error: msg
                        })
                        .eq("id", newTranscript.id);

                    return {
                        content: [{ type: "text", text: `Failed to fetch captions: ${msg}` }],
                        isError: true,
                    };
                }

            } catch (error) {
                const msg = error instanceof Error ? error.message : "Unknown error";
                return {
                    content: [{ type: "text", text: `Failed to create transcript: ${msg}` }],
                    isError: true,
                };
            }
        }
    );

    // Tool: Search Transcripts
    server.tool(
        "search_transcripts",
        "Search your video library by title or content keywords. Returns matching transcripts with metadata.",
        {
            query: z.string().min(1).describe("Search query: keywords to match in video title or transcript content"),
            limit: z.number().min(1).max(100).optional().describe("Max results to return (default: 20)"),
        },
        async ({ query, limit = 20 }) => {
            try {
                const supabase = createServiceClient();
                const searchTerm = query.trim().toLowerCase();
                if (!searchTerm) {
                    return {
                        content: [{ type: "text", text: "Search query cannot be empty." }],
                        isError: true,
                    };
                }

                // Fetch user transcripts - use ilike for title, and text search for content
                const { data: transcripts, error } = await supabase
                    .from("user_transcripts")
                    .select("id, video_id, video_title, status, created_at, language, source_kind, text")
                    .eq("user_id", userId)
                    .eq("status", "succeeded")
                    .order("created_at", { ascending: false })
                    .limit(limit * 2); // Fetch extra for filtering

                if (error) {
                    return {
                        content: [{ type: "text", text: `Error searching: ${error.message}` }],
                        isError: true,
                    };
                }

                // Filter by title or content match (Supabase doesn't have full-text search on arbitrary columns easily)
                const matches = (transcripts || []).filter((t) => {
                    const titleMatch = (t.video_title || "").toLowerCase().includes(searchTerm);
                    const contentMatch = (t.text || "").toLowerCase().includes(searchTerm);
                    return titleMatch || contentMatch;
                }).slice(0, limit);

                const results = matches.map((t) => ({
                    id: t.id,
                    video_id: t.video_id,
                    video_title: t.video_title,
                    status: t.status,
                    created_at: t.created_at,
                    language: t.language,
                }));

                return {
                    content: [{ type: "text", text: JSON.stringify({ count: results.length, results }, null, 2) }],
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [{ type: "text", text: `Search failed: ${msg}` }],
                    isError: true,
                };
            }
        }
    );

    // Tool: Delete Transcript
    server.tool(
        "delete_transcript",
        "Remove a transcript by ID or video_id. Use to clean up old or failed transcripts.",
        {
            id: z.string().uuid().optional().describe("Transcript record UUID"),
            video_id: z.string().optional().describe("YouTube video ID (deletes most recent for that video)"),
        },
        async ({ id, video_id }) => {
            if (!id && !video_id) {
                return {
                    content: [{ type: "text", text: "Either 'id' or 'video_id' must be provided." }],
                    isError: true,
                };
            }

            try {
                const supabase = createServiceClient();
                let targetId: string | null = id ?? null;

                if (!targetId && video_id) {
                    const { data: row } = await supabase
                        .from("user_transcripts")
                        .select("id")
                        .eq("user_id", userId)
                        .eq("video_id", video_id)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    targetId = row?.id ?? null;
                }

                if (!targetId) {
                    return {
                        content: [{ type: "text", text: "Transcript not found." }],
                        isError: true,
                    };
                }

                const { error } = await supabase
                    .from("user_transcripts")
                    .delete()
                    .eq("id", targetId)
                    .eq("user_id", userId);

                if (error) {
                    return {
                        content: [{ type: "text", text: `Delete failed: ${error.message}` }],
                        isError: true,
                    };
                }

                return {
                    content: [{ type: "text", text: `Transcript ${targetId} deleted successfully.` }],
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [{ type: "text", text: `Delete failed: ${msg}` }],
                    isError: true,
                };
            }
        }
    );

    // Tool: Get Account Usage
    server.tool(
        "get_account_usage",
        "Check remaining credits, subscription status, and plan for the authenticated account.",
        {},
        async () => {
            try {
                const supabase = createServiceClient();
                const { data: userData, error } = await supabase
                    .from("users")
                    .select("subscription_credits, extra_credits, reserved_credits, plan, usage_based_enabled, thumbnail_credits")
                    .eq("id", userId)
                    .maybeSingle();

                if (error) {
                    return {
                        content: [{ type: "text", text: `Error fetching usage: ${error.message}` }],
                        isError: true,
                    };
                }

                if (!userData) {
                    return {
                        content: [{ type: "text", text: "User not found." }],
                        isError: true,
                    };
                }

                const u = userData as { subscription_credits?: number; extra_credits?: number; reserved_credits?: number; plan?: string; usage_based_enabled?: boolean; thumbnail_credits?: number };
                const sub = u.subscription_credits ?? 0;
                const extra = u.extra_credits ?? 0;
                const reserved = u.reserved_credits ?? 0;
                const total = sub + extra;
                const available = total - reserved;

                const usage = {
                    available_credits: available,
                    total_credits: total,
                    subscription_credits: sub,
                    extra_credits: extra,
                    reserved_credits: reserved,
                    plan: u.plan ?? "free",
                    usage_based_enabled: u.usage_based_enabled ?? false,
                    thumbnail_credits: u.thumbnail_credits ?? 0,
                };

                return {
                    content: [{ type: "text", text: JSON.stringify(usage, null, 2) }],
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [{ type: "text", text: `Failed to get usage: ${msg}` }],
                    isError: true,
                };
            }
        }
    );

    // Tool: Export Transcript
    server.tool(
        "export_transcript",
        "Get transcript in specific formats (Markdown, SRT, VTT, plain) for use in other apps.",
        {
            id: z.string().uuid().optional().describe("Transcript record UUID"),
            video_id: z.string().optional().describe("YouTube video ID"),
            format: z.enum(["markdown", "srt", "vtt", "plain"]).describe("Export format: markdown, srt, vtt, or plain"),
        },
        async ({ id, video_id, format }) => {
            if (!id && !video_id) {
                return {
                    content: [{ type: "text", text: "Either 'id' or 'video_id' must be provided." }],
                    isError: true,
                };
            }

            try {
                const supabase = createServiceClient();
                let query = supabase
                    .from("user_transcripts")
                    .select("id, video_id, video_title, text, segments, status")
                    .eq("user_id", userId)
                    .eq("status", "succeeded");

                if (id) {
                    query = query.eq("id", id);
                } else if (video_id) {
                    query = query.eq("video_id", video_id).order("created_at", { ascending: false }).limit(1);
                }

                const { data, error } = await query;

                if (error) {
                    return {
                        content: [{ type: "text", text: `Error fetching transcript: ${error.message}` }],
                        isError: true,
                    };
                }

                if (!data || data.length === 0) {
                    return {
                        content: [{ type: "text", text: "Transcript not found." }],
                        isError: true,
                    };
                }

                const transcript = data[0];
                const rawSegments = (transcript.segments as unknown) as Array<{ text: string; start?: number; end?: number; duration?: number }> | null;
                const segments = Array.isArray(rawSegments) && rawSegments.length > 0
                    ? rawSegments.map((s) => ({
                        text: s.text ?? "",
                        start: s.start ?? s.end,
                        end: s.end ?? (s.start != null && s.duration != null ? s.start + s.duration : s.start),
                    }))
                    : [{ text: transcript.text ?? "", start: 0, end: 0 }];

                const exported = exportTranscript(
                    {
                        videoId: transcript.video_id,
                        videoTitle: transcript.video_title,
                        segments,
                        plainText: transcript.text ?? undefined,
                    },
                    format as ExportFormat
                );

                return {
                    content: [{ type: "text", text: exported }],
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [{ type: "text", text: `Export failed: ${msg}` }],
                    isError: true,
                };
            }
        }
    );

    return server;
}
