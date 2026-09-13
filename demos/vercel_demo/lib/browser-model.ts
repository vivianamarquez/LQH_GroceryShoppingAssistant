'use client';

import type { Wllama } from '@wllama/wllama/esm/index.js';
import { baselinePrompt, generationOptions, parseResult } from './inference';

export const baseModelUrl = process.env.NEXT_PUBLIC_BASE_MODEL_URL ||
  'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/resolve/6767265158422fb8a19c62ceb45f16f05363615b/LFM2.5-1.2B-Instruct-Q4_K_M.gguf';

let engine: Wllama | undefined;
let loading: Promise<Wllama> | undefined;
let running = false;

async function load(onProgress: (message: string) => void, signal: AbortSignal) {
  if (engine?.isModelLoaded()) return engine;
  if (loading) return loading;

  loading = (async () => {
    onProgress('Preparing browser runtime…');
    try {
      const { Wllama } = await import('@wllama/wllama/esm/index.js');
      engine = new Wllama({ default: '/wllama/wllama.wasm' }, { suppressNativeLog: true });
      await engine.loadModelFromUrl(baseModelUrl, {
        n_ctx: 4096,
        n_threads: 1,
        n_gpu_layers: 0,
        signal,
        progressCallback: ({ loaded, total }) => {
          onProgress(total && loaded >= total
            ? 'Loading model into memory…'
            : `Downloading base model… ${Math.round(loaded / 1_000_000)}${total ? ` / ${Math.round(total / 1_000_000)}` : ''} MB`);
        },
      });
      return engine;
    } catch (error) {
      if (engine) await engine.exit().catch(() => {});
      engine = undefined;
      throw error;
    } finally {
      loading = undefined;
    }
  })();
  return loading;
}

export async function inferInBrowser(
  text: string,
  onProgress: (message: string) => void,
  signal: AbortSignal,
) {
  if (running) throw new Error('The base model is already running. Please wait.');
  running = true;
  try {
    signal.throwIfAborted();
    const runtime = await load(onProgress, signal);
    signal.throwIfAborted();
    onProgress('Running base model in your browser…');
    const response = await runtime.createChatCompletion({
      ...generationOptions,
      messages: [
        { role: 'system', content: baselinePrompt },
        { role: 'user', content: text },
      ],
      abortSignal: signal,
    });
    const choice = response.choices[0];
    if (choice?.finish_reason === 'length') throw new Error('The response was cut short. Try a shorter list.');
    return parseResult(choice?.message.content);
  } finally {
    running = false;
  }
}
