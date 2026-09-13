# Grocery shopping assistant · Vercel demo

The same three-tab demo as `../local_demo`, with two different inference paths:

| Model | Where it runs |
| --- | --- |
| LQH tuned | Vercel calls `https://inference.lqh.ai/v1/chat/completions` with a server-only key. |
| Original LFM2.5-1.2B-Instruct | wllama runs the Q4 GGUF in the visitor’s browser. |

Kroger product search and OAuth stay server-side. Adding reviewed items sends the same UPC/quantity/PICKUP payload as the local demo, then opens Kroger in a new tab. This app never checks out or places an order.

## Run locally

Use Node.js 22 LTS. From this folder:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Fill in `.env.local` before using the hosted model or Kroger. Open [localhost:3000](http://localhost:3000). If the local demo already uses that port, run `npm run dev -- --port 3001` and use a matching registered Kroger callback URL.

No `.runtime/`, Python, llama-server, or local model files are needed. `npm ci` copies the version-matched wllama WASM asset into `public/wllama/`; generated runtime assets and secrets are ignored by Git.

## Configure and deploy on Vercel

1. Import this repository in Vercel and set **Root Directory** to `demos/vercel_demo`.
2. Use the **Next.js** framework preset, **Node.js 22.x**, install command `npm ci`, and build command `npm run build`. Keep the default output directory.
3. Add the environment variables below in Vercel’s project settings, then deploy.
4. In your Kroger developer app, register the exact production callback URL, for example `https://your-app.vercel.app/api/kroger/callback`. Set `KROGER_REDIRECT_URI` to that same URL and redeploy if necessary. Do not reuse the localhost callback in production.

| Variable | Value |
| --- | --- |
| `LQH_INFERENCE_API_KEY` | The private inference key from LQH. Never use a `NEXT_PUBLIC_` prefix. |
| `LQH_DEPLOYMENT_NAME` | The **deployment name** used as the API’s `model` field—not the key’s display name or artifact ID. |
| `KROGER_CLIENT_ID` | Your Kroger developer app’s client ID. |
| `KROGER_CLIENT_SECRET` | Its private client secret. |
| `KROGER_REDIRECT_URI` | The exact registered callback for this deployment. |
| `NEXT_PUBLIC_BASE_MODEL_URL` | Optional override for the public GGUF URL. Normally leave it unset. |

The supplied screenshot confirms the LQH endpoint, but redacts the key and uses `<deployment-name>`. Those values must be supplied separately. This code requests `response_format: json_schema`; verify that your hosted deployment accepts it. Unsupported structured output is reported as an error, not silently disabled.

Kroger needs `product.compact` and `cart.basic:write` access. Each visitor connects their own shopper account. Cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS; reconnect when the short-lived token expires. A stable production domain is simplest because preview deployment URLs change.

## Browser model

The default file is Liquid AI’s public [Q4_K_M GGUF](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF), pinned to revision `6767265158422fb8a19c62ceb45f16f05363615b`. The browser downloads approximately **731 MB** from Hugging Face only when the user runs the base model, then caches it when browser storage permits. Reloading still loads the cached weights into memory; clearing site data removes the cache.

No account, key, or installation is required for visitors. Start with a recent desktop Chrome or Edge and several GB of available RAM. Private browsing, limited storage, older browsers, or mobile memory limits may prevent loading. The browser makes a model-download request to Hugging Face, but the base model’s grocery input is not sent to LQH or a Vercel inference function.

wllama uses a worker, one CPU thread, a 4,096-token context, and the model’s chat template. Single-threaded mode avoids cross-origin-isolation headers that can sever Kroger OAuth pop-up communication. It is slower than native llama.cpp with Metal acceleration. Download/loading progress and cancellation are shown in the Model lab. The first timing includes download and startup, so it is not a speed comparison with hosted inference.

Both inference paths request temperature 0, a maximum of 1,024 output tokens, and the grocery JSON schema. Only the base model gets the short extraction system prompt. Outputs are validated before display or product search. The displayed training/evaluation scores are historical LQH results, not a new evaluation of this deployment or the browser runtime; the hosted deployment’s quantization is not assumed to be Q4.

## Before sharing publicly

- Keep Vercel Deployment Protection enabled while testing. The hosted inference and catalog routes do not implement login or a distributed rate limiter; public access can spend your LQH quota and Kroger API allowance. Add access controls/rate limits and provider spending limits before opening the demo broadly.
- Never copy `.env.local`, `.lqh/`, or private model-download links into Git. Set production secrets in Vercel, not client-side variables.
- If overriding the GGUF URL, use public HTTPS file storage with browser CORS support. Do not bundle the 731 MB model in Vercel Functions or commit it here. Check the model’s license for your use.
- The hosted path sends grocery requests to LQH. Finding Kroger products sends the extracted products/preferences and ZIP to Kroger. The Model lab’s browser-only base path does neither.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Tests mock external APIs and check request format, schema validation, missing configuration, package quantities, cookies, and the unchanged cart payload. They do not add products to a real account.

Browser smoke test (September 13, 2026): the official Q4 returned the expected failure JSON for “what’s the weather” (85 seconds including first download/loading), then schema-valid grocery JSON for the restock example (56 seconds with weights loaded). That base-model response omitted the requested quantities. Cancellation also worked. These are two smoke tests, not a benchmark; hosted LQH and real Kroger account checks still require configuration.

References: [wllama](https://github.com/ngxson/wllama), [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).
