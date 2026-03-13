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
    this.serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
  }

  /**
   * Creates a stock item entry in the stock microservice
   */
  async createStockItem(dto: CreateStockItemDto): Promise<StockResponse | null> {
    const url = `${this.stockServiceUrl}/stock/items`;
    try {
      this.logger.log(`📦 [StockHttpService] POST ${url} - product_id=${dto.product_id}, quantity=${dto.quantity}, location_id=${dto.location_id ?? 'null'}`);
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
          },
          {
            headers: {
              'x-internal-service': 'suppliers-ms',
              'x-service-secret': this.serviceSecret,
              'Content-Type': 'application/json',
            },
          }
        )
      );
      const data = response.data;
      this.logger.log(`✅ [StockHttpService] Created stock item ID ${data?.id} for product ${dto.product_id}`);
      return data;
    } catch (error: any) {
      const status = error?.response?.status;
      const body = error?.response?.data;
      this.logger.error(
        `❌ [StockHttpService] Failed to create stock item (product_id=${dto.product_id}, quantity=${dto.quantity}): status=${status ?? 'N/A'}, message=${error?.message ?? error}`
      );
      if (body != null) {
        this.logger.error(`❌ [StockHttpService] Response body: ${JSON.stringify(body)}`);
      }
      if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
        this.logger.error(`❌ [StockHttpService] Verifică STOCK_HTTP_URL (current: ${this.stockServiceUrl}) și că serviciul stock rulează.`);
      }
      return null;
    }
  }

  /**
   * Creates multiple stock items in batch
   */
  async createStockItems(items: CreateStockItemDto[]): Promise<StockResponse[]> {
    this.logger.log(`📦 [StockHttpService] Creating ${items.length} stock items in batch`);
    const results: StockResponse[] = [];
    
    for (const item of items) {
      this.logger.log(`📦 [StockHttpService] Processing stock item: product_id=${item.product_id}, quantity=${item.quantity}, price=${item.price}`);
      const result = await this.createStockItem(item);
      if (result) {
        this.logger.log(`✅ [StockHttpService] Successfully created stock item with ID: ${result.id}`);
        results.push(result);
      } else {
        this.logger.error(`❌ [StockHttpService] Failed to create stock item for product_id=${item.product_id}, quantity=${item.quantity}`);
      }
    }
    
    this.logger.log(`📦 [StockHttpService] Created ${results.length} out of ${items.length} stock items`);
    return results;
  }

  /**
   * Health check for stock service connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.stockServiceUrl}/stock/items`,
          {
            headers: {
              'x-internal-service': 'suppliers-ms',
              'x-service-secret': this.serviceSecret,
            },
          }
        )
      );
      
      return response.status === 200;
    } catch (error: any) {
      this.logger.warn(`Stock service health check failed:`, error?.message || error);
      return false;
    }
  }
}