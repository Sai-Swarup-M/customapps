import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { DealRow } from '@/lib/types'

export async function GET() {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('deals')
    .select(`
      id, raw_name, price, unit, base_unit, package_quantity,
      price_per_base_unit, effective_unit_price, deal_type,
      multi_buy_qty, multi_buy_price, sale_start_date, sale_end_date,
      stores(name), products(name, brand, category)
    `)
    .gte('sale_end_date', today)
    .order('sale_start_date', { ascending: false })
    .returns<DealRow[]>()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deals: data })
}
