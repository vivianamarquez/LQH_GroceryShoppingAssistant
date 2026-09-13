import type { GroceryItem, GroceryResult } from '@/lib/grocery';

const healthLabels: Record<string, string> = {
  organic: 'ORGANIC',
  'gluten-free': 'GLUTEN_FREE',
  'fat-free': 'FAT_FREE',
  vegan: 'VEGAN',
  kosher: 'KOSHER',
  'sugar-free': 'SUGAR_FREE',
  'zero sugar': 'SUGAR_FREE',
  'low-fat': 'LOW_FAT',
};

const unitAliases: Record<string, string> = {
  pack: 'package', packs: 'packages', loaf: 'each', loaves: 'each', bottle: 'each', bottles: 'each', bag: 'each', bags: 'each', dozen: 'each',
};

function lineItem(item: GroceryItem) {
  const brands = item.filters?.brand_filters?.map(({ brand }) => brand);
  const health = item.filters?.health_filters
    ?.map(({ label }) => healthLabels[label.toLowerCase()])
    .filter(Boolean);

  const measurement = item.line_item_measurements;
  const normalizedMeasurement = measurement && measurement.quantity > 0
    ? { ...measurement, unit: unitAliases[measurement.unit.toLowerCase()] ?? measurement.unit }
    : undefined;

  return {
    name: item.product,
    ...(normalizedMeasurement && {
      line_item_measurements: [normalizedMeasurement],
    }),
    ...((brands?.length || health?.length) && {
      filters: {
        ...(brands?.length && { brand_filters: brands }),
        ...(health?.length && { health_filters: health }),
      },
    }),
  };
}

export async function POST(request: Request) {
  const key = process.env.INSTACART_API_KEY;
  if (!key) {
    return Response.json(
      { error: 'Add INSTACART_API_KEY to demos/demo_v1/.env.local to enable this handoff.' },
      { status: 503 },
    );
  }

  const list = (await request.json()) as GroceryResult;
  if ('error' in list) return Response.json({ error: 'There are no items to send.' }, { status: 400 });

  const response = await fetch(
    `${process.env.INSTACART_API_URL ?? 'https://connect.dev.instacart.tools'}/idp/v1/products/products_link`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: list.title,
        link_type: 'shopping_list',
        line_items: list.line_items.map(lineItem),
      }),
    },
  );

  const body = (await response.json()) as { message?: string; products_link_url?: string };
  if (!response.ok) return Response.json({ error: body.message ?? 'Instacart rejected the list.' }, { status: response.status });
  return Response.json({ url: body.products_link_url });
}
