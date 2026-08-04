/**
 * Unit-style checks for supplier stock increment validation helpers.
 * suppliers-ms has no Jest harness; these mirror the guards in
 * SuppliersService.incrementMySupplierStock and can be run with:
 *   npx ts-node --transpile-only test/supplier-increment-stock.logic.ts
 * (from suppliers-ms root after wiring, or keep as documentation of expected rules)
 */

export function validateSupplierIncrementItems(
  items: Array<{ product_id: number; quantity: number }>,
  catalogProductIds: number[],
): string | null {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Selectează cel puțin un produs';
  }
  if (items.length > 100) {
    return 'Maximum 100 de produse per request';
  }
  const seen = new Set<number>();
  const catalog = new Set(catalogProductIds);
  for (const item of items) {
    const pid = Number(item.product_id);
    const qty = Number(item.quantity);
    if (!Number.isFinite(pid) || pid <= 0 || !Number.isInteger(pid)) {
      return 'product_id invalid';
    }
    if (seen.has(pid)) {
      return `Produsul ${pid} apare de mai multe ori în request`;
    }
    seen.add(pid);
    if (!Number.isFinite(qty) || qty <= 0) {
      return `Cantitatea trebuie să fie mai mare decât 0 (produs ${pid})`;
    }
    if (!catalog.has(pid)) {
      return `Produsul ${pid} nu aparține nomenclatorului depozitului furnizorului`;
    }
  }
  return null;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const catalog = [40, 41];

assert(
  validateSupplierIncrementItems([{ product_id: 40, quantity: 5 }], catalog) === null,
  'valid item should pass',
);
assert(
  validateSupplierIncrementItems([], catalog) !== null,
  'empty should fail',
);
assert(
  validateSupplierIncrementItems(
    [
      { product_id: 40, quantity: 1 },
      { product_id: 40, quantity: 2 },
    ],
    catalog,
  ) !== null,
  'duplicate should fail',
);
assert(
  validateSupplierIncrementItems([{ product_id: 999, quantity: 1 }], catalog) !== null,
  'foreign product should fail',
);
assert(
  validateSupplierIncrementItems([{ product_id: 40, quantity: 0 }], catalog) !== null,
  'zero qty should fail',
);

console.log('supplier-increment-stock.logic: all assertions passed');
