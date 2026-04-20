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

export const DATE_RANGE_PROMPT = (today: string) => `Today is ${today} (YYYY-MM-DD).
Extract the date range the user is asking about. Return ONLY valid JSON, no explanation:
{"start":"YYYY-MM-DD","end":"YYYY-MM-DD"}

Rules:
- No time reference, "this week", or "current week" → Monday to Sunday of the week containing today
- "last week" → Monday to Sunday of the previous week
- "last 2 weeks" → 14 days ago to today
- "last 3 weeks" → 21 days ago to today
- "April first week" / "1st week of April" → April 1–7 of the nearest relevant year
- "April second week" / "2nd week of April" → April 8–14
- "April third week" → April 15–21
- "April fourth week" / "last week of April" → April 22–30
- Apply same pattern for any month
- "last month" → first to last day of the previous calendar month`

export const CHAT_SYSTEM_PROMPT = (dealsJson: string, today: string) => `You are a helpful grocery deals assistant. Answer using ONLY the deals data below.
Be specific: include store name, price, unit, and effective per-unit price.
When comparing stores, clearly state which is better and by how much (percentage).
If no relevant deals exist in the data provided, say so honestly — do not guess.

Today: ${today}

Deals data:
${dealsJson}`
