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

function rateLimitedResponse(): Response {
  return new Response('{"code":429}', { status: 429, headers: { 'Content-Type': 'application/json' } })
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
    return rateLimitedResponse()
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
