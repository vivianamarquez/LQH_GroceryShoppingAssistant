import type { ReactNode } from 'react';

function Heading({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="mb-6">
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">
        {label}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 leading-7 text-muted-foreground">{children}</p>
    </header>
  );
}

export function TechnicalDetails() {
  return (
    <div className="space-y-8">
      <header className="rounded-[2rem] bg-ink px-6 py-8 text-white sm:px-9">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-lime">
          About this app
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
          Grocery shopping assistant
        </h1>
        <p className="mt-4 text-sm leading-6 text-white/75 sm:text-base">
          Turn everyday requests into structured grocery lists, find matching
          products, and send them to your Kroger cart.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-lime">
          <span>LFM2.5 · 1.2B</span>
          <span>LoRA SFT with LQH</span>
          <span>Local Q4 GGUF</span>
        </div>
      </header>

      <section className="panel p-6 sm:p-8">
        <Heading label="Workflow" title="From LQH to the grocery app">
          The task was to turn noisy everyday grocery requests, resembling
          natural speech, into structured grocery JSON. This is the sequence we
          followed.
        </Heading>
        <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            [
              'Specification and rubric',
              'In LQH, we defined the JSON fields, input noise, and edge cases in SPEC.md, then created a grading rubric. The original format targeted Instacart; the app later reused the extraction structure for Kroger.',
            ],
            [
              'Generate and filter data',
              'Generate a structured grocery intent, render it as noisy text, verify the details, and build the target JSON in code. Medium-judge filtering at 7/10 retained 1,637 of 2,000 training examples and 167 of 200 evaluation examples.',
            ],
            [
              'Baseline models',
              'Test the original models with a system prompt describing the extraction rules. The chosen 1.2B local-inference target scored 4.58/10, versus 3.14 for the tested 350M model and about 8.5 for the hosted API reference.',
            ],
            [
              'Two LoRA SFT runs',
              'Train on the first 1,637 examples, inspect the errors, then generate 553 additional examples targeting those failures. Retrain from the original Instruct model with the expanded mix. Both runs used 3 epochs and rank 32; round 2 did not continue round 1’s adapter.',
            ],
            [
              'Evaluate and correct',
              'Round 1 scored 6.52; round 2 initially scored 6.43. A schema bug forced unwanted filters. Correcting it yielded 7.14 with a system prompt; removing the prompt’s example-product interference yielded 8.05 on the same round-2 checkpoint.',
            ],
            [
              'Export local GGUF files',
              'Merge the round-2 adapter into LFM2.5-1.2B-Instruct and export Q4 and Q8 GGUF files. Run them with llama.cpp. The demo currently selects Q4 for both the original and tuned models, with no system prompt for the tuned model.',
            ],
            [
              'Kroger account and web app',
              'Create a Kroger developer account, register an OAuth app and callback URL, and store its credentials server-side. Build the React/TypeScript interface with Next.js-style routes, running on Vinext/Vite, and connect its server routes to llama.cpp and Kroger.',
            ],
            [
              'Find products and add to cart',
              'Use the ZIP to select a store, search its catalog using the extracted products and preferences, then show product choices and package quantities. After review, send UPCs and quantities to the connected Kroger account and open the cart in a new tab.',
            ],
          ].map(([title, text], index) => (
            <li key={title} className="rounded-2xl bg-muted/60 p-5">
              <p className="mb-3 font-mono text-sm font-semibold text-primary">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border bg-white/60 p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">
          Current limitations / Future work
        </h2>
        <ul className="mt-4 grid gap-4 text-sm leading-6 text-muted-foreground md:grid-cols-3">
          <li>
            <strong className="text-foreground">Quantity selection.</strong> The
            first product match may require buying more than requested. Future
            work: compare package sizes and prices to choose a closer fit.
          </li>
          <li>
            <strong className="text-foreground">Multi-turn clarification.</strong>{' '}
            Add follow-up questions to clarify ambiguous quantities, brands,
            and preferences, and confirm product choices before adding items
            to the cart.
          </li>
          <li>
            <strong className="text-foreground">Deployment.</strong> Production
            needs fresh evaluation, load testing, stronger session lifecycle
            handling, secure hosting, and retailer approval as applicable.
          </li>
        </ul>
      </section>
    </div>
  );
}
