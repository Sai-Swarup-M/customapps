'use client'

type Deal = {
  id: string
  raw_name: string
  price: number
  unit: string
  base_unit: string | null
  effective_unit_price: number | null
  deal_type: string | null
  multi_buy_qty: number | null
  multi_buy_price: number | null
  sale_end_date: string | null
  stores: { name: string } | null
  products: { name: string; brand: string | null; category: string | null } | null
}

export default function DealCard({ deal }: { deal: Deal }) {
  const isMultiBuy = deal.deal_type === 'multi_buy' && deal.multi_buy_qty && deal.multi_buy_price
  const daysLeft = deal.sale_end_date
    ? Math.ceil((new Date(deal.sale_end_date).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 leading-snug truncate">{deal.raw_name}</p>
          {deal.products?.brand && (
            <p className="text-xs text-gray-400">{deal.products.brand}</p>
          )}
        </div>
        {deal.products?.category && (
          <span className="text-xs bg-green-50 text-green-700 rounded-full px-2 py-0.5 whitespace-nowrap">
            {deal.products.category}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          {isMultiBuy ? (
            <div>
              <span className="text-lg font-bold text-green-600">
                {deal.multi_buy_qty} for ${deal.multi_buy_price}
              </span>
              <p className="text-xs text-gray-500">
                ${deal.effective_unit_price}/{deal.base_unit ?? deal.unit} each
              </p>
            </div>
          ) : (
            <div>
              <span className="text-lg font-bold text-green-600">
                ${deal.price}/{deal.unit}
              </span>
              {deal.base_unit && deal.base_unit !== deal.unit && (
                <p className="text-xs text-gray-500">
                  ${deal.effective_unit_price}/{deal.base_unit} normalized
                </p>
              )}
            </div>
          )}
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">{deal.stores?.name}</p>
          {daysLeft !== null && (
            <p className={`text-xs ${daysLeft <= 2 ? 'text-red-500' : 'text-gray-400'}`}>
              {daysLeft <= 0 ? 'Expired' : `${daysLeft}d left`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
