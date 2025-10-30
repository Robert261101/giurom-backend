import { StockService } from './stock.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
export declare class StockMicroController {
    private readonly stockService;
    constructor(stockService: StockService);
    createProduct(dto: CreateProductDto): Promise<import("./entities/product.entity").Product>;
    findAllProducts(): Promise<import("./entities/product.entity").Product[]>;
    findProduct(id: number): Promise<import("./entities/product.entity").Product>;
    updateProduct(payload: {
        id: number;
        dto: UpdateProductDto;
    }): Promise<import("./entities/product.entity").Product>;
    deleteProduct(id: number): Promise<void>;
    createStock(dto: CreateStockDto): Promise<import("./entities/stock.entity").Stock>;
    findAllStocks(): Promise<import("./entities/stock.entity").Stock[]>;
    findStock(id: number): Promise<import("./entities/stock.entity").Stock>;
    updateStock(payload: {
        id: number;
        dto: UpdateStockDto;
    }): Promise<import("./entities/stock.entity").Stock>;
    deleteStock(id: number): Promise<void>;
    createTransaction(dto: CreateStockTransactionDto): Promise<import("./entities/stock-transaction.entity").StockTransaction>;
    findAllTransactions(): Promise<import("./entities/stock-transaction.entity").StockTransaction[]>;
}
