'use client';

import { useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import {
  ArrowRight,
  BookOpen,
  Check,
  Clipboard,
  CloudSun,
  FlaskConical,
  LoaderCircle,
  Plus,
  Send,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { KrogerCartDemo } from '@/components/kroger-cart-demo';
import { TechnicalDetails } from '@/components/technical-details';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { GroceryItem, GroceryResult } from '@/lib/grocery';
import { starterList } from '@/lib/grocery';

const examples = [
  [
    'Quick restock',
    'hey can u grab 2 gallons of milk and a loaf of that good sourdough please',
  ],
  [
    'Brands + filters',
    'Make my taco night list: 2 packs of Mission tortillas, organic avocados, and Coke Zero',
  ],
  [
    'Messy voice note',
    'okay um we need eggs actually two dozen and some baby spinach oh and oat milk thanks',
  ],
  ['Failure mode', "what's the weather"],
];

const models = {
  base: { label: 'Base 1.2B', size: 'Q4 · 731 MB', note: 'Prompted baseline' },
  tuned: { label: 'LQH tuned', size: 'Q4 · 731 MB', note: 'LoRA SFT v3.1' },
};

type Model = keyof typeof models;

async function infer(text: string, model: Model) {
  const started = performance.now();
  const response = await fetch('/api/infer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model }),
  });
  const body = (await response.json()) as {
    error?: string;
    result?: GroceryResult;
  };
  if (!response.ok) throw new Error(body.error);
  return {
    result: body.result as GroceryResult,
    elapsed: performance.now() - started,
  };
}

function ModelToggle({
  value,
  onChange,
}: {
  value: Model;
  onChange: (value: Model) => void;
}) {
  return (
    <div
      className="flex rounded-xl bg-muted p-1"
      aria-label="Choose local model"
    >
      {(Object.keys(models) as Model[]).map((id) => (
        <button
          key={id}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${value === id ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {models[id].label}
        </button>
      ))}
    </div>
  );
}

function ExampleChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {examples.map(([label, text]) => (
        <button
          key={label}
          onClick={() => onPick(text)}
          className="example-chip"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type ResultView = 'json' | 'review';

function ResultPanel({
  data,
  onChange,
  model,
  elapsed,
}: {
  data: GroceryResult;
  onChange: (data: GroceryResult) => void;
  model: Model;
  elapsed?: number;
}) {
  const [view, setView] = useState<ResultView>('json');
  const [copied, setCopied] = useState(false);
  const [handoff, setHandoff] = useState('');
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState('');

  async function copy() {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function updateItem(index: number, next: GroceryItem) {
    if ('error' in data) return;
    onChange({
      ...data,
      line_items: data.line_items.map((item, i) => (i === index ? next : item)),
    });
  }

  function removeItem(index: number) {
    if ('error' in data) return;
    onChange({
      ...data,
      line_items: data.line_items.filter((_, i) => i !== index),
    });
  }

  function addItem() {
    if ('error' in data) {
      onChange({
        title: 'My grocery list',
        line_items: [{ product: 'new item' }],
      });
      return;
    }
    onChange({
      ...data,
      line_items: [...data.line_items, { product: 'new item' }],
    });
  }

  async function sendToInstacart() {
    setHandoff('Creating your shopping link…');
    const response = await fetch('/api/instacart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = (await response.json()) as { error?: string; url?: string };
    if (!response.ok) {
      setHandoff(body.error ?? 'Instacart rejected the list.');
      return;
    }
    if (!body.url) {
      setHandoff('Instacart did not return a shopping link.');
      return;
    }
    setUrl(body.url);
    setQr(
      await QRCode.toDataURL(body.url, {
        width: 220,
        margin: 1,
        color: { dark: '#07345b', light: '#ffffff' },
      }),
    );
    setHandoff('Your list is ready.');
  }

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as ResultView)}
      className="panel gap-0 overflow-hidden"
    >
      <div className="flex flex-col items-start gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="eyebrow">Model output</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Schema-valid JSON
            {elapsed ? ` · ${(elapsed / 1000).toFixed(1)}s` : ''}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Badge className="hidden rounded-full bg-lime text-ink hover:bg-lime sm:inline-flex">
            {models[model].label}
          </Badge>
          <TabsList className="h-9 rounded-xl bg-muted p-1">
            <TabsTrigger value="json" className="h-7 rounded-lg px-3 text-xs">
              JSON
            </TabsTrigger>
            <TabsTrigger value="review" className="h-7 rounded-lg px-3 text-xs">
              Ready to review
            </TabsTrigger>
          </TabsList>
          {view === 'json' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={copy}
              aria-label="Copy JSON"
            >
              {copied ? <Check /> : <Clipboard />}
            </Button>
          )}
        </div>
      </div>
      <TabsContent value="json" className="m-0">
        <pre className="json-view min-h-[28rem] overflow-auto p-5 font-mono text-[13px] leading-6 sm:p-7">
          {JSON.stringify(data, null, 2)}
        </pre>
      </TabsContent>
      <TabsContent value="review" className="m-0">
        {'error' in data ? (
          <div className="grid min-h-[28rem] place-items-center p-8 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-sky-100 text-sky-700">
                <CloudSun />
              </span>
              <p className="eyebrow mt-6">Not a grocery request</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Nothing added—and that’s correct.
              </h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                The model recognized the failure case instead of inventing a
                shopping list.
              </p>
              <Button
                className="mt-6 rounded-xl"
                variant="outline"
                onClick={addItem}
              >
                <Plus /> Start a list manually
              </Button>
            </div>
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Ready to review</p>
                <Input
                  value={data.title}
                  onChange={(event) =>
                    onChange({ ...data, title: event.target.value })
                  }
                  aria-label="List title"
                  className="mt-1 h-auto border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
                />
              </div>
              <Badge
                variant="outline"
                className="w-fit rounded-full px-3 py-1.5"
              >
                {data.line_items.length} items
              </Badge>
            </header>

            <div className="space-y-3 p-5 sm:p-7">
              {data.line_items.map((item, index) => (
                <article
                  key={index}
                  className="group rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime/60 text-ink">
                      <ShoppingBasket className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Input
                        value={item.product}
                        onChange={(event) =>
                          updateItem(index, {
                            ...item,
                            product: event.target.value,
                          })
                        }
                        aria-label={`Item ${index + 1}`}
                        className="h-8 border-0 px-0 text-base font-semibold shadow-none focus-visible:ring-0"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={item.line_item_measurements?.quantity ?? ''}
                          placeholder="Qty"
                          aria-label="Quantity"
                          onChange={(event) =>
                            updateItem(index, {
                              ...item,
                              line_item_measurements: {
                                quantity: Number(event.target.value),
                                unit:
                                  item.line_item_measurements?.unit ?? 'each',
                              },
                            })
                          }
                          className="h-8 w-20 rounded-lg bg-muted/60 text-sm"
                        />
                        <Input
                          value={item.line_item_measurements?.unit ?? ''}
                          placeholder="Unit"
                          aria-label="Unit"
                          onChange={(event) =>
                            updateItem(index, {
                              ...item,
                              line_item_measurements: {
                                quantity:
                                  item.line_item_measurements?.quantity ?? 1,
                                unit: event.target.value,
                              },
                            })
                          }
                          className="h-8 w-28 rounded-lg bg-muted/60 text-sm"
                        />
                        {item.filters?.brand_filters?.map(({ brand }) => (
                          <Badge
                            key={brand}
                            variant="secondary"
                            className="rounded-full"
                          >
                            {brand}
                          </Badge>
                        ))}
                        {item.filters?.health_filters?.map(({ label }) => (
                          <Badge
                            key={label}
                            variant="secondary"
                            className="rounded-full"
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      aria-label={`Remove ${item.product}`}
                      className="opacity-50 hover:text-red-600 group-hover:opacity-100"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </article>
              ))}
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl border-dashed"
                onClick={addItem}
              >
                <Plus /> Add an item
              </Button>
            </div>

            <footer className="border-t bg-muted/35 p-5 sm:p-7">
              <Button
                className="h-12 w-full rounded-xl"
                onClick={sendToInstacart}
                disabled={!data.line_items.length}
              >
                <Send /> Shop this list on Instacart
              </Button>
              {handoff && (
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  {handoff}
                </p>
              )}
              {url && (
                <div className="mt-5 flex flex-col items-center gap-4 rounded-2xl bg-white p-5 text-center sm:flex-row sm:text-left">
                  <Image
                    src={qr}
                    alt="QR code for the Instacart shopping list"
                    width={112}
                    height={112}
                    unoptimized
                    className="size-28 rounded-xl"
                  />
                  <div>
                    <p className="font-semibold">Open your shopping list</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Scan with your phone or continue in this browser.
                    </p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-800 hover:underline"
                    >
                      Continue to Instacart <ArrowRight className="size-3" />
                    </a>
                  </div>
                </div>
              )}
            </footer>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

function ModelLab() {
  const [model, setModel] = useState<Model>('tuned');
  const [resultModel, setResultModel] = useState<Model>('tuned');
  const [text, setText] = useState(examples[0][1]);
  const [result, setResult] = useState<GroceryResult>(starterList);
  const [elapsed, setElapsed] = useState<number>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError('');
    try {
      const response = await infer(text, model);
      setResult(response.result);
      setResultModel(model);
      setElapsed(response.elapsed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Inference failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="mb-6 rounded-[2rem] bg-ink px-6 py-8 text-white sm:px-9">
        <div className="grid gap-7 xl:grid-cols-[0.9fr_1.3fr] xl:items-start">
          <div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Grocery shopping assistant
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              Turn everyday requests into structured grocery lists, find
              matching products, and send them to your Kroger cart.
            </p>
          </div>
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
                Built with{' '}
                <a
                  href="https://lqh.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-lime/50 underline-offset-4 hover:decoration-lime"
                >
                  LQH
                </a>{' '}
                — messy requests, clean carts
              </p>
              <Badge
                variant="outline"
                className="rounded-full border-white/20 bg-white/10 px-3 py-1 text-lime"
              >
                Local GGUF
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['01', 'Foundation', 'LFM2.5-1.2B-Instruct', '4.58 baseline'],
                ['02', 'LoRA SFT', '1,637 training examples\n3 epochs · rank 32', '6.52 after round 1'],
                ['03', 'Failure mining', '+553 targeted examples\n3 epochs · rank 32', '8.05 final eval'],
              ].map(([step, title, detail, score]) => (
                <article
                  key={step}
                  className="flex flex-col rounded-2xl bg-white/7 p-4 ring-1 ring-white/10"
                >
                  <span className="font-mono text-xs text-white/50">{step}</span>
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-white/70">{detail}</p>
                  <p className="mt-auto pt-3 text-sm font-semibold text-lime">
                    {score}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Try it</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                What do you need?
              </h2>
            </div>
            <ModelToggle value={model} onChange={setModel} />
          </div>
          <Textarea
            aria-label="Grocery request"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Try: add milk, eggs, and two bunches of bananas"
            className="min-h-44 resize-none rounded-2xl border-0 bg-muted/70 p-4 text-base shadow-inner focus-visible:ring-primary/20"
          />
          <div className="mt-3">
            <ExampleChips onPick={setText} />
          </div>
          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button
            className="mt-4 h-11 w-full rounded-xl"
            onClick={run}
            disabled={busy || !text.trim()}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {busy ? 'Running locally…' : 'Extract grocery list'}
            {!busy && <ArrowRight />}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {models[model].size} · {models[model].note} ·{' '}
            {model === 'tuned' ? 'no system prompt' : 'minimal system prompt'}
          </p>
        </section>

        <ResultPanel
          key={elapsed ?? 'initial'}
          data={result}
          onChange={setResult}
          model={resultModel}
          elapsed={elapsed}
        />
      </div>

    </>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background pt-5 text-foreground sm:pt-7">
      <Tabs defaultValue="lab" className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
        <TabsList
          variant="line"
          aria-label="Assistant views"
          className="mb-5 w-full justify-start gap-2 border-b border-primary/15 p-0 group-data-horizontal/tabs:h-12"
        >
          <TabsTrigger
            value="lab"
            className="h-12 flex-none rounded-none border-0 px-2 font-semibold hover:text-primary data-active:text-primary after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px] sm:px-4"
          >
            <FlaskConical className="hidden sm:block" /> Model lab
          </TabsTrigger>
          <TabsTrigger
            value="kroger"
            className="h-12 flex-none rounded-none border-0 px-2 font-semibold hover:text-primary data-active:text-primary after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px] sm:px-4"
          >
            <ShoppingCart className="hidden sm:block" /> Kroger cart
          </TabsTrigger>
          <TabsTrigger
            value="technical"
            className="h-12 flex-none rounded-none border-0 px-2 font-semibold hover:text-primary data-active:text-primary after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px] sm:px-4"
          >
            <BookOpen className="hidden sm:block" /> About this app
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lab">
          <ModelLab />
        </TabsContent>
        <TabsContent value="kroger">
          <KrogerCartDemo />
        </TabsContent>
        <TabsContent value="technical">
          <TechnicalDetails />
        </TabsContent>
      </Tabs>
    </main>
  );
}
