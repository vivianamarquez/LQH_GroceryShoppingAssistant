# Failure Analysis v1 — sft_grocery_v2_4

## Why this analysis was run
First SFT run on the pinned LFM2.5-1.2B-Instruct: **mean 6.52 vs 4.58 zero-shot
baseline (Δ +1.94)** on `grocery_list_v2_eval_filtered` (167 samples, judge
medium, schema-constrained decoding). Training healthy (loss 0.72→0.04,
token_acc 99%, 105 steps, $1.78). But the distribution is bimodal:
53% of samples score 7–10 while ~37% sit at exactly 4 — a systematic failure
signature, not noise.

A re-eval of the final checkpoint (artifact `29cf53af`, run
`sft_v2_4_eval_rerun2`, system prompt v0 + schema constraint, max_new_tokens=512)
scored 5.62 and reproduced the bimodal shape (p50=4, p90=9), enabling per-sample
failure mining.

## Setup
- Probe: the filtered eval set itself (per-sample results were unpublished for
  the cloud training run, so the checkpoint was re-evaluated to produce
  results.parquet). NOTE for next round: use a fresh `_probe` set per the skill.
- Checkpoint: sft_grocery_v2_4 final (LoRA on LFM2.5-1.2B-Instruct).
- Judge: medium, scorer `evals/scorers/grocery_list_v1.md`.

## Patterns found

### Pattern A — error-case collapse (scores 1–2, ~20+ samples)
Non-grocery inputs (weather, traffic, sports scores, "just kidding about the
groceries") return a **canned hallucinated list** — almost always
`blueberry yogurt` + `sourdough bread` — instead of
`{"error": "not_a_grocery_request"}`.
- Samples 52, 65, 83, 84, 86, 88, 144, 163, 55.
- The canned list also **overrides real items** on genuine grocery requests
  (samples 13, 16, 28): the model emits the memorized pair and drops the
  actual items.
- Root cause: those two products are the *example products* in the pipeline's
  intent prompt and in `prompts/grocery_list_v0.md` — the training data is
  saturated with them, and error_case was only 7% of the sample-type mix
  (~114 of 1,637 kept rows), too thin to beat the prior toward "always emit a
  list".

### Pattern B — invented filters (the score-4 spike, ~71 samples)
The model invents `health_filters` from flavor/variety descriptors
("chocolate", "chocolate sandwich", "toasted", "salted", "fresh", "black tea",
"tea", "diet", "soda", "ketchup") and `brand_filters` from product adjectives
("Kale", "Fresh", "Milk", "Wild Caught", "Salted Egg", "brown onions",
"High-Protein", "Gluten-Free").
- Samples 79, 63, 158, 77, 159, 111, 71, 126, 40.
- The model learned "filters appear often" (brand_health was 18% of training)
  but not the boundary: **dietary terms only** (organic, gluten-free, vegan,
  keto, low-sodium, dairy-free...) and **canonical brand names only**.
- Flavor/variety descriptors belong in `product`, adjectives that aren't
  brands belong nowhere.

### Pattern C — truncation on long run-ons (samples 112, 138, 30)
Output cut mid-JSON on 10-item run-on inputs. **Largely an eval-config
artifact**: the re-run used max_new_tokens=512; the training run's internal
eval (no such cap) scored these fine. Fix: use the default 4096 tokens in all
future evals. Residual risk remains for very long lists — cover in data.

### Pattern D — judge error (1 sample)
Sample 105: the model correctly *ignored* "dry cleaning" (mixed content) but
the judge capped the score for "failing to extract the non-grocery request as
a separate item" — contradicting SPEC.md requirement 7. Scorer wording should
be tightened so mixed-content non-grocery items are explicitly praised for
being excluded.

## Planned remediation
1. **Targeted supplemental dataset** (`grocery_list_failures_v1`, purpose
   "failures", ~600 samples) via a new pipeline covering:
   - error_case at high weight with DIVERSE non-grocery topics (weather,
     traffic, sports, jokes/retractions, bills, small talk) — teach the error
     object, break the canned-list prior;
   - flavor/variety descriptor items with NO filters (chocolate, toasted,
     salted, fresh, wild-caught, black tea...) — teach the filter boundary;
   - mixed content with service-like distractors (dry cleaning, library
     books, craft supplies) that must be excluded;
   - long run-ons (8–10 items) for truncation robustness;
   - NO use of "blueberry yogurt"/"sourdough bread" as example products
     anywhere in the prompts (de-saturate the prior).
2. **Retrain** multi-source: `grocery_list_v2_train_filtered` (repeat 1) +
   `grocery_list_failures_v1_filtered` (repeat 2), same base/defaults.
3. **Re-eval** with default max_new_tokens (4096), same eval set, compare vs
   6.52 / 4.58 / 8.5.
4. Minor: tighten scorer wording on mixed-content exclusion (Pattern D);
   consider de-saturating `prompts/grocery_list_v0.md` examples too.

## Expected effect
Patterns A and B are direct coverage gaps — supplemental data should convert
most of the 1–2 and 4 clusters into 7–10. If the mean reaches ~8, deployment
bar is met.
