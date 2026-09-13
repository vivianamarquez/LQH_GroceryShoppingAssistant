import { grocerySchema } from '@/lib/schema';

const servers = {
  base: process.env.LLAMA_BASE_URL ?? 'http://127.0.0.1:8082',
  tuned: process.env.LLAMA_TUNED_URL ?? 'http://127.0.0.1:8080',
};

const baselinePrompt = `Convert noisy grocery requests into the provided JSON schema. Keep generic product names, expressed quantities, brands, and dietary preferences. Never invent details. Ignore non-grocery content, and return not_a_grocery_request when there are no groceries.`;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    text?: unknown;
    model?: unknown;
  } | null;
  const text: unknown = body?.text;
  const model: unknown = body?.model ?? 'tuned';

  if (
    typeof text !== 'string' ||
    !text.trim() ||
    (model !== 'base' && model !== 'tuned')
  ) {
    return Response.json(
      { error: 'Choose a model and enter a grocery request.' },
      { status: 400 },
    );
  }

  let response: Response;
  try {
    response = await fetch(`${servers[model]}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local',
        messages: [
          ...(model === 'base'
            ? [{ role: 'system', content: baselinePrompt }]
            : []),
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: 4096,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'grocery_list',
            strict: true,
            schema: grocerySchema,
          },
        },
      }),
    });
  } catch {
    return Response.json(
      { error: `${model.toUpperCase()} model server could not be reached.` },
      { status: 503 },
    );
  }

  if (!response.ok) {
    return Response.json(
      {
        error: `${model.toUpperCase()} model request failed (${response.status}). Check its runtime log.`,
      },
      { status: 502 },
    );
  }

  try {
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      timings?: unknown;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('The model returned an empty response.');
    return Response.json({
      result: JSON.parse(content),
      timings: body.timings,
    });
  } catch {
    return Response.json(
      {
        error:
          'The model returned an empty or invalid JSON response. Try again.',
      },
      { status: 502 },
    );
  }
}
