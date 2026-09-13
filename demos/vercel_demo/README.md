# Grocery shopping assistant · Vercel demo

| Model | Where it runs |
| --- | --- |
| LQH tuned | Vercel calls `https://inference.lqh.ai/v1/chat/completions` with a server-only key. |
| Original LFM2.5-1.2B-Instruct | wllama runs the Q4 GGUF in the visitor’s browser. |

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
2. Use the **Next.js** framework preset, **Node.js 22.x**, install command `npm ci`, and build command `npm run build`. Keep the default output directory and Fluid Compute enabled (the inference function allows up to 300 seconds).
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

LQH can take longer to respond when its deployment starts from idle. The app allows **270 seconds total**, including at most one retry for HTTP 502/503/504, within Vercel’s 300-second function limit. After ten seconds, both tabs show a waiting notice. Authentication, missing deployments, connection failures, timeouts, truncated output, and invalid JSON/schema errors are reported separately. Server logs record an error code, stage, HTTP status, and elapsed time—not keys, prompts, or provider response bodies. This does not keep the LQH deployment warm or eliminate provider outages.

The small LQH indicator beside the tabs reflects requests from this page, not confirmed warm/cold status. It starts at “Not checked,” shows “Waiting” during a request, then “Responded recently” or “Request failed.” Success expires to “Status unknown” after one minute; cancellation also returns to unknown. Switching tabs preserves the status. It makes no background requests and does not change when the browser-only base model runs.

Kroger needs `product.compact` and `cart.basic:write` access. Each visitor connects their own shopper account. Cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS; reconnect when the short-lived token expires. A stable production domain is simplest because preview deployment URLs change.

## Browser model

The default file is Liquid AI’s public [Q4_K_M GGUF](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF), pinned to revision `6767265158422fb8a19c62ceb45f16f05363615b`. The browser downloads approximately **731 MB** from Hugging Face only when the user runs the base model, then caches it when browser storage permits. Reloading still loads the cached weights into memory; clearing site data removes the cache.

No account, key, or installation is required for visitors. Start with a recent desktop Chrome or Edge and several GB of available RAM. Private browsing, limited storage, older browsers, or mobile memory limits may prevent loading. The browser makes a model-download request to Hugging Face, but the base model’s grocery input is not sent to LQH or a Vercel inference function.

wllama uses **WebGPU when a GPU adapter is available**, with all model layers requested on the GPU. If GPU initialization fails or WebGPU is unavailable, it falls back to one CPU thread, reusing the cached download. The Model lab shows the selected backend. It uses a worker, one inference slot, a 4,096-token context, and the model’s chat template. No cross-origin-isolation headers are added, preserving Kroger OAuth pop-up communication. WebGPU speeds up inference, not the first 731 MB download. Download/loading progress and cancellation are shown; cancelling during initialization may wait for that stage to finish. The first timing includes download and startup, so it is not a speed comparison with hosted inference.

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

Tests mock external APIs and check WebGPU/CPU fallback, request format, schema validation, missing configuration, bounded retries, cancellation, timeout/error reporting, package quantities, cookies, and the unchanged cart payload. They do not add products to a real account.

Earlier **CPU-only** smoke test (September 13, 2026): the official Q4 returned the expected failure JSON for “what’s the weather” (85 seconds including first download/loading), then schema-valid grocery JSON for the restock example (56 seconds with weights loaded). That base-model response omitted the requested quantities. These timings predate WebGPU and are not a benchmark.

With **WebGPU enabled** on the same day, the weather example completed in 1.8 seconds with already-cached weights (including initialization), and the next grocery example completed in 1.1 seconds. Both were schema-valid; the untuned grocery output still omitted quantities. A live hosted LQH request returned the correct milk/bread quantities after 124 seconds—beyond the old 110-second timeout, but within the new limit. A follow-up request in the Model lab completed in 1.4 seconds with correct quantities. These are individual smoke tests, not guaranteed timings.

References: [wllama WebGPU support](https://github.com/ngxson/wllama#webgpu-support), [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration), [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).
