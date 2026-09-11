'use client';

import { useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import {
  ArrowRight,
  Check,
  Clipboard,
  CloudSun,
  FlaskConical,
  Leaf,
  LoaderCircle,
  Plus,
  Send,
  ShoppingBasket,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { GroceryItem, GroceryResult } from '@/lib/grocery';
import { starterList } from '@/lib/grocery';

const examples = [
  ['Quick restock', 'hey can u grab 2 gallons of milk and a loaf of that good sourdough please'],
  ['Brands + filters', 'Make my taco night list: 2 packs of Mission tortillas, organic avocados, and Coke Zero'],
  ['Messy voice note', 'okay um we need eggs actually two dozen and some baby spinach oh and oat milk thanks'],
  ['Failure mode', "what's the weather"],
];

const models = {
  base: { label: 'Base 1.2B', size: 'Q4 · 731 MB', note: 'Prompted baseline' },
  tuned: { label: 'LQH tuned', size: 'Q8 · 1.2 GB', note: 'LoRA SFT v3.1' },
};

type Model = keyof typeof models;

async function infer(text: string, model: Model) {
  const started = performance.now();
  const response = await fetch('/api/infer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model }),
  });
  const body = (await response.json()) as { error?: string; result?: GroceryResult };
  if (!response.ok) throw new Error(body.error);
  return { result: body.result as GroceryResult, elapsed: performance.now() - started };
}

function ModelToggle({ value, onChange }: { value: Model; onChange: (value: Model) => void }) {
  return (
    <div className="flex rounded-xl bg-muted p-1" aria-label="Choose local model">
      {(Object.keys(models) as Model[]).map((id) => (
        <button
          key={id}
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
        <button key={label} onClick={() => onPick(text)} className="example-chip">
          {label}
        </button>
      ))}
    </div>
  );
}

function JsonPanel({ data, model, elapsed }: { data: GroceryResult; model: Model; elapsed?: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-4 sm:px-7">
        <div>
          <p className="eyebrow">Structured output</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Schema-valid JSON{elapsed ? ` · ${(elapsed / 1000).toFixed(1)}s` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="rounded-full bg-lime text-ink hover:bg-lime">{models[model].label}</Badge>
          <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy JSON">
            {copied ? <Check /> : <Clipboard />}
          </Button>
        </div>
      </div>
      <pre className="json-view min-h-80 overflow-auto p-5 font-mono text-[13px] leading-6 sm:p-7">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}

function ModelLab() {
  const [model, setModel] = useState<Model>('tuned');
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
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-lime">Built with LQH</p>
        <div className="grid gap-7 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Messy requests, clean carts.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              A 1.2B Liquid model specialized with LoRA SFT, failure mining, and a strict JSON contract.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['4.58', 'Baseline'], ['8.05', 'Final eval'], ['1,637', 'Core rows']].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-white/7 px-2 py-4 ring-1 ring-white/10">
                <p className="text-xl font-semibold text-lime">{value}</p>
                <p className="mt-1 text-[11px] text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Try it</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">What do you need?</h2>
            </div>
            <ModelToggle value={model} onChange={setModel} />
          </div>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Try: add milk, eggs, and two bunches of bananas"
            className="min-h-44 resize-none rounded-2xl border-0 bg-muted/70 p-4 text-base shadow-inner focus-visible:ring-primary/20"
          />
          <div className="mt-3"><ExampleChips onPick={setText} /></div>
          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button className="mt-4 h-11 w-full rounded-xl" onClick={run} disabled={busy || !text.trim()}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {busy ? 'Running locally…' : 'Extract grocery list'}
            {!busy && <ArrowRight />}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {models[model].size} · {models[model].note} · no system prompt
          </p>
        </section>

        <JsonPanel data={result} model={model} elapsed={elapsed} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.45fr_0.8fr]">
        <div className="panel p-5 sm:p-7">
          <p className="eyebrow">How we got here</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ['01', 'Foundation', 'LFM2.5-1.2B-Instruct', '4.58 baseline'],
              ['02', 'LoRA SFT', '3 epochs · rank 32', '6.52 after round 1'],
              ['03', 'Failure mining', '+553 targeted examples', '8.05 final eval'],
            ].map(([step, title, detail, score]) => (
              <article key={step} className="rounded-2xl bg-muted/55 p-4">
                <span className="font-mono text-xs text-muted-foreground">{step}</span>
                <h3 className="mt-6 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                <p className="mt-3 text-xs font-semibold text-emerald-800">{score}</p>
              </article>
            ))}
          </div>
        </div>
        <aside className="rounded-3xl bg-lime p-6 text-ink">
          <p className="eyebrow !text-emerald-900/60">The useful lesson</p>
          <h3 className="mt-4 text-xl font-semibold tracking-tight">The model was not the whole problem.</h3>
          <p className="mt-3 text-sm leading-6 text-emerald-950/70">
            A schema bug forced invented filters, while prompt examples triggered parroting. Fixing the schema and removing the system prompt unlocked the best score.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['167 eval cases', 'JSON constrained', 'Local GGUF'].map((fact) => <Badge key={fact} variant="outline" className="rounded-full border-emerald-950/15">{fact}</Badge>)}
          </div>
        </aside>
      </section>
    </>
  );
}

