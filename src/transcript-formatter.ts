/**
 * Shared transcript formatting utilities for MCP export_transcript tool.
 * Supports SRT, VTT, and Markdown formats.
 */

export interface TranscriptSegment {
    text: string
    start?: number
    end?: number
    duration?: number
}

function formatSRT(seconds: number): string {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`
}

function formatVTT(seconds: number): string {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`
}

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
}

export interface ExportOptions {
    videoId: string
    videoTitle?: string | null
    segments: TranscriptSegment[]
    plainText?: string
}

export type ExportFormat = "markdown" | "srt" | "vtt" | "plain";

/**
 * Export transcript to the specified format.
 */
export function exportTranscript(options: ExportOptions, format: ExportFormat): string {
    const { videoId, videoTitle, segments, plainText } = options

    switch (format) {
        case "plain":
            return plainText ?? segments.map((s) => s.text).join("\n\n")

        case "srt":
            return segments
                .map((seg, i) => {
                    const startSec = (seg.start ?? 0) / 1000
                    const endSec = (seg.end ?? seg.start ?? 0) / 1000
                    return `${i + 1}\n${formatSRT(startSec)} --> ${formatSRT(endSec)}\n${seg.text}`
                })
                .join("\n\n")

        case "vtt":
            return (
                "WEBVTT\n\n" +
                segments
                    .map((seg) => {
                        const startSec = (seg.start ?? 0) / 1000
                        const endSec = (seg.end ?? seg.start ?? 0) / 1000
                        return `${formatVTT(startSec)} --> ${formatVTT(endSec)}\n${seg.text}`
                    })
                    .join("\n\n")
            )

        case "markdown": {
            const title = videoTitle || `Transcript for ${videoId}`
            const duration =
                segments.length > 0 && segments[segments.length - 1]?.end
                    ? Math.floor((segments[segments.length - 1].end ?? 0) / 1000)
                    : 0
            const words = (plainText ?? segments.map((s) => s.text).join(" ")).split(/\s+/).filter(Boolean).length

            return (
                `# ${title}\n\n` +
                `**Video ID:** ${videoId}\n` +
                `**Duration:** ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}\n` +
                `**Words:** ${words.toLocaleString()}\n\n` +
                `## Transcript\n\n` +
                segments
                    .map((seg) => `**[${formatTime(seg.start ?? 0)}]** ${seg.text}`)
                    .join("\n\n")
            )
        }

        default:
            throw new Error(`Unsupported format: ${format}`)
    }
}
