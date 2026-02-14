/**
 * HTTP client utilities with proxy support for YouTube requests
 *
 * This module provides fetch wrappers with:
 * - Automatic retry logic with exponential backoff
 * - Proxy support via environment variables (WEBSHARE_PROXY_URL, USE_PROXY)
 * - Timeout handling
 * - Rate limit and server error handling
 *
 * @module lib/http-client
 */

import { HttpsProxyAgent } from 'https-proxy-agent'

const PROXY_URL = process.env.WEBSHARE_PROXY_URL
// Always enable proxy when a URL is provided to avoid env flag mismatches.
const USE_PROXY = !!PROXY_URL
let proxyStatusLogged = false
let proxyUnavailableLogged = false

function maskProxyUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.username || parsed.password) {
      parsed.username = '***'
      parsed.password = '***'
    }
    return parsed.toString()
  } catch {
    return url.replace(/:\/\/[^@]+@/, '://***:***@')
  }
}

export interface FetchWithRetryOptions {
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Whether to use proxy for this request (default: USE_PROXY env value) */
  useProxy?: boolean
}

/**
 * Creates an HTTPS proxy agent for fetch requests
 */
function createProxyAgent(): HttpsProxyAgent<string> | null {
  if (!USE_PROXY || !PROXY_URL) {
    return null
  }

  try {
    if (!proxyStatusLogged) {
      console.log('[HTTP Client] Proxy enabled (agent)', { proxyUrl: maskProxyUrl(PROXY_URL) })
      proxyStatusLogged = true
    }
    return new HttpsProxyAgent(PROXY_URL)
  } catch (error) {
    console.warn('[HTTP Client] Failed to create proxy agent:', error)
    return null
  }
}

const proxyAgent = createProxyAgent()
let proxyDispatcher: unknown | null | undefined

async function getProxyDispatcher(): Promise<unknown | null> {
  if (!PROXY_URL) return null
  if (proxyDispatcher !== undefined) return proxyDispatcher

  try {
    const undici = await import('undici')
    if (typeof (undici as any).ProxyAgent !== 'function') {
      proxyDispatcher = null
      return proxyDispatcher
    }
    proxyDispatcher = new (undici as any).ProxyAgent(PROXY_URL)
    if (!proxyStatusLogged) {
      console.log('[HTTP Client] Proxy enabled (dispatcher)', { proxyUrl: maskProxyUrl(PROXY_URL) })
      proxyStatusLogged = true
    }
    return proxyDispatcher
  } catch (error) {
    console.warn('[HTTP Client] Failed to create undici ProxyAgent:', error)
    proxyDispatcher = null
    return proxyDispatcher
  }
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch with retry logic and optional proxy support
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 10000,
    maxRetries = 3,
    useProxy = USE_PROXY,
  } = options

  const retryStatusCodes = new Set([429, 500, 502, 503, 504])
  let lastError: Error | null = null

  // Add proxy agent if enabled
  const requestInit: RequestInit = { ...init }
  if (useProxy && typeof window === 'undefined') {
    const dispatcher = await getProxyDispatcher()
    if (dispatcher) {
      // @ts-ignore - undici fetch supports dispatcher in Node.js environment
      requestInit.dispatcher = dispatcher
    } else if (proxyAgent) {
      // @ts-ignore - some fetch impls support agent (node-fetch, etc.)
      requestInit.agent = proxyAgent
    } else if (!proxyUnavailableLogged) {
      console.warn('[HTTP Client] Proxy requested but no agent/dispatcher available')
      proxyUnavailableLogged = true
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, requestInit, timeoutMs)

      // Success or non-retryable error
      if (response.ok || !retryStatusCodes.has(response.status)) {
        return response
      }

      // Retry on server errors
      console.warn(`[HTTP Client] Attempt ${attempt}/${maxRetries} failed:`, {
        url,
        status: response.status,
        useProxy,
      })

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)

      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      console.warn(`[HTTP Client] Attempt ${attempt}/${maxRetries} error:`, {
        url,
        error: lastError.message,
        useProxy,
      })

      // Don't retry on abort errors (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`)
      }

      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('Request failed after retries')
}

/**
 * Build standard headers for YouTube watch page requests
 */
export function buildYouTubeHeaders(): HeadersInit {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }
}
