import type { ClientSupplierRelationshipRequirement } from './client-supplier-relationship.util';

/**
 * Catalog / admin visibility: blocked & removed denied; inactive association still readable
 * (unblock UI, client-association toggle, GET /catalog).
 */
export const CLIENT_SUPPLIER_CATALOG_ACCESS_REQUIREMENTS: ClientSupplierRelationshipRequirement =
  {
    requireOperationalActive: false,
    requireAccessibleQuota: true,
  };

/**
 * Admin supplier detail (GET /suppliers/:id): blocked allowed for unblock UI;
 * removed still denied.
 */
export const CLIENT_SUPPLIER_ADMIN_DETAIL_ACCESS_REQUIREMENTS: ClientSupplierRelationshipRequirement =
  {
    requireOperationalActive: false,
    requireAccessibleQuota: false,
  };

/**
 * Comenzi deja existente (listă / finalizare / anulare): blocked e permis
 * ca utilizatorul să poată închide restanțele; removed rămâne denied.
 * Operațiunile noi (createOrder, catalog produse) folosesc OPERATIONAL.
 */
export const CLIENT_SUPPLIER_EXISTING_ORDER_ACCESS_REQUIREMENTS: ClientSupplierRelationshipRequirement =
  {
    requireOperationalActive: false,
    requireAccessibleQuota: false,
  };

/**
 * Operational supplier access (orders, products, mappings, stock preview, staff lists, documents):
 * blocked, removed and inactive client↔supplier association all denied.
 */
export const CLIENT_SUPPLIER_OPERATIONAL_ACCESS_REQUIREMENTS: ClientSupplierRelationshipRequirement =
  {
    requireOperationalActive: true,
    requireAccessibleQuota: true,
  };
