# DeepLX Serverless — Cloudflare Workers

The simplest way to deploy [deeplx-serverless](https://github.com/rockbenben/deeplx-serverless).

## Deploy

**One-click** (copies the repo to your GitHub and sets up automatic deploys):

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Frockbenben%2Fdeeplx-serverless%2Ftree%2Fmain%2Fplatform%2Fcloudflare)

**Local CLI:**

```bash
npm install
npx wrangler deploy
```

## Configuration

All variables are optional. Set them with `wrangler secret put <NAME>` (recommended for `token`) or under the Worker's **Settings → Variables**:

| Name       | Description                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------- |
| `token`    | Access token(s); multiple separated by commas (`,`). Omit to allow public access.           |
| `retry`    | Extra attempts on DeepL `429` (exponential backoff). Default `2`.                            |
| `cooldown` | Milliseconds to fast-reject after a `429` without calling DeepL. Default `30000`.           |

> Cloudflare Workers reach DeepL through a **shared egress IP**, which makes `429` relatively more likely than on other platforms. See the [root README](../../README.md#about-429-too-many-requests) for details and trade-offs.
