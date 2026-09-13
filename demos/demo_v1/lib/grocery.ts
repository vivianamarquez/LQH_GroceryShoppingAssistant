export type Measurement = { quantity: number; unit: string };
export type GroceryItem = {
  product: string;
  line_item_measurements?: Measurement;
  filters?: {
    brand_filters?: { brand: string }[];
    health_filters?: { label: string }[];
  };
};

export type GroceryResult =
  | { title: string; line_items: GroceryItem[] }
  | { error: 'not_a_grocery_request' };

export const starterList: GroceryResult = {
  title: 'Weekend restock',
  line_items: [
    {
      product: 'milk',
      line_item_measurements: { quantity: 2, unit: 'gallon' },
    },
    {
      product: 'sourdough bread',
      line_item_measurements: { quantity: 1, unit: 'loaf' },
    },
  ],
};
