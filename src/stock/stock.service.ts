import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Locator } from './entities/locator.entity';
import { Stock, StockStatus } from './entities/stock.entity';
import { StockTransaction, TransactionType } from './entities/stock-transaction.entity';
import { RecipeUsage } from './entities/recipe-usage.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateLocatorDto } from './dto/create-locator.dto';
import { UpdateLocatorDto } from './dto/update-locator.dto';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { UpdateStockTransactionDto } from './dto/update-stock-transaction.dto';
import { CreateRecipeUsageDto } from './dto/create-recipe-usage.dto';
import { UpdateRecipeUsageDto } from './dto/update-recipe-usage.dto';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Locator) private readonly locatorRepo: Repository<Locator>,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    @InjectRepository(StockTransaction) private readonly txRepo: Repository<StockTransaction>,
    @InjectRepository(RecipeUsage) private readonly usageRepo: Repository<RecipeUsage>,
  ) {}

  /* PRODUCT CRUD */
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

  /* LOCATOR CRUD */
  async createLocator(dto: CreateLocatorDto): Promise<Locator> {
    const existing = await this.locatorRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Locatorul există deja');
    const loc = this.locatorRepo.create(dto);
    return await this.locatorRepo.save(loc);
  }

  async findAllLocators(): Promise<Locator[]> {
    return await this.locatorRepo.find();
  }

  async findLocator(id: number): Promise<Locator> {
    const loc = await this.locatorRepo.findOne({ where: { id } });
    if (!loc) throw new NotFoundException('Locatorul nu a fost găsit');
    return loc;
  }

  async updateLocator(id: number, dto: UpdateLocatorDto): Promise<Locator> {
    const loc = await this.findLocator(id);
    Object.assign(loc, dto);
    return await this.locatorRepo.save(loc);
  }

  async deleteLocator(id: number): Promise<void> {
    const loc = await this.findLocator(id);
    const stockCount = await this.stockRepo.count({ where: { locator_id: id } });
    if (stockCount > 0) throw new BadRequestException('Locatorul este folosit în stocuri');
    await this.locatorRepo.remove(loc);
  }

  /* STOCK CRUD */
  async createStock(dto: CreateStockDto): Promise<Stock> {
    // validation product/locator exists
    const product = await this.findProduct(dto.product_id);
    const locator = await this.findLocator(dto.locator_id);
    const stock = this.stockRepo.create({ ...dto, product, locator });
    return await this.stockRepo.save(stock);
  }

  async findAllStocks(): Promise<Stock[]> {
    return await this.stockRepo.find({ relations: ['product', 'locator'] });
  }

  async findStock(id: number): Promise<Stock> {
    const s = await this.stockRepo.findOne({ where: { id }, relations: ['product', 'locator', 'transactions'] });
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

  /* STOCK TRANSACTIONS */
  async createTransaction(dto: CreateStockTransactionDto): Promise<StockTransaction> {
    const stock = await this.findStock(dto.stock_id);
    // Update quantity on stock
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

  /* RECIPE USAGE */
  async createRecipeUsage(dto: CreateRecipeUsageDto): Promise<RecipeUsage> {
    const product = await this.findProduct(dto.product_id);
    const usage = this.usageRepo.create({ ...dto, product });
    return await this.usageRepo.save(usage);
  }

  async updateRecipeUsage(id: number, dto: UpdateRecipeUsageDto): Promise<RecipeUsage> {
    const usage = await this.usageRepo.findOne({ where: { id } });
    if (!usage) throw new NotFoundException('Utilizarea nu a fost găsită');
    Object.assign(usage, dto);
    return await this.usageRepo.save(usage);
  }

  async deleteRecipeUsage(id: number): Promise<void> {
    const usage = await this.usageRepo.findOne({ where: { id } });
    if (!usage) throw new NotFoundException('Utilizarea nu a fost găsită');
    await this.usageRepo.remove(usage);
  }
} 