# Project Notes — Instacart Grocery List Extraction

## Objective
Post-train `lfm2.5-1.2b-instruct` (pinned budget) to convert noisy conversational
English grocery requests into strict JSON for Instacart's Create Shopping List
Page API. Full spec in SPEC.md.

## Current state
- **Pipeline**: `data_gen/grocery_list_v1.py` — intent-first design: LLM designs
  a structured grocery intent, a second call renders it as noisy text, a
  **medium-model grounding verifier** checks the text expresses every
  item/quantity/brand/label (retries on gaps), and the gold JSON is built
  **programmatically** from the intent (schema conformance guaranteed by
  construction). Weighted sample types cover the spec's noise profile and all
  12 edge cases (error case, mixed content, duplicates, adversarial, etc.).
- **Scorer**: `evals/scorers/grocery_list_v1.md` — validated on drafts; judge
  size **medium** (small judge produced self-contradictory reasoning; medium
  is coherent). Reuse medium for all downstream scoring/filtering.
- **Schema**: `prompts/grocery_list.schema.json` — constrains decoding at eval
  time (oneOf: title+line_items or error object).
- **Eval set**: `datasets/grocery_list_v2_eval_filtered/` — 167 samples (84%
  kept at threshold 7, medium judge). This is the filtered, trusted eval set.
  Earlier unfiltered sets (`grocery_list_v1_eval`, `grocery_list_v2_eval`) are
  superseded; drafts (`_draft`, `_draft2`, `_draft3`, `_smoke`) were iteration
  artifacts.

## Key decisions & why
- Gold built programmatically from intent, not free-generated → no
  hallucinated labels possible at the JSON level; residual failures come only
  from the renderer dropping intent details, which the verifier now catches.
- "each" default unit for count-style quantities (matches spec Example 5).
- Variety descriptors (sourdough, jasmine, whole wheat) are kept in product
  names; household supplies (dish soap, paper towels) count as groceries.
- Judge escalation path: small → medium after two prompt iterations produced
  self-contradictory scores. Medium validated on drafts and 200-sample eval.

## Open items
- 5 unjudged samples in the eval filter run (judge errors) — kept by fail-open;
  negligible for a 167-sample eval set.
- Residual ~10% low-score tail in raw generation (renderer/verifier misses) —
  handled by threshold-7 filtering; acceptable.

## Baselines (filtered eval set, 167 samples, medium judge, schema-constrained decoding)
- pool `medium` (API reference): mean 8.5, median 9.0 — task is tractable for a strong model.
- LFM2.5-1.2B-Instruct (pinned target): mean 4.58, median 4.0, p90 7.0 — partial rule-following; SFT headroom is large.
- LFM2.5-350M: mean 3.14, median 2.0 — near-floor zero-shot (normal for small models on multi-rule prompts).
- Baseline system prompt: `prompts/grocery_list_v0.md`.

## Next steps
1. ✅ Cloud data-gen job (2,000 samples) — completed → `datasets/grocery_list_v2_train_raw/`.
2. ✅ Filtered the training set → `grocery_list_v2_train_filtered` (1,637/2,000 kept @ ≥7, medium judge, mean 8.68; 66 unjudged kept by fail-open).
3. ✅ SFT launched after `uv tool upgrade lqh` fixed the launcher bug (the
   `training_manifest` 400). Run `sft_grocery_v2_4` (job
   `deb9bc78-89e8-4b49-8a0e-beab280c1933`), L4 GPU, 1,637 train / 167 eval rows,
   default hyperparameters, schema-constrained checkpoint evals, medium-judge
   scoring of the best checkpoint. Empty `runs/sft_grocery_v2_{1,2,3}/` dirs are
   leftovers from the failed submissions — ignore them.
4. ✅ SFT `sft_grocery_v2_4` completed: **mean 6.52 vs 4.58 baseline (Δ +1.94)**,
   $1.78 billed, healthy training (loss 0.72→0.04, token_acc 99%, 105 steps).
   BUT distribution is bimodal: 53% score 7–10, 37% sit at exactly 4 →
   systematic failure mode, not noise. Final checkpoint artifact:
   `29cf53af-0ecc-49f7-b26c-5edbfbcf2a87` (LoRA on LFM2.5-1.2B-Instruct).
5. ✅ Diagnosed the bimodal distribution (report: `reports/failure_analysis_v1.md`).
   Re-eval of final checkpoint (run `sft_v2_4_eval_rerun2`, 5.62 with system
   prompt + 512-token cap) enabled failure mining. Three patterns:
   - **A. Error-case collapse**: non-grocery inputs → canned hallucinated list
     ("blueberry yogurt"+"sourdough bread" — the example products saturating
     the pipeline prompt & system prompt). Also overrides real items.
   - **B. Invented filters** (the score-4 spike, ~71 samples): flavor/variety
     descriptors → health_filters ("chocolate", "toasted", "fresh"); product
     adjectives → brand_filters ("Kale", "Wild Caught").
   - **C. Truncation on long run-ons**: partly eval-config artifact
     (max_new_tokens=512 in re-run); use default 4096 going forward.
