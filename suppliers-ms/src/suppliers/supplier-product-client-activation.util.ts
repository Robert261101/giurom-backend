export function normalizeSupplierProductIsActive(value: unknown): boolean {
  return value !== false && value !== 0 && value !== '0';
}

/**
 * Rezolvă is_active pentru un client: globalul furnizorului + override strict per client.
 * Lipsa rândului pentru clientul curent = activ implicit (dacă globalul e activ).
 */
export function resolveIsActiveForClientProduct(
  globalIsActive: unknown,
  clientActivationRow: { is_active: unknown } | undefined,
): boolean {
  const globalActive = normalizeSupplierProductIsActive(globalIsActive);
  if (!globalActive) {
    return false;
  }
  if (!clientActivationRow) {
    return true;
  }
  return normalizeSupplierProductIsActive(clientActivationRow.is_active);
}
