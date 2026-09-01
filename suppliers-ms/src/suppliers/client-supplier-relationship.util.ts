import {
  normalizeSupplierQuotaStatus,
  SUPPLIER_QUOTA_STATUS,
  supplierQuotaStatusIsAccessible,
  type SupplierQuotaStatus,
} from './supplier-quota-status';

export type ClientSupplierRelationshipMode = 'account' | 'manual';

export type ClientSupplierLinkSnapshot = {
  client_company_id: number;
  supplier_id: number;
  is_active: boolean;
  quota_status: string | null;
};

export type ClientManualSupplierStateSnapshot = {
  client_company_id: number;
  supplier_id: number;
  is_active: boolean;
  quota_status: string | null;
};

export type ClientSupplierRelationshipSnapshot = {
  mode: ClientSupplierRelationshipMode;
  hasLocationAssociation: boolean;
  link?: ClientSupplierLinkSnapshot | null;
  manualState?: ClientManualSupplierStateSnapshot | null;
};

export type ClientSupplierRelationshipRequirement = {
  /** Catalog/read paths may allow inactive Cont links; orders require active. */
  requireOperationalActive?: boolean;
  /** createOrder / getSupplierProducts — blocked/removed deny. */
  requireAccessibleQuota?: boolean;
};

export class ClientSupplierRelationshipError extends Error {
  constructor(
    public readonly code:
      | 'NOT_LINKED'
      | 'REMOVED'
      | 'BLOCKED'
      | 'INACTIVE'
      | 'NO_LOCATION',
    message: string,
  ) {
    super(message);
    this.name = 'ClientSupplierRelationshipError';
  }
}

export function resolveAccountLinkQuotaStatus(
  link: ClientSupplierLinkSnapshot | null | undefined,
): SupplierQuotaStatus | null {
  if (!link) return null;
  return normalizeSupplierQuotaStatus(link.quota_status);
}

export function resolveManualStateQuotaStatus(
  state: ClientManualSupplierStateSnapshot | null | undefined,
): SupplierQuotaStatus {
  if (!state) return SUPPLIER_QUOTA_STATUS.ACTIVE;
  return normalizeSupplierQuotaStatus(state.quota_status);
}

export function isManualAssociationOperationallyActive(
  state: ClientManualSupplierStateSnapshot | null | undefined,
): boolean {
  if (!state) return true;
  if (state.is_active === false) return false;
  return supplierQuotaStatusIsAccessible(resolveManualStateQuotaStatus(state));
}

export function isAccountLinkOperationallyActive(
  link: ClientSupplierLinkSnapshot | null | undefined,
): boolean {
  if (!link) return false;
  if (link.is_active === false) return false;
  const quotaStatus = resolveAccountLinkQuotaStatus(link);
  if (!quotaStatus) return false;
  return supplierQuotaStatusIsAccessible(quotaStatus);
}

/**
 * Pure validation after relationship snapshot is resolved in service layer.
 */
export function assertClientSupplierRelationshipResolved(
  clientCompanyId: number,
  supplierId: number,
  snapshot: ClientSupplierRelationshipSnapshot,
  requirements: ClientSupplierRelationshipRequirement = {},
): void {
  const requireOperational = requirements.requireOperationalActive === true;
  const requireAccessibleQuota = requirements.requireAccessibleQuota !== false;

  if (snapshot.mode === 'account') {
    const link = snapshot.link;
    if (!link || Number(link.client_company_id) !== clientCompanyId) {
      throw new ClientSupplierRelationshipError(
        'NOT_LINKED',
        'Nu există o asociere Cont între compania ta și acest furnizor',
      );
    }
    const quotaStatus = normalizeSupplierQuotaStatus(link.quota_status);
    if (quotaStatus === SUPPLIER_QUOTA_STATUS.REMOVED) {
      throw new ClientSupplierRelationshipError(
        'REMOVED',
        'Acest furnizor a fost eliminat din contul companiei tale',
      );
    }
    if (requireAccessibleQuota && !supplierQuotaStatusIsAccessible(quotaStatus)) {
      throw new ClientSupplierRelationshipError(
        'BLOCKED',
        'Acest furnizor este blocat de abonament și nu poate fi accesat',
      );
    }
    if (requireOperational && !isAccountLinkOperationallyActive(link)) {
      throw new ClientSupplierRelationshipError(
        'INACTIVE',
        'Asocierea cu acest furnizor este inactivă pentru compania ta',
      );
    }
    return;
  }

  if (!snapshot.hasLocationAssociation) {
    throw new ClientSupplierRelationshipError(
      'NO_LOCATION',
      'Furnizorul nu este asociat locațiilor companiei tale',
    );
  }
  const state = snapshot.manualState;
  const quotaStatus = resolveManualStateQuotaStatus(state);
  if (quotaStatus === SUPPLIER_QUOTA_STATUS.REMOVED) {
    throw new ClientSupplierRelationshipError(
      'REMOVED',
      'Acest furnizor a fost eliminat din contul companiei tale',
    );
  }
  if (requireAccessibleQuota && !supplierQuotaStatusIsAccessible(quotaStatus)) {
    throw new ClientSupplierRelationshipError(
      'BLOCKED',
      'Acest furnizor este blocat de abonament și nu poate fi accesat',
    );
  }
  if (requireOperational && !isManualAssociationOperationallyActive(state)) {
    throw new ClientSupplierRelationshipError(
      'INACTIVE',
      'Asocierea cu acest furnizor este inactivă pentru compania ta',
    );
  }
}

export function buildEligibilityFieldsFromRelationship(
  snapshot: ClientSupplierRelationshipSnapshot,
  supplierGlobalIsActive: boolean,
): {
  client_association_is_active: boolean | null;
  quota_status: SupplierQuotaStatus | null;
  is_active: boolean;
} {
  if (snapshot.mode === 'account') {
    const link = snapshot.link;
    return {
      is_active: supplierGlobalIsActive,
      client_association_is_active: link ? link.is_active !== false : null,
      quota_status: resolveAccountLinkQuotaStatus(link),
    };
  }
  const state = snapshot.manualState;
  return {
    // Manual: per-client operational state; ignore global suppliers.is_active for eligibility.
    is_active: true,
    client_association_is_active: state ? state.is_active !== false : true,
    quota_status: resolveManualStateQuotaStatus(state),
  };
}
