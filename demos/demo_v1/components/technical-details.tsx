import type { ReactNode } from 'react';
import { baselineSystemPrompt } from '@/lib/baseline-system-prompt';

const workflow = [
  {
    title: 'Specification and rubric',
    content: (
      <>
        <p>
          In LQH, we defined the <strong>JSON fields, input noise, and edge
          cases</strong> in <code>SPEC.md</code>, then created a grading rubric.
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>
            <strong>JSON fields:</strong> a title and generic product names,
            plus stated quantities, units, brands, and dietary preferences.
          </li>
          <li>
            <strong>Input noise:</strong> typos, filler words, transcription
            errors, and run-on sentences.
          </li>
          <li>
            <strong>Edge cases:</strong> quantity corrections, mixed requests,
            and no-grocery requests returning <code>not_a_grocery_request</code>.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Generate and filter data',
    content: (
      <p>
        Generate a structured grocery intent, render it as noisy text,
        verify the details, and build the target JSON in code. Medium-judge
        filtering at 7/10 retained 1,637 of 2,000 training examples and 167
        of 200 evaluation examples.
      </p>
    ),
    example: {
      label: 'Example target for “um, milk please”',
      code: `{
  "title": "Grocery list",
  "line_items": [
    { "product": "milk" }
  ]
}`,
    },
  },
  {
    title: 'Baseline models',
    content: (
      <>
        <p>
          Test the original models with a <strong>system prompt</strong>{' '}
          describing the extraction rules.
        </p>
        <p>
          Baseline scores were <strong>4.58/10 for the 1.2B model</strong>,
          3.14/10 for the tested 350M model, and about 8.5/10 for the hosted
          API reference.
        </p>
        <details className="overflow-hidden rounded-xl border bg-white/80 text-sm">
          <summary className="cursor-pointer px-4 py-3 font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary">
            View baseline system prompt
          </summary>
          <div className="border-t px-4 py-3">
            <p className="mb-3 leading-6">
              Saved prompt for the 4.58/10 baseline. The live Model lab uses
              a shorter prompt.
            </p>
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to focus this region to scroll the long prompt. */}
            <section className="max-h-80 overflow-y-auto rounded-lg bg-white p-3" tabIndex={0} aria-label="Saved baseline system prompt">
              <pre className="whitespace-pre-wrap break-words font-mono leading-6"><code>{baselineSystemPrompt}</code></pre>
            </section>
          </div>
        </details>
      </>
    ),
  },
  {
    title: 'Two LoRA SFT runs',
    content: (
      <>
        <p>
          <strong>Round 1:</strong> train on the first 1,637 examples and
          inspect the errors.
        </p>
        <p>
          <strong>Round 2:</strong> generate 553 additional examples targeting
          those failures. Retrain from the original Instruct model
          with the expanded mix.
        </p>
      </>
    ),
    example: {
      label: 'Shared settings · both runs',
      code: `epochs: 3
LoRA rank: 32`,
    },
  },
  {
    title: 'Evaluate and correct',
    content: (
      <>
        <p>
          Round 1 scored <strong>6.52</strong>; round 2 initially scored{' '}
          <strong>6.43</strong>. A schema bug forced unwanted filters.
        </p>
        <p>
          Correct the schema: <strong>7.14</strong> with a system prompt.
          <br />
          Remove the system prompt: <strong>8.05</strong> on the same
          round-2 checkpoint.
        </p>
      </>
    ),
  },
  {
    title: 'Export local GGUF files',
    content: (
      <>
        <p>
          Merge the round-2 adapter into LFM2.5-1.2B-Instruct and{' '}
          <strong>export Q4 and Q8 GGUF files</strong>. Run them with{' '}
          <code>llama.cpp</code>.
        </p>
        <p>
          The demo currently selects <strong>Q4 for both models</strong>,
          with <strong>no system prompt for the tuned model</strong>.
        </p>
      </>
    ),
  },
  {
    title: 'Kroger developer account and web app',
    content: (
      <>
        <p>
          Create a Kroger developer account, register an <strong>OAuth app</strong>
          {' '}and callback URL, and store its credentials server-side.
        </p>
        <p>
          Build the <strong>React/TypeScript interface</strong> with
          Next.js-style routes, running on Vinext/Vite, and connect its
          server routes to llama.cpp and Kroger.
        </p>
      </>
    ),
  },
  {
    title: 'Find products and add to cart',
    content: (
      <>
        <p>
          Use the ZIP to select a store, search its catalog
          using the extracted products and preferences, then show product
          choices and package quantities.
        </p>
        <p>
          After review, send UPCs and quantities to the
          connected Kroger account and open the cart in a new tab.
        </p>
      </>
    ),
    example: {
      label: 'Illustrative cart item · UPC comes from Kroger',
      code: `{
  "upc": "<selected product UPC>",
  "quantity": 2,
  "modality": "PICKUP"
}`,
    },
  },
];

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
        <ol className="grid gap-5 lg:grid-cols-2">
          {workflow.map(({ title, content, example }, index) => (
            <li key={title} className="min-w-0 rounded-2xl bg-muted/60 p-5 sm:p-6">
              <div className="mb-4 flex items-baseline gap-3">
                <span className="font-mono text-sm font-semibold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-lg font-semibold">{title}</h3>
              </div>
              <div className="space-y-3 leading-7 text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-white [&_code]:px-1 [&_code]:text-sm [&_code]:text-primary">
                {content}
              </div>
              {example && (
                <figure className="mt-5 overflow-hidden rounded-xl border bg-white/80">
                  <figcaption className="border-b px-4 py-2 text-sm font-medium text-muted-foreground">
                    {example.label}
                  </figcaption>
                  <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-6 text-ink">
                    <code>{example.code}</code>
                  </pre>
                </figure>
              )}
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
