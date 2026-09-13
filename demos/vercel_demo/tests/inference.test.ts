import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { POST } from '../app/api/infer/route';
import { parseResult } from '../lib/inference';

const oldKey = process.env.LQH_INFERENCE_API_KEY;
const oldModel = process.env.LQH_DEPLOYMENT_NAME;
beforeEach(() => mock.method(console, 'warn', () => {}));
afterEach(() => {
  mock.restoreAll();
  if (oldKey === undefined) delete process.env.LQH_INFERENCE_API_KEY;
  else process.env.LQH_INFERENCE_API_KEY = oldKey;
  if (oldModel === undefined) delete process.env.LQH_DEPLOYMENT_NAME;
  else process.env.LQH_DEPLOYMENT_NAME = oldModel;
});

function request(body: unknown) {
  return new Request('http://localhost:3000/api/infer', {
    method: 'POST', body: JSON.stringify(body),
  });
}

function configure() {
  process.env.LQH_INFERENCE_API_KEY = 'test-key';
  process.env.LQH_DEPLOYMENT_NAME = 'test-deployment';
}

test('invalid input and base requests never call the hosted model', async () => {
  mock.method(globalThis, 'fetch', () => assert.fail('Unexpected network call'));
  for (const body of [null, {}, { text: 3 }, { text: ' ' }, { text: 'a'.repeat(3001) }, { text: 'milk', model: 'base' }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
});

test('missing credentials produce a useful setup error', async () => {
  delete process.env.LQH_INFERENCE_API_KEY;
  delete process.env.LQH_DEPLOYMENT_NAME;
  mock.method(globalThis, 'fetch', () => assert.fail('Unexpected network call'));
  const response = await POST(request({ text: 'milk' }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /LQH_DEPLOYMENT_NAME/);
});

test('the deployment name, private bearer key, schema and no-system-prompt are preserved', async () => {
  configure();
  const result = { title: 'Groceries', line_items: [{ product: 'milk' }] };
  mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://inference.lqh.ai/v1/chat/completions');
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer test-key');
    const body = JSON.parse(init.body as string);
    assert.equal(body.model, 'test-deployment');
    assert.deepEqual(body.messages, [{ role: 'user', content: 'milk' }]);
    assert.equal(body.temperature, 0);
    assert.equal(body.max_tokens, 1024);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.ok(init.signal);
    return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
  });
  assert.deepEqual(await (await POST(request({ text: 'milk', model: 'tuned' }))).json(), { result });
});

test('upstream errors do not expose credentials or upstream response bodies', async () => {
  configure();
  mock.method(globalThis, 'fetch', async () => new Response('private diagnostic test-key', { status: 401 }));
  const response = await POST(request({ text: 'milk' }));
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.match(body, /401/);
  assert.doesNotMatch(body, /test-key|private diagnostic/);
});

test('malformed, schema-invalid, and truncated outputs are rejected', async () => {
  configure();
  for (const [content, finish_reason] of [['not json', 'stop'], ['{}', 'stop'], ['{"error":"not_a_grocery_request"}', 'length']]) {
    const fetcher = mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content }, finish_reason }] }));
    assert.equal((await POST(request({ text: 'milk' }))).status, 502);
    fetcher.mock.restore();
  }
});

test('schema keeps optional filters optional and supports the failure mode', () => {
  const failure = { error: 'not_a_grocery_request' };
  assert.deepEqual(parseResult(JSON.stringify(failure)), failure);
  assert.doesNotThrow(() => parseResult('{"title":"List","line_items":[{"product":"milk"}]}'));
  for (const invalid of [null, '{}', '{"title":"List","line_items":[{"product":42}]}']) {
    assert.throws(() => parseResult(invalid));
  }
});

test('badly copied keys fail locally without disclosing the key', async () => {
  configure();
  mock.method(globalThis, 'fetch', () => assert.fail('Unexpected network call'));
  for (const key of ['secret with spaces', 'secret\u0410']) {
    process.env.LQH_INFERENCE_API_KEY = key;
    const response = await POST(request({ text: 'milk' }));
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes(key));
  }
});

