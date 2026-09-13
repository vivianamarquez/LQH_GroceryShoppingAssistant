import { generationOptions, maxInputLength, parseResult } from '@/lib/inference';
import { setTimeout as delay } from 'node:timers/promises';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    typeof body?.text !== 'string' || !body.text.trim() ||
    body.text.length > maxInputLength || (body.model ?? 'tuned') !== 'tuned'
  ) {
    return Response.json(
      { error: `Enter a grocery request of up to ${maxInputLength} characters. The base model runs in your browser.` },
      { status: 400 },
    );
  }

  const key = process.env.LQH_INFERENCE_API_KEY;
  const model = process.env.LQH_DEPLOYMENT_NAME;
  if (!key || !model) {
    return Response.json(
      { error: 'The hosted model is not configured. Set LQH_INFERENCE_API_KEY and LQH_DEPLOYMENT_NAME on the server.' },
      { status: 503 },
    );
  }

  if (!/^[\x21-\x7e]+$/.test(key)) {
    return Response.json({ error: 'The LQH inference key contains whitespace or non-ASCII characters. Copy the original key into LQH_INFERENCE_API_KEY.' }, { status: 503 });
  }

  const started = Date.now();
  const deploymentName = model.trim();
  const timeout = AbortSignal.timeout(270_000);
  const disconnected = new AbortController();
  const signal = AbortSignal.any([request.signal, timeout, disconnected.signal]);
  let stage = 'connection';
  let upstreamStatus: number | undefined;
  function failure(code: string, error: string, status = 502) {
    // Do not log prompts, keys, raw provider bodies, or exception messages.
    console.warn('LQH inference failed', { code, stage, upstreamStatus, elapsedMs: Date.now() - started });
    return Response.json({ error, code }, { status });
  }

  async function run(onRetry: () => void = () => {}) {
    try {
      signal.throwIfAborted();
      const options: RequestInit = {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...generationOptions,
          model: deploymentName,
          messages: [{ role: 'user', content: body.text.trim() }],
        }),
        cache: 'no-store',
        signal,
      };
      let response = await fetch('https://inference.lqh.ai/v1/chat/completions', options);
      // At most two inference attempts share one deadline. Never retry cart writes.
      if ([502, 503, 504, 524].includes(response.status)) {
        upstreamStatus = response.status;
        await response.body?.cancel();
        signal.throwIfAborted();
        onRetry();
        await delay(2000, undefined, { signal });
        response = await fetch('https://inference.lqh.ai/v1/chat/completions', options);
      }
      upstreamStatus = response.status;
      if (!response.ok) {
        const messages: Record<number, string> = {
          401: 'LQH returned 401: the inference key was rejected. Check LQH_INFERENCE_API_KEY.',
          403: 'LQH returned 403: this inference key does not have access to the deployment.',
          404: 'LQH returned 404: the deployment was not found. LQH_DEPLOYMENT_NAME must be the deployment name, not the key name.',
          400: 'LQH returned 400: the deployment rejected the request. Check its support for JSON-schema structured output.',
          429: 'LQH is rate-limiting requests. Wait a moment before trying again.',
          502: 'LQH’s gateway could not reach the model after a retry. Check the deployment status in LQH.',
          503: 'LQH is still unavailable after a retry. The model may be starting; check its deployment status in LQH.',
          504: 'LQH’s gateway timed out after a retry. Check the deployment status in LQH.',
          524: 'LQH’s gateway timed out again. Your request is still here; try again when you’re ready.',
        };
        await response.body?.cancel();
        return failure(`lqh_http_${response.status}`, messages[response.status] ?? `LQH returned HTTP ${response.status}. Check the deployment in LQH.`);
      }
      stage = 'response';
      const data = await response.json();
      const choice = data?.choices?.[0];
      if (choice?.finish_reason === 'length') {
        return failure('output_truncated', 'LQH reached the output-token limit before finishing the JSON. Try fewer grocery items.');
      }
      if (typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) {
        return failure('empty_output', 'LQH responded but returned no model text. Check the deployment in LQH.');
      }
      stage = 'validation';
      return Response.json({ result: parseResult(choice?.message?.content) });
    } catch (error) {
      if (request.signal.aborted || disconnected.signal.aborted) return failure('cancelled', 'Request cancelled.', 499);
      if (timeout.aborted) return failure('timeout', 'LQH did not finish within 4½ minutes. Your request is still here; you can try again.', 504);
      if (error instanceof SyntaxError) return failure('invalid_json', `LQH returned invalid JSON in its ${stage === 'validation' ? 'model output' : 'API response'}. This is not a request-length error.`);
      if (stage === 'validation') return failure('schema_mismatch', 'LQH returned JSON that does not match the grocery schema. Check structured-output support on the deployment.');
      return failure('connection_failed', 'The connection to LQH failed before the response completed. Check your connection and the LQH deployment, then retry.');
    }
  }

  // The UI opts into progress events; other callers still receive ordinary JSON.
  if (!request.headers.get('accept')?.includes('application/x-ndjson')) return run();
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        if (!disconnected.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      send({ type: 'started' });
      const response = await run(() => send({
        type: 'progress', message: 'No response yet. Retrying once…',
      }));
      send({ type: response.ok ? 'result' : 'error', ...await response.json() });
      if (!disconnected.signal.aborted) controller.close();
    },
    cancel() { disconnected.abort(); },
  }), {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
