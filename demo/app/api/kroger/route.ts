import type { GroceryItem } from '@/lib/grocery';
import { getAppToken, krogerFetch, readCookie } from '@/lib/kroger';
import type {
  KrogerMatch,
  KrogerProduct,
  KrogerStore,
} from '@/lib/kroger-types';

type LocationResponse = {
  data?: {
    locationId: string;
    name: string;
    address?: {
      addressLine1?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
  }[];
};

type ProductResponse = {
  data?: {
    productId: string;
    upc?: string;
    brand?: string;
    description: string;
    items?: {
      size?: string;
      price?: { regular?: number; promo?: number };
    }[];
  }[];
};

function quantity(item: GroceryItem) {
  return Math.max(1, Math.ceil(item.line_item_measurements?.quantity ?? 1));
}

function productOptions(data: ProductResponse, preferredBrand?: string) {
  const options: KrogerProduct[] = (data.data ?? []).map((product) => {
    const item = product.items?.[0];
    return {
      upc: product.upc ?? product.productId,
      description: product.description,
      brand: product.brand,
      size: item?.size,
      price: item?.price?.promo ?? item?.price?.regular,
    };
  });

  if (preferredBrand) {
    const brand = preferredBrand.toLowerCase();
    options.sort(
      (a, b) =>
        Number((b.brand ?? '').toLowerCase().includes(brand)) -
        Number((a.brand ?? '').toLowerCase().includes(brand)),
    );
  }
  return options.slice(0, 4);
}

async function searchProducts(
  token: string,
  locationId: string,
  item: GroceryItem,
) {
  const brand = item.filters?.brand_filters?.[0]?.brand;
  const terms = brand
    ? [`${brand} ${item.product}`, item.product]
    : [item.product];

  for (const term of terms) {
    const params = new URLSearchParams({
      'filter.term': term,
      'filter.locationId': locationId,
      'filter.fulfillment': 'csp',
      'filter.limit': '8',
    });
    const products = await krogerFetch<ProductResponse>(
      `/products?${params}`,
      token,
    );
    const options = productOptions(products, brand);
    if (options.length) return options;
  }
  return [];
}

async function matchItems(zip: string, items: GroceryItem[]) {
  if (!/^\d{5}$/.test(zip)) throw new Error('Enter a valid 5-digit ZIP code.');
  if (!items.length) throw new Error('There are no grocery items to match.');

  const token = await getAppToken();
  const locationParams = new URLSearchParams({
    'filter.zipCode.near': zip,
    'filter.radiusInMiles': '50',
    'filter.limit': '3',
  });
  const locations = await krogerFetch<LocationResponse>(
    `/locations?${locationParams}`,
    token,
  );
  const location = locations.data?.[0];
  if (!location)
    throw new Error('No Kroger-family store was found near that ZIP code.');

  const address = location.address;
  const store: KrogerStore = {
    id: location.locationId,
    name: location.name,
    address: [
      address?.addressLine1,
      address?.city,
      address?.state,
      address?.zipCode,
    ]
      .filter(Boolean)
      .join(', '),
  };
  const matches: KrogerMatch[] = await Promise.all(
    items.slice(0, 20).map(async (item) => ({
      query: item.product,
      quantity: quantity(item),
      options: await searchProducts(token, location.locationId, item),
    })),
  );
  return { store, matches };
}

export async function GET(request: Request) {
  return Response.json({
    connected: Boolean(readCookie(request, 'kroger_user_token')),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: 'search' | 'cart';
      zip?: string;
      items?: GroceryItem[];
      cartItems?: { upc: string; quantity: number }[];
    };

    if (body.action === 'search') {
      return Response.json(
        await matchItems(body.zip?.trim() ?? '', body.items ?? []),
      );
    }

    if (body.action === 'cart') {
      const userToken = readCookie(request, 'kroger_user_token');
      if (!userToken) {
        return Response.json(
          { error: 'Connect your Kroger account first.' },
          { status: 401 },
        );
      }
      const cartItems = (body.cartItems ?? [])
        .filter((item) => /^\d{10,14}$/.test(item.upc))
        .slice(0, 20)
        .map((item) => ({
          upc: item.upc,
          quantity: Math.max(1, Math.ceil(item.quantity)),
          modality: 'PICKUP',
        }));
      if (!cartItems.length) {
        return Response.json(
          { error: 'Choose at least one matched product.' },
          { status: 400 },
        );
      }

      await krogerFetch('/cart/add', userToken, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cartItems }),
      });
      return Response.json({ added: cartItems.length });
    }

    return Response.json({ error: 'Unknown Kroger action.' }, { status: 400 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Kroger request failed.',
      },
      { status: 502 },
    );
  }
}
