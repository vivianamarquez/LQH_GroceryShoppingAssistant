'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Search,
  ShoppingBasket,
  ShoppingCart,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { GroceryResult } from '@/lib/grocery';
import type {
  KrogerMatch,
  KrogerProduct,
  KrogerStore,
} from '@/lib/kroger-types';
import { packagePlan, type PackagePlan } from '@/lib/package-quantity';

const examples = [
  ['Quick restock', '2 gallons of milk and a loaf of sourdough'],
  ['Taco night', 'Mission tortillas, organic avocados, and Coke Zero'],
  ['Messy note', 'um two dozen eggs, baby spinach, and oat milk please'],
  ['Failure mode', "what's the weather"],
];

type DisplayProduct = KrogerProduct & PackagePlan;
type DisplayMatch = Omit<KrogerMatch, 'options'> & {
  requestedQuantity: number;
  requestedUnit?: string;
  options: DisplayProduct[];
};

async function json<T>(response: Response) {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Request failed.');
  return body;
}

function number(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function requestedLabel(match: DisplayMatch) {
  const unit = match.requestedUnit?.toLowerCase();
  if (!unit || ['each', 'ea', 'count', 'counts', 'ct'].includes(unit)) {
    return `${number(match.requestedQuantity)} ${match.query}`;
  }
  return `${number(match.requestedQuantity)} ${match.requestedUnit} ${match.query}`;
}

export function KrogerCartDemo() {
  const [text, setText] = useState(examples[0][1]);
  const [zip, setZip] = useState('71104');
  const [list, setList] = useState<GroceryResult>();
  const [store, setStore] = useState<KrogerStore>();
  const [matches, setMatches] = useState<DisplayMatch[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const checkConnection = async () => {
      const response = await fetch('/api/kroger');
      const body = (await response.json()) as { connected?: boolean };
      if (active) setConnected(Boolean(body.connected));
    };
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.data === 'kroger-connected'
      ) {
        void checkConnection();
        setNotice('Kroger account connected.');
      }
    };
    void checkConnection();
    window.addEventListener('message', onMessage);
    return () => {
      active = false;
      window.removeEventListener('message', onMessage);
    };
  }, []);

  async function buildCart() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const inference = await json<{ result: GroceryResult }>(
        await fetch('/api/infer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, model: 'tuned' }),
        }),
      );
      const groceryList = inference.result;
      setList(groceryList);
      if ('error' in groceryList) {
        setMatches([]);
        setStore(undefined);
        return;
      }

      const found = await json<{ store: KrogerStore; matches: KrogerMatch[] }>(
        await fetch('/api/kroger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'search',
            zip,
            items: groceryList.line_items,
          }),
        }),
      );
      const displayMatches = found.matches.map((match, index) => {
        const item = groceryList.line_items[index];
        if (!item) {
          return {
            ...match,
            requestedQuantity: match.quantity,
            options: match.options.map((option) => ({
              ...option,
              cartQuantity: match.quantity,
            })),
          };
        }
        const options = match.options.map((option) => ({
          ...option,
          ...packagePlan(item, option.size),
        }));
        return {
          ...match,
          requestedQuantity: item.line_item_measurements?.quantity ?? 1,
          requestedUnit: item.line_item_measurements?.unit,
          quantity: options[0]?.cartQuantity ?? match.quantity,
          options,
        };
      });
      setStore(found.store);
      setMatches(displayMatches);
      setSelected(
        displayMatches.map((match) => match.options[0]?.upc ?? ''),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to build the cart.',
      );
    } finally {
      setBusy(false);
    }
  }

  function connect() {
    setNotice('Finish signing in with Kroger in the new window.');
    window.open(
      '/api/kroger/connect',
      'kroger-oauth',
      'popup=yes,width=520,height=720',
    );
  }

  async function addToCart() {
    setAdding(true);
    setError('');
    setNotice('');
    try {
      const cartItems = matches.flatMap((match, index) =>
        selected[index]
          ? [{ upc: selected[index], quantity: match.quantity }]
          : [],
      );
      const body = await json<{ added: number }>(
        await fetch('/api/kroger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cart', cartItems }),
        }),
      );
      setNotice(
        `${body.added} ${body.added === 1 ? 'item' : 'items'} added to your Kroger cart.`,
      );
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : 'Unable to add to cart.';
      setError(message);
      if (message.toLowerCase().includes('connect')) setConnected(false);
    } finally {
      setAdding(false);
    }
  }

  const matchedCount = selected.filter(Boolean).length;

  function selectProduct(index: number, upc: string) {
    setSelected((current) =>
      current.map((value, itemIndex) => (itemIndex === index ? upc : value)),
    );
    setMatches((current) =>
      current.map((match, itemIndex) => {
        if (itemIndex !== index) return match;
        const option = match.options.find((value) => value.upc === upc);
        return option ? { ...match, quantity: option.cartQuantity } : match;
      }),
    );
  }

  return (
    <>
      <section className="mb-6 rounded-[2rem] bg-ink px-6 py-8 text-white sm:px-9">
        <div className="grid gap-7 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-lime">
              Live Kroger integration
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Grocery shopping assistant
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              Turn everyday requests into structured grocery lists, find
              matching products, and send them to your Kroger cart.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['1', 'Local extract'],
              ['2', 'Product match'],
              ['3', 'Kroger cart'],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl bg-white/7 px-2 py-4 ring-1 ring-white/10"
              >
                <p className="text-xl font-semibold text-lime">{value}</p>
                <p className="mt-1 text-[11px] text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="panel p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Build your cart</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                What do you need?
              </h2>
            </div>
            <Badge className="rounded-full bg-lime text-ink hover:bg-lime">
              LQH tuned
            </Badge>
          </div>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Try: add milk, eggs, and bananas"
            className="min-h-44 resize-none rounded-2xl border-0 bg-muted/70 p-4 text-base shadow-inner focus-visible:ring-primary/20"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {examples.map(([label, value]) => (
              <button
                key={label}
                onClick={() => setText(value)}
                className="example-chip"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Input
              value={zip}
              onChange={(event) =>
                setZip(event.target.value.replace(/\D/g, '').slice(0, 5))
              }
              inputMode="numeric"
              aria-label="ZIP code"
              placeholder="ZIP code"
              className="h-11 w-32 rounded-xl"
            />
            <Button
              className="h-11 flex-1 rounded-xl"
              onClick={buildCart}
              disabled={busy || !text.trim() || zip.length !== 5}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <Search />}
              {busy ? 'Matching products…' : 'Find Kroger products'}
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Kroger credentials stay on the server · checkout stays with Kroger
          </p>
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>

        <section className="panel overflow-hidden">
          {!list ? (
            <div className="grid min-h-[30rem] place-items-center p-8 text-center">
              <div className="max-w-sm">
                <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-lime/55 text-ink">
                  <ShoppingCart />
                </span>
                <p className="eyebrow mt-6">Ready to match</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  Your Kroger cart starts here.
                </h2>
                <p className="mt-3 leading-7 text-muted-foreground">
                  Enter a grocery request and ZIP code to find real products at
                  the closest Kroger-family store.
                </p>
              </div>
            </div>
          ) : 'error' in list ? (
            <div className="grid min-h-[30rem] place-items-center p-8 text-center">
              <div className="max-w-sm">
                <p className="eyebrow">No shopping list found</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  This doesn’t look like a grocery request.
                </h2>
                <p className="mt-3 leading-7 text-muted-foreground">
                  Try asking for groceries or household essentials.
                </p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div>
                  <p className="eyebrow">Ready to review</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                    {list.title}
                  </h2>
                  {store && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" /> {store.name} ·{' '}
                      {store.address}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className="w-fit rounded-full px-3 py-1.5"
                >
                  {matchedCount}/{matches.length} matched
                </Badge>
              </header>

              <div className="space-y-3 p-5 sm:p-7">
                {matches.map((match, index) => {
                  const option = match.options.find(
                    (value) => value.upc === selected[index],
                  );
                  return (
                  <article
                    key={`${match.query}-${index}`}
                    className="rounded-2xl border bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime/60 text-ink">
                        <ShoppingBasket className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold capitalize">
                            {match.query}
                          </p>
                          <Input
                            type="number"
                            min="1"
                            value={match.quantity}
                            aria-label={`Quantity for ${match.query}`}
                            onChange={(event) =>
                              setMatches((current) =>
                                current.map((value, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...value,
                                        quantity: Math.max(
                                          1,
                                          Number(event.target.value),
                                        ),
                                      }
                                    : value,
                                ),
                              )
                            }
                            className="h-8 w-16 rounded-lg bg-muted/60 text-sm"
                          />
                        </div>
                        {match.options.length ? (
                          <select
                            value={selected[index]}
                            onChange={(event) =>
                              selectProduct(index, event.target.value)
                            }
                            aria-label={`Kroger match for ${match.query}`}
                            className="mt-2 h-10 w-full rounded-xl border bg-muted/45 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {match.options.map((option) => (
                              <option key={option.upc} value={option.upc}>
                                {[option.brand, option.description, option.size]
                                  .filter(Boolean)
                                  .join(' · ')}
                                {option.price
                                  ? ` · $${option.price.toFixed(2)}`
                                  : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="mt-2 text-sm text-red-600">
                            No pickup match found at this store.
                          </p>
                        )}
                        {option?.packageQuantity && option.packageUnit && (
                          <p className="mt-2 text-xs font-medium text-blue-700">
                            Requested {requestedLabel(match)} · Cart uses{' '}
                            {match.quantity} × {option.size} ={' '}
                            {number(match.quantity * option.packageQuantity)}{' '}
                            {option.packageUnit === 'ct'
                              ? match.query
                              : option.packageUnit}
                          </p>
                        )}
                        {option?.needsReview && (
                          <p className="mt-2 text-xs font-medium text-amber-700">
                            Requested {requestedLabel(match)} · Package size is
                            unclear, so review the cart quantity.
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>

              <footer className="border-t bg-muted/35 p-5 sm:p-7">
                {connected ? (
                  <Button
                    className="h-12 w-full rounded-xl"
                    onClick={addToCart}
                    disabled={adding || !matchedCount}
                  >
                    {adding ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <ShoppingCart />
                    )}
                    {adding
                      ? 'Adding to Kroger…'
                      : `Add ${matchedCount} items to Kroger cart`}
                  </Button>
                ) : (
                  <Button
                    className="h-12 w-full rounded-xl"
                    onClick={connect}
                    disabled={!matchedCount}
                  >
                    <LockKeyhole /> Connect Kroger account
                  </Button>
                )}
                {notice && (
                  <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="size-4" /> {notice}
                    </p>
                    {notice.includes('added') && (
                      <>
                        <a
                          href="https://www.kroger.com/cart"
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 font-semibold hover:underline"
                        >
                          Open Kroger cart <ArrowRight className="size-3" />
                        </a>
                        <p className="mt-2 leading-6">
                          Missing items? Check Kroger’s Saved for Later and
                          choose Move to Cart. Adding again increases quantities.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </>
  );
}
