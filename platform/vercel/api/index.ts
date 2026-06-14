import type { VercelRequest, VercelResponse } from '@vercel/node'
import process from 'node:process'
import deeplxServerless from 'deeplx-serverless'

const token = process.env.token
const retry = process.env.retry ? Number(process.env.retry) : undefined
const cooldown = process.env.cooldown ? Number(process.env.cooldown) : undefined

export default async (request: VercelRequest, response: VercelResponse) => {
  const webResponse = await deeplxServerless({ request, token, retry, cooldown })
  webResponse.headers.forEach((value, key) => response.setHeader(key, value))

  response.writeHead(webResponse.status)
  if (webResponse.body) {
    await webResponse.body.pipeTo(new WritableStream({
      write(chunk) { response.write(chunk) },
      close() { response.end() },
    }))
  }
}
