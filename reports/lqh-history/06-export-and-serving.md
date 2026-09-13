# GGUF export and serving discussion

[History index](README.md) · Sanitized historical record, not current setup instructions.

<details>
<summary>345 · LQH · ask_user</summary>

### 345 · LQH

2026-09-10T21:43:39.835424+00:00

```text
## 🎯 We're at the deployment bar

**Score trajectory:**

| Configuration | Mean | Notes |
|---|---|---|
| Zero-shot baseline (1.2B, prompt) | 4.58 | |
| SFT v2_4 (internal eval) | 6.52 | schema bug depressing scores |
| v3_1 + system prompt + fixed schema | 7.14 | prompt examples being parroted |
| **v3_1, no system prompt, fixed schema** | **8.05** | p50=9, p90=10 |
| API reference (pool medium) | 8.5 | |

The fine-tuned 1.2B now nearly matches a strong API model on this task — at a fraction of the size. The remaining gap is roughly half judge noise (true mean likely ~8.3–8.5) and half long-run-on brand-assignment slips.

**Deployment configuration:** serve with schema-constrained decoding and **no system prompt** — the model learned the task from training; the prompt's example products only trigger parroting.
```

Tool: `ask_user` · `[call-167]`

```json
{
  "options": [
    "Deploy as API endpoint (push_to_production)",
    "Export GGUF for local/llama.cpp inference",
    "Keep improving (round 3: judge cleanup + long-run-on data)",
    "Deploy AND export GGUF"
  ],
  "question": "The model is at 8.05/10 (deployment bar met). What would you like to do?"
}
```

</details>

---

<details>
<summary>346 · Tool result</summary>

### 346 · Tool result

2026-09-10T21:56:16.197427+00:00

```text
Export GGUF for local/llama.cpp inference
```

Responds to `[call-167]`.

</details>

---

<details>
<summary>347 · LQH · gguf_convert</summary>

### 347 · LQH

2026-09-10T21:57:53.621744+00:00

```text
Exporting the checkpoint to GGUF. I'll produce two quantizations — **Q4_K** (fast, good quality) and **Q8_0** (near-lossless) — so you can pick per deployment target:
```

Tool: `gguf_convert` · `[call-168]`

```json
{
  "artifact_id": "[id-222]",
  "quant_types": [
    "Q4_K",
    "Q8_0"
  ]
}
```

</details>

---

<details>
<summary>348 · Tool result</summary>

### 348 · Tool result

2026-09-10T22:11:22.177025+00:00

```text
Error starting gguf conversion of lqh:[id-222]: gguf submit failed (400): {"error":{"code":400,"message":"adapter artifact needs a valid base model HF id (org/repo) to merge onto before GGUF conversion — none in lineage; pass base_model explicitly (e.g. \"LiquidAI/LFM2.5-1.2B-Instruct\")","type":"artifact_error"}}

```

Responds to `[call-168]`.

</details>

---

<details>
<summary>349 · LQH · gguf_convert</summary>

### 349 · LQH

2026-09-10T22:11:30.042912+00:00

Tool: `gguf_convert` · `[call-169]`

```json
{
  "artifact_id": "[id-222]",
  "base_model": "LiquidAI/LFM2.5-1.2B-Instruct",
  "quant_types": [
    "Q4_K",
    "Q8_0"
  ]
}
```

</details>

---

<details>
<summary>350 · Tool result</summary>

### 350 · Tool result

2026-09-10T22:11:32.951193+00:00

```text
🧱 Converting lqh:[id-222] → GGUF (Q4_K, Q8_0) via a CPU sandbox (job [id-226]). Each quant is converted from cloud storage directly and smoke-tested; the produced .gguf files register as new artifacts (kind 'gguf'). Check training_status for progress, then 'artifacts' (action=list) to download them.
```

Responds to `[call-169]`.

</details>

---

<details>
<summary>351 · LQH · edit_file</summary>

### 351 · LQH

2026-09-10T22:11:36.754273+00:00

Tool: `edit_file` · `[call-170]`

