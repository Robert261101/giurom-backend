/**
 * Cont (account) suppliers: client tenants must not mutate supplier master fields.
 * Client-specific usage state lives on client_supplier_links.is_active.
 */

export const SUPPLIER_MASTER_UPDATE_FIELDS = [
  'supplier_name',
  'vat_number',
  'registration_number',
  'address',
  'city',
  'region',
  'country',
  'postal_code',
  'phone',
  'email',
  'contact_person',
  'bank_name',
  'bank_account_number',
  'activity_code',
  'headquarters_name',
  'is_active',
  'owner_company_id',
  'connection_code',
] as const;

export type SupplierMasterUpdateField =
  (typeof SUPPLIER_MASTER_UPDATE_FIELDS)[number];

export function listPresentSupplierMasterFields(
  dto: Record<string, unknown> | null | undefined,
): SupplierMasterUpdateField[] {
  if (!dto || typeof dto !== 'object') return [];
  return SUPPLIER_MASTER_UPDATE_FIELDS.filter((key) =>
    Object.prototype.hasOwnProperty.call(dto, key),
  );
}

export function shouldBlockClientMasterUpdateOnContSupplier(input: {
  isTenantScopedClient: boolean;
  hasRealSupplierLoginAccount: boolean;
  dto: Record<string, unknown> | null | undefined;
}): boolean {
  if (!input.isTenantScopedClient) return false;
  if (!input.hasRealSupplierLoginAccount) return false;
  return listPresentSupplierMasterFields(input.dto).length > 0;
}
