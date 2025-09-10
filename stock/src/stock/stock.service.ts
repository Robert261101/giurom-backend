import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Product } from './entities/product.entity';
import { Stock, StockStatus } from './entities/stock.entity';
import { StockTransaction, TransactionType } from './entities/stock-transaction.entity';
import { WasteRecord } from './entities/waste-record.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { UpdateStockTransactionDto } from './dto/update-stock-transaction.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    @InjectRepository(StockTransaction) private readonly txRepo: Repository<StockTransaction>,
    @InjectRepository(WasteRecord) private readonly wasteRecordRepo: Repository<WasteRecord>,
  ) {}

  async createProduct(dto: CreateProductDto): Promise<Product> {
    const existing = await this.productRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Produsul există deja');
    const product = this.productRepo.create(dto);
    return await this.productRepo.save(product);
  }

  async findAllProducts(): Promise<Product[]> {
    return await this.productRepo.find();
  }

  async findProduct(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Produsul nu a fost găsit');
    return product;
  }

  async updateProduct(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findProduct(id);
    Object.assign(product, dto);
    return await this.productRepo.save(product);
  }

  async deleteProduct(id: number): Promise<void> {
    const product = await this.findProduct(id);
    const stockCount = await this.stockRepo.count({ where: { product_id: id } });
    if (stockCount > 0) throw new BadRequestException('Produsul este folosit în stocuri');
    await this.productRepo.remove(product);
  }

  async createStock(dto: CreateStockDto): Promise<Stock> {
    const product = await this.findProduct(dto.product_id);
    const stock = this.stockRepo.create({ ...dto, product });
    return await this.stockRepo.save(stock);
  }

  async findAllStocks(): Promise<Stock[]> {
    return await this.stockRepo.find({ relations: ['product'] });
  }

  async findStock(id: number): Promise<Stock> {
    const s = await this.stockRepo.findOne({ where: { id }, relations: ['product', 'transactions'] });
    if (!s) throw new NotFoundException('Stocul nu a fost găsit');
    return s;
  }

  async updateStock(id: number, dto: UpdateStockDto): Promise<Stock> {
    const stock = await this.findStock(id);
    Object.assign(stock, dto);
    return await this.stockRepo.save(stock);
  }

  async deleteStock(id: number): Promise<void> {
    const stock = await this.findStock(id);
    await this.stockRepo.remove(stock);
  }

  async consumeProduct(productId: number, quantity: number, target: string = 'recipe-preparation'): Promise<void> {
    let remaining = quantity;
    const stocks = await this.stockRepo.find({
      where: { product_id: productId, status: StockStatus.VALID, quantity: MoreThan(0) },
      order: { expiration_date: 'ASC', entry_date: 'ASC' },
    });
    if (stocks.length === 0) {
      throw new BadRequestException(`Nu există stoc valid pentru produsul ${productId}`);
    }
    const totalAvailable = stocks.reduce((sum, stock) => sum + Number(stock.quantity), 0);
    if (totalAvailable < quantity) {
      throw new BadRequestException(
        `Cantitate insuficientă în stoc pentru produsul ${productId}. Disponibil: ${totalAvailable}, Necesar: ${quantity}, Lipsesc: ${quantity - totalAvailable}`,
      );
    }
    for (const stock of stocks) {
      if (remaining <= 0) break;
      const availableInStock = Number(stock.quantity);
      const toConsume = Math.min(availableInStock, remaining);
      const tx = this.txRepo.create({ stock: stock, stock_id: stock.id, type: TransactionType.EXIT, quantity: toConsume, location: 'production', target });
      await this.txRepo.save(tx);
      stock.quantity = availableInStock - toConsume;
      stock.last_update = new Date();
      await this.stockRepo.save(stock);
      remaining -= toConsume;
    }
    if (remaining > 0) {
      throw new BadRequestException(
        `Eroare în logica de consum pentru produsul ${productId}. Cantitate rămasă neconsumat: ${remaining}`,
      );
    }
  }

  async createTransaction(dto: CreateStockTransactionDto): Promise<StockTransaction> {
    const stock = await this.findStock(dto.stock_id);
    if (dto.type === TransactionType.ENTRY) {
      stock.quantity += dto.quantity;
    } else {
      if (stock.quantity < dto.quantity) throw new BadRequestException('Cantitate insuficientă în stoc');
      stock.quantity -= dto.quantity;
    }
    stock.last_update = new Date();
    await this.stockRepo.save(stock);
    const tx = this.txRepo.create({ ...dto, stock });
    return await this.txRepo.save(tx);
  }

  async findAllTransactions(): Promise<StockTransaction[]> {
    return await this.txRepo.find({ relations: ['stock'] });
  }

  // === WASTE RECORDS ===
  async createWasteRecord(dto: CreateWasteRecordDto): Promise<WasteRecord> {
    // Verify product exists
    const product = await this.findProduct(dto.product_id);
    
    const wasteRecord = this.wasteRecordRepo.create({ ...dto, product });
    return await this.wasteRecordRepo.save(wasteRecord);
  }

  async findAllWasteRecords(): Promise<WasteRecord[]> {
    return await this.wasteRecordRepo.find({ relations: ['product'], order: { created_at: 'DESC' } });
  }

  async findWasteRecord(id: number): Promise<WasteRecord> {
    const wasteRecord = await this.wasteRecordRepo.findOne({ where: { id }, relations: ['product'] });
    if (!wasteRecord) throw new NotFoundException('Waste record not found');
    return wasteRecord;
  }

  async updateWasteRecord(id: number, dto: UpdateWasteRecordDto): Promise<WasteRecord> {
    const wasteRecord = await this.findWasteRecord(id);
    
    // If product_id is being updated, verify new product exists
    if (dto.product_id && dto.product_id !== wasteRecord.product_id) {
      await this.findProduct(dto.product_id);
    }
    
    Object.assign(wasteRecord, dto);
    return await this.wasteRecordRepo.save(wasteRecord);
  }

  async deleteWasteRecord(id: number): Promise<void> {
    const wasteRecord = await this.findWasteRecord(id);
    await this.wasteRecordRepo.remove(wasteRecord);
  }
}