function ShoppingDemo() {
  const [text, setText] = useState(examples[1][1]);
  const [list, setList] = useState<GroceryResult>(starterList);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [handoff, setHandoff] = useState('');
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState('');

  async function extract() {
    setBusy(true);
    setError('');
    setUrl('');
    try {
      setList((await infer(text, 'tuned')).result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Inference failed.');
    } finally {
      setBusy(false);
    }
  }

  function updateItem(index: number, next: GroceryItem) {
    if ('error' in list) return;
    setList({ ...list, line_items: list.line_items.map((item, i) => i === index ? next : item) });
  }

  function removeItem(index: number) {
    if ('error' in list) return;
    setList({ ...list, line_items: list.line_items.filter((_, i) => i !== index) });
  }

  function addItem() {
    if ('error' in list) setList({ title: 'My grocery list', line_items: [{ product: 'new item' }] });
    else setList({ ...list, line_items: [...list.line_items, { product: 'new item' }] });
  }

  async function sendToInstacart() {
    setHandoff('Creating your shopping link…');
    const response = await fetch('/api/instacart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list),
    });
    const body = (await response.json()) as { error?: string; url?: string };
    if (!response.ok) return setHandoff(body.error ?? 'Instacart rejected the list.');
    if (!body.url) return setHandoff('Instacart did not return a shopping link.');
    setUrl(body.url);
    setQr(await QRCode.toDataURL(body.url, { width: 220, margin: 1, color: { dark: '#112a1e', light: '#ffffff' } }));
    setHandoff('Your list is ready.');
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <section className="rounded-[2rem] bg-ink p-6 text-white sm:p-8 xl:sticky xl:top-6 xl:h-fit">
        <Badge className="rounded-full bg-lime text-ink hover:bg-lime">Powered by LQH v3.1 · Q8</Badge>
        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Say it your way.<br />Shop it your way.</h1>
        <p className="mt-4 max-w-md leading-7 text-white/60">Turn a voice-note-style request into a clean, editable list before sending it to Instacart.</p>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="What should we add?"
          className="mt-7 min-h-40 resize-none rounded-2xl border-white/10 bg-white/8 p-4 text-base text-white placeholder:text-white/35 focus-visible:ring-lime/30"
        />
        <div className="mt-3"><ExampleChips onPick={setText} /></div>
        {error && <p className="mt-3 rounded-xl bg-red-400/15 px-3 py-2 text-sm text-red-100">{error}</p>}
        <Button className="mt-5 h-12 w-full rounded-xl bg-lime text-ink hover:bg-lime/90" onClick={extract} disabled={busy || !text.trim()}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {busy ? 'Building your list…' : 'Build my list'}
        </Button>
        <p className="mt-3 text-center text-xs text-white/40">Private local inference · review before handoff</p>
      </section>

      <section className="panel overflow-hidden">
        {'error' in list ? (
          <div className="grid min-h-[620px] place-items-center p-8 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-sky-100 text-sky-700"><CloudSun /></span>
              <p className="eyebrow mt-6">Not a grocery request</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Nothing added—and that’s correct.</h2>
              <p className="mt-3 leading-7 text-muted-foreground">The model recognized the failure case instead of inventing a shopping list.</p>
              <Button className="mt-6 rounded-xl" variant="outline" onClick={addItem}><Plus /> Start a list manually</Button>
            </div>
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div>
                <p className="eyebrow">Ready to review</p>
                <Input
                  value={list.title}
                  onChange={(event) => setList({ ...list, title: event.target.value })}
                  aria-label="List title"
                  className="mt-1 h-auto border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
                />
              </div>
              <Badge variant="outline" className="w-fit rounded-full px-3 py-1.5">{list.line_items.length} items</Badge>
            </header>

            <div className="space-y-3 p-5 sm:p-7">
              {list.line_items.map((item, index) => (
                <article key={`${item.product}-${index}`} className="group rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime/60 text-ink"><ShoppingBasket className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <Input
                        value={item.product}
                        onChange={(event) => updateItem(index, { ...item, product: event.target.value })}
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
                          onChange={(event) => updateItem(index, {
                            ...item,
                            line_item_measurements: { quantity: Number(event.target.value), unit: item.line_item_measurements?.unit ?? 'each' },
                          })}
                          className="h-8 w-20 rounded-lg bg-muted/60 text-sm"
                        />
                        <Input
                          value={item.line_item_measurements?.unit ?? ''}
                          placeholder="Unit"
                          aria-label="Unit"
                          onChange={(event) => updateItem(index, {
                            ...item,
                            line_item_measurements: { quantity: item.line_item_measurements?.quantity ?? 1, unit: event.target.value },
                          })}
                          className="h-8 w-28 rounded-lg bg-muted/60 text-sm"
                        />
                        {item.filters?.brand_filters?.map(({ brand }) => <Badge key={brand} variant="secondary" className="rounded-full">{brand}</Badge>)}
                        {item.filters?.health_filters?.map(({ label }) => <Badge key={label} variant="secondary" className="rounded-full">{label}</Badge>)}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(index)} aria-label={`Remove ${item.product}`} className="opacity-50 hover:text-red-600 group-hover:opacity-100"><Trash2 /></Button>
                  </div>
                </article>
              ))}
              <Button variant="outline" className="h-11 w-full rounded-xl border-dashed" onClick={addItem}><Plus /> Add an item</Button>
            </div>

            <footer className="border-t bg-muted/35 p-5 sm:p-7">
              <Button className="h-12 w-full rounded-xl" onClick={sendToInstacart} disabled={!list.line_items.length}><Send /> Shop this list on Instacart</Button>
              {handoff && <p className="mt-3 text-center text-sm text-muted-foreground">{handoff}</p>}
              {url && (
                <div className="mt-5 flex flex-col items-center gap-4 rounded-2xl bg-white p-5 text-center sm:flex-row sm:text-left">
                  <Image src={qr} alt="QR code for the Instacart shopping list" width={112} height={112} unoptimized className="size-28 rounded-xl" />
                  <div>
                    <p className="font-semibold">Open your shopping list</p>
                    <p className="mt-1 text-sm text-muted-foreground">Scan with your phone or continue in this browser.</p>
                    <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 hover:underline">Continue to Instacart <ArrowRight className="size-3" /></a>
                  </div>
                </div>
              )}
              <details className="mt-5 text-sm text-muted-foreground">
                <summary className="cursor-pointer font-medium">View model JSON</summary>
                <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-ink p-4 font-mono text-xs leading-5 text-lime">{JSON.stringify(list, null, 2)}</pre>
              </details>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><ShoppingBasket className="size-5" /></span>
          <div>
            <p className="font-semibold tracking-[-0.02em]">ListLab</p>
            <p className="text-xs text-muted-foreground">Local grocery intelligence</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 rounded-full bg-white/60 px-3 py-1.5"><span className="size-1.5 rounded-full bg-emerald-500" /> Local-first demo</Badge>
      </header>

      <Tabs defaultValue="lab" className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
        <TabsList className="mb-6 h-11 rounded-2xl bg-white/70 p-1 shadow-sm ring-1 ring-black/5">
          <TabsTrigger value="lab" className="h-9 rounded-xl px-4"><FlaskConical /> Model lab</TabsTrigger>
          <TabsTrigger value="shop" className="h-9 rounded-xl px-4"><Leaf /> Shopping demo</TabsTrigger>
        </TabsList>
        <TabsContent value="lab"><ModelLab /></TabsContent>
        <TabsContent value="shop"><ShoppingDemo /></TabsContent>
      </Tabs>
    </main>
  );
}
