"""Targeted supplemental data for sft_grocery_v2_4 failure modes.

Covers the three patterns from reports/failure_analysis_v1.md:
  A. error_case collapse  — diverse non-grocery topics, high weight
  B. invented filters     — flavor/variety descriptors with NO filters
  C. truncation           — long run-ons (8-10 items)
plus mixed-content service distractors (dry cleaning, library books).

CRITICAL: never uses "blueberry yogurt" or "sourdough bread" as example
products anywhere — those saturated v2 training and became the model's
canned fallback list.
"""

import json
import random

import liquidrandom
from lqh.pipeline import (
    Pipeline,
    ChatMLMessage,
    Conversation,
    GenerationError,
    step,
    safe_content,
)

# Reweighted toward failure modes (compare v1: error_case 7%, brand_health 18%).
SAMPLE_TYPES = [
    ("error_case", 30),        # A: teach the error object, break canned-list prior
    ("no_filter_descriptors", 25),  # B: flavor/variety descriptors, NO filters
    ("mixed_content", 15),     # service-like distractors must be excluded
    ("runon_many", 12),        # C: 8-10 item run-ons
    ("brand_health", 10),      # keep some genuine filter cases (correct usage)
    ("simple", 8),             # keep ordinary requests
]
_TYPE_NAMES = [t for t, _ in SAMPLE_TYPES]
_TYPE_WEIGHTS = [w for _, w in SAMPLE_TYPES]

# Diverse non-grocery topics for error cases (Pattern A).
NON_GROCERY_TOPICS = [
    "asking about the weather or forecast",
    "asking about traffic or road conditions",
    "asking about a sports game or score",
    "joking or retracting a previous grocery mention ('just kidding about the groceries')",
    "asking about paying a bill or checking an account balance",
    "asking to set a reminder or calendar event",
    "asking about news, politics, or current events",
    "asking about a movie, TV show, or music",
    "asking for directions or travel plans",
    "asking about their health symptoms or medication schedule",
    "asking about the time, date, or a holiday",
    "making small talk or greeting the assistant",
    "asking about their smart home devices (lights, thermostat, locks)",
    "asking about a package delivery or mail",
    "asking for a joke, story, or recipe to cook (no shopping)",
    "asking about school, homework, or work deadlines",
    "asking about pets' vet appointments or grooming",
    "asking about gym or exercise plans",
]

# Descriptor words that must stay in `product` and NEVER become filters (Pattern B).
# These are the exact failure vocabulary observed in the eval.
DESCRIPTOR_WORDS = [
    "chocolate", "chocolate sandwich", "toasted", "salted", "unsalted",
    "fresh", "wild-caught", "black", "green", "red", "yellow", "dark",
    "light", "whole grain", "whole wheat", "self-raising", "vanilla",
    "smoked", "roasted", "dried", "frozen", "canned", "crunchy", "creamy",
    "spicy", "mild", "sweet", "sour", "instant", "brewed", "cold brew",
    "sparkling", "still", "diet", "zero", "regular", "large", "small",
    "baby", "english", "irish", "swiss", "greek", "italian", "japanese",
    "sourdough", "brioche", "rye", "pumpernickel", "jasmine", "basmati",
    "arborio", "long-grain", "short-grain", "extra virgin", "virgin",
    "refined", "unrefined", "raw", "organic-adjacent-sounding but NOT dietary: none here",
]
# Clean the joke entry out (kept list readable above).
DESCRIPTOR_WORDS = [w for w in DESCRIPTOR_WORDS if "NOT dietary" not in w]

# Service/errand distractors for mixed content (must be EXCLUDED from output).
SERVICE_DISTRACTORS = [
    "pick up my dry cleaning",
    "drop off library books",
    "grab wool for my weaving project",
    "pick up a prescription at the pharmacy counter",
    "mail a package at the post office",
    "return the rental car keys",
    "drop off the kids at soccer practice",
    "pick up my repaired bike from the shop",
    "water the office plants",
    "renew the gym membership at the front desk",
]

