import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const EXTRACT_SYSTEM_PROMPT = `You are a grocery ad data extractor. Extract ALL products and prices from the ad image.

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

export const CHAT_SYSTEM_PROMPT = (dealsJson: string, today: string) => `You are a helpful grocery deals assistant. Answer using ONLY the deals data below.
Be specific: include store name, price, unit, and effective per-unit price.
When comparing stores, clearly state which is better and by how much (percentage).
If no relevant deals exist, say so honestly.

Today: ${today}

Deals data:
${dealsJson}`
