import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface CreateStockItemDto {
  product_id: number;
  supplier_order_item_id: number;
  quantity: number;
  price: number;
  entry_date: string;
  status: string;
  expiration_date?: string;
  location_id?: number;
  /** Idempotent ENTRY key (e.g. entry:reception:123, restore:supplier-order-cancel:1:item:2) */
  target?: string;
  source?: 'comanda' | 'manual';
}

export interface ConsumeStockDto {
  product_id: number;
  quantity: number;
  location_id?: number;
  target?: string;
  employee_id?: number;
  recipe_preparation_id?: number;
}

export interface StockResponse {
  id: number;
  product_id: number;
  supplier_order_item_id: number;
  quantity: number;
  price: number;
  entry_date: string;
  status: string;
  expiration_date?: string;
  created_at: string;
  updated_at: string;
  entry_transaction_id?: number;
}

@Injectable()
export class StockHttpService {
  private readonly logger = new Logger(StockHttpService.name);
  private readonly stockServiceUrl: string;
  private readonly serviceSecret: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.stockServiceUrl = this.configService.get<string>('STOCK_HTTP_URL') || 'http://localhost:3006';
    this.serviceSecret =
      this.configService.get<string>('SERVICE_SECRET') ||
      process.env.SERVICE_SECRET || '';
  }

  private internalHeaders() {
    return {
      'x-internal-service': 'suppliers-ms',
      'x-service-secret': this.serviceSecret,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Creates a stock item entry in the stock microservice
   */
  async createStockItem(dto: CreateStockItemDto): Promise<StockResponse | null> {
    const url = `${this.stockServiceUrl}/stock/items`;
    try {
      this.logger.log(
        `📦 [StockHttpService] POST ${url} - product_id=${dto.product_id}, quantity=${dto.quantity}, location_id=${dto.location_id ?? 'null'}, target=${dto.target ?? 'auto'}`,
      );
      const response = await firstValueFrom(
        this.httpService.post<StockResponse>(
          url,
          {
            product_id: dto.product_id,
            supplier_order_item_id: dto.supplier_order_item_id,
            quantity: dto.quantity,
            price: dto.price,
            entry_date: dto.entry_date,
            status: dto.status ?? 'valid',
            location_id: dto.location_id,
            target: dto.target,
            source: dto.source,
          },
          { headers: this.internalHeaders() },
        ),
      );
      const data = response.data;
      this.logger.log(
        `✅ [StockHttpService] Created stock aggregate ID ${data?.id}, entry_transaction_id=${data?.entry_transaction_id ?? 'N/A'} for product ${dto.product_id}`,
      );
      return data;
    } catch (error: any) {
      const status = error?.response?.status;
      const body = error?.response?.data;
      this.logger.error(
        `❌ [StockHttpService] Failed to create stock item (product_id=${dto.product_id}, quantity=${dto.quantity}): status=${status ?? 'N/A'}, message=${error?.message ?? error}`,
      );
      if (body != null) {
        this.logger.error(`❌ [StockHttpService] Response body: ${JSON.stringify(body)}`);
      }
      if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
        this.logger.error(
          `❌ [StockHttpService] Verifică STOCK_HTTP_URL (current: ${this.stockServiceUrl}) și că serviciul stock rulează.`,
        );
      }
      return null;
    }
  }

  /**
   * Deducts stock at a location via POST /stock/consume (FEFO EXIT transactions).
   */
  async consumeProduct(dto: ConsumeStockDto): Promise<void> {
    const url = `${this.stockServiceUrl}/stock/consume`;
    const payload = {
      product_id: dto.product_id,
      quantity: dto.quantity,
      location_id: dto.location_id,
      target: dto.target,
      employee_id: dto.employee_id,
      recipe_preparation_id: dto.recipe_preparation_id,
    };
    try {
      this.logger.log(
        `📤 [StockHttpService] POST ${url} consume payload=${JSON.stringify(payload)}`,
      );
      await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.internalHeaders() }),
      );
      this.logger.log(
        `✅ [StockHttpService] Consumed ${dto.quantity} of product ${dto.product_id} at location_id=${dto.location_id ?? 'null'}`,
      );
    } catch (error: any) {
      const status = error?.response?.status;
      const body = error?.response?.data;
      const detail =
        typeof body?.message === 'string'
          ? body.message
          : error?.message ?? String(error);
      this.logger.error(
        `❌ [StockHttpService] Failed to consume stock (product_id=${dto.product_id}, quantity=${dto.quantity}): status=${status ?? 'N/A'}, message=${detail}`,
      );
      if (body != null) {
        this.logger.error(`❌ [StockHttpService] Response body: ${JSON.stringify(body)}`);
      }
      if (status === 401) {
        throw new Error(
          'Autentificare eșuată către serviciul stock (SERVICE_SECRET). Verifică .env pe suppliers-ms și stock.',
        );
      }
      throw new Error(
        typeof body?.message === 'string'
          ? body.message
          : `Eroare la scăderea stocului pentru produsul ${dto.product_id}`,
      );
    }
  }

  /**
   * Creates multiple stock items in batch
   */
  async createStockItems(items: CreateStockItemDto[]): Promise<StockResponse[]> {
    this.logger.log(`📦 [StockHttpService] Creating ${items.length} stock items in batch`);
    const results: StockResponse[] = [];

    for (const item of items) {
      this.logger.log(
        `📦 [StockHttpService] Processing stock item: product_id=${item.product_id}, quantity=${item.quantity}, price=${item.price}`,
      );
      const result = await this.createStockItem(item);
      if (result) {
        this.logger.log(
          `✅ [StockHttpService] Successfully created stock item aggregate ID: ${result.id}, entry_transaction_id=${result.entry_transaction_id ?? 'N/A'}`,
        );
        results.push(result);
      } else {
        this.logger.error(
          `❌ [StockHttpService] Failed to create stock item for product_id=${item.product_id}, quantity=${item.quantity}`,
        );
      }
    }

    this.logger.log(`📦 [StockHttpService] Created ${results.length} out of ${items.length} stock items`);
    return results;
  }

  /**
   * Verifică dacă există un EXIT real (scădere efectivă) pentru o linie de comandă furnizor.
   * Acceptă atât target-ul nou `supplier-order-confirm:{orderId}:item:{itemId}` cât și cel
   * legacy `supplier-order-create:{orderId}:item:{itemId}`. Folosește API-ul existent
   * GET /stock/transactions (filtrare type=exit + product_id) și potrivește target-ul aici,
   * fără modificări în stock-ms.
   */
  async hasSupplierOrderExit(
    productId: number,
    orderId: number,
    itemId: number,
  ): Promise<boolean> {
    const targets = new Set<string>([
      `supplier-order-confirm:${orderId}:item:${itemId}`,
      `supplier-order-create:${orderId}:item:${itemId}`,
    ]);
    const url = `${this.stockServiceUrl}/stock/transactions?type=exit&product_id=${productId}`;
    const expectedTargets = [...targets];
    try {
      this.logger.log(
        `🧪 [DEBUG hasSupplierOrderExit] GET ${url} orderId=${orderId} itemId=${itemId} ` +
          `productId=${productId} expectedTargets=${JSON.stringify(expectedTargets)}`,
      );
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: this.internalHeaders() }),
      );
      const raw = response.data;
      const txs = Array.isArray(raw) ? raw : [];
      const matched = txs.filter(
        (tx: any) => typeof tx?.target === 'string' && targets.has(tx.target),
      );
      const sampleTargets = txs
        .slice(0, 15)
        .map((tx: any) => tx?.target ?? '(no target)')
        .filter((t: string) => t.includes(`:${orderId}:`) || t.startsWith('supplier-order-'));
      this.logger.log(
        `🧪 [DEBUG hasSupplierOrderExit] RESPONSE orderId=${orderId} itemId=${itemId} ` +
          `rawIsArray=${Array.isArray(raw)} rawType=${raw === null ? 'null' : typeof raw} ` +
          `txCount=${txs.length} matchedCount=${matched.length} result=${matched.length > 0} ` +
          `sampleOrderTargets=${JSON.stringify(sampleTargets)} ` +
          (matched.length > 0
            ? `matched=${JSON.stringify(matched.map((tx: any) => ({ id: tx.id, target: tx.target, qty: tx.quantity })))}`
            : ''),
      );
      if (!Array.isArray(raw)) {
        this.logger.warn(
          `🧪 [DEBUG hasSupplierOrderExit] unexpected response shape keys=${raw && typeof raw === 'object' ? Object.keys(raw).join(',') : 'n/a'} ` +
            `snippet=${JSON.stringify(raw)?.slice(0, 500)}`,
        );
      }
      return matched.length > 0;
    } catch (error: any) {
      const status = error?.response?.status;
      this.logger.error(
        `❌ [StockHttpService] Failed to check EXIT (product_id=${productId}, order=${orderId}, item=${itemId}): status=${status ?? 'N/A'}, message=${error?.message ?? error}`,
      );
      throw error;
    }
  }

  /** Lists aggregate stock rows at a location (internal service auth). */
  async listStockItems(
    locationId: number,
    limit = 9,
  ): Promise<Array<Record<string, unknown>>> {
    const allRows: Array<Record<string, unknown>> = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const pageResult = await this.listStockItemsPaginated(
        locationId,
        page,
        Math.min(limit, 9),
      );
      allRows.push(...pageResult.data);
      hasNext = pageResult.pagination.hasNextPage && allRows.length < limit;
      page += 1;
    }

    return allRows;
  }

  /** Paginated stock rows at a location (internal service auth). */
  async listStockItemsPaginated(
    locationId: number,
    page = 1,
    limit = 9,
    filters?: {
      search?: string;
      status?: string;
      stock_filter?: string;
      sort_by?: string;
      sort_direction?: string;
    },
  ): Promise<{
    data: Array<Record<string, unknown>>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    summary?: { below_minimum_count: number };
  }> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(Math.min(Math.max(1, limit), 9)),
      location_id: String(locationId),
    });
    if (filters?.search) params.set('search', filters.search);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.stock_filter) params.set('stock_filter', filters.stock_filter);
    if (filters?.sort_by) params.set('sort_by', filters.sort_by);
    if (filters?.sort_direction) {
      params.set('sort_direction', filters.sort_direction);
    }

    const url = `${this.stockServiceUrl}/stock/items?${params.toString()}`;
    try {
      this.logger.log(`📦 [StockHttpService] GET ${url}`);
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: this.internalHeaders() }),
      );
      const body = response.data;
      if (body && Array.isArray(body.data) && body.pagination) {
        return {
          data: body.data,
          pagination: body.pagination,
          summary: body.summary,
        };
      }
      if (Array.isArray(body)) {
        const total = body.length;
        return {
          data: body,
          pagination: {
            page: 1,
            limit: 9,
            total,
            totalPages: total > 0 ? 1 : 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      }
      return {
        data: [],
        pagination: {
          page: 1,
          limit: 9,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    } catch (error: any) {
      const status = error?.response?.status;
      this.logger.error(
        `❌ [StockHttpService] Failed to list stock (location_id=${locationId}): status=${status ?? 'N/A'}, message=${error?.message ?? error}`,
      );
      throw error;
    }
  }

  /**
   * ID-urile de produse cu stoc la o locație, într-un singur request —
   * folosit pentru filtrarea catalogului comandabil al unui furnizor
   * (evită paginarea de 9/pagină din listStockItems, nepotrivită pentru
   * locații cu sute de rânduri de stoc).
   */
  async getProductIdsAtLocation(locationId: number): Promise<number[]> {
    const url = `${this.stockServiceUrl}/stock/items/location/${locationId}/product-ids`;
    try {
      this.logger.log(`📦 [StockHttpService] GET ${url}`);
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: this.internalHeaders() }),
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      const status = error?.response?.status;
      this.logger.error(
        `❌ [StockHttpService] Failed to get product ids (location_id=${locationId}): status=${status ?? 'N/A'}, message=${error?.message ?? error}`,
      );
      throw error;
    }
  }

  async listProductsByLocation(
    locationId: number,
  ): Promise<Array<Record<string, unknown>>> {
    const url = `${this.stockServiceUrl}/stock/products?location_id=${locationId}`;
    try {
      this.logger.log(`📦 [StockHttpService] GET ${url}`);
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: this.internalHeaders() }),
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      const status = error?.response?.status;
      this.logger.error(
        `❌ [StockHttpService] Failed to list products (location_id=${locationId}): status=${status ?? 'N/A'}, message=${error?.message ?? error}`,
      );
      throw error;
    }
  }

  async createProductAtLocation(payload: {
    name: string;
    unit: string;
    location_id: number;
    sku?: string | null;
    description?: string | null;
    min_stock_level?: number | null;
    is_active?: boolean;
    is_consumable?: boolean;
    photo?: string | null;
  }): Promise<{ product: Record<string, unknown>; stock: Record<string, unknown> }> {
    const url = `${this.stockServiceUrl}/stock/products/at-location`;
    try {
      this.logger.log(
        `📦 [StockHttpService] POST ${url} name=${payload.name}, location_id=${payload.location_id}`,
      );
      const response = await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.internalHeaders() }),
      );
      return response.data as { product: Record<string, unknown>; stock: Record<string, unknown> };
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.message ?? error?.message ?? 'Unknown error';
      this.logger.error(
        `❌ [StockHttpService] createProductAtLocation failed: status=${status ?? 'N/A'}, message=${message}`,
      );
      throw error;
    }
  }

  async updateProduct(
    productId: number,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.stockServiceUrl}/stock/products/${productId}`;
    try {
      const response = await firstValueFrom(
        this.httpService.patch(url, payload, { headers: this.internalHeaders() }),
      );
      return response.data as Record<string, unknown>;
    } catch (error: any) {
      this.logger.error(
        `❌ [StockHttpService] updateProduct failed productId=${productId}: ${error?.message ?? error}`,
      );
      throw error;
    }
  }

  async updateProductAtLocation(
    productId: number,
    locationId: number,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.stockServiceUrl}/stock/products/${productId}/at-location?location_id=${locationId}`;
    try {
      const response = await firstValueFrom(
        this.httpService.patch(url, payload, { headers: this.internalHeaders() }),
      );
      return response.data as Record<string, unknown>;
    } catch (error: any) {
      this.logger.error(
        `❌ [StockHttpService] updateProductAtLocation failed productId=${productId}, locationId=${locationId}: ${error?.message ?? error}`,
      );
      throw error;
    }
  }

  async uploadProductImage(
    fileName: string,
    base64Content: string,
  ): Promise<string> {
    const url = `${this.stockServiceUrl}/stock/products/upload-image`;
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { fileName, content: base64Content },
          { headers: this.internalHeaders() },
        ),
      );
      const body = response.data as { imageUrl?: string };
      if (!body?.imageUrl) {
        throw new Error('Răspuns invalid de la upload imagine');
      }
      return body.imageUrl;
    } catch (error: any) {
      this.logger.error(
        `❌ [StockHttpService] uploadProductImage failed: ${error?.message ?? error}`,
      );
      throw error;
    }
  }

  async getProductPhotosByIds(
    productIds: number[],
  ): Promise<Map<number, string | null>> {
    const uniqueIds = [
      ...new Set(
        productIds.filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    const photoMap = new Map<number, string | null>();
    await Promise.all(
      uniqueIds.map(async (productId) => {
        const url = `${this.stockServiceUrl}/stock/products/${productId}`;
        try {
          const response = await firstValueFrom(
            this.httpService.get(url, { headers: this.internalHeaders() }),
          );
          const photo = (response.data as { photo?: string | null })?.photo ?? null;
          photoMap.set(
            productId,
            photo != null && String(photo).trim() !== '' ? String(photo) : null,
          );
        } catch {
          photoMap.set(productId, null);
        }
      }),
    );
    return photoMap;
  }

  /**
   * Health check for stock service connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.stockServiceUrl}/stock/items`, {
          headers: this.internalHeaders(),
        }),
      );

      return response.status === 200;
    } catch (error: any) {
      this.logger.warn(`Stock service health check failed:`, error?.message || error);
      return false;
    }
  }
}
