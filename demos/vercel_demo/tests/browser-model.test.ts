import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Wllama } from '@wllama/wllama/esm/index.js';
import { initializeBrowserModel } from '../lib/browser-model';

function fixture(failGpu = false, failDownload = false, controller = new AbortController()) {
  const layers: number[] = [];
  const progress: string[] = [];
  const model = {};
  let downloads = 0;
  let exits = 0;
  const create = () => ({
    modelManager: { getModelOrDownload: async () => {
      downloads++;
      if (failDownload) throw new Error('Download failed');
      return model;
    } },
    loadModel: async (cached: unknown, options: { n_gpu_layers: number; n_parallel: number }) => {
      assert.equal(cached, model);
      assert.equal(options.n_parallel, 1);
      layers.push(options.n_gpu_layers);
      if (failGpu && options.n_gpu_layers > 0) throw new Error('GPU allocation failed');
    },
    exit: async () => { exits++; },
  }) as unknown as Wllama;
  return {
    create, layers, progress, controller,
    counts: () => ({ downloads, exits }),
    run: (gpu: boolean) => initializeBrowserModel(create, gpu, (message) => progress.push(message), controller.signal),
  };
}

test('WebGPU loads all model layers when available', async () => {
  const f = fixture();
  assert.equal((await f.run(true)).backend, 'WebGPU');
  assert.deepEqual(f.layers, [99999]);
});

test('browsers without WebGPU go directly to CPU', async () => {
  const f = fixture();
  assert.equal((await f.run(false)).backend, 'CPU');
  assert.deepEqual(f.layers, [0]);
});

test('GPU initialization failure disposes the engine and reuses the download on CPU', async () => {
  const f = fixture(true);
  assert.equal((await f.run(true)).backend, 'CPU');
  assert.deepEqual(f.layers, [99999, 0]);
  assert.deepEqual(f.counts(), { downloads: 1, exits: 1 });
  assert.match(f.progress.join(' '), /Falling back/);
});

test('download failure is not retried as a GPU failure', async () => {
  const f = fixture(false, true);
  await assert.rejects(f.run(true), /Download failed/);
  assert.deepEqual(f.layers, []);
  assert.deepEqual(f.counts(), { downloads: 1, exits: 1 });
});

test('cancellation does not load or retry the model', async () => {
  const f = fixture();
  f.controller.abort();
  await assert.rejects(f.run(true), { name: 'AbortError' });
  assert.deepEqual(f.counts(), { downloads: 0, exits: 1 });
});

test('cancellation during GPU initialization cleans up without CPU fallback', async () => {
  const f = fixture();
  const create = () => ({ ...f.create(), loadModel: async () => {
    f.controller.abort();
    throw new Error('GPU interrupted');
  } }) as unknown as Wllama;
  await assert.rejects(initializeBrowserModel(create, true, () => {}, f.controller.signal));
  assert.deepEqual(f.counts(), { downloads: 1, exits: 1 });
});
