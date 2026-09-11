import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

const scores = [
  ['Original 1.2B Instruct', '4.58', 'Historical prompted baseline'],
  ['SFT round 1 · v2.4', '6.52', 'Original training data; internal evaluation'],
  ['SFT round 2 · v3.1', '6.43', 'More targeted data; internal evaluation'],
  ['v3.1 · corrected schema', '7.14', 'System prompt still included'],
  [
    'v3.1 · corrected schema, no system prompt',
    '8.05',
    'Final recorded development evaluation',
  ],
];

const inputTokens = 500;
const outputTokens = 200;
const inputRate = 1;
const outputRate = 5;
const costPerRequest =
  (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
const dollars = (amount: number) =>
  amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
    >
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </a>
  );
}

function Heading({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="mb-6 max-w-3xl">
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">
        {number}
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
        <Heading number="01 / Workflow" title="From LQH to the grocery app">
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
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          Filtering retained 66 unscored training rows and 5 unscored evaluation
          rows when judging failed. The evaluation set was reused during
          development. In this laptop setup, model inference stays local, while
          product searches, the ZIP, and authorized cart data go to Kroger.
        </p>
      </section>

      <section className="panel p-6 sm:p-8">
        <Heading number="02 / Model" title="Model choice and fine-tuning">
          LFM means Liquid Foundation Model. The original LFM2.5-1.2B-Instruct
          is already instruction-tuned; this project specializes it for noisy
          grocery text → structured JSON.
        </Heading>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4 leading-7 text-muted-foreground">
            <h3 className="text-lg font-semibold text-foreground">
              Why this model?
            </h3>
            <p>
              The task needs extraction and normalization, not encyclopedic
              knowledge. A compact model can run on the laptop, keep inference
              local, and avoid a hosted language-model call for every list.
            </p>
            <p>
              The 1.2B target was chosen for this project’s size budget. It
              scored 4.58 before this fine-tune, versus 3.14 for the tested 350M
              model. That supports choosing it over that smaller baseline—not
              claiming it beats every available model.
            </p>
            <Source href="https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct">
              Liquid AI model card
            </Source>
          </div>
          <div className="space-y-4 rounded-2xl bg-muted/60 p-5 leading-7 text-muted-foreground">
            <h3 className="text-lg font-semibold text-foreground">
              What LQH contributed
            </h3>
            <p>
              LQH helped turn the task specification into synthetic examples,
              quality filtering, a grading rubric, baseline evaluations, cloud
              training runs, failure analysis, and GGUF export.
            </p>
            <p>
              <strong className="text-foreground">SFT</strong> means supervised
              fine-tuning: learn from request / correct-answer pairs.{' '}
              <strong className="text-foreground">LoRA</strong> means low-rank
              adaptation: train small adapter matrices instead of updating all
              the original weights. The adapter is merged into the model before
              GGUF export.
            </p>
            <Source href="https://lqh.ai/">About LQH</Source>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border p-5">
          <h3 className="text-lg font-semibold">
            The historical baseline system prompt
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The baseline used an instruction message before the grocery request.
            It opened with:
          </p>
          <blockquote className="mt-3 border-l-2 border-primary/40 pl-4 leading-7">
            “You are a grocery list extraction engine for Instacart. Convert the
            user's noisy, conversational grocery request (typos,
            voice-transcription artifacts, filler words, run-on sentences) into
            a strict JSON payload.”
          </blockquote>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            It specified raw JSON only, generic product names, quantities such
            as “two dozen” → 24, optional brand/dietary fields, and a
            non-grocery error response. It also included concrete product
            examples. The snapshot is in{' '}
            <code className="break-all">
              runs/baseline_lfm2.5_1.2b/config.json
            </code>
            , originally loaded from{' '}
            <code className="break-all">prompts/grocery_list_v0.md</code>.
            Today’s Model lab uses a shorter prompt for the original model and
            no system prompt for the tuned model.
          </p>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {[
            [
              'Round 1 · v2.4',
              '1,637 curated examples',
              'From 2,000 generated examples, filtered with a medium LLM judge. The trainer used 1,636 rows after skipping one.',
            ],
            [
              'Round 2 · v3.1',
              '+553 targeted examples',
              'The original 1,637 examples once + 553 failure-focused examples twice: 2,190 unique / 2,743 weighted rows submitted; 2,742 used by the trainer.',
            ],
          ].map(([title, count, text]) => (
            <article key={title} className="rounded-2xl border p-5">
              <p className="text-sm font-medium text-primary">{title}</p>
              <h3 className="mt-2 text-xl font-semibold">{count}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {text}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-5 leading-7 text-muted-foreground">
          <strong className="text-foreground">
            Both runs started from the same original Instruct checkpoint.
          </strong>{' '}
          Round 2 did not continue training round 1’s adapter. Both used 3
          epochs, learning rate 0.0001, LoRA rank 32, alpha 64, dropout 0.02,
          and seed 42 on an L4 GPU. No direct preference optimization (DPO)
          stage was run.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          An epoch is a pass through the training mix; rank controls adapter
          capacity. Runtime micro-batch size was 8, with gradient accumulation
          of 6 / 10 for effective batches of 48 / 80 in rounds 1 / 2. Submitted
          auto-batch settings were adjusted by the trainer.
        </p>
      </section>

      <section className="panel p-6 sm:p-8">
        <Heading number="03 / Evaluation" title="Evaluation results">
          The final mean was 8.05 out of 10, not 80.5% accuracy. A separate
          language model acts as a judge, grading each response against the task
          rubric: valid structure, complete extraction, faithful quantities,
          brands and labels, and correct handling of non-grocery requests.
        </Heading>
        <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Historical development scores; evaluation configurations differ.
              </caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="pb-3 pr-4 font-semibold">
                    Configuration
                  </th>
                  <th scope="col" className="pb-3 text-right font-semibold">
                    Mean / 10
                  </th>
                </tr>
              </thead>
              <tbody>
                {scores.map(([name, score, note]) => (
                  <tr key={name} className="border-b last:border-0">
                    <th scope="row" className="py-3 pr-4 font-normal">
                      <span className="font-medium">{name}</span>
                      <span className="mt-1 block text-muted-foreground">
                        {note}
                      </span>
                    </th>
                    <td className="py-3 text-right align-top font-mono text-lg font-semibold text-primary">
                      {score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-4 leading-7 text-muted-foreground">
            <h3 className="text-lg font-semibold text-foreground">
              Schema and system-prompt changes
            </h3>
            <p>
              The original schema mistakenly required both brand and dietary
              filters together. Fixing it stopped the decoder from forcing
              unwanted fields. Removing the example-heavy system prompt then
              reduced parroting; the tuned model had trained without one.
            </p>
            <p>
              The final run attempted 167 examples: 165 were scored, 2 failed,
              and the median score was 9. The recorded API reference was about
              8.5, but the run labels do not establish its exact model identity.
            </p>
            <p className="rounded-xl bg-muted/70 p-4 text-sm leading-6">
              <strong className="text-foreground">Evaluation limits:</strong>{' '}
              these are development results with changing prompt/schema
              settings, not a controlled training-only gain. They are not a
              fresh benchmark of today’s Q4 files, product matching, or cart
              success. An independent holdout and a Q4 evaluation are still
              needed.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 border-t pt-5 text-sm sm:grid-cols-3">
          <p>
            <strong>10:</strong> complete, correct JSON and task handling.
          </p>
          <p>
            <strong>6–7:</strong> mostly right, but a real extraction flaw.
          </p>
          <p>
            <strong>1–5:</strong> broken structure or significant errors;
            critical failures cap the score.
          </p>
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <Heading
          number="04 / Integration"
          title="Local inference and Kroger integration"
        >
          The web UI is React + TypeScript with Next.js-style routes, served
          with Vinext/Vite rather than the standard Next.js server. The model
          runtime is llama.cpp. Kroger is connected through its REST API—not an
          MCP server.
        </Heading>
        <div className="grid gap-7 lg:grid-cols-2">
          <div className="space-y-4 leading-7 text-muted-foreground">
            <h3 className="text-lg font-semibold text-foreground">
              GGUF and llama.cpp
            </h3>
            <p>
              GGUF packages weights and metadata for compatible runtimes. Q4_K_M
              uses mixed quantization, largely 4-bit, to reduce file size. Both
              models in this demo are Q4 and about 731 MB each on disk; runtime
              memory is larger and also depends on context and concurrency.
            </p>
            <p>
              The app calls llama.cpp’s local{' '}
              <code className="break-all text-sm text-foreground">
                /v1/chat/completions
              </code>{' '}
              endpoint using an OpenAI-compatible request shape. Compatible does
              not mean every provider feature is interchangeable. JSON is the
              contract between the model and the rest of the app.
            </p>
            <p>
              The tuned server runs on port 8080, the original Instruct server
              on 8082. Both use a 4,096-token context setting. The app requests
              temperature 0 and schema-constrained output; only the original
              model gets a short system prompt.
            </p>
            <Source href="https://github.com/ggml-org/llama.cpp/tree/master/tools/server">
              llama.cpp server documentation
            </Source>
          </div>
          <div className="space-y-4 leading-7 text-muted-foreground">
            <h3 className="text-lg font-semibold text-foreground">
              Kroger API access
            </h3>
            <p>
              Server-side client credentials obtain catalog access with{' '}
              <code className="text-sm text-foreground">product.compact</code>.
              ZIP lookup selects a nearby store; product results provide UPCs,
              descriptions, package sizes, and prices. A UPC (Universal Product
              Code) identifies a purchasable product.
            </p>
            <p>
              Cart access uses customer sign-in through OAuth authorization code
              + PKCE, with{' '}
              <code className="text-sm text-foreground">cart.basic:write</code>.
              The registered redirect URL must match the app callback. The
              client secret stays server-side; the customer token is stored in
              an HttpOnly cookie.
            </p>
            <p>
              After review, the server sends UPCs, package quantities, and
              pickup modality to{' '}
              <code className="text-sm text-foreground">/cart/add</code>.
              Payment, fulfillment selection, and placing the order remain with
              Kroger. A successful add is not a purchase.
            </p>
            <Source href="https://www.postman.com/kroger/the-kroger-co-s-public-workspace/collection/ki6utqb/kroger-public-apis">
              Kroger’s official API collection
            </Source>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border p-5">
            <h3 className="text-lg font-semibold">How products are selected</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Each search includes the extracted product, requested dietary
              labels, and brands. Broader fallback searches still apply those
              filters. Labels are checked against catalog descriptions and
              brands against brand/description text, without a fixed preference
              list. The app requests up to eight results and shows up to four
              eligible choices. The first eligible result is selected initially,
              not the cheapest or best-fitting package.
            </p>
          </article>
          <article className="rounded-2xl border p-5">
            <h3 className="text-lg font-semibold">
              How quantities reach the cart
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The app converts requested amounts to package counts when units
              can be compared. For example, 24 eggs with an 18-count carton
              means 2 cartons (36 eggs). Changing the product recalculates the
              count; you can review and edit it. On Add to cart, the server
              calls Kroger’s PUT /cart/add. After the API confirms the request,
              Kroger’s cart opens in a new tab.
            </p>
          </article>
        </div>
        <p className="mt-6 border-t pt-5 text-sm leading-6 text-muted-foreground">
          <strong className="text-foreground">
            Other retailers and phones.
          </strong>{' '}
          Another retailer can reuse the extraction JSON but needs its own
          catalog/cart adapter and permissions. A phone needs a compatible
          on-device runtime or a reachable backend; opening this web UI on a
          phone does not move inference onto it. Retailer credentials must not
          be bundled into a mobile app.
        </p>
      </section>

      <section className="panel p-6 sm:p-8">
        <Heading number="05 / Costs" title="Local inference and API costs">
          A specialized local model can process repeated extraction tasks on an
          existing laptop without per-request language-model fees. A hosted
          model can be the better choice for low volume, broader reasoning, or
          managed scaling.
        </Heading>
        <div className="grid gap-7 lg:grid-cols-2">
          <div className="rounded-2xl bg-ink p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-wider text-lime">
              Illustrative cost calculation
            </p>
            <p className="mt-4 text-4xl font-semibold tracking-tight">
              {dollars(costPerRequest * 1_000)}{' '}
              <span className="text-lg font-normal text-white/70">
                / 1,000 requests
              </span>
            </p>
            <p className="mt-4 leading-7 text-white/80">
              Assume {inputTokens} input tokens and {outputTokens} output tokens
              per request, with hypothetical hosted rates of ${inputRate} /
              million input tokens and ${outputRate} / million output tokens.
            </p>
            <p className="mt-4 rounded-xl bg-white/10 p-4 font-mono text-sm leading-6">
              (500 × $1 + 200 × $5) ÷ 1,000,000
              <br />= $0.0015 per request
            </p>
            <p className="mt-4 text-sm leading-6 text-white/65">
              Tokens are chunks of text the model reads or generates. These are
              assumptions, not measured averages or a vendor price quote. Input
              includes instructions and context; output includes the JSON. This
              is separate from the API reference used in the evaluation.
            </p>
          </div>
          <div>
            <table className="w-full text-left text-sm">
              <caption className="pb-4 text-left text-base font-semibold">
                Monthly language-model token fees only
              </caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="pb-3 pr-3">
                    Requests
                  </th>
                  <th scope="col" className="pb-3 pr-3 text-right">
                    Hosted example
                  </th>
                  <th scope="col" className="pb-3 text-right">
                    Local
                  </th>
                </tr>
              </thead>
              <tbody>
                {[1_000, 100_000, 1_000_000].map((count) => (
                  <tr key={count} className="border-b">
                    <th scope="row" className="py-4 pr-3 font-normal">
                      {count.toLocaleString('en-US')}
                    </th>
                    <td className="py-4 pr-3 text-right font-mono">
                      {dollars(count * costPerRequest)}
                    </td>
                    <td className="py-4 text-right font-mono">$0.00</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-5 leading-7 text-muted-foreground">
              The local column excludes hardware, electricity, development,
              hosting, and maintenance. The volumes are arithmetic examples—not
              a claim that one laptop can serve that traffic.
            </p>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Project notes record $1.78 + $2.07 ={' '}
              <strong className="text-foreground">
                $3.85 for the two SFT jobs
              </strong>
              . That excludes data generation, judging, evaluations, export, and
              engineering. It is not the total project cost or a break-even
              estimate.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white/60 p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">
          Current limitations
        </h2>
        <ul className="mt-4 grid gap-4 text-sm leading-6 text-muted-foreground md:grid-cols-2">
          <li>
            <strong className="text-foreground">Extraction errors.</strong> The
            model can still miss items or misread quantities. Schema constraints
            control structure, not meaning.
          </li>
          <li>
            <strong className="text-foreground">Catalog-text matching.</strong>{' '}
            Labels and brands are checked without a fixed preference list.
            Unstated labels and synonyms can be missed; related-but-wrong
            product suggestions can still appear.
          </li>
          <li>
            <strong className="text-foreground">Package selection.</strong> The
            first eligible result is selected. Quantity conversion rounds up to
            enough packages when units can be compared; it does not choose the
            least waste or lowest total price.
          </li>
          <li>
            <strong className="text-foreground">Deployment.</strong> Production
            needs fresh evaluation, load testing, stronger session lifecycle
            handling, secure hosting, and retailer approval as applicable.
            Performance depends on the hardware and workload.
          </li>
        </ul>
        <p className="mt-6 border-t pt-4 text-sm leading-6 text-muted-foreground">
          Project facts checked against the run configs and logs, final
          evaluation JSON, scorer rubric, local model files, and current app
          code. Snapshot: September 11, 2026. “Base” in Model lab means the
          original Instruct model—not Liquid AI’s separate pretrained Base
          release.
        </p>
      </section>
    </div>
  );
}
