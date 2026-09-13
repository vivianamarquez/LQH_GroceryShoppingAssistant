import assert from 'node:assert/strict';
import { after, afterEach, mock, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Use the app's existing TypeScript loader; tests never start a web server.
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  envFile: false,
  resolve: { alias: { '@': root } },
  server: {
    middlewareMode: true,
    ws: false,
    watch: null,
    preTransformRequests: false,
  },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const { packagePlan } = await server.ssrLoadModule('/lib/package-quantity.ts');
const { POST: infer } = await server.ssrLoadModule('/app/api/infer/route.ts');
const { POST: kroger, GET: connection } = await server.ssrLoadModule(
  '/app/api/kroger/route.ts',
);
after(() => server.close());
afterEach(() => mock.restoreAll());

function request(body, connected = false) {
  return new Request('http://localhost:3000/api/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(connected ? { Cookie: 'kroger_user_token=test-token' } : {}),
    },
    body: JSON.stringify(body),
  });
}

void test('quantities refer to packages, not individual eggs or gallons', () => {
  for (const [quantity, unit, size, expected] of [
    [24, 'each', '18 ct', 2],
    [2, 'dozen', '12 ct', 2],
    [24, 'each', '12 ct', 2],
    [2, 'gallons', '1 gal', 2],
    [1, 'lb', '8 oz', 2],
  ]) {
    const plan = packagePlan(
      { product: 'test', line_item_measurements: { quantity, unit } },
      size,
    );
    assert.equal(plan.cartQuantity, expected);
  }
  assert.equal(
    packagePlan({
      product: 'milk',
      line_item_measurements: { quantity: 2, unit: 'gal' },
    }).needsReview,
    true,
  );
});

void test('invalid inference requests never call a model', async () => {
  const fetch = mock.method(globalThis, 'fetch', () =>
    assert.fail('Unexpected network call'),
  );
  for (const body of [
    null,
    {},
    { text: 24 },
    { text: ' ' },
    { text: 'milk', model: 'constructor' },
  ]) {
    assert.equal((await infer(request(body))).status, 400);
  }
  assert.equal(
    (
      await infer(
        new Request('http://localhost/api/infer', {
          method: 'POST',
          body: '{',
        }),
      )
    ).status,
    400,
  );
  assert.equal(fetch.mock.callCount(), 0);
});

void test('both models use constrained JSON; only the base gets a system prompt', async () => {
  const calls = [];
  const result = { title: 'Groceries', line_items: [{ product: 'milk' }] };
  mock.method(globalThis, 'fetch', async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return Response.json({
      choices: [{ message: { content: JSON.stringify(result) } }],
    });
  });
  for (const model of ['base', 'tuned']) {
    assert.deepEqual(
      (await (await infer(request({ text: 'milk', model }))).json()).result,
      result,
    );
  }
  assert.deepEqual(
    calls.map((call) => call.messages.map((message) => message.role)),
    [['system', 'user'], ['user']],
  );
  for (const call of calls) {
    assert.equal(call.temperature, 0);
    assert.equal(call.response_format.json_schema.strict, true);
  }
});

void test('non-grocery output is preserved', async () => {
  const result = { error: 'not_a_grocery_request' };
  mock.method(globalThis, 'fetch', async () =>
    Response.json({
      choices: [{ message: { content: JSON.stringify(result) } }],
    }),
  );
  assert.deepEqual(
    (await (await infer(request({ text: "what's the weather" }))).json())
      .result,
    result,
  );
});

void test('model HTTP errors and malformed output are distinct from connection errors', async () => {
  mock.method(
    globalThis,
    'fetch',
    async () => new Response('context full', { status: 400 }),
  );
  assert.equal((await infer(request({ text: 'milk' }))).status, 502);
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () =>
    Response.json({ choices: [{ message: { content: 'not JSON' } }] }),
  );
  assert.equal((await infer(request({ text: 'milk' }))).status, 502);
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed');
  });
  assert.equal((await infer(request({ text: 'milk' }))).status, 503);
});

void test('invalid cart requests never reach Kroger', async () => {
  const fetch = mock.method(globalThis, 'fetch', () =>
    assert.fail('Unexpected network call'),
  );
  const validItem = { upc: '0001111041700', quantity: 2 };
  assert.equal(
    (await kroger(request({ action: 'cart', cartItems: [validItem] }))).status,
    401,
  );
  for (const cartItems of [
    [],
    [null],
    [{ ...validItem, quantity: null }],
    [{ ...validItem, quantity: -1 }],
    [{ ...validItem, upc: 'bad' }],
    Array(21).fill(validItem),
  ]) {
    assert.equal(
      (await kroger(request({ action: 'cart', cartItems }, true))).status,
      400,
    );
  }
  assert.equal((await kroger(request(null))).status, 400);
  assert.equal(fetch.mock.callCount(), 0);
});

void test('a valid cart still sends the same UPCs, quantities, and PICKUP modality', async () => {
  const cartItems = [{ upc: '0001111041700', quantity: 2 }];
  mock.method(console, 'info', () => {});
  mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(url.endsWith('/cart/add'));
    assert.equal(init.method, 'PUT');
    assert.deepEqual(JSON.parse(init.body), {
      items: [{ ...cartItems[0], modality: 'PICKUP' }],
    });
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(
    await (await kroger(request({ action: 'cart', cartItems }, true))).json(),
    { added: 1 },
  );
});

void test('Kroger HTML errors and malformed cookies do not crash parsing', async () => {
  mock.method(
    globalThis,
    'fetch',
    async () => new Response('<html>Unavailable</html>', { status: 503 }),
  );
  const response = await kroger(
    request(
      { action: 'cart', cartItems: [{ upc: '0001111041700', quantity: 1 }] },
      true,
    ),
  );
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /Kroger returned 503/);
  assert.deepEqual(
    await (
      await connection(
        new Request('http://localhost/api/kroger', {
          headers: { Cookie: 'kroger_user_token=%' },
        }),
      )
    ).json(),
    { connected: false },
  );
});
