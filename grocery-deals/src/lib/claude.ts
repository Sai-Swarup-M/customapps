import Anthropic from '@anthropic-ai/sdk'
import { config } from './config'

export function getAnthropic(): Anthropic {
  return new Anthropic({ apiKey: config.anthropicApiKey })
}

export const EXTRACT_SYSTEM_PROMPT = (today: string) => `You are a grocery ad data extractor. Extract ALL products and prices from the ad image.
Today's date is ${today}. Use this to infer the correct year for sale dates when the year is not shown in the ad.

Return ONLY valid JSON in this exact structure — no markdown, no explanation:
{
  "store_name": "string",
  "store_address": "string or null",
  "store_website": "string or null",
  "sale_start_date": "YYYY-MM-DD or null",
  "sale_end_date": "YYYY-MM-DD or null",
  "products": [
    {
      "raw_name": "exact product name as shown in ad",
      "category": "Fresh Produce | Dry Products | Dairy | Meat | Snacks | Beverages | Other",
      "normalized_name": "brand-agnostic generic name (e.g. 'Basmati Rice', 'Green Beans')",
      "brand": "brand name only, null for unbranded produce (e.g. 'India Gate', 'Laxmi')",
      "price": 5.49,
      "unit": "LB",
      "deal_type": "regular | multi_buy | bogo",
      "multi_buy_qty": null,
      "multi_buy_price": null
    }
  ]
}

Rules:
- Extract every product visible, even if partially obscured
- For "BUY 2 FOR $6.00": deal_type=multi_buy, multi_buy_qty=2, multi_buy_price=6.00, price=price of single item if shown else null
- For "2 FOR $5.00": same pattern
- normalized_name must omit brand, size, and variety descriptors
- Infer year from context if not shown in dates
- Use null for any truly unknown field`

export type ChatIntent = {
  is_followup: boolean
  product: string | null
  brand: string | null
  store: string | null
  date_type: 'current_week' | 'specific_range' | 'all_history'
  date_start: string | null
  date_end: string | null
}

export const INTENT_PROMPT = (today: string, productNames: string[], stores: string[]) =>
  `You are a query intent extractor for a grocery deals database. Today is ${today} (YYYY-MM-DD).

Known products: ${productNames.join(', ')}
Known stores: ${stores.join(', ')}

Return ONLY this JSON, no markdown, no explanation:
{"is_followup":false,"product":null,"brand":null,"store":null,"date_type":"current_week","date_start":null,"date_end":null}

RULES:

is_followup: true ONLY if message uses pronouns referencing the previous answer ("those", "that one", "the cheaper one", "which of them", "compare those"). Otherwise false.

product: match the user's product mention to the closest item in the Known products list above.
  Tolerate typos, partial names, and colloquial names (e.g. "atta" → "Whole Wheat Flour (Atta)", "basmatii rce" → "Basmati Rice", "dal" → "Toor Dal").
  Return the EXACT name from the list. null if no product is mentioned or no confident match exists.

brand: brand name if explicitly mentioned (e.g. "India Gate", "Laxmi"). null otherwise.

store: match to one of the Known stores above if mentioned. null otherwise.

date_type — choose exactly one:
  "all_history"    → user asks about availability, range, oldest/newest, min/max dates, "what weeks do you have", "what data do you have", "all time", "ever", "history", "always", "is it a good price", "best price ever"
  "specific_range" → user mentions ANY specific time period: "last week", "last 2 weeks", "last month", "April second week", "week of April 10", "April 10 week"
  "current_week"   → no time reference, or "this week", "today", "now", "current"

For "all_history": date_start and date_end must be null.
For "specific_range" fill date_start and date_end (YYYY-MM-DD):
  - "last week" → Monday to Sunday of the week before today
  - "last N weeks" → (N×7) days ago to today
  - "last month" → first to last day of previous calendar month
  - "[Month] first week" → Month 1–7, second → 8–14, third → 15–21, fourth → 22–30
  - "week of [Month] [D]" / "[Month] [D] week" → Monday of that week to Sunday
For "current_week": date_start and date_end must be null.`

export const CHAT_SYSTEM_PROMPT = (dealsJson: string, today: string) =>
  `You are a helpful grocery deals assistant. Answer using ONLY the deals data below.
Be specific: include store name, price, unit, and effective per-unit price.
When comparing stores, clearly state which is better and by how much (percentage).
If no relevant deals exist in the data provided, say so honestly — do not guess.

Today: ${today}

Deals data:
${dealsJson}`
