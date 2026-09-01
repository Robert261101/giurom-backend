export type ClientStockProductResolutionCode =
  | 'MISSING_MAPPING'
  | 'INVALID_MAPPING'
  | 'LOCATION_NOT_IN_NOMENCLATOR'
  | 'PRODUCT_ID_MISMATCH'
  | 'MISSING_SUPPLIER_PRODUCT_ID'
  | 'LEGACY_PRODUCT_ID_MISMATCH'
  | 'MISSING_LOCATION';

export class ClientStockProductResolutionError extends Error {
  constructor(
    public readonly code: ClientStockProductResolutionCode,
    message: string,
  ) {
    super(message);
    this.name = 'ClientStockProductResolutionError';
  }
}

export type ClientStockProductMappingRow = {
  client_company_id: number;
  client_location_id: number | null;
  supplier_product_id: number;
  client_stock_product_id: number;
};

export function resolveClientStockProductIdFromMapping(
  mapping: ClientStockProductMappingRow | null | undefined,
  clientCompanyId: number,
  supplierProductId: number,
  clientLocationId: number,
): number {
  if (!Number.isFinite(clientLocationId) || clientLocationId <= 0) {
    throw new ClientStockProductResolutionError(
      'MISSING_LOCATION',
      'Locația comenzii este obligatorie pentru rezolvarea mapării produsului',
    );
  }

  if (!mapping) {
    throw new ClientStockProductResolutionError(
      'MISSING_MAPPING',
      `Produsul furnizor (id=${supplierProductId}) nu este asociat cu nomenclatorul locației selectate (location_id=${clientLocationId}). Configurați maparea înainte de comandă.`,
    );
  }

  if (
    Number(mapping.client_company_id) !== clientCompanyId ||
    Number(mapping.supplier_product_id) !== supplierProductId ||
    Number(mapping.client_location_id) !== clientLocationId
  ) {
    throw new ClientStockProductResolutionError(
      'MISSING_MAPPING',
      `Produsul furnizor (id=${supplierProductId}) nu este asociat cu nomenclatorul locației selectate (location_id=${clientLocationId}). Configurați maparea înainte de comandă.`,
    );
  }

  const clientStockProductId = Number(mapping.client_stock_product_id);
  if (!Number.isFinite(clientStockProductId) || clientStockProductId <= 0) {
    throw new ClientStockProductResolutionError(
      'INVALID_MAPPING',
      `Mapare invalidă pentru produsul furnizor (id=${supplierProductId}): client_stock_product_id lipsește`,
    );
  }

  return clientStockProductId;
}

export function assertRequestedClientStockProductId(
  resolvedClientStockProductId: number,
  requestedProductId?: number | null,
): void {
  if (requestedProductId == null) {
    return;
  }
  const requested = Number(requestedProductId);
  if (!Number.isFinite(requested) || requested <= 0) {
    return;
  }
  if (requested !== resolvedClientStockProductId) {
    throw new ClientStockProductResolutionError(
      'PRODUCT_ID_MISMATCH',
      'product_id din cerere nu corespunde mapării configurate pentru produsul furnizor',
    );
  }
}

export function assertOrderItemProductIdMatchesMapping(
  orderItemProductId: number,
  resolvedClientStockProductId: number,
): void {
  const stored = Number(orderItemProductId);
  if (!Number.isFinite(stored) || stored <= 0) {
    throw new ClientStockProductResolutionError(
      'LEGACY_PRODUCT_ID_MISMATCH',
      'Linia comenzii nu are product_id valid. Necesită remediere date (VAL 5).',
    );
  }
  if (stored !== resolvedClientStockProductId) {
    throw new ClientStockProductResolutionError(
      'LEGACY_PRODUCT_ID_MISMATCH',
      `Linia comenzii are product_id=${stored} inconsistent cu maparea clientului (product_id=${resolvedClientStockProductId}). Contactați suport pentru remediere date (VAL 5).`,
    );
  }
}

export function assertProductExistsInLocationNomenclator(
  clientStockProductId: number,
  locationId: number,
  productIdsAtLocation: readonly number[],
): void {
  if (!Number.isFinite(locationId) || locationId <= 0) {
    throw new ClientStockProductResolutionError(
      'LOCATION_NOT_IN_NOMENCLATOR',
      'Locația comenzii este obligatorie pentru validarea nomenclatorului',
    );
  }

  if (!productIdsAtLocation.some((id) => Number(id) === clientStockProductId)) {
    throw new ClientStockProductResolutionError(
      'LOCATION_NOT_IN_NOMENCLATOR',
      `Produsul furnizor nu este configurat în nomenclatorul locației selectate (location_id=${locationId})`,
    );
  }
}
