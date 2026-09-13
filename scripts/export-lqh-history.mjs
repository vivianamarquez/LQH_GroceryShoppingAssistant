// Creates a reviewable snapshot; never changes .lqh or Git's index.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'reports/lqh-history');
const project = JSON.parse(fs.readFileSync(path.join(root, '.lqh/project.json'), 'utf8'));
const privateValues = new Map();
const counts = {};
const identifiers = new Map();
const credentialField = /^(?:api[_-]?key|client[_-]?(?:secret|id)|access[_-]?token|refresh[_-]?token|password|authorization|secret|account[_-]?key)$/i;

function remember(value, replacement) {
  if (typeof value === 'string' && value.length >= 6) privateValues.set(value, replacement);
}
for (const file of ['.env', 'demos/demo_v1/.env.local']) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(full, 'utf8')))) {
    if (/token|secret|password|api[_-]?key|client[_-]?id/i.test(key)) remember(value, '[credential]');
  }
}
remember(project.last_seen_hostname, '[machine]');
remember(project.pipeline_readiness?.account_key, '[account]');
remember(path.basename(os.homedir()), '[user]');
remember(root, '[repo]');
remember(os.homedir(), '[home]');
const replacements = [...privateValues].sort(([a], [b]) => b.length - a.length);
const omittedTools = new Set(['load_skill', 'summary', 'create_inference_key']);
const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const urls = /https?:\/\/[^\s"'<>`\\]+/gi;
const tokens = /\b(?:hf_[A-Za-z0-9]{20,}|lqh_(?:inf|key|sk)_[A-Za-z0-9_-]{12,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g;

function replace(text, pattern, label, replacement) {
  return text.replace(pattern, (...args) => {
    counts[label] = (counts[label] ?? 0) + 1;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
}
function alias(value, kind = 'id') {
  if (!identifiers.has(value)) identifiers.set(value, `[${kind}-${String(identifiers.size + 1).padStart(3, '0')}]`);
  return identifiers.get(value);
}
function publicUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash) return false;
    if (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) return true;
    if (url.protocol !== 'https:') return false;
    return (url.hostname === 'huggingface.co' && url.pathname.startsWith('/LiquidAI/')) ||
      url.hostname === 'docs.instacart.com' ||
      (url.hostname === 'lqh.ai' && (url.pathname === '/' || url.pathname.startsWith('/docs/'))) ||
      (url.hostname === 'github.com' && /^\/(LiquidAI|ggml-org|ggerganov)\//.test(url.pathname));
  } catch { return false; }
}

function sanitize(text) {
  for (const [value, replacement] of replacements) {
    for (const variant of new Set([value, encodeURIComponent(value), JSON.stringify(value).slice(1, -1)])) {
      const parts = text.split(variant);
      if (parts.length > 1) {
        counts.known_private_values = (counts.known_private_values ?? 0) + parts.length - 1;
        text = parts.join(replacement);
      }
    }
  }
  text = replace(text, /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g, 'private_keys', '[private key omitted]');
  text = replace(text, urls, 'urls_checked', (raw) => {
    const tail = raw.match(/[).,;]+$/)?.[0] ?? '';
    const url = tail ? raw.slice(0, -tail.length) : raw;
    if (publicUrl(url)) return raw;
    counts.private_urls = (counts.private_urls ?? 0) + 1;
    return '[private-url]' + tail;
  });
  text = replace(text, /\/(?:Users|home)\/[^\s/"'<>\\]+/g, 'home_paths', '[home]');
  text = replace(text, /(?:\/private)?\/var\/folders\/[^\s"'<>\\]+/g, 'temporary_paths', '[temp-path]');
  text = replace(text, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, 'emails', '[email]');
  text = replace(text, uuid, 'identifiers', (value) => alias(value.toLowerCase()));
  for (const [value, replacement] of identifiers) text = text.replaceAll(value, replacement);
  text = replace(text, tokens, 'tokens', '[credential]');
  text = replace(text, /\blqh_inf_[A-Za-z0-9_.…-]+/g, 'credential_prefixes', '[credential]');
  text = replace(text, /\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/-]{12,}={0,2}/gi, 'authorization', (_match, scheme) => `${scheme} [credential]`);
  text = replace(text, /((?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password|secret)\s*["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+\/-]{12,}/gi, 'credential_assignments', (_match, prefix) => `${prefix}[credential]`);
  text = replace(text, /\b(?:[a-f0-9]{32,}|[A-Za-z0-9]{40,}|(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[0-9])[A-Za-z0-9_-]{40,})\b/g, 'opaque_values', '[opaque-value]');
  return text;
}
function clean(value, key = '') {
  if (credentialField.test(key)) {
    counts.credential_fields = (counts.credential_fields ?? 0) + 1;
    return '[credential]';
  }
  if (typeof value === 'string') {
    // Tool arguments/results sometimes contain another JSON document as a string.
    if (/^\s*[\[{]/.test(value)) {
      try { return JSON.stringify(clean(JSON.parse(value))); } catch { /* Plain prose. */ }
    }
    return sanitize(value);
  }
  if (Array.isArray(value)) return value.map((item) => clean(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [sanitize(key), clean(item, key)]));
  return value;
}
function verify(text) {
  for (const [value] of replacements) {
    for (const variant of new Set([value, encodeURIComponent(value), JSON.stringify(value).slice(1, -1)])) {
      assert.ok(!text.includes(variant), 'Export contains a known private value.');
    }
  }
  assert.ok(!new RegExp(uuid).test(text), 'Export contains a raw identifier.');
  assert.ok(!new RegExp(tokens).test(text), 'Export contains a token pattern.');
  assert.ok(!/\blqh_inf_/.test(text), 'Export contains an inference-key prefix.');
  assert.ok(!/X-Amz-(?:Signature|Credential)|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i.test(text), 'Export contains signing/key material.');
  assert.ok(!/\/(?:Users|home)\/[^\s/]+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text), 'Export contains personal metadata.');
  for (const [raw] of text.matchAll(urls)) assert.ok(publicUrl(raw.replace(/[).,;]+$/, '')), 'Export contains an unapproved URL.');
}
function fence(value) {
  let language = 'text';
  try { value = JSON.stringify(JSON.parse(value), null, 2); language = 'json'; } catch { /* Plain prose. */ }
  const ticks = '`'.repeat(Math.max(3, ...[...value.matchAll(/`+/g)].map(([run]) => run.length + 1)));
  return `${ticks}${language}\n${value}\n${ticks}`;
}
function render(event) {
  const { msg, seq, ts } = event;
  const label = msg.role === 'user' && msg.content?.startsWith('[System:') ? 'LQH run notification' : ({ user: 'User', assistant: 'LQH', tool: 'Tool result', system: 'Internal event' })[msg.role] ?? msg.role;
  const parts = [`### ${seq} · ${label}`, '', ts, ''];
  if (msg.content) parts.push(fence(msg.content), '');
  for (const call of msg.tool_calls ?? []) parts.push(`Tool: \`${call.function.name}\` · \`${call.id}\``, '', fence(call.function.arguments), '');
  if (msg.tool_call_id) parts.push(`Responds to \`${msg.tool_call_id}\`.`, '');
  const result = parts.join('\n');
  return msg.role === 'tool' || msg.tool_calls?.length
    ? `<details>\n<summary>${seq} · ${label}${msg.tool_calls ? ' · ' + msg.tool_calls.map((call) => call.function.name).join(', ') : ''}</summary>\n\n${result}\n</details>\n`
    : result;
}

if (process.argv.includes('--self-test')) {
  const token = 'hf_' + 'a'.repeat(24);
  const id = ['12345678', '1234', '4321', '1234', '123456789abc'].join('-');
  const input = {
    api_key: 'example-secret',
    nested: JSON.stringify({ client_secret: 'another-example-secret' }),
    text: `${token} lqh_inf_sample… Bearer ${'b'.repeat(24)} password=${'c'.repeat(24)} ${id} ${id} /home/example/file test@example.com`,
    url: 'https://storage.example/file?X-Amz-Signature=example',
    public: 'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct',
    run: 'data_gen_grocery_list_failures_v1_raw_20260910_195856_e4754e',
  };
  const result = clean(input);
  assert.equal(result.api_key, '[credential]');
  assert.equal(JSON.parse(result.nested).client_secret, '[credential]');
  assert.equal(result.url, '[private-url]');
  assert.equal(result.public, input.public);
  assert.equal(result.run, input.run);
  assert.ok(result.text.includes('Bearer [credential] password=[credential]'));
  assert.equal(result.text.split(alias(id)).length - 1, 2);
  verify(JSON.stringify(result));
  for (const [value] of replacements) assert.ok(!sanitize(`${value} ${value}`).includes(value));
  console.log('Sanitizer self-tests passed.');
} else if (process.argv.includes('--check')) {
  const files = fs.readdirSync(output).filter((file) => /\.(md|jsonl|json)$/.test(file));
  assert.ok(files.length, 'No exported files found.');
  for (const file of files) verify(fs.readFileSync(path.join(output, file), 'utf8'));
  console.log(`Privacy checks passed for ${files.length} exported files.`);
} else {
  const conversations = fs.readdirSync(path.join(root, '.lqh/conversations'));
  assert.equal(conversations.length, 1, 'Expected one conversation; select the intended session before exporting.');
  const source = path.join(root, '.lqh/conversations', conversations[0], 'messages.jsonl');
  const raw = fs.readFileSync(source, 'utf8');
  const rows = raw.trim().split('\n').map((line) => JSON.parse(line));
  const toolNames = new Map();
  const privateFileCalls = new Set();
  for (const row of rows) for (const call of row.msg.tool_calls ?? []) {
    toolNames.set(call.id, call.function.name);
    alias(call.id, 'call');
    if (['read_file', 'list_files'].includes(call.function.name) && /\.lqh|\.env/.test(call.function.arguments)) privateFileCalls.add(call.id);
  }
  for (const [value] of raw.matchAll(uuid)) alias(value.toLowerCase());
  const fullIds = [...identifiers].filter(([value]) => new RegExp(uuid).test(value));
  for (const [value, replacement] of fullIds) {
    const short = value.slice(0, 8);
    if (fullIds.filter(([other]) => other.startsWith(short)).length === 1) identifiers.set(short, replacement);
  }
  let omitted = 0;
  const events = rows.map(({ seq, ts, msg: original }) => {
    const msg = structuredClone(original);
    if (msg.role === 'system' || omittedTools.has(toolNames.get(msg.tool_call_id)) || privateFileCalls.has(msg.tool_call_id)) {
      msg.content = '[Internal instructions, private local state, or credential-related tool output omitted.]';
      omitted++;
    }
    for (const call of msg.tool_calls ?? []) if (omittedTools.has(call.function.name) || privateFileCalls.has(call.id)) {
      call.function.arguments = '[Internal, private-state, or credential-related tool arguments omitted.]';
      omitted++;
    }
    return { seq, ts, msg: clean(msg) };
  });
  const chapters = [
    [150, '01-task-and-data', 'Task definition and data generation'],
    [182, '02-baselines', 'Baseline models and evaluations'],
    [260, '03-first-sft', 'First SFT run and evaluation attempts'],
    [304, '04-failure-mining-and-second-sft', 'Failure mining and second SFT run'],
    [344, '05-schema-and-prompt-evaluations', 'Schema fixes and prompt evaluations'],
    [Infinity, '06-export-and-serving', 'GGUF export and serving discussion'],
  ];
  const files = new Map();
  let previous = 0;
  for (const [last, name, title] of chapters) {
    const selected = events.filter(({ seq }) => seq > previous && seq <= last);
    files.set(`${name}.md`, `# ${title}\n\n[History index](README.md) · Sanitized historical record, not current setup instructions.\n\n${selected.map(render).join('\n---\n\n')}\n`);
    previous = last;
  }
  files.set('messages.jsonl', events.map((event) => JSON.stringify(event)).join('\n') + '\n');
  const report = { format_version: 1, source_events: rows.length, exported_events: events.length, first_event: events[0].ts, last_event: events.at(-1).ts, omitted_payloads: omitted, tool_call_aliases: toolNames.size, identifier_aliases: fullIds.length, redactions: counts, validation: 'Known private values, token patterns, identifiers, signing parameters, personal paths, email addresses, and non-allowlisted URLs checked before writing.' };
  files.set('redaction-report.json', JSON.stringify(report, null, 2) + '\n');
  files.set('README.md', `# LQH tuning history\n\nA sanitized snapshot of the saved LQH conversation: **${events.length} events**, from ${events[0].ts.slice(0, 10)} to ${events.at(-1).ts.slice(0, 10)}. It preserves the original request, tool calls, results, failed attempts, and later corrections. Nothing has been committed or published automatically.\n\n## Read the history\n\n${chapters.map(([, name, title]) => `- [${title}](${name}.md)`).join('\n')}\n\nTool calls and results are collapsed; expand them to inspect configurations, generated code, and evaluation output. Original sequence numbers and timestamps are retained. Automatic run notifications were stored with the user role by LQH; the readable chapters label them separately.\n\n[Structured JSONL](messages.jsonl) contains the same events. [Redaction report](redaction-report.json) records counts and checks, without recording the removed values.\n\n## What was sanitized\n\n- Local usernames, home/repository paths, machine and account metadata, email addresses, credentials, and private URLs are replaced by labeled placeholders.\n- Job/artifact/deployment identifiers and tool-call IDs use consistent aliases, so related events can still be followed.\n- System messages, loaded internal instructions, context-summary payloads, and key-creation payloads are replaced by omission notices.\n- Raw logs, project/session metadata, permission settings, lock files, checkpoints, snapshots, and environment files are **not exported**.\n\nThis is historical evidence, not a corrected technical guide: earlier claims, prompts, errors, and deployment attempts may have been superseded. Keep the relative run/dataset filenames to compare against the repository's other artifacts. Redacted snippets are for inspection, not replay.\n\n## Refresh or verify\n\nWith the original local session available, run from the repository root using Node.js 22 or newer:\n\n\`\`\`bash\nnode scripts/export-lqh-history.mjs --check\nnode scripts/export-lqh-history.mjs\n\`\`\`\n\nThe second command regenerates these files from the saved session. The live \`.lqh/\` folder stays ignored and is never modified. The checks cover known values and common patterns, not every possible kind of sensitive information; review refreshed exports before publishing.\n`);
  for (const text of files.values()) verify(text);
  assert.equal(createHash('sha256').update(fs.readFileSync(source)).digest('hex'), createHash('sha256').update(raw).digest('hex'), 'The source changed during export; retry with a stable session.');
  fs.mkdirSync(output, { recursive: true });
  for (const [name, text] of files) fs.writeFileSync(path.join(output, name), text);
  console.log(JSON.stringify({ exported_events: events.length, files: files.size, omitted_payloads: omitted, redactions: counts, source_unchanged: true }, null, 2));
}
