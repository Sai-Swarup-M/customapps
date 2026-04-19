export type DealRow = {
  id?: string
  raw_name: string
  price: number
  unit: string
  base_unit: string | null
  package_quantity: number | null
  price_per_base_unit: number | null
  effective_unit_price: number | null
  deal_type: string | null
  multi_buy_qty: number | null
  multi_buy_price: number | null
  sale_start_date: string | null
  sale_end_date: string | null
  stores: { name: string } | null
  products: { name: string; brand: string | null; category: string | null } | null
}