# Real canonical brands for genuine brand_health cases (correct usage).
REAL_BRANDS = [
    "Coca-Cola", "Kraft", "Chobani", "Oreo", "Doritos", "Barilla",
    "De Cecco", "Organic Valley", "Horizon", "Lundberg", "Bertolli",
    "Filippo Berio", "Tilda", "Goya", "Bimbo", "Eggland's Best",
    "Twinings", "Lee Kum Kee", "McCain", "Nissin", "Kadoya", "Hikari",
    "Bushells", "White Wings", "SPC", "Pura", "Devondale", "Alpro",
    "Lindt", "Tyson", "Finish", "Tide", "Bounty", "Vitasoy",
]
DIETARY_LABELS = [
    "organic", "gluten-free", "vegan", "keto", "dairy-free", "low-sodium",
    "lactose-free", "caffeine-free", "heart-healthy", "low-calorie",
    "high-protein", "sugar-free", "non-GMO", "halal", "kosher",
]

INTENT_SCHEMA_DESC = """{
  "is_grocery_request": true/false,
  "title": "<short natural list title, or null>",
  "user_names_list": "<the phrase the user calls the list, or null>",
  "items": [
    {
      "product": "<generic product name: brand stripped, flavor/variety kept, no size/packaging>",
      "quantity": <number or null>,
      "unit": "<free-text unit or null>",
      "brands": ["<canonical brand name>", ...],
      "health_labels": ["organic", "keto", ...]
    }
  ],
  "non_grocery_content": "<non-grocery sentence to weave in, or null>",
  "duplicate_of": <index of an earlier item this one repeats, or null>,
  "adversarial_instruction": null
}"""