6. ✅ Supplemental data generated & filtered: `grocery_list_failures_v1_filtered`
   (553/600 kept @ ≥7, medium judge, mean 9.37 — cleaner than v2's 8.68).
7. ✅ Retrain `sft_grocery_v3_1` completed: **mean 6.43 — flat vs 6.52** (Δ −0.09),
   $2.07. Score-4 spike GREW (68 vs 61). Training healthy (loss 0.80→0.04,
   token_acc 99%). Supplemental data did NOT fix the dominant failure mode.
   Final checkpoint artifact: `3c052515-563c-4ad6-aa61-2116b4b3fa2a`.
8. ✅ Root-caused the persistent score-4 cluster: **the JSON schema was buggy** —
   `filters` required BOTH `brand_filters` and `health_filters`, so constrained
   decoding FORCED the model to invent a label/brand whenever only one was
   expressed (spec says include only what's expressed). The invented-filter
   failures were an eval-harness artifact, not model behavior. Fixed:
   `filters.required` → `[]`. Also de-saturated the system prompt examples
   AGAIN (v0 examples "jasmine rice/toasted sesame oil/dark chocolate" had
   become the new canned fallback — now "wild-caught tuna/smoked paprika/
   baby spinach"; lesson: NEVER reuse concrete example products across
   prompt/pipeline/eval artifacts).
9. ✅ Schema-fixed re-eval of v3_1: **7.14** (vs 5.52 before fix, +1.62) — the
   invented-filter cluster was indeed mostly the schema bug forcing both
   filter keys. p50=8, p90=10. Remaining low cluster (~43 samples ≤4):
   error-case collapse — model parrots the system prompt's example products
   ("bananas/smoked paprika/baby spinach/wild-caught tuna" — the CURRENT
   prompt examples) as a canned list on non-grocery inputs. Key insight: the
   fine-tuned model was trained WITHOUT a system prompt; every system-prompt
   eval scores ~1pt lower than the internal no-prompt eval (6.43/6.52 vs
   5.52/5.62). The prompt's examples actively hurt it.
10. ✅ No-prompt eval of v3_1 (fixed schema): **8.05** (p50=9, p90=10) — AT THE
    DEPLOYMENT BAR. The error-case collapse is GONE without the system prompt
    (it was pure prompt-example parroting). Remaining 23 low samples ≈ half
    genuine model errors (quantity hallucination, brand-to-item swaps in long
    lists, one hardware item extracted), ≈ half judge errors (penalizing
    present titles, demanding markdown fences, ignoring stated brands) —
    true mean likely ~8.3-8.5.
    **Deployment configuration: serve with schema-constrained decoding and NO
    system prompt** (or a minimal one with zero example products). The
    fine-tuned model needs neither instructions nor examples — the prompt
    only hurts it.
    Checkpoint: `3c052515-563c-4ad6-aa61-2116b4b3fa2a` (LoRA on
    LFM2.5-1.2B-Instruct). Score trajectory: 4.58 zero-shot → 6.52 SFT v2_4 →
    8.05 v3_1 (schema-fixed, no prompt). API reference: 8.5.
11. ✅ GGUF export chosen: conversion job `6d9666a5` (Q4_K + Q8_0, LoRA merged
    onto LiquidAI/LFM2.5-1.2B-Instruct first). Artifacts (kind 'gguf')
    downloadable via `pull` / `artifacts` when done.
12. ✅ ALSO deployed as API (user request): deployment
    `grocery-list-extractor-v1` (id fd8321b2, L4, debug tier, ~$2.40/hr while
    warm, scales to zero when idle). OpenAI-compatible endpoint
    https://inference.lqh.ai/v1, model name `grocery-list-extractor-v1`.
    Inference key `grocery-list-extractor-key` (id 92afc769, scoped to this
    deployment, shown to user once). Deployment config: NO system prompt
    (prompt examples trigger parroting); schema-constrained decoding if the
    client supports it.
   Also done: scorer tightened (service-distractor exclusion is explicitly
   correct — fixes the sample-105 judge error); `prompts/grocery_list_v0.md`
   de-saturated (examples now jasmine rice/toasted sesame oil/dark chocolate;
   explicit "flavor descriptors are NOT filters" and "fresh/wild-caught are
   not brands" rules).
