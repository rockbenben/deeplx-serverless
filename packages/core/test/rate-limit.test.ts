/* eslint-disable test/no-import-node-test -- the repo's vitest dependency cannot be linked reliably on this platform; `node:test` keeps the suite dependency-free. */
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { isRateLimited, RATE_LIMITED_MESSAGE, rateLimitRetryAfterSeconds, requestDeepL } from '../src/deepl'
import deeplx from '../src/index'

const options = { text: 'hello', from: 'EN', to: 'ZH' } as Parameters<typeof requestDeepL>[0]

/** Replace global fetch with a stub returning `status` for every call. */
function stubFetch(status: number) {
  const original = globalThis.fetch
  globalThis.fetch = (async () => new Response('{}', { status })) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

/**
 * The 429 contract, pinned because both halves are easy to lose silently:
 *
 *  - `Retry-After` tells the client exactly how long to wait. Our tools honour
 *    it in their shared cooldown gate, so a missing header means the two sides
 *    each guess a wait time — which is how a shared instance keeps hammering
 *    DeepL after the upstream already said "stop".
 *  - `Access-Control-Expose-Headers` is required for a browser client to read
 *    `Retry-After` at all: it is not a CORS-safelisted response header, so
 *    without the expose directive the header is sent but invisible to the very
 *    clients it exists for.
 */
describe('rate-limit response contract', () => {
  let restore: (() => void) | undefined

  afterEach(() => {
    restore?.()
    restore = undefined
  })

  it('advertises the REMAINING window as Retry-After once the breaker is open', async () => {
    restore = stubFetch(429)

    // Every upstream attempt answers 429 → the breaker opens for `cooldown` ms.
    const first = await requestDeepL(options, { retry: 0, cooldown: 30_000 })
    assert.equal(first.status, 429)

    // The advertised wait shrinks as the window burns down — the property a
    // client relies on. Unlike an absolute bound it does not depend on how
    // much of the window a previous test already used.
    const now = Date.now()
    const early = rateLimitRetryAfterSeconds(now)
    const later = rateLimitRetryAfterSeconds(now + 5_000)
    assert.ok(early! > 0, 'Retry-After should be advertised while the breaker is open')
    assert.ok(later! > 0)
    assert.ok(later! < early!, 'the advertised wait should shrink as the window burns down')
  })

  it('reports no Retry-After when no cooldown window is open', () => {
    // The breaker is module-level state, so "closed" cannot be asserted by
    // looking at the current time — a previous test may have opened a window.
    // `blockedUntil` is an absolute timestamp, so the only time guaranteed to
    // be outside any window is one far in the FUTURE.
    assert.equal(isRateLimited(Number.MAX_SAFE_INTEGER), false)
    assert.equal(rateLimitRetryAfterSeconds(Number.MAX_SAFE_INTEGER), undefined)
  })

  it('returns the same body from the breaker path and the upstream path', async () => {
    restore = stubFetch(429)

    // Upstream 429: the breaker opens, and this response carries the message.
    const upstream = await requestDeepL(options, { retry: 0, cooldown: 30_000 })
    const upstreamBody = await upstream.json()

    // The next request short-circuits on the open breaker.
    const breaker = await requestDeepL(options, { retry: 0, cooldown: 30_000 })
    const breakerBody = await breaker.json()

    assert.deepEqual(upstreamBody, { code: 429, msg: RATE_LIMITED_MESSAGE })
    assert.deepEqual(breakerBody, upstreamBody)
  })

  it('exposes Retry-After via CORS so a browser client can read it', async () => {
    restore = stubFetch(429)

    const response = await deeplx({
      request: new Request('https://example.com/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', target_lang: 'ZH' }),
      }),
      cooldown: 30_000,
    })

    assert.equal(response.status, 429)
    assert.ok(response.headers.get('Access-Control-Expose-Headers')!.includes('Retry-After'))
    assert.match(response.headers.get('Retry-After')!, /^\d+$/)
  })
})
