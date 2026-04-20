import { getToday } from '@/lib/config'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAnthropic, CHAT_SYSTEM_PROMPT, INTENT_PROMPT, ChatIntent } from '@/lib/claude'
import type { DealRow } from '@/lib/types'

type HistoryMessage = { role: 'user' | 'assistant'; content: string }

async function fetchProductsAndStores(): Promise<{ products: string[]; stores: string[] }> {
  const [{ data: prods }, { data: strs }] = await Promise.all([
    supabaseAdmin.from('products').select('name, brand'),
    supabaseAdmin.from('stores').select('name'),
  ])
  const products = (prods ?? []).map((p: { name: string; brand: string | null }) =>
    p.brand ? `${p.name} | ${p.brand}` : p.name
  )
  const stores = (strs ?? []).map((s: { name: string }) => s.name)
  return { products, stores }
}

async function extractIntent(
  message: string,
  history: HistoryMessage[],
  today: string,
  products: string[],
  stores: string[]
): Promise<ChatIntent> {
  const messages: HistoryMessage[] = [
    ...history.slice(-4),
    { role: 'user', content: message },
  ]
  const response = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: INTENT_PROMPT(today, products, stores),
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
  }
  // all_history: no date filter

  // Product filter
  if (intent.product) {
    query = query.ilike('products.name', `%${intent.product}%`)
  }

  // Brand filter
  if (intent.brand) {
    query = query.ilike('products.brand', `%${intent.brand}%`)
  }

  // Store filter
  if (intent.store) {
    query = query.ilike('stores.name', `%${intent.store}%`)
  }

  const { data } = await query
    .order('effective_unit_price', { ascending: true })
    .returns<DealRow[]>()

  return data ?? []
}

export async function POST(req: NextRequest) {
  const { message, history = [] }: { message: string; history: HistoryMessage[] } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'No message' }, { status: 400 })

  const today = getToday()

  // Follow-up: skip DB query, continue conversation from history
  // We still extract intent to check is_followup, but only need stores/products for non-followups
  const { products, stores } = await fetchProductsAndStores()
  const intent = await extractIntent(message, history, today, products, stores)

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
