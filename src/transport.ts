import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"

/**
 * A Transport implementation for Next.js App Router using Server-Sent Events (SSE).
 *
 * This transport bridges the MCP protocol with Next.js's Request/Response model.
 * It handles the SSE connection for sending messages to the client and provides
 * a method (`handlePostMessage`) for receiving JSON-RPC messages from the client.
 */
export class NextJsSseTransport implements Transport {
    private _writer: WritableStreamDefaultWriter<any> | null = null
    private _reader: ReadableStreamDefaultReader<any> | null = null
    private _messageHandler: ((message: JSONRPCMessage) => void) | undefined

    /**
     * Starts the transport.
     * This method is called by the MCP Server when it connects.
     * For SSE, the "connection" is established when the client connects to the GET endpoint.
     */
    async start(): Promise<void> {
        // No-op: The connection is technically established when the response stream is created.
        // We just need to be ready to write to it.
        if (!this._writer) {
            throw new Error("Transport not initialized with a response stream writer")
        }
    }

    /**
     * Sets the message handler.
     * The MCP Server provides this callback to receive messages.
     */
    set onmessage(handler: (message: JSONRPCMessage) => void) {
        this._messageHandler = handler
    }

    get onmessage(): ((message: JSONRPCMessage) => void) | undefined {
        return this._messageHandler
    }

    set onclose(handler: () => void) {
        // We don't really have a clean way to detect client disconnect on the server side
        // in a serverless function without keeping state, but we can implement cleanup logic here.
    }

    set onerror(handler: (error: Error) => void) {
        // Error handling logic
    }

    /**
     * Sends a JSON-RPC message to the client via SSE.
     */
    async send(message: JSONRPCMessage): Promise<void> {
        if (!this._writer) {
            throw new Error("Transport not active or writer closed")
        }

        // SSE format: event: message\ndata: <json>\n\n
        const event = "message"
        const data = JSON.stringify(message)
        const payload = `event: ${event}\ndata: ${data}\n\n`

        const encoder = new TextEncoder()
        await this._writer.write(encoder.encode(payload))
    }

    /**
     * Sends the endpoint event to the client.
     */
    async sendEndpoint(endpoint: string): Promise<void> {
        if (!this._writer) {
            throw new Error("Transport not active or writer closed")
        }

        const event = "endpoint"
        const payload = `event: ${event}\ndata: ${endpoint}\n\n`

        const encoder = new TextEncoder()
        await this._writer.write(encoder.encode(payload))
    }

    /**
     * Closes the transport.
     */
    async close(): Promise<void> {
        if (this._writer) {
            await this._writer.close()
            this._writer = null
        }
    }

    /**
     * Initializes the response stream for the GET request.
     * This MUST be called when handling the GET request to establish the SSE channel.
     * returns A ReadableStream that should be returned in the Next.js Response.
     */
    initResponseStream(): ReadableStream {
        const { readable, writable } = new TransformStream()
        this._writer = writable.getWriter()
        return readable
    }

    /**
     * Handles an incoming POST message (JSON-RPC) from the client.
     * This bridges the stateless HTTP POST to the MCP message handler.
     */
    async handlePostMessage(message: JSONRPCMessage): Promise<void> {
        if (this._messageHandler) {
            this._messageHandler(message)
        }
    }
}
