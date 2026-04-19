import { supabaseAdmin } from '@/lib/supabase'

export const revalidate = 600

async function getPriceHistory() {
  const { data } = await supabaseAdmin
    .from('deals')
    .select(`
      effective_unit_price, unit, base_unit, sale_start_date,
      stores(name), products(name, brand)
    `)
    .order('sale_start_date', { ascending: false })
    .limit(200)
  return data ?? []
}

type HistoryRow = {
  effective_unit_price: number | null
  unit: string
  base_unit: string | null
  sale_start_date: string | null
  stores: { name: string } | null
  products: { name: string; brand: string | null } | null
}

type GroupedProduct = {
  productKey: string
  entries: HistoryRow[]
}

function groupByProduct(rows: HistoryRow[]): GroupedProduct[] {
  const map = new Map<string, HistoryRow[]>()
  for (const row of rows) {
    const key = `${row.products?.brand ?? ''} ${row.products?.name ?? 'Unknown'}`.trim()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(row)
  }
  return Array.from(map.entries())
    .map(([productKey, entries]) => ({ productKey, entries }))
    .filter((g) => g.entries.length > 1)
    .slice(0, 20)
}

export default async function HistoryPage() {
  const rows = await getPriceHistory()
  // @ts-expect-error supabase join types
  const groups = groupByProduct(rows)

  return (
    <main className="px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Price History</h1>
      <p className="text-sm text-gray-400 mb-6">Products seen across multiple weeks</p>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📈</p>
          <p className="font-medium">Not enough data yet</p>
          <p className="text-sm mt-1">Upload ads from multiple weeks to see trends</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ productKey, entries }) => (
            <div key={productKey} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="font-semibold text-gray-900 mb-3">{productKey}</p>
              <div className="flex flex-col gap-2">
                {entries.map((e, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">{e.sale_start_date}</span>
                    <span className="text-gray-600">{e.stores?.name}</span>
                    <span className="font-medium text-green-700">
                      ${e.effective_unit_price}/{e.base_unit ?? e.unit}
                    </span>
                  </div>
                ))}
              </div>
              {entries.length >= 2 && (() => {
                const prices = entries
                  .map((e) => e.effective_unit_price)
                  .filter((p): p is number => p !== null)
                const min = Math.min(...prices)
                const max = Math.max(...prices)
                const diff = Math.round(((max - min) / max) * 100)
                return diff > 0 ? (
                  <p className="text-xs text-gray-400 mt-2">
                    Range: ${min} – ${max} · {diff}% variance
                  </p>
                ) : null
              })()}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
