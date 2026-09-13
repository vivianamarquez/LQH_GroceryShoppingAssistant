import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { POST } from '../app/api/infer/route';
import { parseResult } from '../lib/inference';

const oldKey = process.env.LQH_INFERENCE_API_KEY;
const oldModel = process.env.LQH_DEPLOYMENT_NAME;
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
    mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content }, finish_reason }] }));
    assert.equal((await POST(request({ text: 'milk' }))).status, 502);
    mock.restoreAll();
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
