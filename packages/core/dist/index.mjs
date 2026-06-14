import { toWebRequest, bodyData } from 'body-data';
import { DEEPL_URL, getBody, parse2DeepLX } from 'deeplx-lib';

const DEEPL_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "DeepL/1627620 CFNetwork/3826.500.62.2.1 Darwin/24.4.0",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "X-App-Os-Name": "iOS",
  "X-App-Os-Version": "18.4.0",
  "X-App-Device": "iPhone16,2",
  "X-App-Build": "1627620",
  "X-App-Version": "25.1",
  "X-Product": "translator",
  "Referer": "https://www.deepl.com/"
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
let blockedUntil = 0;
function isRateLimited(now = Date.now()) {
  return now < blockedUntil;
}
function rateLimitedResponse() {
  return new Response('{"code":429}', { status: 429, headers: { "Content-Type": "application/json" } });
}
async function requestDeepL(options, requestOptions = {}) {
  const { dlSession, retry = 2, retryDelay = 500, cooldown = 3e4 } = requestOptions;
  if (isRateLimited()) {
    return rateLimitedResponse();
  }
  const headers = { ...DEEPL_HEADERS };
  if (dlSession) {
    headers.Cookie = `dl_session=${dlSession}`;
  }
  let response;
  for (let attempt = 0; attempt <= retry; attempt++) {
    response = await fetch(DEEPL_URL, {
      method: "POST",
      body: getBody(options),
      headers
    });
    if (response.status !== 429) {
      blockedUntil = 0;
      return response;
    }
    if (attempt < retry) {
      await sleep(retryDelay * 2 ** attempt);
    }
  }
  if (cooldown > 0) {
    blockedUntil = Date.now() + cooldown;
  }
  return response;
}

function parseToken(token = "") {
  if (Array.isArray(token)) {
    return token;
  }
  const tokens = token.split(",").filter(Boolean).map((i) => i.trim());
  return tokens;
}
function authToken({ tokens, authorization, token }) {
  if (!tokens.length) {
    return true;
  }
  if (authorization) {
    authorization = authorization.replace("Bearer ", "").trim();
    return tokens.includes(authorization);
  }
  if (token) {
    return tokens.includes(token);
  }
  return false;
}

const index = async (options) => {
  const METHODS = ["GET", "HEAD", "POST", "OPTIONS"];
  const method = options.request.method || "GET";
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": METHODS.join(", "),
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8"
  });
  if (!METHODS.includes(method)) {
    return new Response(null, { status: 405, headers });
  }
  const responseInit = {
    headers
  };
  if (method === "HEAD") {
    return new Response(null, {
      headers,
      status: 200
    });
  }
  if (method === "OPTIONS") {
    return new Response(null, { headers });
  }
  const data = await handle(options).then((r) => r.json());
  responseInit.status = data.code;
  return new Response(JSON.stringify(data), responseInit);
};
async function handle(options) {
  const { token, dlSession, retry, cooldown } = options;
  const request = toWebRequest(options.request);
  const url = new URL(request.url);
  const path = url.pathname;
  const { params, body } = await bodyData(request, { backContentType: "application/json; charset=utf-8" });
  const tokens = parseToken(token);
  const authorization = request.headers.get("authorization");
  const auth = authToken({ tokens, authorization, token: params.token });
  if (!auth) {
    const code = 403;
    const msg = `Request missing authentication information`;
    return Response.json({ code, msg }, { status: code });
  }
  if (request.method.toUpperCase() === "POST" && body) {
    if (body.source_lang) {
      body.from = body.source_lang;
    }
    if (body.target_lang) {
      body.to = body.target_lang;
    }
    body.to = body.to.split("-")[0];
    if (path.startsWith("/translate") && body.to && body.text) {
      const text = body.text;
      const from = (body.from || "AUTO").toUpperCase();
      const to = body.to.toUpperCase();
      const options2 = { text, from, to };
      const response = await requestDeepL(options2, { dlSession, retry, cooldown });
      if (response.status === 429) {
        const code2 = 429;
        const msg = "Too many requests, the upstream IP has been temporarily rate-limited by DeepL. Please try again later.";
        return Response.json({ code: code2, msg }, { status: code2 });
      }
      const translateData = await response.json().catch(() => ({}));
      if (!response.ok || translateData.error) {
        const code2 = response.status;
        return Response.json({ code: code2, ...translateData }, { status: code2 });
      }
      const responseData = parse2DeepLX({ ...options2, ...translateData });
      return Response.json(responseData, { status: response.status });
    }
    const code = 404;
    return Response.json({ code, msg: "Not found" }, { status: code });
  } else {
    const code = 404;
    return Response.json({ code, msg: "Not found" }, { status: code });
  }
}

export { index as default, handle, isRateLimited, requestDeepL };
