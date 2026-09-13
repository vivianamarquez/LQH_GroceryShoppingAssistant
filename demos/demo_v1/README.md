# Grocery shopping assistant — local demo

A React/TypeScript web app running on Vinext/Vite, with three tabs:

- **Model lab:** compare the original LFM2.5-1.2B-Instruct model with the LQH fine-tune and inspect the JSON output.
- **Kroger cart:** find real products and add reviewed selections to a connected Kroger account.
- **About this app:** read about the tuning workflow and implementation.

## Requirements

- Node.js **22.13 or newer**, with npm.
- A compatible `llama-server` executable from llama.cpp.
- Both Q4 GGUF files in the repository-level `models/` folder:
  - `LFM2.5-1.2B-Instruct-Q4_K_M.gguf`
  - `grocery-list-v3-q4.gguf`

Each model is about 731 MB on disk; running them requires additional memory. 

## First-time setup

On a Mac with [Homebrew](https://brew.sh/), install Node.js and [llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md) if needed:

```bash
brew install node llama.cpp
```

Copy the two model files listed above into the repository's `models/` directory (next to `demos/`, not inside this demo). 

Then, from the repository root:

```bash
cd demos/demo_v1
npm run setup
npm run demo
```

`npm run setup` checks the Node version, runs `npm ci` to install the locked JavaScript dependencies, creates `.env.local` from `.env.example` if missing, and checks for the engine and both GGUF files. It preserves existing credentials and reports missing prerequisites. It does not install system software, download models, or obtain Kroger credentials.

No Python or `uv` environment is needed. On subsequent runs, use **`npm run demo`** from this folder. Rerun setup after pulling dependency changes.

## Run the demo

Open [http://localhost:3000](http://localhost:3000) and allow the models to finish loading before submitting a request. Keep the terminal open; **Ctrl+C** stops the app and the model servers launched with it.

The launcher starts:

| Service | Address |
| --- | --- |
| Web app | `http://localhost:3000` |
| Fine-tuned model | `http://127.0.0.1:8080` |
| Original Instruct model | `http://127.0.0.1:8082` |

The Model lab works without Kroger credentials. Try a preset grocery request or the “Failure mode” example.

### Use a different llama.cpp installation

The launcher uses `LLAMA_SERVER_BIN` if set, then the existing local `.runtime/` engine, then `llama-server` on your `PATH`. To select another executable:

```bash
LLAMA_SERVER_BIN=/absolute/path/to/llama-server npm run demo
```

This override also works with `npm run setup`. Set it in the terminal, not `.env.local`: the launcher runs before the web app loads its environment files.

## Connect Kroger (optional)

Before starting the app, fill in these values in this demo's `.env.local`:

```dotenv
kroger_client_id=your_client_id
kroger_client_secret=your_client_secret
KROGER_REDIRECT_URI=http://localhost:3000/api/kroger/callback
```

In your Kroger developer application's settings, register **exactly** the same callback URL. The app requests `product.compact` for catalog searches and `cart.basic:write` when connecting a shopper's account.

Restart the app after changing `.env.local`. In the Kroger tab, connect your account, choose a ZIP code, enter a grocery request, and find products. Review the products and package quantities before adding them. Adding items changes your real cart; it does not place an order. Checkout stays with Kroger.

Keep credentials in `.env.local`; do not commit them. Kroger is the app's only shopping integration; the Model lab requires no retailer credentials.

## Troubleshooting

- **`llama-server not found`:** install llama.cpp, or use `LLAMA_SERVER_BIN` as shown above. You do not need to copy `.runtime/`.
- **Setup reports missing models:** copy both named GGUF files into `../../models/`, then rerun setup. Installing llama.cpp does not supply these model weights.
- **Model server error:** check that both GGUF files exist in `../../models/`. Details are in `.runtime/logs/base.log` and `.runtime/logs/tuned.log`.
- **Port already in use:** stop any previous demo/model-server instances before restarting. The launcher uses ports 8080 and 8082; keep port 3000 available for the configured Kroger callback.
- **Kroger redirect mismatch:** the portal URL and `KROGER_REDIRECT_URI` must match, including hostname, port, and path. Use `localhost`, not `127.0.0.1`, for the browser URL with this configuration.

`npm run dev` starts only the web app. Use it only if your model servers are already running at the addresses configured by `LLAMA_TUNED_URL` and `LLAMA_BASE_URL` in `.env.local`.

## Folder layout

The app's source, assets, and setup/launch scripts live here. `.env.local` holds local configuration; `.runtime/` holds generated logs and, optionally, a local engine installation. Shared models stay in `../../models/`; LQH specifications, datasets, training runs, and evaluation outputs remain at the repository root.

## Code checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tests mock network calls and setup dependencies: they do not use credentials, contact Kroger, or change a real cart. They cover first-time setup, engine discovery, package quantities, model request settings, and API error handling.
