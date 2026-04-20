import { getToday } from '@/lib/config'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAnthropic, CHAT_SYSTEM_PROMPT, INTENT_PROMPT, ChatIntent } from '@/lib/claude'
import type { DealRow } from '@/lib/types'

type HistoryMessage = { role: 'user' | 'assistant'; content: string }

async function fetchStores(): Promise<string[]> {
  const { data } = await supabaseAdmin.from('stores').select('name')
  return (data ?? []).map((s: { name: string }) => s.name)
}

async function extractIntent(
  message: string,
  history: HistoryMessage[],
  today: string,
  stores: string[]
): Promise<ChatIntent> {
  const messages: HistoryMessage[] = [
    ...history.slice(-4),
    { role: 'user', content: message },
  ]
  const response = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: INTENT_PROMPT(today, stores),
    messages,
  })
  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  try {
    return JSON.parse(text) as ChatIntent
  } catch {
    return { is_followup: false, product: null, brand: null, store: null, date_type: 'current_week', date_start: null, date_end: null }
  }
}

async function fetchDeals(intent: ChatIntent, today: string): Promise<DealRow[]> {
  // Resolve product IDs — multi-word fuzzy search across name + brand
  let productIds: string[] | null = null
  if (intent.product || intent.brand) {
    const { data: allProds } = await supabaseAdmin
      .from('products').select('id, name, brand')
      .returns<{ id: string; name: string; brand: string | null }[]>()

    const words = [
      ...(intent.product ?? '').toLowerCase().split(/\s+/).filter(Boolean),
      ...(intent.brand ?? '').toLowerCase().split(/\s+/).filter(Boolean),
    ]

    productIds = (allProds ?? [])
      .filter((p) => {
        const haystack = `${p.name} ${p.brand ?? ''}`.toLowerCase()
        return words.every((w) => haystack.includes(w))
      })
      .map((p) => p.id)

    if (productIds.length === 0) return []
  }

  // Resolve store IDs upfront for same reason
  let storeIds: string[] | null = null
  if (intent.store) {
    const { data: strs } = await supabaseAdmin
      .from('stores').select('id').ilike('name', `%${intent.store}%`)
      .returns<{ id: string }[]>()
    storeIds = strs?.map((s) => s.id) ?? []
    if (storeIds.length === 0) return []
  }

  let query = supabaseAdmin
    .from('deals')
    .select(`
      raw_name, price, unit, base_unit, package_quantity,
      price_per_base_unit, effective_unit_price, deal_type,
      multi_buy_qty, multi_buy_price, sale_start_date, sale_end_date,
      stores(name), products(name, brand, category)
    `)

  // Date filter
  if (intent.date_type === 'current_week') {
    query = query.gte('sale_end_date', today)
  } else if (intent.date_type === 'specific_range' && intent.date_start && intent.date_end) {
    query = query.lte('sale_start_date', intent.date_end).gte('sale_end_date', intent.date_start)
  } else if (intent.date_type === 'all_history') {
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - 54 * 7)
    query = query.gte('sale_start_date', cutoff.toISOString().split('T')[0])
  }

  if (productIds) query = query.in('product_id', productIds)
  if (storeIds)   query = query.in('store_id', storeIds)

  const { data } = await query
    .order('sale_start_date', { ascending: false })
    .order('effective_unit_price', { ascending: true })
    .limit(500)
    .returns<DealRow[]>()

  return data ?? []
}

export async function POST(req: NextRequest) {
  const { message, history = [] }: { message: string; history: HistoryMessage[] } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'No message' }, { status: 400 })

  const today = getToday()

  // Follow-up: skip DB query, continue conversation from history
  // We still extract intent to check is_followup, but only need stores/products for non-followups
  const stores = await fetchStores()
  const intent = await extractIntent(message, history, today, stores)
  console.log('INTENT:', JSON.stringify(intent))

  let dealsJson: string
  let deals: DealRow[] = []

  if (intent.is_followup && history.length > 0) {
    // Reuse context from conversation — no DB query needed
    dealsJson = '(see previous messages for deal data)'
  } else {
    deals = await fetchDeals(intent, today)
    dealsJson = JSON.stringify(deals, null, 2)
  }

  const conversationMessages = [
    ...history,
    { role: 'user' as const, content: message },
  ]

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: CHAT_SYSTEM_PROMPT(dealsJson, today),
    messages: conversationMessages,
  })

  const answer = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ answer, deals })
}
