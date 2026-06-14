import type { IEnv } from './types'
import deeplxServerless from 'deeplx-serverless'

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const token = env.token
    const retry = env.retry ? Number(env.retry) : undefined
    const cooldown = env.cooldown ? Number(env.cooldown) : undefined
    return deeplxServerless({ request, token, retry, cooldown })
  },
} satisfies ExportedHandler<IEnv>
