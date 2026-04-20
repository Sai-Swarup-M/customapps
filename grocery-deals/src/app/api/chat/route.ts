import { getToday } from '@/lib/config'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAnthropic, CHAT_SYSTEM_PROMPT } from '@/lib/claude'
import type { DealRow } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'No message' }, { status: 400 })

  const today = getToday()

  const { data: deals } = await supabaseAdmin
    .from('deals')
    .select(`
      raw_name, price, unit, base_unit, package_quantity,
      price_per_base_unit, effective_unit_price, deal_type,
      multi_buy_qty, multi_buy_price, sale_start_date, sale_end_date,
      stores(name), products(name, brand, category)
    `)
    .gte('sale_end_date', today)
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
