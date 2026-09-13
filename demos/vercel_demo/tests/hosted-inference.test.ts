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
    assert.equal(new Headers(init.headers).get('accept'), 'application/x-ndjson');
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
  assert.match(progress.at(-1)!, /Still waiting/);
  assert.doesNotMatch(progress.at(-1)!, /cold|warm|Retrying/);
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

function stream(chunks: string[]) {
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'application/x-ndjson' } });
}

test('server retry events are shown immediately, even across split chunks', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const progress: string[] = [];
  let sender!: ReadableStreamDefaultController<Uint8Array>;
  let notified!: () => void;
  const retrySeen = new Promise<void>(resolve => { notified = resolve; });
  const fetcher = mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) { sender = controller; },
  }), { headers: { 'Content-Type': 'application/x-ndjson' } }));
  const pending = inferHosted('milk', message => {
    progress.push(message);
    if (message.includes('Retrying')) notified();
  });
  const send = (chunk: string) => sender.enqueue(new TextEncoder().encode(chunk));
  send('{"type":"started"}\n{"type":"pro');
  send('gress","message":"The model is taking longer than usual. Retrying once…"}\n');
  await retrySeen;
  assert.equal(lqhStatus.getSnapshot(), 'waiting');
  t.mock.timers.tick(10_000);
  assert.match(progress.at(-1)!, /Retrying once/);
  send('{"type":"result","result":{"error":"not_a_grocery_request"}}');
  sender.close();
  assert.deepEqual(await pending, { error: 'not_a_grocery_request' });
  assert.equal(lqhStatus.getSnapshot(), 'responded');
  assert.equal(fetcher.mock.callCount(), 1, 'The browser must not add another automatic retry');
});

test('stream errors, truncation and invalid data fail clearly without client-side retries', async () => {
  for (const [chunks, message] of [
    [['{"type":"error","error":"LQH’s gateway timed out again."}\n'], /timed out again/],
    [['{"type":"started"}\n'], /before a result/],
    [['<html>'], /interrupted/],
  ] as [string[], RegExp][]) {
    const fetcher = mock.method(globalThis, 'fetch', async () => stream(chunks));
    await assert.rejects(inferHosted('milk', () => {}), message);
    assert.equal(lqhStatus.getSnapshot(), 'failed');
    assert.equal(fetcher.mock.callCount(), 1);
    fetcher.mock.restore();
  }
});

test('cancelling a response stream is not a deployment failure', async () => {
  const controller = new AbortController();
  mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(sender) {
      controller.signal.addEventListener('abort', () => sender.error(controller.signal.reason), { once: true });
    },
  }), { headers: { 'Content-Type': 'application/x-ndjson' } }));
  const pending = inferHosted('milk', () => {}, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(lqhStatus.getSnapshot(), 'unknown');
});
