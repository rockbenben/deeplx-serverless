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
 * Send a translation request to DeepL with browser-like headers, retry with
 * exponential backoff on `429 Too Many Requests`, and open an in-memory circuit
 * breaker for `cooldown` ms once rate-limited so the instance stops hammering DeepL.
 */
declare function requestDeepL(options: IOptions$1, requestOptions?: IRequestOptions): Promise<Response>;

declare const _default: (options: IOptions) => Promise<Response>;

declare function handle(options: IOptions): Promise<Response>;

export { _default as default, handle, isRateLimited, requestDeepL };
export type { IBody, IOptions, IParams, IRequestOptions, IResultData, TMethod };
