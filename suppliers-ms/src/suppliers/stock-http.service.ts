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
      process.env.SERVICE_SECRET ||
      'default-service-secret';
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

  /** Lists aggregate stock rows at a location (internal service auth). */
  async listStockItems(
    locationId: number,
    limit = 1000,
  ): Promise<Array<Record<string, unknown>>> {
    const url = `${this.stockServiceUrl}/stock/items?page=1&limit=${limit}&location_id=${locationId}`;
    try {
      this.logger.log(`📦 [StockHttpService] GET ${url}`);
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: this.internalHeaders() }),
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      const status = error?.response?.status;
      this.logger.error(
        `❌ [StockHttpService] Failed to list stock (location_id=${locationId}): status=${status ?? 'N/A'}, message=${error?.message ?? error}`,
      );
      throw error;
    }
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
