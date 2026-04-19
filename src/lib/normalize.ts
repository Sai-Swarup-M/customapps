export type NormalizedUnit = {
  baseUnit: 'LB' | 'KG' | 'EACH' | 'BUNCH' | 'OTHER'
  packageQuantity: number
  pricePerBaseUnit: number
  effectiveUnitPrice: number
}

// Parse unit strings like "4LB", "20LB", "LB", "KG", "1KG", "EACH", "BUNCH", "9CT"
function parseUnit(unit: string | null): { baseUnit: string; quantity: number } {
  if (!unit) return { baseUnit: 'OTHER', quantity: 1 }
  const cleaned = unit.trim().toUpperCase().replace(/^\//, '')

  const weightMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*(LB|KG)$/)
  if (weightMatch) {
    return { baseUnit: weightMatch[2], quantity: parseFloat(weightMatch[1]) }
  }

  if (cleaned === 'LB') return { baseUnit: 'LB', quantity: 1 }
  if (cleaned === 'KG') return { baseUnit: 'KG', quantity: 1 }
  if (cleaned === 'EACH' || cleaned === 'EA') return { baseUnit: 'EACH', quantity: 1 }
  if (cleaned === 'BUNCH') return { baseUnit: 'BUNCH', quantity: 1 }

  // e.g. "9CT", "400GM", "2LB" catch-all
  const numUnitMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/)
  if (numUnitMatch) {
    const qty = parseFloat(numUnitMatch[1])
    const base = numUnitMatch[2]
    if (base === 'LB') return { baseUnit: 'LB', quantity: qty }
    if (base === 'KG') return { baseUnit: 'KG', quantity: qty }
    if (base === 'GM' || base === 'G') return { baseUnit: 'KG', quantity: qty / 1000 }
    return { baseUnit: base, quantity: qty }
  }

  return { baseUnit: 'OTHER', quantity: 1 }
}

export function normalizePrice(
  price: number,
  unit: string | null,
  dealType: string,
  multiBuyQty: number | null,
  multiBuyPrice: number | null
): NormalizedUnit {
  const { baseUnit, quantity } = parseUnit(unit)

  let pricePerBaseUnit = price / quantity

  // Convert grams-based KG to a standard KG price
  if (baseUnit === 'KG') {
    pricePerBaseUnit = price / quantity
  }

  let effectiveUnitPrice = pricePerBaseUnit

  if (dealType === 'multi_buy' && multiBuyQty && multiBuyPrice) {
    // e.g. BUY 2 FOR $6 — effective price per item
    const effectivePerItem = multiBuyPrice / multiBuyQty
    // Effective per base unit (e.g. if item is 4LB, effective per LB)
    effectiveUnitPrice = effectivePerItem / quantity
  }

  return {
    baseUnit: baseUnit as NormalizedUnit['baseUnit'],
    packageQuantity: quantity,
    pricePerBaseUnit: Math.round(pricePerBaseUnit * 100) / 100,
    effectiveUnitPrice: Math.round(effectiveUnitPrice * 100) / 100,
  }
}