```json
{
  "new_string": "11. ✅ User chose GGUF export for local/llama.cpp inference. Conversion job\n    `[id-226]` (Q4_K + Q8_0, LoRA merged onto LiquidAI/LFM2.5-1.2B-Instruct\n    first). When done: artifacts (kind 'gguf') downloadable via `pull` /\n    `artifacts`. Deployment config reminder: schema-constrained decoding, NO\n    system prompt.",
  "old_string": "11. ⏭ Awaiting user decision: deploy as API (push_to_production +\n    create_inference_key), export GGUF for local inference, or keep improving\n    (round 3: judge-noise cleanup + long-run-on brand-assignment data).",
  "path": "NOTES.md"
}
```

</details>

---

<details>
<summary>352 · Tool result</summary>

### 352 · Tool result

2026-09-10T22:11:36.770503+00:00

```text
✅ Edited NOTES.md
```

Responds to `[call-170]`.

</details>

---

### 353 · LQH

2026-09-10T22:11:42.538510+00:00

```text
🧱 GGUF conversion running on a cloud sandbox — the LoRA adapter is being merged onto LFM2.5-1.2B-Instruct first, then quantized to both formats. Each file is smoke-tested before being registered. You'll get a notification when it completes; the `.gguf` artifacts will be downloadable from the artifacts store.

**For local use (Ollama / llama.cpp):**
- **Q4_K** (~0.8 GB) — fast, good quality; the usual pick for CPU inference
- **Q8_0** (~1.3 GB) — near-lossless; use if you have the RAM headroom

**Two deployment notes for when you serve it:**
1. **No system prompt** — the model learned the task from training; prompts with example products trigger parroting (that was the last failure mode).
2. If your serving stack supports JSON-schema-constrained decoding (llama.cpp grammars / Ollama `format`), apply `prompts/grocery_list.schema.json` — it guarantees valid JSON. The fixed version (filters keys optional) is in the project. Without grammar support the model still emits raw JSON reliably — it was trained on exactly that.
```

---

### 354 · User

2026-09-11T21:11:31.553331+00:00

```text
could we export the model via api
```

---

<details>
<summary>355 · LQH · push_to_production</summary>

### 355 · LQH

2026-09-11T21:11:39.931200+00:00

```text
Absolutely — deploying the same checkpoint as a live OpenAI-compatible API endpoint on LQH Cloud:
```

Tool: `push_to_production` · `[call-171]`

```json
{
  "artifact_id": "[id-222]",
  "base_model": "LiquidAI/LFM2.5-1.2B-Instruct",
  "name": "grocery-list-extractor-v1"
}
```

</details>

---

<details>
<summary>356 · Tool result</summary>

### 356 · Tool result

2026-09-11T21:11:40.117735+00:00

```text
🚀 Deployment created
  ID:       [id-227]
  Name:     grocery-list-extractor-v1
  Status:   deploying (LoRA checkpoints auto-merge first: pending → merging → deploying → running; full fine-tunes skip merging)
  Tier:     debug
  GPU:      1x L4
  Est. cost: $2.40/hr while running

Once status is 'running', the model is served OpenAI-compatible at:
  Endpoint: [private-url]
  Model:    grocery-list-extractor-v1

Authentication needs an inference key — create one with create_inference_key. Track progress with get_deployment.
```

Responds to `[call-171]`.

</details>

---

<details>
<summary>357 · LQH · create_inference_key</summary>

### 357 · LQH

2026-09-11T21:11:42.595887+00:00

```text
Deployment is spinning up (LoRA merge → deploy → running). Creating your API key now:
```

Tool: `create_inference_key` · `[call-172]`

```text
[Internal, private-state, or credential-related tool arguments omitted.]
```

</details>

---

<details>
<summary>358 · Tool result</summary>

### 358 · Tool result

2026-09-11T21:14:23.062340+00:00

```text
[Internal instructions, private local state, or credential-related tool output omitted.]
```

Responds to `[call-172]`.

</details>

---

<details>
<summary>359 · LQH · edit_file</summary>

### 359 · LQH

2026-09-11T21:14:27.900831+00:00

Tool: `edit_file` · `[call-173]`

