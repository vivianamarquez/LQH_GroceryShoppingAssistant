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
cd demos/local_demo
npm run setup
npm run demo
```

`npm run setup` checks the Node version, runs `npm ci` to install the locked JavaScript dependencies, creates `.env.local` from `.env.example` if missing, and checks for the engine and both GGUF files. It preserves existing credentials and reports missing prerequisites. 

On subsequent runs, use **`npm run demo`** from this folder. Rerun setup after pulling dependency changes.

## Run the demo

Open [http://localhost:3000](http://localhost:3000) and allow the models to finish loading before submitting a request.

The launcher starts:

| Service | Address |
| --- | --- |
| Web app | `http://localhost:3000` |
| Fine-tuned model | `http://127.0.0.1:8080` |
| Original Instruct model | `http://127.0.0.1:8082` |

## Connect Kroger (optional)

Before starting the app, fill in these values in this demo's `.env.local`:

```dotenv
kroger_client_id=your_client_id
kroger_client_secret=your_client_secret
KROGER_REDIRECT_URI=http://localhost:3000/api/kroger/callback
```

In your Kroger developer application's settings, register the same callback URL. 

Adding items changes your Kroger cart but it does not place an order. Complete the checkout process in the new Kroger tab that opens.

