'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
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
  const [connected, setConnected] = useState<boolean>();
  const [connectionNotice, setConnectionNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const checkConnection = async () => {
      try {
        const body = await json<{ connected?: boolean }>(await fetch('/api/kroger'));
        if (active) {
          setConnected(Boolean(body.connected));
          if (body.connected) setConnectionNotice('');
        }
      } catch {
        if (active) {
          setConnected(false);
          setConnectionNotice('Could not check your connection. Try connecting again.');
        }
      }
    };
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.data === 'kroger-connected'
      ) {
        void checkConnection();
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
    setConnectionNotice('Finish signing in with Kroger in the new window.');
    window.open(
      '/api/kroger/connect',
      'kroger-oauth',
      'popup=yes,width=520,height=720',
    );
  }

  async function addToCart() {
    if (adding) return;
    setAdding(true);
    setError('');
    // Reserve the tab during the click so the browser allows it.
    const cartWindow = window.open('', '_blank');
    try {
      if (!cartWindow) {
        throw new Error('Allow pop-ups for this demo, then try again. No items were added.');
      }
      cartWindow.opener = null;
      cartWindow.document.title = 'Adding to Kroger…';
      const cartItems = matches.flatMap((match, index) =>
        selected[index]
          ? [{ upc: selected[index], quantity: match.quantity }]
          : [],
      );
      await json<{ added: number }>(
        await fetch('/api/kroger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cart', cartItems }),
        }),
      );
      cartWindow.location.replace('https://www.kroger.com/cart');
    } catch (reason) {
      cartWindow?.close();
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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-12">
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
          <div className="flex flex-col items-start gap-4 lg:items-center">
            <Image
              src="/kroger-logo.webp"
              alt="Kroger"
              width={1200}
              height={467}
              unoptimized
              className="h-auto w-48 max-w-full object-contain sm:w-56 lg:w-60"
            />
            <div className="max-w-sm lg:text-center">
              <div className="flex flex-wrap items-center gap-2 lg:justify-center">
                <Button
                  onClick={connect}
                  disabled={connected !== false}
                  aria-label={connected ? 'Kroger account connected' : 'Connect your Kroger account'}
                  className={`h-9 rounded-lg border-0 px-3 font-medium ring-1 ring-inset disabled:opacity-100 ${
                    connected === undefined
                      ? 'bg-white/5 text-white/65 ring-white/15'
                      : connected
                        ? 'bg-emerald-200/10 text-emerald-200 ring-emerald-200/25'
                        : 'bg-amber-200/10 text-amber-200 ring-amber-200/25 hover:bg-amber-200/20'
                  }`}
                >
                  {connected === undefined ? (
                    <LoaderCircle className="animate-spin" />
                  ) : connected ? (
                    <CheckCircle2 />
                  ) : (
                    <LockKeyhole />
                  )}
                  <span aria-live="polite">
                    {connected === undefined
                      ? 'Checking…'
                      : connected
                        ? 'Connected'
                        : 'Connect account'}
                  </span>
                </Button>
                <label className="flex h-9 items-center gap-2 rounded-lg bg-white/5 px-3 text-sm text-white/65 ring-1 ring-inset ring-white/15 focus-within:ring-white/40">
                  ZIP
                  <Input
                    value={zip}
                    onChange={(event) =>
                      setZip(event.target.value.replace(/\D/g, '').slice(0, 5))
                    }
                    inputMode="numeric"
                    aria-label="ZIP code"
                    placeholder="ZIP code"
                    className="h-full w-14 rounded-none border-0 p-0 font-medium text-white shadow-none placeholder:text-white/40 focus-visible:ring-0 dark:bg-transparent"
                  />
                </label>
              </div>
              {connectionNotice && (
                <p className="mt-3 text-sm leading-6 text-white/75" role="status">{connectionNotice}</p>
              )}
            </div>
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
            <Button
              className="h-11 flex-1 rounded-xl"
              onClick={buildCart}
              disabled={busy || !text.trim() || zip.length !== 5}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <Search />}
              {busy ? 'Matching products…' : 'Find Kroger products'}
            </Button>
          </div>
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
                <Button
                  className="h-12 w-full rounded-xl"
                  onClick={addToCart}
                  disabled={adding || !connected || !matchedCount}
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
                {connected === false && (
                  <p className="mt-3 text-center text-sm text-muted-foreground">
                    Connect your Kroger account above to add these items.
                  </p>
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </>
  );
}
