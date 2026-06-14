import type { IncomingMessage } from 'node:http'

export type TMethod = 'GET' | 'POST'

export interface IParams {
  token: string
}

export interface IBody {
  from: string
  to: string
  text: string
  source_lang: string
  target_lang: string
}

export interface IOptions {
  request: IncomingMessage | Request
  token?: string | string[]
  /** DeepL Pro `dl_session` cookie value. When set, requests use the account's higher limits. */
  dlSession?: string
  /** Number of extra attempts when DeepL answers with `429 Too Many Requests`. Default: `2`. */
  retry?: number
  /**
   * How long (in milliseconds) to reject requests immediately after DeepL rate-limits
   * the upstream IP, to stop hammering DeepL while it is blocked. Default: `30000`.
   */
  cooldown?: number
}

export interface IResultData {
  code: number
  msg: string
}
