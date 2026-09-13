# Grocery shopping assistant

This project uses [LQH](https://lqh.ai/) to fine-tune **LFM2.5-1.2B-Instruct** with LoRA supervised fine-tuning (SFT). The model converts messy, conversational grocery requests into structured JSON containing products, quantities, and preferences.

The demos use that JSON to display a grocery list and, in the Kroger integration, find matching catalog products and add reviewed selections to a connected account's cart. Checkout stays with Kroger.

## LQH workflow and outputs

The repository root contains the task definition and artifacts produced during the LQH workflow:

- `SPEC.md` and `prompts/`: task requirements, prompts, and the JSON schema.
- `data_gen/` and `datasets/`: data-generation scripts and generated training/evaluation data.
- `evals/`, `runs/`, and `reports/`: grading rubrics, experiment configurations, training/evaluation outputs, and analysis.
- `NOTES.md`: progress notes and experiment decisions.
- [Sanitized LQH history](reports/lqh-history/): the original request, tuning conversations, tool calls, and results, with private details removed.

The local working folder also contains `models/` for GGUF model files and `.lqh/` for LQH session records. These are ignored by Git and are not included when cloning the repository.

## Demos

The `demos/` folder contains the different demos and versions built around the model.

- [demo_v1](demos/demo_v1/): the local web demo, with a **Model lab** for comparing the original and fine-tuned models, a **Kroger cart** integration, and an **About this app** page explaining the workflow.
