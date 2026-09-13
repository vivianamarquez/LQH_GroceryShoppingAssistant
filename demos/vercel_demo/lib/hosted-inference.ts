import type { GroceryResult } from './grocery';
import { lqhStatus } from './lqh-status';

async function readResult(response: Response, onProgress: (message: string) => void): Promise<GroceryResult> {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.result) {
      throw new Error(body?.error ?? `The inference server returned HTTP ${response.status} without a result. Check the server logs.`);
    }
    return body.result;
  }

  const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
  if (!reader) throw new Error('LQH returned no response. Please try again.');
  let pending = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += value ?? '';
      const lines = pending.split('\n');
      pending = lines.pop()!;
      if (done && pending) lines.push(pending);
      for (const line of lines.filter(line => line.trim())) {
        let event;
        try { event = JSON.parse(line); }
        catch { throw new Error('The inference response was interrupted. Please try again.'); }
        if (event?.type === 'progress' && typeof event.message === 'string') onProgress(event.message);
        if (event?.type === 'error') throw new Error(event.error ?? 'Inference failed. Please try again.');
        if (event?.type === 'result' && event.result) return event.result;
      }
      if (done) throw new Error('The inference response ended before a result arrived. Please try again.');
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function inferHosted(text: string, onProgress: (message: string) => void, signal?: AbortSignal): Promise<GroceryResult> {
  const finish = lqhStatus.start();
  const notice = setTimeout(() => onProgress('The model is taking longer than usual. Still waiting…'), 10_000);
  try {
    onProgress('Running hosted LQH model…');
    const response = await fetch('/api/infer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({ text, model: 'tuned' }),
      signal,
    });
    const result = await readResult(response, message => {
      clearTimeout(notice);
      onProgress(message);
    });
    finish('responded');
    return result;
  } catch (error) {
    finish(signal?.aborted ? 'cancelled' : 'failed');
    throw error;
  } finally {
    clearTimeout(notice);
  }
}
