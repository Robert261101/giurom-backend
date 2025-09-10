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

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.stockServiceUrl = this.configService.get<string>('STOCK_HTTP_URL') || 'http://localhost:3006';
  }

  /**
   * Creates a stock item entry in the stock microservice
   */
  async createStockItem(dto: CreateStockItemDto): Promise<StockResponse | null> {
    try {
      this.logger.log(`Creating stock item for product ${dto.product_id} with quantity ${dto.quantity}`);
      
      const response = await firstValueFrom(
        this.httpService.post<StockResponse>(`${this.stockServiceUrl}/stock/items`, dto)
      );

      this.logger.log(`Successfully created stock item with ID: ${response.data.id}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to create stock item for product ${dto.product_id}:`, error?.message || error);
      
      // Log more details for debugging
      if (error?.response) {
        this.logger.error(`Stock service responded with status ${error.response.status}:`, error.response.data);
      }
      
      return null;
    }
  }

  /**
   * Creates multiple stock items in batch
   */
  async createStockItems(items: CreateStockItemDto[]): Promise<StockResponse[]> {
    const results: StockResponse[] = [];
    
    for (const item of items) {
      const result = await this.createStockItem(item);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * Health check for stock service connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.stockServiceUrl}/stock/items`)
      );
      
      return response.status === 200;
    } catch (error: any) {
      this.logger.warn(`Stock service health check failed:`, error?.message || error);
      return false;
    }
  }
}