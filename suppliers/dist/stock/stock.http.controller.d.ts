import { StockService } from './stock.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';
export declare class StockHttpController {
    private readonly service;
    constructor(service: StockService);
    createProduct(dto: CreateProductDto): Promise<import("./entities/product.entity").Product>;
    getProducts(): Promise<import("./entities/product.entity").Product[]>;
    getProduct(id: string): Promise<import("./entities/product.entity").Product>;
    updateProduct(id: string, dto: UpdateProductDto): Promise<import("./entities/product.entity").Product>;
    deleteProduct(id: string): Promise<void>;
    createStock(dto: CreateStockDto): Promise<import("./entities/stock.entity").Stock>;
    getStocks(): Promise<import("./entities/stock.entity").Stock[]>;
    getStock(id: string): Promise<import("./entities/stock.entity").Stock>;
    updateStock(id: string, dto: UpdateStockDto): Promise<import("./entities/stock.entity").Stock>;
    deleteStock(id: string): Promise<void>;
    createTx(dto: CreateStockTransactionDto): Promise<import("./entities/stock-transaction.entity").StockTransaction>;
    getTxs(): Promise<import("./entities/stock-transaction.entity").StockTransaction[]>;
    consume(dto: {
        product_id: number;
        quantity: number;
        target?: string;
    }): Promise<void>;
    createWasteRecord(dto: CreateWasteRecordDto): Promise<import("./entities/waste-record.entity").WasteRecord>;
    getWasteRecords(): Promise<import("./entities/waste-record.entity").WasteRecord[]>;
    getWasteRecord(id: string): Promise<import("./entities/waste-record.entity").WasteRecord>;
    updateWasteRecord(id: string, dto: UpdateWasteRecordDto): Promise<import("./entities/waste-record.entity").WasteRecord>;
    deleteWasteRecord(id: string): Promise<void>;
}