```json
{
  "new_string": "11. ✅ GGUF export chosen: conversion job `[id-226]` (Q4_K + Q8_0, LoRA merged\n    onto LiquidAI/LFM2.5-1.2B-Instruct first). Artifacts (kind 'gguf')\n    downloadable via `pull` / `artifacts` when done.\n12. ✅ ALSO deployed as API (user request): deployment\n    `grocery-list-extractor-v1` (id [id-227], L4, debug tier, ~$2.40/hr while\n    warm, scales to zero when idle). OpenAI-compatible endpoint\n    [private-url], model name `grocery-list-extractor-v1`.\n    Inference key `grocery-list-extractor-key` (id [id-228], scoped to this\n    deployment, shown to user once). Deployment config: NO system prompt\n    (prompt examples trigger parroting); schema-constrained decoding if the\n    client supports it.",
  "old_string": "11. ✅ User chose GGUF export for local/llama.cpp inference. Conversion job\n    `[id-226]` (Q4_K + Q8_0, LoRA merged onto LiquidAI/LFM2.5-1.2B-Instruct\n    first). When done: artifacts (kind 'gguf') downloadable via `pull` /\n    `artifacts`. Deployment config reminder: schema-constrained decoding, NO\n    system prompt.",
  "path": "NOTES.md"
}
```

</details>

---

<details>
<summary>360 · Tool result</summary>

### 360 · Tool result

2026-09-11T21:14:27.916644+00:00

```text
✅ Edited NOTES.md
```

Responds to `[call-173]`.

</details>

---

### 361 · LQH

2026-09-11T21:14:33.960967+00:00

````text
🚀 **API deployment created** — you now have both export paths running:

| Path | Status | Details |
|---|---|---|
| **GGUF export** | Converting (job `[id-226]`) | Q4_K + Q8_0, downloadable when done |
| **API endpoint** | Deploying → running | `grocery-list-extractor-v1` @ `[private-url]` |

**Your API key** was shown once in the confirmation (prefix `[credential]`) — store it somewhere safe, it can't be retrieved again. It's scoped to just this deployment.

**Calling it** (OpenAI-compatible):

```python
from openai import OpenAI

client = OpenAI(base_url="[private-url]", api_key="[credential]")

resp = client.chat.completions.create(
    model="grocery-list-extractor-v1",
    messages=[{"role": "user", "content": "hey can u grab like 2 milks and a loaf of that good sourdough please"}],
)
print(resp.choices[0].message.content)
# {"title": "Grocery Run", "line_items": [{"product": "milk", ...}, ...]}
```

**Two serving notes:**
- **Don't send a system prompt** — the model was trained without one, and prompt examples trigger the parroting failure mode we just eliminated. Just the user message.
- The deployment is debug-tier: it **scales to zero when idle** (no GPU billing while unused, ~$2.40/hr while serving). First request after idle takes a few seconds to warm up.

I'll let you know when the GGUF files land. Anything else — or shall we call it a session? The full state is recorded in NOTES.md for next time.
````

---

### 362 · User

2026-09-11T21:47:57.434657+00:00

```text
can i get an api key for the base model as well?
```

---

### 363 · LQH

2026-09-11T21:48:10.977962+00:00

```text
Short answer: not on this endpoint, no. Here's the distinction:

**Inference keys only work for *deployments*** on `[private-url]` — models you've deployed from your own checkpoint artifacts. Your key (`grocery-list-extractor-key`) is scoped to `grocery-list-extractor-v1` because that's the only deployment serving there.

**The base model (LFM2.5-1.2B-Instruct) isn't deployed** — it's a HuggingFace checkpoint, not one of your artifacts, so there's nothing on the inference endpoint for a key to unlock. The deployment path (`push_to_production`) works from your trained checkpoints in the artifact store, not from upstream HF repos.

A couple of options depending on what you're after:

1. **If you want to compare base vs. fine-tuned behavior** — we already have that measured (4.58 zero-shot vs 8.05 fine-tuned on the same eval set), and I can run any additional side-by-side evals you'd like via `eval_hf_model` without deploying anything.
2. **If you want to *serve* the base model via API** — the practical route is pulling it from HuggingFace (`LiquidAI/LFM2.5-1.2B-Instruct`) and hosting it wherever you like (HF Inference Endpoints, your own GPU, etc.). It's a public checkpoint, so nothing stops you from serving it independently.
3. **If you just want a second key for the extractor** (e.g. separate dev/prod credentials) — that I can do right now, scoped to the same or future deployments.

What's the underlying goal — comparison, serving, or credential separation?
```

