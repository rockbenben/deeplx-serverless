import process from 'node:process'
import deeplxServerless from 'deeplx-serverless'

const token = process.env.token
const dlSession = process.env.dl_session
const retry = process.env.retry ? Number(process.env.retry) : undefined
const cooldown = process.env.cooldown ? Number(process.env.cooldown) : undefined

export default async (request: Request) => {
  return deeplxServerless({ request, token, dlSession, retry, cooldown })
}

export const config = {
  path: '/*',
}
