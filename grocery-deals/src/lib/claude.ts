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

export const INTENT_PROMPT = (today: string, products: string[], stores: string[]) =>
  `Today is ${today} (YYYY-MM-DD).

Known products (name | brand): ${products.join(', ')}
Known stores: ${stores.join(', ')}

Extract the user's intent from their message. Return ONLY valid JSON, no explanation:
{
  "is_followup": false,
  "product": "exact product name from the list above, or null",
  "brand": "exact brand from the list above, or null",
  "store": "exact store name from the list above, or null",
  "date_type": "current_week",
  "date_start": null,
  "date_end": null
}

Rules:
- is_followup: true if the message references a previous answer ("those", "that one", "the cheaper one", "which of them", "compare those") — false otherwise
- product/brand: match to the closest item in the known list, tolerating typos and partial names. null if not asking about a specific product
- store: match to known stores if mentioned, null otherwise
- date_type:
  - "current_week" if no time reference or "this week" → date_start/end = null
  - "specific_range" if a past/future period is mentioned → fill date_start and date_end
  - "all_history" if "all time", "ever", "history", "always" → date_start/end = null
- specific_range date rules:
  - "last week" → previous Monday to Sunday
  - "last N weeks" → N×7 days ago to today
  - "last month" → first to last day of previous month
  - "April first week" / "1st week of April" → April 1–7 of nearest relevant year
  - "April second week" → April 8–14, third → 15–21, fourth → 22–30`

export const CHAT_SYSTEM_PROMPT = (dealsJson: string, today: string) =>
  `You are a helpful grocery deals assistant. Answer using ONLY the deals data below.
Be specific: include store name, price, unit, and effective per-unit price.
When comparing stores, clearly state which is better and by how much (percentage).
If no relevant deals exist in the data provided, say so honestly — do not guess.

Today: ${today}

Deals data:
${dealsJson}`
