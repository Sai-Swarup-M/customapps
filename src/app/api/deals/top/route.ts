import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { DealRow } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50)
  const category = searchParams.get('category')

  const today = new Date().toISOString().split('T')[0]

  let baseQuery = supabaseAdmin
    .from('deals')
    .select(`
      id, raw_name, price, unit, base_unit, package_quantity,
      price_per_base_unit, effective_unit_price, deal_type,
      multi_buy_qty, multi_buy_price, sale_start_date, sale_end_date,
      stores(name), products(name, brand, category)
    `)
    .gte('sale_end_date', today)
    .not('effective_unit_price', 'is', null)
    .order('effective_unit_price', { ascending: true })
    .limit(limit)

  if (category && category !== 'all') {
    baseQuery = baseQuery.eq('products.category', category)
  }

  const { data, error } = await baseQuery.returns<DealRow[]>()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deals: data })
}
