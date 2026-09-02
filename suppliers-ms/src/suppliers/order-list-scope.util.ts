import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { resolveJwtCompanyId } from '@giurom/tenant-access';
import {
  assertOrderCompanyIdNotEscalated,
  isPlatformOrderRequester,
  OrderRequesterUser,
  resolveOrderTenantCompanyId,
} from './order-access';
import { SupplierOrder } from './entities/supplier-order.entity';

export type OrderListRequester = OrderRequesterUser;

export {
  assertOrderCompanyIdNotEscalated as assertOrderListCompanyIdNotEscalated,
  resolveOrderTenantCompanyId as resolveOrderListTenantCompanyId,
};

/**
 * Mandatory tenant filter for order list/batch queries.
 * `order.company_id = JWT company_id` for non-platform requesters.
 */
export function applyOrderListTenantScopeToQueryBuilder<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  requester?: OrderListRequester | null,
  orderAlias = 'order',
): SelectQueryBuilder<T> {
  if (!requester || isPlatformOrderRequester(requester)) {
    return qb;
  }
  const companyId = resolveJwtCompanyId(requester);
  if (companyId == null) {
    qb.andWhere('1 = 0');
    return qb;
  }
  qb.andWhere(`${orderAlias}.company_id = :tenantCompanyId`, {
    tenantCompanyId: companyId,
  });
  return qb;
}

/**
 * Tenant scope for reception report/events via supplier_orders join.
 */
export function applyReceptionEventsTenantScopeToQueryBuilder<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  requester: OrderRequesterUser | undefined,
  orderIdColumn: string,
  orderAlias = 'tenant_scope_order',
): SelectQueryBuilder<T> {
  if (!requester || isPlatformOrderRequester(requester)) {
    return qb;
  }
  const companyId = resolveJwtCompanyId(requester);
  qb.innerJoin(
    SupplierOrder,
    orderAlias,
    `${orderAlias}.id = ${orderIdColumn}`,
  );
  if (companyId == null) {
    qb.andWhere('1 = 0');
  } else {
    qb.andWhere(`${orderAlias}.company_id = :receptionTenantCompanyId`, {
      receptionTenantCompanyId: companyId,
    });
  }
  return qb;
}
