# ListLab demo

Two local demos for the LQH grocery model:

- **Model lab** compares the original LFM2.5 Instruct model with the LQH fine-tune.
- **Kroger cart** matches the tuned model's output to real products and adds reviewed items to an authenticated Kroger cart.

## Run

The simplest option starts both Q4 models and the web app together:

```bash
npm run demo
```

Or start each service manually:

```bash
.runtime/llama/build/bin/llama-server -m ../models/grocery-list-v3-q4.gguf --port 8080 -ngl 99 -c 4096
.runtime/llama/build/bin/llama-server -m ../models/LFM2.5-1.2B-Instruct-Q4_K_M.gguf --port 8082 -ngl 99 -c 4096
```

Then start the app:

```bash
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. For the Kroger cart flow, add `kroger_client_id` and `kroger_client_secret` to `.env.local`, then register this OAuth callback in the Kroger developer portal:

```text
http://localhost:3000/api/kroger/callback
```
