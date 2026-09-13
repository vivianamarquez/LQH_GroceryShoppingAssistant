import { generationOptions, maxInputLength, parseResult } from '@/lib/inference';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    typeof body?.text !== 'string' || !body.text.trim() ||
    body.text.length > maxInputLength || (body.model ?? 'tuned') !== 'tuned'
  ) {
    return Response.json(
      { error: `Enter a grocery request of up to ${maxInputLength} characters. The base model runs in your browser.` },
      { status: 400 },
    );
  }

  const key = process.env.LQH_INFERENCE_API_KEY;
  const model = process.env.LQH_DEPLOYMENT_NAME;
  if (!key || !model) {
    return Response.json(
      { error: 'The hosted model is not configured. Set LQH_INFERENCE_API_KEY and LQH_DEPLOYMENT_NAME on the server.' },
      { status: 503 },
    );
  }

  try {
    const response = await fetch('https://inference.lqh.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...generationOptions,
        model,
        messages: [{ role: 'user', content: body.text.trim() }],
      }),
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]),
    });
    if (!response.ok) {
      return Response.json(
        { error: `LQH returned ${response.status}. Check the deployment, inference key, and structured-output support.` },
        { status: 502 },
      );
    }
    const data = await response.json();
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') throw new Error('Truncated output');
    return Response.json({ result: parseResult(choice?.message?.content) });
  } catch {
    return Response.json(
      { error: 'The hosted model timed out, could not be reached, or returned invalid output. Try a shorter request.' },
      { status: 502 },
    );
  }
}
