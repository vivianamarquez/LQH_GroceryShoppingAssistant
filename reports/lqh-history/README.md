# LQH tuning history

A sanitized snapshot of the saved LQH conversation: **367 events**, from 2026-09-10 to 2026-09-11. It preserves the original request, tool calls, results, failed attempts, and later corrections. Nothing has been committed or published automatically.

## Read the history

- [Task definition and data generation](01-task-and-data.md)
- [Baseline models and evaluations](02-baselines.md)
- [First SFT run and evaluation attempts](03-first-sft.md)
- [Failure mining and second SFT run](04-failure-mining-and-second-sft.md)
- [Schema fixes and prompt evaluations](05-schema-and-prompt-evaluations.md)
- [GGUF export and serving discussion](06-export-and-serving.md)

Tool calls and results are collapsed; expand them to inspect configurations, generated code, and evaluation output. Original sequence numbers and timestamps are retained. Automatic run notifications were stored with the user role by LQH; the readable chapters label them separately.

[Structured JSONL](messages.jsonl) contains the same events. [Redaction report](redaction-report.json) records counts and checks, without recording the removed values.

## What was sanitized

- Local usernames, home/repository paths, machine and account metadata, email addresses, credentials, and private URLs are replaced by labeled placeholders.
- Job/artifact/deployment identifiers and tool-call IDs use consistent aliases, so related events can still be followed.
- System messages, loaded internal instructions, context-summary payloads, and key-creation payloads are replaced by omission notices.
- Raw logs, project/session metadata, permission settings, lock files, checkpoints, snapshots, and environment files are **not exported**.

This is historical evidence, not a corrected technical guide: earlier claims, prompts, errors, and deployment attempts may have been superseded. Keep the relative run/dataset filenames to compare against the repository's other artifacts. Redacted snippets are for inspection, not replay.

## Refresh or verify

With the original local session available, run from the repository root using Node.js 22 or newer:

```bash
node scripts/export-lqh-history.mjs --check
node scripts/export-lqh-history.mjs
```

The second command regenerates these files from the saved session. The live `.lqh/` folder stays ignored and is never modified. The checks cover known values and common patterns, not every possible kind of sensitive information; review refreshed exports before publishing.
