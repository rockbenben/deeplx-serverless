import type { IOptions as deepLXOptions, IDeepLData, IDeepLDataError, TSourceLanguage, TTargetLanguage } from 'deeplx-lib'
import type { IBody, IOptions, IParams } from './types'
import { bodyData, toWebRequest } from 'body-data'
import { parse2DeepLX } from 'deeplx-lib'
import { requestDeepL } from './deepl'
import { authToken, parseToken } from './utils'

export * from './deepl'

export * from './types.d'

export default async (options: IOptions): Promise<Response> => {
  const METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS']
  const method = options.request.method || 'GET'
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': METHODS.join(', '),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json; charset=utf-8',
  })

  if (!METHODS.includes(method)) {
    return new Response(null, { status: 405, headers })
  }

  const responseInit: ResponseInit = {
    headers,
  }
  if (method === 'HEAD') {
    return new Response(null, {
      headers,
      status: 200,
    })
  }
  if (method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  const data = await handle(options).then(r => r.json())

  responseInit.status = data.code
  return new Response(JSON.stringify(data), responseInit)
}

export async function handle(options: IOptions): Promise<Response> {
  const { token, retry, cooldown } = options
  const request = toWebRequest(options.request)
  const url = new URL(request.url)
  const path = url.pathname

  const { params, body } = await bodyData<IParams, IBody>(request, { backContentType: 'application/json; charset=utf-8' })

  const tokens = parseToken(token)
  const authorization = request.headers.get('authorization')
  const auth = authToken({ tokens, authorization, token: params.token })
  if (!auth) {
    const code = 403
    const msg = `Request missing authentication information`
    return Response.json({ code, msg }, { status: code })
  }

  if (request.method.toUpperCase() === 'POST' && body) {
    if (body.source_lang) {
      body.from = body.source_lang
    }
    if (body.target_lang) {
      body.to = body.target_lang
    }

    // fix unsupported regional variant
    if (body.to) {
      body.to = body.to.split('-')[0]
    }

    if (path.startsWith('/translate') && body.to && body.text) {
      const text = body.text
      const from = (body.from || 'AUTO').toUpperCase() as TSourceLanguage
      const to = body.to.toUpperCase() as TTargetLanguage
      const options: deepLXOptions = { text, from, to }
      const response = await requestDeepL(options, { retry, cooldown })

      if (response.status === 429) {
        const code = 429
        const msg = 'Too many requests, the upstream IP has been temporarily rate-limited by DeepL. Please try again later.'
        return Response.json({ code, msg }, { status: code })
      }

      const translateData = await response.json().catch(() => ({})) as IDeepLData & IDeepLDataError

      if (!response.ok || translateData.error) {
        const code = response.status
        return Response.json({ code, ...translateData }, { status: code })
      }

      const responseData = parse2DeepLX({ ...options, ...translateData })
      return Response.json(responseData, { status: response.status })
    }

    const code = 404
    return Response.json({ code, msg: 'Not found' }, { status: code })
  }
  // else if (req.method.toUpperCase() === 'GET') {

  // }
  else {
    const code = 404
    return Response.json({ code, msg: 'Not found' }, { status: code })
  }
}
