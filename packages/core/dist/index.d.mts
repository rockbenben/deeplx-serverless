import { IncomingMessage } from 'node:http';
import { IOptions as IOptions$1 } from 'deeplx-lib';

type TMethod = 'GET' | 'POST'

interface IParams {
  token: string
}

interface IBody {
  from: string
  to: string
  text: string
  source_lang: string
  target_lang: string
}

interface IOptions {
  request: IncomingMessage | Request
  token?: string | string[]
  /** Number of extra attempts when DeepL answers with `429 Too Many Requests`. Default: `2`. */
  retry?: number
  /**
   * How long (in milliseconds) to reject requests immediately after DeepL rate-limits
   * the upstream IP, to stop hammering DeepL while it is blocked. Default: `30000`.
   */
  cooldown?: number
}

interface IResultData {
  code: number
  msg: string
}

interface IRequestOptions {
    /** Number of extra attempts when DeepL answers with `429 Too Many Requests`. Default: `2`. */
    retry?: number;
    /** Base delay in milliseconds for the exponential backoff between retries. Default: `500`. */
    retryDelay?: number;
    /**
     * How long (in milliseconds) to keep rejecting requests immediately after DeepL
     * rate-limits the upstream IP, so we stop hammering DeepL while it is blocked.
     * Default: `30000`. Set to `0` to disable.
     */
    cooldown?: number;
}
/** Whether the breaker is currently open (upstream IP is in a cooldown window). */
declare function isRateLimited(now?: number): boolean;
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
declare function rateLimitRetryAfterSeconds(now?: number): number | undefined;
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
declare const RATE_LIMITED_MESSAGE = "Too many requests, the upstream IP has been temporarily rate-limited by DeepL. Please try again later.";
/**
 * Send a translation request to DeepL with browser-like headers, retry with
 * exponential backoff on `429 Too Many Requests`, and open an in-memory circuit
 * breaker for `cooldown` ms once rate-limited so the instance stops hammering DeepL.
 */
declare function requestDeepL(options: IOptions$1, requestOptions?: IRequestOptions): Promise<Response>;

declare const _default: (options: IOptions) => Promise<Response>;

declare function handle(options: IOptions): Promise<Response>;

export { RATE_LIMITED_MESSAGE, _default as default, handle, isRateLimited, rateLimitRetryAfterSeconds, requestDeepL };
export type { IBody, IOptions, IParams, IRequestOptions, IResultData, TMethod };
