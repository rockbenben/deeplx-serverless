import type { IOptions as deepLXOptions } from 'deeplx-lib'
import { DEEPL_URL, getBody } from 'deeplx-lib'

/**
 * Headers that mimic the official DeepL iOS app.
 *
 * The free `www2.deepl.com/jsonrpc` endpoint rate-limits by source IP. Requests
 * that look like a real client are far less likely to be blocked than the bare
 * `Content-Type: application/json` request that `deeplx-lib.translate()` sends.
 */
const DEEPL_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'User-Agent': 'DeepL/1627620 CFNetwork/3826.500.62.2.1 Darwin/24.4.0',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'X-App-Os-Name': 'iOS',
  'X-App-Os-Version': '18.4.0',
  'X-App-Device': 'iPhone16,2',
  'X-App-Build': '1627620',
  'X-App-Version': '25.1',
  'X-Product': 'translator',
  'Referer': 'https://www.deepl.com/',
}

export interface IRequestOptions {
  /** Number of extra attempts when DeepL answers with `429 Too Many Requests`. Default: `2`. */
  retry?: number
  /** Base delay in milliseconds for the exponential backoff between retries. Default: `500`. */
  retryDelay?: number
  /**
   * How long (in milliseconds) to keep rejecting requests immediately after DeepL
   * rate-limits the upstream IP, so we stop hammering DeepL while it is blocked.
   * Default: `30000`. Set to `0` to disable.
   */
  cooldown?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * In-memory circuit breaker shared across requests handled by the same serverless
 * instance (Worker isolate / warm function). Once DeepL rate-limits the upstream
 * IP, every further request would otherwise keep firing `fetch` (plus retries),
 * wasting the instance's CPU/subrequest budget and prolonging the block. While the
 * breaker is open we reject instantly without contacting DeepL.
 */
let blockedUntil = 0

/** Whether the breaker is currently open (upstream IP is in a cooldown window). */
export function isRateLimited(now: number = Date.now()): boolean {
  return now < blockedUntil
}

/**
 * Seconds the client should wait before retrying, advertised via `Retry-After`.
 *
 * Clients that understand the header (our own tools, and any well-behaved HTTP
 * client) use it to wait exactly as long as the server asked. Without it both
 * sides guess independently — and that is how a shared instance ends up
 * hammering DeepL longer than necessary.
 *
 * Value: the REMAINING breaker window, rounded up, so a client arriving
 * mid-cooldown is told when the instance frees up rather than when the window
 * originally started. Clamped to 1..120s to stay inside the range clients
 * accept for a delta-seconds value.
 *
 * Returns `undefined` when no window is known — i.e. the breaker was never
 * opened (upstream 429 with the cooldown disabled). Advertising a guess there
 * would contradict the operator's configuration, so we stay silent and let the
 * client apply its own backoff.
 */
export function rateLimitRetryAfterSeconds(now: number = Date.now()): number | undefined {
  if (!isRateLimited(now)) {
    return undefined
  }
  const remainingMs = blockedUntil - now
  return Math.min(120, Math.max(1, Math.ceil(remainingMs / 1000)))
}

/**
 * The message every 429 carries, whatever path produced it.
 *
 * The breaker's fast-reject path used to answer a bare `{"code":429}` while
 * the upstream-429 path answered `{"code":429,"msg":"..."}`. `handle()` rewrites
 * both into one response, so users saw the same text either way — but the two
 * paths still disagreed on the body they returned, which is a trap for any
 * caller that reads the response directly instead of going through `handle()`.
 * One body, one message, everywhere.
 */
export const RATE_LIMITED_MESSAGE = 'Too many requests, the upstream IP has been temporarily rate-limited by DeepL. Please try again later.'

/**
 * The 429 body the breaker returns when it short-circuits.
 *
 * Carries the same `msg` the upstream-429 path produces, so a caller that
 * inspects this response directly sees the same diagnostic either way.
 */
function rateLimitedResponse(msg: string): Response {
  return new Response(JSON.stringify({ code: 429, msg }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Send a translation request to DeepL with browser-like headers, retry with
 * exponential backoff on `429 Too Many Requests`, and open an in-memory circuit
 * breaker for `cooldown` ms once rate-limited so the instance stops hammering DeepL.
 */
export async function requestDeepL(options: deepLXOptions, requestOptions: IRequestOptions = {}): Promise<Response> {
  const { retry = 2, retryDelay = 500, cooldown = 30000 } = requestOptions

  // Breaker is open: reject immediately without touching DeepL.
  if (isRateLimited()) {
    return rateLimitedResponse(RATE_LIMITED_MESSAGE)
  }

  let response!: Response
  for (let attempt = 0; attempt <= retry; attempt++) {
    // Rebuild the body each attempt so the embedded timestamp stays fresh.
    response = await fetch(DEEPL_URL, {
      method: 'POST',
      body: getBody(options),
      headers: DEEPL_HEADERS,
    })

    if (response.status !== 429) {
      // Upstream is healthy again: close the breaker.
      blockedUntil = 0
      return response
    }

    if (attempt < retry) {
      await sleep(retryDelay * 2 ** attempt)
    }
  }

  // Every attempt hit 429: open the breaker so the next requests short-circuit.
  if (cooldown > 0) {
    blockedUntil = Date.now() + cooldown
  }

  return response
}
