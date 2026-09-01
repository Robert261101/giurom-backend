/**
 * Pure helpers for company-wide supplier_locations seeding (unit-tested).
 */

export function mergeUniquePositiveIds(
  ...lists: Array<number[] | null | undefined>
): number[] {
  const set = new Set<number>();
  for (const list of lists) {
    for (const raw of list || []) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) set.add(n);
    }
  }
  return [...set].sort((a, b) => a - b);
}

/** Location IDs still missing from an existing assignment set. */
export function missingLocationIds(
  companyLocationIds: number[],
  alreadyAssignedLocationIds: number[],
): number[] {
  const have = new Set(
    (alreadyAssignedLocationIds || [])
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0),
  );
  return mergeUniquePositiveIds(companyLocationIds).filter((id) => !have.has(id));
}

export function isManualOwnerCompanyId(
  ownerCompanyId: number | null | undefined,
): boolean {
  if (ownerCompanyId == null) return true;
  const n = Number(ownerCompanyId);
  return !Number.isFinite(n) || n <= 0;
}
