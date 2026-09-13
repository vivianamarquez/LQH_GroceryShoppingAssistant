'use client';

import type { Wllama } from '@wllama/wllama/esm/index.js';
import { baselinePrompt, generationOptions, parseResult } from './inference';

export const baseModelUrl = process.env.NEXT_PUBLIC_BASE_MODEL_URL ||
  'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/resolve/6767265158422fb8a19c62ceb45f16f05363615b/LFM2.5-1.2B-Instruct-Q4_K_M.gguf';

type BrowserEngine = Pick<Wllama, 'modelManager' | 'loadModel' | 'exit'>;
type Progress = (message: string) => void;

// Download once; a failed GPU initialization can reuse the same cached weights.
export async function initializeBrowserModel<T extends BrowserEngine>(
  create: () => T, useGpu: boolean, onProgress: Progress, signal: AbortSignal,
) {
  let runtime = create();
  let backend = useGpu ? 'WebGPU' : 'CPU';
  try {
    signal.throwIfAborted();
    const model = await runtime.modelManager.getModelOrDownload({ url: baseModelUrl }, {
      signal,
      progressCallback: ({ loaded, total }) => onProgress(total && loaded >= total
        ? 'Download complete. Preparing model…'
        : `Downloading base model… ${Math.round(loaded / 1_000_000)}${total ? ` / ${Math.round(total / 1_000_000)}` : ''} MB`),
    });
    signal.throwIfAborted();
    const options = { n_ctx: 4096, n_threads: 1, n_parallel: 1 };
    onProgress(`Loading base model · ${backend}…`);
    try {
      await runtime.loadModel(model, { ...options, n_gpu_layers: useGpu ? 99999 : 0 });
    } catch (error) {
      if (!useGpu || signal.aborted) throw error;
      await runtime.exit().catch(() => {});
      signal.throwIfAborted();
      runtime = create();
      backend = 'CPU';
      onProgress('WebGPU could not load this model. Falling back to CPU…');
      await runtime.loadModel(model, { ...options, n_gpu_layers: 0 });
    }
    signal.throwIfAborted();
    return { runtime, backend };
  } catch (error) {
    await runtime.exit().catch(() => {});
    throw error;
  }
}

let engine: Awaited<ReturnType<typeof load>> | undefined;
let running = false;

async function load(onProgress: Progress, signal: AbortSignal) {
  onProgress('Preparing browser runtime…');
  const { Wllama } = await import('@wllama/wllama/esm/index.js');
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  const useGpu = Boolean(await gpu?.requestAdapter().catch(() => null));
  return initializeBrowserModel(
    () => new Wllama({ default: '/wllama/wllama.wasm' }, { suppressNativeLog: true }),
    useGpu, onProgress, signal,
  );
}

export async function inferInBrowser(text: string, onProgress: Progress, signal: AbortSignal) {
  if (running) throw new Error('The base model is already running. Please wait.');
  running = true;
  try {
    signal.throwIfAborted();
    engine ??= await load(onProgress, signal);
    signal.throwIfAborted();
    onProgress(`Running base model · ${engine.backend}…`);
    const response = await engine.runtime.createChatCompletion({
      ...generationOptions,
      messages: [
        { role: 'system', content: baselinePrompt },
        { role: 'user', content: text },
      ],
      abortSignal: signal,
    });
    const choice = response.choices[0];
    if (choice?.finish_reason === 'length') throw new Error('The response was cut short. Try a shorter list.');
    return { result: parseResult(choice?.message.content), backend: engine.backend };
  } finally {
    running = false;
  }
}
