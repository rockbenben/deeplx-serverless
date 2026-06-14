# DeepLX Serverless

A free-to-deploy translation API, compatible with [OwO-Network/DeepLX](https://github.com/OwO-Network/DeepLX), running on serverless platforms and tuned to **reduce** (not eliminate — see [below](#about-429-too-many-requests)) frequent `429 Too Many Requests` errors.

> [!TIP]
> For better security and to prevent misuse, it’s strongly recommended to configure a `token`.
> Multiple tokens can be set using commas (`,`).

## ⚙️ Environment Variables

| Name       | Required | Description                                                                                                                                                                                       |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token`    | No       | Access token(s) for your API. Multiple tokens separated by commas (`,`).                                                                                                                          |
| `retry`    | No       | Extra attempts (with exponential backoff) when DeepL replies with `429`. Default: `2`. Set to `0` to disable retries.                                                                             |
| `cooldown` | No       | After DeepL rate-limits the upstream IP, how long (in **milliseconds**) to reject requests immediately without contacting DeepL, so the function stops hammering DeepL while blocked. Default: `30000` (30s). Set to `0` to disable. |

### About `429 Too Many Requests`

> [!IMPORTANT]
> The `Too many requests, your IP has been blocked by DeepL temporarily` error is triggered by the **outgoing IP that reaches DeepL** — i.e. the platform's IP — **not** by the end user's IP. On serverless platforms (especially Cloudflare Workers, whose outbound `fetch` uses a shared egress IP pool) that IP is shared across many requests and even across other deployments, so it can already be rate-limited before your own traffic is heavy. This is an inherent limitation of calling DeepL's free endpoint from a shared egress IP; it can be reduced but **not** fully eliminated.

To mitigate it, this project:

1. **Mimics the official DeepL iOS app** (`User-Agent` + `x-app-*` headers), the same headers used by [PyDeepLX](https://github.com/OwO-Network/PyDeepLX). A request that looks like a real client is less likely to be blocked than a bare one.
2. **Retries on `429`** with a short exponential backoff (`retry`), which recovers from brief, transient blocks.
3. **Opens an in-memory circuit breaker** once a request still hits `429` after exhausting its retries: for the next `cooldown` ms, requests are rejected **instantly without calling DeepL**, then the breaker auto-closes on the first healthy response.

> [!NOTE]
> The circuit breaker is per running instance (a Cloudflare Worker isolate / a warm serverless function) and is **best-effort**, not a global rate limiter — it does not coordinate across instances or use any external store. It trades a little availability for resource safety: while open, *all* requests on that instance get a fast `429` for up to `cooldown` ms, even ones that might have succeeded. Lower `cooldown` to recover faster from short blocks, or raise it to probe DeepL less often.
>
> If you need a hard guarantee against `429`, use DeepL's official paid API instead of the free endpoint this project (via `deeplx-lib`) calls.

## 🚀 Deployment

> [!TIP]
> **Every environment variable is optional.** The simplest deployment is to deploy as-is and set nothing; add a `token` only if you want to restrict who can use your API.

> [!NOTE]
> Each platform installs the shared core from this repository's **default (`main`) branch** (`"deeplx-serverless": "github:rockbenben/deeplx-serverless"` in each `platform/*/package.json`). So make sure your changes are merged into `main` before deploying — every deploy then automatically picks up the latest core from `main`.

### Cloudflare Workers (recommended — simplest)

* **One-Click Deploy** (copies this repo to your GitHub and sets up automatic deploys):

  [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Frockbenben%2Fdeeplx-serverless%2Ftree%2Fmain%2Fplatform%2Fcloudflare)

* **Connect your own repository** (Cloudflare Dashboard):

  1. **Workers & Pages** → **Create** → **Workers** → **Import a repository**, and select your fork.
  2. Set **Root directory** to `platform/cloudflare`.
  3. *(Optional)* add variables `token`, `retry`, `cooldown` under **Settings → Variables**.
  4. **Deploy.** Your API is then at `https://<worker-name>.<your-subdomain>.workers.dev/translate`.

* **Local CLI:**

  ```bash
  cd platform/cloudflare
  npm install
  npx wrangler deploy
  ```

### Vercel

* **One-Click Deploy:**

  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frockbenben%2Fdeeplx-serverless%2Ftree%2Fmain%2Fplatform%2Fvercel&env=token&envDescription=Optional%20access%20token.%20Multiple%20tokens%20are%20separated%20by%20commas&project-name=deeplx&repository-name=deeplx-serverless)

* **Manual Deploy:**

  1. Create a new project in Vercel (or import your forked repository).
  2. Go to the project → `Settings` → `Build and Deployment`.
  3. Set `Root Directory` to `platform/vercel`.
  4. *(Optional)* add environment variables `token`, `retry`, `cooldown`.

### Netlify

* **One-Click Deploy:**

  [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https%3A%2F%2Fgithub.com%2Frockbenben%2Fdeeplx-serverless&create_from_path=platform/netlify)

* **Manual Deploy:**

  1. Import your forked repository into Netlify.
  2. Go to Site Settings → `Build & Deploy` → `Build settings`.
  3. Set `Base directory` to `platform/netlify`.
  4. *(Optional)* add environment variables `token`, `retry`, `cooldown`.

## 📦 Usage

### Request Example

```bash
curl 'https://your-api-address/translate?token=your-token' \
--header 'Content-Type: application/json' \
--data '{
  "text": "Hello, World",
  "from": "en",
  "to": "zh"
}'

# Or use Authorization header
curl 'https://your-api-address/translate' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer your-token' \
--data '{
  "text": "Hello, World",
  "from": "en",
  "to": "zh"
}'
```

### Response Example

```json
{
  "code": 200,
  "id": 145289000,
  "method": "Free",
  "from": "EN",
  "to": "ZH",
  "source_lang": "EN",
  "target_lang": "ZH",
  "data": "你好，世界",
  "alternatives": [
    "世界，你好",
    "世界你好",
    "您好，世界"
  ]
}
```
