export interface StockPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface StockLocationSummary {
  below_minimum_count: number;
}

export interface PaginatedStockResponse<T> {
  data: T[];
  pagination: StockPaginationMeta;
  summary?: StockLocationSummary;
}

export interface StockListQueryFilters {
  locationId?: number;
  productId?: number;
  search?: string;
  status?: string;
  stockFilter?: "all" | "with_stock" | "without_stock";
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}
