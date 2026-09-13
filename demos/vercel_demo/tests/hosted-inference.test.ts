import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { inferHosted } from '../lib/hosted-inference';
import { lqhStatus } from '../lib/lqh-status';

afterEach(() => {
  lqhStatus.start()('cancelled');
  mock.restoreAll();
});

test('both tabs use the hosted route without exposing a provider key', async () => {
  const result = { error: 'not_a_grocery_request' };
  const controller = new AbortController();
  mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, '/api/infer');
    assert.deepEqual(JSON.parse(init.body as string), { text: 'weather', model: 'tuned' });
    assert.equal(new Headers(init.headers).get('authorization'), null);
    assert.equal(init.signal, controller.signal);
    return Response.json({ result });
  });
  assert.deepEqual(await inferHosted('weather', () => {}, controller.signal), result);
  assert.equal(lqhStatus.getSnapshot(), 'responded');
});

test('route diagnostics survive and non-JSON gateway errors remain readable', async () => {
  const fetcher = mock.method(globalThis, 'fetch', async () => Response.json({ error: 'LQH did not finish in time.' }, { status: 504 }));
  await assert.rejects(inferHosted('milk', () => {}), /LQH did not finish/);
  assert.equal(lqhStatus.getSnapshot(), 'failed');
  fetcher.mock.restore();
  mock.method(globalThis, 'fetch', async () => new Response('<html>timeout</html>', { status: 504 }));
  await assert.rejects(inferHosted('milk', () => {}), /HTTP 504/);
});

test('slow requests show a waiting notice and clear it after completion', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const progress: string[] = [];
  let finish!: (response: Response) => void;
  mock.method(globalThis, 'fetch', () => new Promise<Response>((resolve) => { finish = resolve; }));
  const pending = inferHosted('weather', message => progress.push(message));
  assert.equal(lqhStatus.getSnapshot(), 'waiting');
  t.mock.timers.tick(10_000);
  assert.match(progress.at(-1)!, /cold start/);
  finish(Response.json({ result: { error: 'not_a_grocery_request' } }));
  await pending;
  assert.equal(lqhStatus.getSnapshot(), 'responded');
  const count = progress.length;
  t.mock.timers.tick(60_000);
  assert.equal(progress.length, count);
  assert.equal(lqhStatus.getSnapshot(), 'unknown');
});

test('cancelled inference does not show a deployment failure', async () => {
  const controller = new AbortController();
  mock.method(globalThis, 'fetch', async () => {
    controller.abort();
    controller.signal.throwIfAborted();
  });
  await assert.rejects(inferHosted('milk', () => {}, controller.signal), { name: 'AbortError' });
  assert.equal(lqhStatus.getSnapshot(), 'unknown');
});
