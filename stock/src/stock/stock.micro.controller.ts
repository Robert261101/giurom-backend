import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StockService } from './stock.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';

@Controller()
export class StockMicroController {
  constructor(private readonly stockService: StockService) {}

  @MessagePattern('stock.products.create')
  createProduct(@Payload() dto: CreateProductDto) { return this.stockService.createProduct(dto); }

  @MessagePattern('stock.products.findAll')
  findAllProducts() { return this.stockService.findAllProducts(); }

  @MessagePattern('stock.products.findOne')
  findProduct(@Payload() id: number) { return this.stockService.findProduct(id); }

  @MessagePattern('stock.products.update')
  updateProduct(@Payload() payload: { id: number; dto: UpdateProductDto }) { return this.stockService.updateProduct(payload.id, payload.dto); }

  @MessagePattern('stock.products.delete')
  deleteProduct(@Payload() id: number) { return this.stockService.deleteProduct(id); }

  @MessagePattern('stock.items.create')
  createStock(@Payload() dto: CreateStockDto) { return this.stockService.createStock(dto); }

  @MessagePattern('stock.items.findAll')
  findAllStocks() { return this.stockService.findAllStocks(); }

  @MessagePattern('stock.items.findOne')
  findStock(@Payload() id: number) { return this.stockService.findStock(id); }

  @MessagePattern('stock.items.update')
  updateStock(@Payload() payload: { id: number; dto: UpdateStockDto }) { return this.stockService.updateStock(payload.id, payload.dto); }

  @MessagePattern('stock.items.delete')
  deleteStock(@Payload() id: number) { return this.stockService.deleteStock(id); }

  @MessagePattern('stock.transactions.create')
  createTransaction(@Payload() dto: CreateStockTransactionDto) { return this.stockService.createTransaction(dto); }

  @MessagePattern('stock.transactions.findAll')
  findAllTransactions() { return this.stockService.findAllTransactions(); }

  // === WASTE RECORDS ===
  @MessagePattern('stock.waste-records.create')
  createWasteRecord(@Payload() dto: CreateWasteRecordDto) { return this.stockService.createWasteRecord(dto); }

  @MessagePattern('stock.waste-records.findAll')
  findAllWasteRecords() { return this.stockService.findAllWasteRecords(); }

  @MessagePattern('stock.waste-records.findOne')
  findWasteRecord(@Payload() id: number) { return this.stockService.findWasteRecord(id); }

  @MessagePattern('stock.waste-records.update')
  updateWasteRecord(@Payload() payload: { id: number; dto: UpdateWasteRecordDto }) { return this.stockService.updateWasteRecord(payload.id, payload.dto); }

  @MessagePattern('stock.waste-records.delete')
  deleteWasteRecord(@Payload() id: number) { return this.stockService.deleteWasteRecord(id); }

  // === MANUAL NOTIFICATION TRIGGERS ===
  @MessagePattern('stock.check-expiring-products')
  checkExpiringProducts() { return this.stockService.checkExpiringProducts(); }

  @MessagePattern('stock.check-low-stock-products')
  checkLowStockProducts() { return this.stockService.checkLowStockProducts(); }
}