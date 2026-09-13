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

Fill in `.env.local` before using the hosted model or Kroger. Open [localhost:3000](http://localhost:3000). 

## Configure and deploy on Vercel

1. Import this repository in Vercel and set **Root Directory** to `demos/vercel_demo`.
2. Use the **Next.js** framework preset, **Node.js 22.x**, install command `npm ci`, and build command `npm run build`. Keep the default output directory and Fluid Compute enabled (the inference function allows up to 300 seconds).
3. Add the environment variables below in Vercel’s project settings, then deploy.
4. In your Kroger developer app, register the exact production callback URL, for example `https://your-app.vercel.app/api/kroger/callback`. Set `KROGER_REDIRECT_URI` to that same URL and redeploy if necessary. Do not reuse the localhost callback in production.

| Variable | Value |
| --- | --- |
| `LQH_INFERENCE_API_KEY` | The private inference key from LQH. |
| `LQH_DEPLOYMENT_NAME` | The deployment name used as the API’s `model` field—not the key’s display name or artifact ID. |
| `KROGER_CLIENT_ID` | Your Kroger developer app’s client ID. |
| `KROGER_CLIENT_SECRET` | Its private client secret. |
| `KROGER_REDIRECT_URI` | The exact registered callback for this deployment. |
| `NEXT_PUBLIC_BASE_MODEL_URL` | Optional override for the public GGUF URL. Normally leave it unset. |
