/**
 * Pure helpers for company update tenant rules.
 * Rulare: npx tsx --test src/company/company-tenant.util.test.ts
 */

export function shouldBlockCompanyTypeChange(
  hasPlatformWideAccess: boolean,
  currentType: string | null | undefined,
  requestedType: string | null | undefined,
): boolean {
  if (hasPlatformWideAccess) return false;
  if (requestedType === undefined || requestedType === null) return false;
  return (
    String(requestedType).toLowerCase().trim() !==
    String(currentType ?? '').toLowerCase().trim()
  );
}
