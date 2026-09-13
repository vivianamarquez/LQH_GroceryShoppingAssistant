# Grocery shopping assistant — local demo

A React/TypeScript web app running on Vinext/Vite, with three tabs:

- **Model lab:** compare the original LFM2.5-1.2B-Instruct model with the LQH fine-tune and inspect the JSON output.
- **Kroger cart:** find real products and add reviewed selections to a connected Kroger account.
- **About this app:** read about the tuning workflow and implementation.

## Requirements

- Node.js **22.13 or newer**, with npm.
- A compatible `llama-server` executable from llama.cpp. The existing local setup uses `.runtime/llama/build/bin/llama-server` on an Apple Silicon Mac.
- Both Q4 GGUF files in the repository-level `models/` folder:
  - `LFM2.5-1.2B-Instruct-Q4_K_M.gguf`
  - `grocery-list-v3-q4.gguf`

Each model is about 731 MB on disk; running them requires additional memory. The model files, `.runtime/`, and `.env.local` are ignored by Git, so a fresh clone does not include them. Copy the model exports into `models/` before starting; `npm ci` does not download models.

## Start the demo

From the repository root:

```bash
cd demos/demo_v1
npm ci
cp -n .env.example .env.local
npm run demo
```

`cp -n` preserves an existing `.env.local`. On subsequent runs, you only need `npm run demo` from this folder.

Open [http://localhost:3000](http://localhost:3000) and allow the models to finish loading before submitting a request. Keep the terminal open; **Ctrl+C** stops the app and the model servers launched with it.

The launcher starts:

| Service | Address |
| --- | --- |
| Web app | `http://localhost:3000` |
| Fine-tuned model | `http://127.0.0.1:8080` |
| Original Instruct model | `http://127.0.0.1:8082` |

The Model lab works without Kroger credentials. Try a preset grocery request or the “Failure mode” example.

### If llama.cpp is not installed

On a Mac with Homebrew, follow the [llama.cpp installation instructions](https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md):

```bash
brew install llama.cpp
```

Then, from `demos/demo_v1`, use the installed executable instead of `.runtime/`:

```bash
LLAMA_SERVER_BIN="$(command -v llama-server)" npm run demo
```

This override belongs in the terminal command, not `.env.local`: the launch script reads it before the web app loads its environment files.

## Connect Kroger (optional)

Before starting the app, fill in these values in this demo's `.env.local`:

```dotenv
kroger_client_id=your_client_id
kroger_client_secret=your_client_secret
KROGER_REDIRECT_URI=http://localhost:3000/api/kroger/callback
```

In your Kroger developer application's settings, register **exactly** the same callback URL. The app requests `product.compact` for catalog searches and `cart.basic:write` when connecting a shopper's account.

Restart the app after changing `.env.local`. In the Kroger tab, connect your account, choose a ZIP code, enter a grocery request, and find products. Review the products and package quantities before adding them. Adding items changes your real cart; it does not place an order. Checkout stays with Kroger.

Keep credentials in `.env.local`; do not commit them. Instacart credentials are not required for the Model lab or Kroger flow.

## Troubleshooting

- **`llama-server not found`:** restore the local `.runtime/` installation or use `LLAMA_SERVER_BIN` as shown above.
- **Model server error:** check that both GGUF files exist in `../../models/`. Details are in `.runtime/logs/base.log` and `.runtime/logs/tuned.log`.
- **Port already in use:** stop any previous demo/model-server instances before restarting. The launcher uses ports 8080 and 8082; keep port 3000 available for the configured Kroger callback.
- **Kroger redirect mismatch:** the portal URL and `KROGER_REDIRECT_URI` must match, including hostname, port, and path. Use `localhost`, not `127.0.0.1`, for the browser URL with this configuration.

`npm run dev` starts only the web app. Use it only if your model servers are already running at the addresses configured by `LLAMA_TUNED_URL` and `LLAMA_BASE_URL` in `.env.local`.

## Folder layout

The app's source, assets, `.env.local`, and `.runtime/` live here. Shared models stay in `../../models/`; LQH specifications, datasets, training runs, and evaluation outputs remain at the repository root.
