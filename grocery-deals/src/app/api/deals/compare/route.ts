import { getToday } from '@/lib/config'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { DealRow } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const product = searchParams.get('product')
  const brand = searchParams.get('brand')

  if (!product) return NextResponse.json({ error: 'product param required' }, { status: 400 })

  const today = getToday()

  let productQuery = supabaseAdmin
    .from('products')
    .select('id')
    .ilike('name', `%${product}%`)

  if (brand) productQuery = productQuery.ilike('brand', `%${brand}%`)

  const { data: products } = await productQuery.returns<{ id: string }[]>()
  if (!products?.length) return NextResponse.json({ deals: [] })

  const productIds = products.map((p) => p.id)

  const { data, error } = await supabaseAdmin
    .from('deals')
    .select(`
      id, raw_name, price, unit, base_unit, package_quantity,
      price_per_base_unit, effective_unit_price, deal_type,
      multi_buy_qty, multi_buy_price, sale_start_date, sale_end_date,
      stores(name), products(name, brand, category)
    `)
    .in('product_id', productIds)
    .gte('sale_end_date', today)
    .order('effective_unit_price', { ascending: true })
    .returns<DealRow[]>()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deals: data })
}
