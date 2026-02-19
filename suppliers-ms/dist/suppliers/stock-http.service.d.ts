import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
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
export declare class StockHttpService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly stockServiceUrl;
    private readonly serviceSecret;
    constructor(httpService: HttpService, configService: ConfigService);
    createStockItem(dto: CreateStockItemDto): Promise<StockResponse | null>;
    createStockItems(items: CreateStockItemDto[]): Promise<StockResponse[]>;
    healthCheck(): Promise<boolean>;
}