test('a temporary gateway failure retries once with the same overall deadline', async () => {
  configure();
  const signals: unknown[] = [];
  const fetcher = mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    signals.push(init.signal);
    if (signals.length === 1) return new Response(null, { status: 503 });
    return Response.json({ choices: [{ message: { content: '{"error":"not_a_grocery_request"}' } }] });
  });
  assert.equal((await POST(request({ text: 'weather' }))).status, 200);
  assert.equal(fetcher.mock.callCount(), 2);
  assert.equal(signals[0], signals[1]);
});

test('persistent gateway failure stops after two attempts; auth and model errors do not retry', async () => {
  configure();
  for (const status of [401, 403, 404, 400, 429, 503]) {
    const fetcher = mock.method(globalThis, 'fetch', async () => new Response('private test-key', { status }));
    const response = await POST(request({ text: 'milk' }));
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.code, `lqh_http_${status}`);
    assert.doesNotMatch(body.error, /private|test-key/);
    assert.equal(fetcher.mock.callCount(), status === 503 ? 2 : 1);
    fetcher.mock.restore();
  }
});

test('timeout, client cancellation and network failure are different errors', async () => {
  configure();
  const deadline = new AbortController();
  const timer = mock.method(AbortSignal, 'timeout', (ms: number) => {
    assert.equal(ms, 270_000);
    return deadline.signal;
  });
  const fetcher = mock.method(globalThis, 'fetch', async () => {
    deadline.abort(new DOMException('Timeout', 'TimeoutError'));
    deadline.signal.throwIfAborted();
  });
  let response = await POST(request({ text: 'milk' }));
  assert.equal(response.status, 504);
  assert.equal((await response.json()).code, 'timeout');
  timer.mock.restore();
  fetcher.mock.restore();

  const controller = new AbortController();
  const aborted = new Request(request({ text: 'milk' }), { signal: controller.signal });
  controller.abort();
  const noFetch = mock.method(globalThis, 'fetch', () => assert.fail('Cancelled requests must not fetch'));
  response = await POST(aborted);
  assert.equal(response.status, 499);
  assert.equal((await response.json()).code, 'cancelled');
  noFetch.mock.restore();

  const network = mock.method(globalThis, 'fetch', async () => { throw new TypeError('private test-key'); });
  response = await POST(request({ text: 'milk' }));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, 'connection_failed');
  assert.equal(network.mock.callCount(), 1);
  assert.doesNotMatch(JSON.stringify((console.warn as unknown as { mock: { calls: unknown[] } }).mock.calls), /test-key/);
});

test('cancelling during a gateway retry does not send another request', async () => {
  configure();
  const controller = new AbortController();
  const fetcher = mock.method(globalThis, 'fetch', async () => {
    controller.abort();
    return new Response(null, { status: 503 });
  });
  const response = await POST(new Request(request({ text: 'milk' }), { signal: controller.signal }));
  assert.equal(response.status, 499);
  assert.equal(fetcher.mock.callCount(), 1);
});

test('API JSON, empty output, output JSON, schema and truncation failures stay distinguishable', async () => {
  configure();
  const cases: [unknown, string][] = [
    [null, 'empty_output'],
    [{ choices: [] }, 'empty_output'],
    [{ choices: [{ message: { content: 'not json' } }] }, 'invalid_json'],
    [{ choices: [{ message: { content: '{}' } }] }, 'schema_mismatch'],
    [{ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }, 'output_truncated'],
  ];
  for (const [body, code] of cases) {
    const fetcher = mock.method(globalThis, 'fetch', async () => Response.json(body));
    const response = await POST(request({ text: 'milk' }));
    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, code);
    assert.equal(fetcher.mock.callCount(), 1);
    fetcher.mock.restore();
  }
  mock.method(globalThis, 'fetch', async () => new Response('<html>gateway</html>'));
  assert.equal((await (await POST(request({ text: 'milk' }))).json()).code, 'invalid_json');
});
