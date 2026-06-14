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
  /** DeepL Pro `dl_session` cookie value. When set, requests use the account's higher limits. */
  dlSession?: string
  /** Number of extra attempts when DeepL answers with `429 Too Many Requests`. Default: `2`. */
  retry?: number
  /** Base delay in milliseconds for the exponential backoff between retries. Default: `500`. */
  retryDelay?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Send a translation request to DeepL with browser-like headers and retry the
 * request with exponential backoff when DeepL rate-limits the source IP (HTTP 429).
 */
export async function requestDeepL(options: deepLXOptions, requestOptions: IRequestOptions = {}): Promise<Response> {
  const { dlSession, retry = 2, retryDelay = 500 } = requestOptions

  const headers: Record<string, string> = { ...DEEPL_HEADERS }
  if (dlSession) {
    headers.Cookie = `dl_session=${dlSession}`
  }

  let response!: Response
  for (let attempt = 0; attempt <= retry; attempt++) {
    // Rebuild the body each attempt so the embedded timestamp stays fresh.
    response = await fetch(DEEPL_URL, {
      method: 'POST',
      body: getBody(options),
      headers,
    })

    if (response.status !== 429) {
      return response
    }

    if (attempt < retry) {
      await sleep(retryDelay * 2 ** attempt)
    }
  }

  return response
}
