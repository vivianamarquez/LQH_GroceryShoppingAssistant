import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { POST, GET } from '../app/api/kroger/route';
import { packagePlan } from '../lib/package-quantity';
import { cookie } from '../lib/kroger';

afterEach(() => mock.restoreAll());

function request(body: unknown, connected = false) {
  return new Request('https://demo.example/api/kroger', {
    method: 'POST', body: JSON.stringify(body),
    headers: connected ? { Cookie: 'kroger_user_token=test-token' } : {},
  });
}

test('package quantities keep the local demo behavior', () => {
  for (const [quantity, unit, size, expected] of [
    [24, 'each', '18 ct', 2], [24, 'each', '12 ct', 2], [2, 'gal', '1 gal', 2],
  ] as const) {
    assert.equal(packagePlan({ product: 'test', line_item_measurements: { quantity, unit } }, size).cartQuantity, expected);
  }
});

test('valid cart requests keep UPCs, quantities, PICKUP and accept Kroger 204', async () => {
  mock.method(console, 'info', () => {});
  mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.ok(url.endsWith('/cart/add'));
    assert.equal(init.method, 'PUT');
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer test-token');
    assert.deepEqual(JSON.parse(init.body as string), { items: [{ upc: '0001111041700', quantity: 2, modality: 'PICKUP' }] });
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(await (await POST(request({ action: 'cart', cartItems: [{ upc: '0001111041700', quantity: 2 }] }, true))).json(), { added: 1 });
});

test('invalid cart and catalog requests never reach Kroger', async () => {
  mock.method(globalThis, 'fetch', () => assert.fail('Unexpected network call'));
  assert.equal((await POST(request({ action: 'cart', cartItems: [] }))).status, 401);
  for (const body of [
    null, { action: 'cart', cartItems: [] }, { action: 'cart', cartItems: [null] },
    { action: 'search', zip: 12345 }, { action: 'search', zip: '71104', items: [{ product: 42 }] },
  ]) {
    assert.equal((await POST(request(body, true))).status, 400);
  }
});

test('cookies work statelessly across HTTPS requests and are not readable by JS', async () => {
  assert.deepEqual(await (await GET(request({}, true))).json(), { connected: true });
  assert.deepEqual(await (await GET(request({}))).json(), { connected: false });
  const header = cookie(request({}), 'example', 'token', 600);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Secure/);
});
