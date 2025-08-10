import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StockService } from '@/stock/stock.service';
import { CreateProductDto } from '@/stock/dto/create-product.dto';
import { UpdateProductDto } from '@/stock/dto/update-product.dto';
import { CreateStockDto } from '@/stock/dto/create-stock.dto';
import { UpdateStockDto } from '@/stock/dto/update-stock.dto';
import { CreateStockTransactionDto } from '@/stock/dto/create-stock-transaction.dto';

@Controller()
export class StockMicroController {
  constructor(private readonly stockService: StockService) {}

  /* PRODUCTS */
  @MessagePattern('stock.products.create')
  createProduct(@Payload() dto: CreateProductDto) {
    return this.stockService.createProduct(dto);
  }

  @MessagePattern('stock.products.findAll')
  findAllProducts() {
    return this.stockService.findAllProducts();
  }

  @MessagePattern('stock.products.findOne')
  findProduct(@Payload() id: number) {
    return this.stockService.findProduct(id);
  }

  @MessagePattern('stock.products.update')
  updateProduct(@Payload() payload: { id: number; dto: UpdateProductDto }) {
    return this.stockService.updateProduct(payload.id, payload.dto);
  }

  @MessagePattern('stock.products.delete')
  deleteProduct(@Payload() id: number) {
    return this.stockService.deleteProduct(id);
  }

  /* STOCK ITEMS */
  @MessagePattern('stock.items.create')
  createStock(@Payload() dto: CreateStockDto) {
    return this.stockService.createStock(dto);
  }

  @MessagePattern('stock.items.findAll')
  findAllStocks() {
    return this.stockService.findAllStocks();
  }

  @MessagePattern('stock.items.findOne')
  findStock(@Payload() id: number) {
    return this.stockService.findStock(id);
  }

  @MessagePattern('stock.items.update')
  updateStock(@Payload() payload: { id: number; dto: UpdateStockDto }) {
    return this.stockService.updateStock(payload.id, payload.dto);
  }

  @MessagePattern('stock.items.delete')
  deleteStock(@Payload() id: number) {
    return this.stockService.deleteStock(id);
  }

  /* TRANSACTIONS */
  @MessagePattern('stock.transactions.create')
  createTransaction(@Payload() dto: CreateStockTransactionDto) {
    return this.stockService.createTransaction(dto);
  }

  @MessagePattern('stock.transactions.findAll')
  findAllTransactions() {
    return this.stockService.findAllTransactions();
  }
}