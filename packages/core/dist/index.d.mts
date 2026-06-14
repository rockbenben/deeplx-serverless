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
  /** DeepL Pro `dl_session` cookie value. When set, requests use the account's higher limits. */
  dlSession?: string
  /** Number of extra attempts when DeepL answers with `429 Too Many Requests`. Default: `2`. */
  retry?: number
}

interface IResultData {
  code: number
  msg: string
}

interface IRequestOptions {
    /** DeepL Pro `dl_session` cookie value. When set, requests use the account's higher limits. */
    dlSession?: string;
    /** Number of extra attempts when DeepL answers with `429 Too Many Requests`. Default: `2`. */
    retry?: number;
    /** Base delay in milliseconds for the exponential backoff between retries. Default: `500`. */
    retryDelay?: number;
}
/**
 * Send a translation request to DeepL with browser-like headers and retry the
 * request with exponential backoff when DeepL rate-limits the source IP (HTTP 429).
 */
declare function requestDeepL(options: IOptions$1, requestOptions?: IRequestOptions): Promise<Response>;

declare const _default: (options: IOptions) => Promise<Response>;

declare function handle(options: IOptions): Promise<Response>;

export { _default as default, handle, requestDeepL };
export type { IBody, IOptions, IParams, IRequestOptions, IResultData, TMethod };
