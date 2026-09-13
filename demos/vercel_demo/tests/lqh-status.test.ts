import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLqhStatus } from '../lib/lqh-status';

test('status starts unchecked and a successful request expires without making a network call', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', () => assert.fail('Status must not poll LQH'));
  const store = createLqhStatus();
  assert.equal(store.getSnapshot(), 'unchecked');
  const finish = store.start();
  assert.equal(store.getSnapshot(), 'waiting');
  finish('responded');
  assert.equal(store.getSnapshot(), 'responded');
  t.mock.timers.tick(59_999);
  assert.equal(store.getSnapshot(), 'responded');
  t.mock.timers.tick(1);
  assert.equal(store.getSnapshot(), 'unknown');
});

test('a previous success timer cannot overwrite a pending or failed request', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const store = createLqhStatus();
  store.start()('responded');
  const finish = store.start();
  t.mock.timers.tick(60_000);
  assert.equal(store.getSnapshot(), 'waiting');
  finish('failed');
  t.mock.timers.tick(60_000);
  assert.equal(store.getSnapshot(), 'failed');
});

test('overlapping requests remain waiting until both finish', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const store = createLqhStatus();
  const first = store.start();
  const second = store.start();
  first('responded');
  first('responded');
  assert.equal(store.getSnapshot(), 'waiting');
  second('responded');
  assert.equal(store.getSnapshot(), 'responded');
});

test('subscriptions receive changes and can unsubscribe', () => {
  const store = createLqhStatus();
  const seen: string[] = [];
  const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot()));
  store.start()('cancelled');
  assert.deepEqual(seen, ['waiting', 'unknown']);
  unsubscribe();
  store.start()('failed');
  assert.deepEqual(seen, ['waiting', 'unknown']);
});
