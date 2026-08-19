/**
 * Unități și preț pe bază — helpers pentru comenzi / stoc furnizor.
 */

export type UnitFamily = 'mass' | 'volume' | 'count'

const MASS_TO_KG: Record<string, number> = {
  g: 0.001,
  gr: 0.001,
  gram: 0.001,
  grams: 0.001,
  grame: 0.001,
  kg: 1,
  kilogram: 1,
  kilograms: 1,
  kilo: 1,
  t: 1000,
  to: 1000,
  tone: 1000,
  tona: 1000,
}

const VOLUME_TO_L: Record<string, number> = {
  ml: 0.001,
  mililitri: 0.001,
  mililitru: 0.001,
  l: 1,
  litri: 1,
  litru: 1,
  litre: 1,
}

export function normalizeUnitKey(unit: string | null | undefined): string {
  return String(unit ?? '')
    .trim()
    .toLowerCase()
}

export function getUnitFamily(unit: string | null | undefined): UnitFamily {
  const key = normalizeUnitKey(unit)
  if (key in MASS_TO_KG) return 'mass'
  if (key in VOLUME_TO_L) return 'volume'
  return 'count'
}

export function convertToStandardUnit(
  quantity: number,
  unit: string | null | undefined,
): { converted: number; standardUnit: string; family: UnitFamily } {
  const key = normalizeUnitKey(unit)
  const qty = Number(quantity)
  const family = getUnitFamily(unit)
  if (!Number.isFinite(qty)) {
    return { converted: 0, standardUnit: key || '', family }
  }
  if (key in MASS_TO_KG) {
    return { converted: qty * MASS_TO_KG[key], standardUnit: 'kg', family: 'mass' }
  }
  if (key in VOLUME_TO_L) {
    return { converted: qty * VOLUME_TO_L[key], standardUnit: 'l', family: 'volume' }
  }
  return {
    converted: qty,
    standardUnit: key || String(unit ?? '').trim(),
    family: 'count',
  }
}

/**
 * Compară cantitate comandată cu stoc disponibil în unități compatibile.
 * Returnează availableInOrderUnit (stoc exprimat în unitatea comenzii) când e posibil.
 */
export function compareQuantityToStock(params: {
  orderQuantity: number
  orderUnit: string | null | undefined
  stockQuantity: number
  stockUnit: string | null | undefined
}): {
  ok: boolean
  reason:
    | 'ok'
    | 'insufficient'
    | 'incompatible_units'
    | 'invalid'
  availableInOrderUnit: number | null
  orderInStandard: number
  stockInStandard: number
  standardUnit: string
} {
  const orderQty = Number(params.orderQuantity)
  const stockQty = Number(params.stockQuantity)
  if (!Number.isFinite(orderQty) || orderQty < 0 || !Number.isFinite(stockQty) || stockQty < 0) {
    return {
      ok: false,
      reason: 'invalid',
      availableInOrderUnit: null,
      orderInStandard: 0,
      stockInStandard: 0,
      standardUnit: '',
    }
  }

  const order = convertToStandardUnit(orderQty, params.orderUnit)
  const stock = convertToStandardUnit(stockQty, params.stockUnit)

  // Dacă unitățile lipsesc dar familia e count cu etichete egale/goale — compară numeric.
  const orderKey = normalizeUnitKey(params.orderUnit)
  const stockKey = normalizeUnitKey(params.stockUnit)

  if (order.family !== stock.family) {
    // count fără unită vs count — ok dacă ambele count
    if (!(order.family === 'count' && stock.family === 'count')) {
      return {
        ok: false,
        reason: 'incompatible_units',
        availableInOrderUnit: null,
        orderInStandard: order.converted,
        stockInStandard: stock.converted,
        standardUnit: order.standardUnit,
      }
    }
  }

  if (
    order.family === 'count' &&
    stock.family === 'count' &&
    orderKey &&
    stockKey &&
    orderKey !== stockKey
  ) {
    return {
      ok: false,
      reason: 'incompatible_units',
      availableInOrderUnit: null,
      orderInStandard: order.converted,
      stockInStandard: stock.converted,
      standardUnit: order.standardUnit,
    }
  }

  const ok = order.converted <= stock.converted + 1e-9
  let availableInOrderUnit: number | null = null
  if (order.family === 'mass' || order.family === 'volume') {
    const factor =
      order.family === 'mass'
        ? MASS_TO_KG[orderKey] ?? (orderKey ? null : 1)
        : VOLUME_TO_L[orderKey] ?? (orderKey ? null : 1)
    if (factor != null && factor > 0) {
      availableInOrderUnit = stock.converted / factor
    }
  } else {
    availableInOrderUnit = stock.converted
  }

  return {
    ok,
    reason: ok ? 'ok' : 'insufficient',
    availableInOrderUnit,
    orderInStandard: order.converted,
    stockInStandard: stock.converted,
    standardUnit: order.standardUnit || stock.standardUnit,
  }
}

/**
 * Politică financiară (aceeași ca frontend `lib/order-line-money.ts`):
 * lineNet = roundMoney(qty × netUnit)
 * lineVat = roundMoney(lineNet × vatRate / 100)
 * lineGross = roundMoney(lineNet + lineVat)
 * Rotunjire doar la 2 zecimale, în aceste puncte — fără floor / truncare.
 * lineNet = quantity / priceBaseQuantity * price; baza lipsă → 1
 */
export function computeLineSubtotal(
  quantity: number,
  pricePerUnit: number,
  priceBaseQuantity?: number | null,
): number {
  const qty = Number(quantity)
  const price = Number(pricePerUnit)
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0
  const baseRaw = Number(priceBaseQuantity)
  const base = Number.isFinite(baseRaw) && baseRaw > 0 ? baseRaw : 1
  return (qty / base) * price
}

export function normalizePriceBaseQuantity(
  value: number | null | undefined,
): number | null {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/** Rotunjire monetară la 2 zecimale (evită 6.049999…). */
export function roundMoney(value: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function resolveProductVatRate(
  vat: number | null | undefined,
): number | null {
  if (vat == null) return null
  const n = Number(vat)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export function priceWithVatFromNet(
  netPrice: number,
  vatRate: number,
): number {
  return roundMoney(Number(netPrice) * (1 + Number(vatRate) / 100))
}

export function priceNetFromGross(
  grossPrice: number,
  vatRate: number,
): number {
  const rate = Number(vatRate)
  const divisor = 1 + rate / 100
  if (!Number.isFinite(divisor) || divisor <= 0) {
    return roundMoney(Number(grossPrice))
  }
  return roundMoney(Number(grossPrice) / divisor)
}

export function resolvePriceBaseUnit(
  priceBaseUnit: string | null | undefined,
  productUnit: string | null | undefined,
): string | null {
  const base = String(priceBaseUnit ?? '').trim()
  if (base) return base
  const product = String(productUnit ?? '').trim()
  return product || null
}
