import { getToday } from '@/lib/config'
import DealCard from '@/components/DealCard'
import { supabaseAdmin } from '@/lib/supabase'

export const revalidate = 300

async function getTopDeals() {
  const today = getToday()
  const { data } = await supabaseAdmin
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
    .limit(20)
  return data ?? []
}

export default async function HomePage() {
  const deals = await getTopDeals()

  return (
    <main className="px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-1">This Week&apos;s Best Deals</h1>
      <p className="text-sm text-gray-400 mb-4">Sorted by best price per unit</p>

      {deals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🛒</p>
          <p className="font-medium">No deals yet</p>
          <p className="text-sm mt-1">Upload your first ad to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {deals.map((deal) => (
            // @ts-expect-error supabase join types
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </main>
  )
}