---

### 364 · User

2026-09-11T21:49:00.353582+00:00

```text
I want to create a web app where people can see the difference between the base and the finetuned model
```

---

### 365 · LQH

2026-09-11T21:49:24.580680+00:00

```text
Great demo idea — and the comparison is genuinely striking (4.58 vs 8.05 on the same inputs). Here's how I'd architect it:

## Recommended setup

**Fine-tuned model** — already served: `[private-url]`, model `grocery-list-extractor-v1`, your existing key. Call it with **no system prompt** (that's its trained configuration).

**Base model** — it's a public HuggingFace checkpoint (`LiquidAI/LFM2.5-1.2B-Instruct`), so your app backend has two good options:

1. **HF Inference Providers** (easiest) — OpenAI-compatible API with an `HF_TOKEN`; the backend calls it like any other endpoint. Worth a quick test that the model is served there before committing.
2. **Self-host both** (cheapest at scale, fully self-contained) — it's a 1.2B model: runs comfortably on CPU via Ollama/llama.cpp. Your fine-tuned GGUF (Q4_K/Q8_0) is converting right now, and the base model's GGUF is available from HuggingFace — so one local runtime could serve both sides of the demo.

## One critical detail for a *fair* comparison

Give the base model its best shot: it needs the system prompt (`prompts/grocery_list_v0.md`) to score even 4.58 — without it, it's near-floor and the demo looks rigged. So:

- **Base**: system prompt ✅ + user message
- **Fine-tuned**: user message only

That's the honest comparison, and the fine-tuned model still wins by ~3.5 points — while being *simpler to serve* (no prompt engineering needed). That's actually a nice narrative for the demo itself.

## What I can prepare for you

- 📋 A curated set of ~15 demo inputs from the eval distribution that showcase the contrast: an error case (weather question), a filters case, a long run-on, a mixed-content request — each with the reference gold JSON so the app can show three columns (base / fine-tuned / expected)
- 🔑 A second inference key if you want separate credentials for the app vs. your own testing
- 📦 The GGUF download links once conversion finishes

Want me to put together the demo input set? And which base-model hosting route do you lean toward — HF Inference Providers or self-hosted?
```

---

### 366 · User

2026-09-11T21:50:12.236559+00:00

```text
i want the same thing you gave me for the finetuned model, but for the base one
```

---

### 367 · LQH

2026-09-11T21:50:28.706199+00:00

````text
I have to be straight with you: I can't give the base model the exact same setup. The managed endpoint (`inference.lqh.ai`) deploys **your checkpoint artifacts** from the project's artifact store — your fine-tuned LoRA is there, but the base model is an upstream HuggingFace checkpoint, and there's no path for me to deploy someone else's repo onto your endpoint. That's a real limitation of the deployment tooling, not a config choice.

The two ways to get an OpenAI-compatible API for the base model — both with client code *identical in shape* to what you have for the fine-tuned one:

**Option A — HF Inference Providers** (closest to "same thing"):
```python
from openai import OpenAI

client = OpenAI(
    base_url="[private-url]",
    api_key="<HF_TOKEN>",
)
resp = client.chat.completions.create(
    model="LiquidAI/LFM2.5-1.2B-Instruct",
    messages=[{"role": "system", "content": SYSTEM_PROMPT},
              {"role": "user", "content": user_input}],
)
```
Same `chat.completions.create` call as your extractor — your web app just swaps `base_url`, `api_key`, `model`, and adds the system prompt for the base side. I'd want to verify the model is actually served there before you build on it.

**Option B — self-host the base with Ollama** (free, fully local):
```bash
ollama pull hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF
ollama serve   # OpenAI-compatible at http://localhost:11434/v1
```
And since your fine-tuned GGUF is converting right now, you could serve *both* sides of the demo from one local Ollama instance — zero API cost, no rate limits, works offline for demos.

For a public web app where visitors hit it, Option A is more practical (no server of yours needed for the base side). For an internal/local demo, Option B is cleaner.

Want me to check whether the base model is available through HF Inference Providers, or would you rather go the Ollama route once your GGUF lands?
````

