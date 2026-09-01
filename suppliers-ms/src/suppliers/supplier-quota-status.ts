export const SUPPLIER_QUOTA_STATUS = {
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  REMOVED: 'removed',
} as const;

export type SupplierQuotaStatus =
  (typeof SUPPLIER_QUOTA_STATUS)[keyof typeof SUPPLIER_QUOTA_STATUS];

export function normalizeSupplierQuotaStatus(
  value: unknown,
): SupplierQuotaStatus {
  const raw = String(value || SUPPLIER_QUOTA_STATUS.ACTIVE)
    .toLowerCase()
    .trim();
  if (raw === SUPPLIER_QUOTA_STATUS.BLOCKED) {
    return SUPPLIER_QUOTA_STATUS.BLOCKED;
  }
  if (raw === SUPPLIER_QUOTA_STATUS.REMOVED) {
    return SUPPLIER_QUOTA_STATUS.REMOVED;
  }
  return SUPPLIER_QUOTA_STATUS.ACTIVE;
}

export function supplierQuotaStatusCountsTowardLimit(
  status: SupplierQuotaStatus,
): boolean {
  return status === SUPPLIER_QUOTA_STATUS.ACTIVE;
}

export function supplierQuotaStatusIsAccessible(
  status: SupplierQuotaStatus,
): boolean {
  return status === SUPPLIER_QUOTA_STATUS.ACTIVE;
}

/** Furnizor eligibil în dropdown-ul de comandă nouă (nu amestecă is_active cu quota_status). */
export function isSupplierEligibleForNewOrder(supplier: {
  is_active?: boolean;
  has_supplier_account?: boolean;
  client_association_is_active?: boolean | null;
  quota_status?: string | null;
}): boolean {
  const isManual = supplier.has_supplier_account !== true;
  if (!isManual && supplier.is_active === false) {
    return false;
  }
  if (supplier.client_association_is_active === false) {
    return false;
  }
  return supplierQuotaStatusIsAccessible(
    normalizeSupplierQuotaStatus(supplier.quota_status),
  );
}

export const TERMINAL_SUPPLIER_ORDER_STATUSES = new Set([
  'delivered',
  'cancelled',
]);
