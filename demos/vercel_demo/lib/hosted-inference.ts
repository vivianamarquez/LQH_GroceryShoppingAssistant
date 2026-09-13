import type { GroceryResult } from './grocery';
import { lqhStatus } from './lqh-status';

export async function inferHosted(text: string, onProgress: (message: string) => void, signal?: AbortSignal): Promise<GroceryResult> {
  const finish = lqhStatus.start();
  const notice = setTimeout(() => onProgress('Still waiting for LQH. A cold start can take a few minutes.'), 10_000);
  try {
    onProgress('Running hosted LQH model…');
    const response = await fetch('/api/infer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model: 'tuned' }),
      signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.result) {
      throw new Error(body?.error ?? `The inference server returned HTTP ${response.status} without a result. Check the server logs.`);
    }
    finish('responded');
    return body.result;
  } catch (error) {
    finish(signal?.aborted ? 'cancelled' : 'failed');
    throw error;
  } finally {
    clearTimeout(notice);
  }
}
