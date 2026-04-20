import { getToday } from '@/lib/config'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAnthropic, CHAT_SYSTEM_PROMPT, DATE_RANGE_PROMPT } from '@/lib/claude'
import type { DealRow } from '@/lib/types'

async function extractDateRange(message: string, today: string): Promise<{ start: string; end: string }> {
  const response = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    system: DATE_RANGE_PROMPT(today),
    messages: [{ role: 'user', content: message }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  try {
    return JSON.parse(text)
  } catch {
    // Fall back to current week
    const todayDate = new Date(today)
    const day = todayDate.getDay()
    const monday = new Date(todayDate)
    monday.setDate(todayDate.getDate() - ((day + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    }
  }
}

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'No message' }, { status: 400 })

  const today = getToday()

  const { start, end } = await extractDateRange(message, today)

  const { data: deals } = await supabaseAdmin
    .from('deals')
    .select(`
      raw_name, price, unit, base_unit, package_quantity,
      price_per_base_unit, effective_unit_price, deal_type,
      multi_buy_qty, multi_buy_price, sale_start_date, sale_end_date,
      stores(name), products(name, brand, category)
    `)
    .lte('sale_start_date', end)
    .gte('sale_end_date', start)
    .order('effective_unit_price', { ascending: true })
    .returns<DealRow[]>()

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: CHAT_SYSTEM_PROMPT(JSON.stringify(deals, null, 2), today),
    messages: [{ role: 'user', content: message }],
  })

  const answer = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ answer, deals })
}
