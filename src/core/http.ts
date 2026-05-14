import type { GrowthHttp, GrowthHttpRequest, GrowthHttpResponse } from "./types"

/**
 * Default fetch-based transport. Works in browsers, Node 18+, Bun, Deno, and modern
 * React Native (Hermes ships fetch).
 */
export const fetchHttp: GrowthHttp = async (request: GrowthHttpRequest): Promise<GrowthHttpResponse> => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
    // Important for the web build — we never want browsers to send cookies to the
    // ingest API since we authenticate by write key.
    credentials: "omit",
  })
  const body = await response.text()
  return { status: response.status, body }
}
