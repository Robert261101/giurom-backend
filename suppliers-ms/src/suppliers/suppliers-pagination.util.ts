export const DEFAULT_ORDERS_PAGE_LIMIT = 15;
export const MAX_ORDERS_PAGE_LIMIT = 20;

export type OrdersPaginationMeta = {
  page: number;
  limit: number;
  /** @deprecated Prefer totalItems — kept for backward compatibility */
  total: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedOrdersResponse<T> = {
  data: T[];
  pagination: OrdersPaginationMeta;
  /** Top-level alias for legacy clients expecting `total` without `pagination` */
  total?: number;
  totalItems?: number;
};

export function normalizeOrdersPagination(
  pageRaw?: string | number,
  limitRaw?: string | number,
): { page: number; limit: number } {
  const page = Math.max(1, parseInt(String(pageRaw ?? '1'), 10) || 1);
  const parsedLimit = parseInt(
    String(limitRaw ?? DEFAULT_ORDERS_PAGE_LIMIT),
    10,
  );
  const limit = Math.min(
    MAX_ORDERS_PAGE_LIMIT,
    Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_ORDERS_PAGE_LIMIT),
  );
  return { page, limit };
}

export function buildOrdersPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedOrdersResponse<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  return {
    data,
    total,
    totalItems: total,
    pagination: {
      page,
      limit,
      total,
      totalItems: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