class GroceryFailuresPipeline(Pipeline):
    async def generate(self, client, input=None) -> Conversation:
        self.persona = liquidrandom.persona()
        self.sample_type = random.choices(_TYPE_NAMES, weights=_TYPE_WEIGHTS, k=1)[0]
        self.seed = f"{self.persona.name}-fail-{self.sample_type}-{random.randint(0, 9999)}"

        await self._generate_intent(client)
        await self._render_noisy_text(client)

        gold = self._build_gold()
        return [
            ChatMLMessage("user", self.noisy_text),
            ChatMLMessage("assistant", gold),
        ]

    @step(retries=4)
    async def _generate_intent(self, client):
        type_guidance = {
            "error_case": (
                "NOT a grocery request at all. Set is_grocery_request=false and items=[]. "
                f"Topic (pick one, make it sound like a real casual chat/voice message): "
                f"{random.choice(NON_GROCERY_TOPICS)}. "
                "The message must contain ZERO grocery or household items — no food, "
                "no drinks, no supplies. If it mentions an errand, it must be a service "
                "(pharmacy, post office), not a purchasable grocery product."
            ),
            "no_filter_descriptors": (
                "A grocery request with 3-6 items where 2-4 items carry flavor/variety "
                f"descriptors from this list: {', '.join(random.sample(DESCRIPTOR_WORDS, 8))}. "
                "CRITICAL: these descriptors are part of the product name ONLY. The items "
                "must have EMPTY brands and EMPTY health_labels — the user expresses NO "
                "brand and NO dietary preference. Optionally 1-2 items may have a quantity."
            ),
            "mixed_content": (
                "A grocery request with 3-5 items PLUS this non-grocery errand woven in: "
                f"'{random.choice(SERVICE_DISTRACTORS)}' (put it in non_grocery_content). "
                "The errand is NOT a grocery item and must NOT appear in items. "
                "1-2 grocery items may carry a real brand or dietary label."
            ),
            "runon_many": (
                "A grocery request with 8-10 items expressed as one long breathless "
                "run-on stream of consciousness with 'and um' / 'oh and' connectors. "
                "Mix in quantities for a few items and brands/labels for 2-3 items."
            ),
            "brand_health": (
                "A grocery request with 3-5 items where 2-3 carry a REAL brand from: "
                f"{', '.join(random.sample(REAL_BRANDS, 6))} and/or a genuine dietary "
                f"label from: {', '.join(random.sample(DIETARY_LABELS, 5))}. "
                "Items without a stated brand/label must have empty brands/labels."
            ),
            "simple": (
                "A plain grocery request with 2-5 items; 1-3 with quantities "
                "(units like 'gallon', 'loaf', 'bunch'). No brands or labels."
            ),
        }[self.sample_type]

        resp = await client.chat.completions.create(
            model=f"random:medium:{self.seed}",
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Design a grocery shopping request intent as JSON. "
                        f"Shopper persona: {self.persona.brief()}. "
                        f"Scenario type: {type_guidance}\n\n"
                        f"Return ONLY a JSON object with this structure:\n{INTENT_SCHEMA_DESC}\n\n"
                        "Rules: 'product' must be generic (no brand, no size/packaging, "
                        "flavor/variety kept, e.g. 'dark chocolate' or 'jasmine rice'). "
                        "'quantity' is a JSON number or null. 'brands' are canonical brand "
                        "names only — never a descriptor, adjective, or product name. "
                        "'health_labels' contain ONLY dietary terms the shopper actually "
                        "said (organic, gluten-free, vegan, keto, low-sodium, ...) — never "
                        "a flavor, variety, or product attribute. Use realistic grocery "
                        "products; vary them widely across requests.\n\n"
                        "CRITICAL: every entry in 'items' must be a grocery or household "
                        "item sold by grocery retailers. Services and errands go ONLY in "
                        "'non_grocery_content', never in 'items'.\n"
                        "CRITICAL: 'title' must be a short natural shopping-list title "
                        "(e.g. 'Taco Night', 'Breakfast Stuff', 'Weekly Restock', "
                        "'Grocery Run'). NEVER use a person's name in the title."
                    ),
                }
            ],
            response_format={"type": "json_object"},
        )
        raw = safe_content(resp)
        if not raw:
            raise GenerationError("empty intent response")
        try:
            intent = json.loads(raw)
        except json.JSONDecodeError as e:
            raise GenerationError(f"intent not valid JSON: {e}")

        if "is_grocery_request" not in intent or "items" not in intent:
            raise GenerationError("intent missing required keys")

        if intent["is_grocery_request"]:
            items = intent["items"]
            max_items = 10 if self.sample_type == "runon_many" else 6
            if not isinstance(items, list) or not (1 <= len(items) <= max_items):
                raise GenerationError(f"bad items list: {items!r}")
            for it in items:
                if not isinstance(it, dict) or not it.get("product"):
                    raise GenerationError(f"bad item: {it!r}")
                q = it.get("quantity")
                if q is not None and not isinstance(q, (int, float)):
                    raise GenerationError(f"quantity not numeric: {q!r}")
                # Pattern B enforcement: descriptor-only items must be filter-free.
                if self.sample_type == "no_filter_descriptors":
                    if it.get("brands") or it.get("health_labels"):
                        raise GenerationError(
                            "no_filter_descriptors item must have no brands/labels: "
                            f"{it!r}"
                        )
        else:
            if intent["items"]:
                raise GenerationError("error-case intent must have empty items")

        self.intent = intent

    @step(retries=4)
    async def _render_noisy_text(self, client):
        if not self.intent["is_grocery_request"]:
            await self._render_non_grocery(client)
            return

        guidance = (
            "Write the user's grocery request as ONE noisy, conversational "
            "message (typed or voice-transcribed style). Express EVERY item "
            "from the intent exactly once. Include the quantities, brands, and "
            "health labels where the intent has them — shoppers say brands "
            "casually and dietary terms naturally. Do NOT mention "
            "quantities/brands/labels the intent doesn't have, and do NOT omit "
            "any the intent DOES have — every one must appear in the message."
        )
        payload = {k: v for k, v in self.intent.items() if k != "is_grocery_request"}

        noise_instruction = {
            "error_case": "",
            "no_filter_descriptors": "Keep the flavor/variety descriptors attached to the products, exactly as a shopper would say them ('toasted sesame oil', 'wild-caught tuna'). Casual lowercase typing is fine.",
            "mixed_content": f"Weave in this non-grocery errand naturally: {self.intent.get('non_grocery_content')}.",
            "runon_many": "Make it one long breathless run-on sentence with 'and um' / 'oh and' connectors.",
            "brand_health": "Shoppers say brands casually ('coke', 'some kraft cheese') and dietary terms naturally ('organic', 'gluten free').",
            "simple": "Casual lowercase typing, no punctuation, is fine.",
        }[self.sample_type]

        resp = await client.chat.completions.create(
            model=f"random:small:{self.seed}",
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"{guidance}\n\nIntent (JSON):\n{json.dumps(payload)}\n\n"
                        f"{noise_instruction}\n"
                        "Write ONLY the user's message text — no quotes, no "
                        "explanation, no role labels. Keep it under 60 words "
                        "unless it's a many-item run-on."
                    ),
                }
            ],
        )
        text = safe_content(resp)
        if not text:
            raise GenerationError("empty noisy text")
        text = text.strip().strip('"').strip()
        if len(text) < 8:
            raise GenerationError("noisy text too short")
        self.noisy_text = text

        # Grounding verification (medium model, as validated in v1).
        resp2 = await client.chat.completions.create(
            model=f"random:medium:{self.seed}",
            messages=[
                {
                    "role": "user",
                    "content": (
                        "A grocery request message was supposed to express this "
                        f"intent:\n{json.dumps(payload)}\n\nThe actual message:\n"
                        f"\"{text}\"\n\nCheck whether the message expresses every "
                        "item, and every quantity, unit, brand, and health label "
                        "the intent has (typos and casual phrasing count as "
                        "expressed; digits vs word-numbers both count). Return "
                        "ONLY a JSON object: {\"missing\": [\"<description of each "
                        "missing detail>\"]} — empty list if nothing is missing. "
                        "Do not list things the intent doesn't have."
                    ),
                }
            ],
            response_format={"type": "json_object"},
        )
        raw = safe_content(resp2)
        if not raw:
            raise GenerationError("empty verification response")
        try:
            verdict = json.loads(raw)
        except json.JSONDecodeError:
            raise GenerationError("verification not valid JSON")
        missing = verdict.get("missing") or []
        if missing:
            raise GenerationError(f"render dropped intent details: {missing}")

    async def _render_non_grocery(self, client):
        guidance = (
            "Write a short (1-2 sentence) user message to a grocery shopping "
            "assistant that is NOT about groceries at all. It should sound like "
            "a real casual chat/voice message. It must not mention any food, "
            "drink, or household product."
        )
        resp = await client.chat.completions.create(
            model=f"random:small:{self.seed}",
            messages=[{"role": "user", "content": guidance}],
        )
        text = safe_content(resp)
        if not text:
            raise GenerationError("empty noisy text")
        text = text.strip().strip('"').strip()
        if len(text) < 8:
            raise GenerationError("noisy text too short")
        self.noisy_text = text

    def _build_gold(self) -> str:
        if not self.intent["is_grocery_request"]:
            return json.dumps({"error": "not_a_grocery_request"})

        items = self.intent["items"]
        dup_map = {}
        for idx, it in enumerate(items):
            dup_of = it.get("duplicate_of")
            if dup_of is not None and isinstance(dup_of, int) and 0 <= dup_of < idx:
                dup_map[dup_of] = it

        line_items = []
        for idx, it in enumerate(items):
            if idx in dup_map:
                continue
            line_items.append(self._item_to_line_item(it))

        title = self.intent.get("user_names_list") or self.intent.get("title") or "Grocery Run"
        return json.dumps({"title": title, "line_items": line_items})

    def _item_to_line_item(self, it: dict) -> dict:
        li = {"product": it["product"]}
        if it.get("quantity") is not None:
            measurement = {"quantity": it["quantity"]}
            measurement["unit"] = it.get("unit") or "each"
            li["line_item_measurements"] = measurement
        brands = it.get("brands") or []
        labels = it.get("health_labels") or []
        if brands or labels:
            filters = {}
            if brands:
                filters["brand_filters"] = [{"brand": b} for b in brands]
            if labels:
                filters["health_filters"] = [{"label": l} for l in labels]
            li["filters"] = filters
        return li
