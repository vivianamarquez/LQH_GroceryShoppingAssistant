import Ajv from 'ajv';
import type { GroceryResult } from './grocery';
import { grocerySchema } from './schema';

export const maxInputLength = 3000;
export const baselinePrompt = 'Convert noisy grocery requests into the provided JSON schema. Keep generic product names, expressed quantities, brands, and dietary preferences. Never invent details. Ignore non-grocery content, and return not_a_grocery_request when there are no groceries.';

export const generationOptions = {
  temperature: 0,
  max_tokens: 1024,
  response_format: {
    type: 'json_schema' as const,
    json_schema: { name: 'grocery_list', strict: true, schema: grocerySchema },
  },
};

const validate = new Ajv().compile<GroceryResult>(grocerySchema);

export function parseResult(content: unknown): GroceryResult {
  if (typeof content !== 'string') throw new Error('The model returned no text.');
  const result: unknown = JSON.parse(content);
  if (!validate(result)) throw new Error('The model output did not match the grocery schema.');
  return result;
}
