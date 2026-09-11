# ListLab demo

Two local demos for the LQH grocery model:

- **Model lab** compares the original LFM2.5 Instruct model with the LQH fine-tune.
- **Shopping demo** turns a request into editable items and can create an Instacart shopping link.

## Run

The simplest option starts both models and the web app together:

```bash
npm run demo
```

Or start each service manually:

```bash
.runtime/llama/build/bin/llama-server -m ../models/grocery-list-v3-q8.gguf --port 8080 -ngl 99 -c 4096
.runtime/llama/build/bin/llama-server -m ../models/LFM2.5-1.2B-Instruct-Q4_K_M.gguf --port 8082 -ngl 99 -c 4096
```

Then start the app:

```bash
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Add `INSTACART_API_KEY` to `.env.local` to enable the final handoff.
