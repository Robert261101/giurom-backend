import { StockService } from './stock/stock.service';
import { CreateProductDto } from './stock/dto/create-product.dto';
import { UpdateProductDto } from './stock/dto/update-product.dto';
import { CreateStockDto } from './stock/dto/create-stock.dto';
import { UpdateStockDto } from './stock/dto/update-stock.dto';
import { CreateStockTransactionDto } from './stock/dto/create-stock-transaction.dto';
export declare class StockMicroController {
    private readonly stockService;
    constructor(stockService: StockService);
    createProduct(dto: CreateProductDto): Promise<import("./stock/entities/product.entity").Product>;
    findAllProducts(): Promise<import("./stock/entities/product.entity").Product[]>;
    findProduct(id: number): Promise<import("./stock/entities/product.entity").Product>;
    updateProduct(payload: {
        id: number;
        dto: UpdateProductDto;
    }): Promise<import("./stock/entities/product.entity").Product>;
    deleteProduct(id: number): Promise<void>;
    createStock(dto: CreateStockDto): Promise<import("./stock/entities/stock.entity").Stock>;
    findAllStocks(): Promise<import("./stock/entities/stock.entity").Stock[]>;
    findStock(id: number): Promise<import("./stock/entities/stock.entity").Stock>;
    updateStock(payload: {
        id: number;
        dto: UpdateStockDto;
    }): Promise<import("./stock/entities/stock.entity").Stock>;
    deleteStock(id: number): Promise<void>;
    createTransaction(dto: CreateStockTransactionDto): Promise<import("./stock/entities/stock-transaction.entity").StockTransaction>;
    findAllTransactions(): Promise<import("./stock/entities/stock-transaction.entity").StockTransaction[]>;
}
