import { grocerySchema } from '@/lib/schema';

const servers = {
  base: process.env.LLAMA_BASE_URL ?? 'http://127.0.0.1:8082',
  tuned: process.env.LLAMA_TUNED_URL ?? 'http://127.0.0.1:8080',
};

const baselinePrompt = `Convert noisy grocery requests into the provided JSON schema. Keep generic product names, expressed quantities, brands, and dietary preferences. Never invent details. Ignore non-grocery content, and return not_a_grocery_request when there are no groceries.`;

export async function POST(request: Request) {
  const { text, model = 'tuned' } = (await request.json()) as { text?: string; model?: string };
  const server = servers[model as keyof typeof servers];

  if (!text?.trim() || !server) {
    return Response.json({ error: 'Choose a model and enter a grocery request.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${server}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local',
        messages: [
          ...(model === 'base' ? [{ role: 'system', content: baselinePrompt }] : []),
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: 4096,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'grocery_list', strict: true, schema: grocerySchema },
        },
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      timings?: unknown;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('The model returned an empty response.');
    return Response.json({ result: JSON.parse(content), timings: body.timings });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: `${model.toUpperCase()} model server is not running.` },
      { status: 503 },
    );
  }
}
