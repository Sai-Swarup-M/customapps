import { getAnthropic, EXTRACT_SYSTEM_PROMPT } from './claude'
import { supabaseAdmin } from './supabase'
import { normalizePrice } from './normalize'

type ExtractedProduct = {
  raw_name: string
  category: string
  normalized_name: string
  brand: string | null
  price: number
  unit: string
  deal_type: 'regular' | 'multi_buy' | 'bogo'
  multi_buy_qty: number | null
  multi_buy_price: number | null
}

type ExtractionResult = {
  store_name: string
  store_address: string | null
  store_website: string | null
  sale_start_date: string | null
  sale_end_date: string | null
  products: ExtractedProduct[]
}

export async function processAdImage(imageBuffer: Buffer, mimeType: string): Promise<{
  adId: string
  storeName: string
  productsFound: number
  saleDates: { start: string | null; end: string | null }
}> {
  const base64Image = imageBuffer.toString('base64')
  const today = new Date().toISOString().split('T')[0]

  // Step 1: Extract data from image using Claude Vision
  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: EXTRACT_SYSTEM_PROMPT(today),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: base64Image },
          },
          { type: 'text', text: 'Extract all products and prices from this grocery ad.' },
        ],
      },
    ],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  // Strip markdown code fences if Claude wraps the JSON
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const extraction: ExtractionResult = JSON.parse(cleaned)

  if (!extraction.store_name) throw new Error('Could not identify a store name from this image. Make sure it is a grocery ad.')

  // Step 2: Upsert store
  const { data: store } = await supabaseAdmin
    .from('stores')
    .upsert({ name: extraction.store_name, address: extraction.store_address, website: extraction.store_website }, { onConflict: 'name' })
    .select('id')
    .single()

  if (!store) throw new Error('Failed to upsert store')

  // Step 3: Upload image placeholder URL (caller handles actual storage upload)
  const { data: ad } = await supabaseAdmin
    .from('ads')
    .insert({
      store_id: store.id,
      image_url: 'pending',
      sale_start_date: extraction.sale_start_date,
      sale_end_date: extraction.sale_end_date,
      raw_extraction: extraction as unknown as Record<string, unknown>,
      processed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (!ad) throw new Error('Failed to insert ad')

  // Step 4: Upsert products and insert deals
  for (const product of extraction.products) {
    const { data: productRow } = await supabaseAdmin
      .from('products')
      .upsert({ name: product.normalized_name, brand: product.brand, category: product.category }, { onConflict: 'name,brand' })
      .select('id')
      .single()

    if (!productRow) continue
    if (!product.price) continue  // skip products where Claude couldn't extract a price

    const normalized = normalizePrice(
      product.price,
      product.unit,
      product.deal_type,
      product.multi_buy_qty,
      product.multi_buy_price
    )

    await supabaseAdmin.from('deals').insert({
      ad_id: ad.id,
      store_id: store.id,
      product_id: productRow.id,
      raw_name: product.raw_name,
      price: product.price,
      unit: product.unit,
      base_unit: normalized.baseUnit,
      package_quantity: normalized.packageQuantity,
      price_per_base_unit: normalized.pricePerBaseUnit,
      deal_type: product.deal_type,
      multi_buy_qty: product.multi_buy_qty,
      multi_buy_price: product.multi_buy_price,
      effective_unit_price: normalized.effectiveUnitPrice,
      sale_start_date: extraction.sale_start_date,
      sale_end_date: extraction.sale_end_date,
    })
  }

  return {
    adId: ad.id,
    storeName: extraction.store_name,
    productsFound: extraction.products.length,
    saleDates: { start: extraction.sale_start_date, end: extraction.sale_end_date },
  }
}
