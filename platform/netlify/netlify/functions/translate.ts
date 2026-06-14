import process from 'node:process'
import deeplxServerless from 'deeplx-serverless'

const token = process.env.token
const retry = process.env.retry ? Number(process.env.retry) : undefined
const cooldown = process.env.cooldown ? Number(process.env.cooldown) : undefined

export default async (request: Request) => {
  return deeplxServerless({ request, token, retry, cooldown })
}

export const config = {
  path: '/*',
}
