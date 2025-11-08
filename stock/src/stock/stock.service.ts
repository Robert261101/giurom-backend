import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { Product } from './entities/product.entity';
import { Stock, StockStatus } from './entities/stock.entity';
import { StockTransaction, TransactionType } from './entities/stock-transaction.entity';
import { WasteRecord } from './entities/waste-record.entity';
import { ConsumptionRecord } from './entities/consumption-record.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { UpdateStockTransactionDto } from './dto/update-stock-transaction.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';
import { CreateConsumptionRecordDto } from './dto/create-consumption-record.dto';
import { UpdateConsumptionRecordDto } from './dto/update-consumption-record.dto';
import { AssignCategoryDto } from './dto/assign-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    @InjectRepository(StockTransaction) private readonly txRepo: Repository<StockTransaction>,
    @InjectRepository(WasteRecord) private readonly wasteRecordRepo: Repository<WasteRecord>,
    @InjectRepository(ConsumptionRecord) private readonly consumptionRecordRepo: Repository<ConsumptionRecord>,
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {}

  private async sendStockNotification(
    type: string,
    title: string,
    description: string,
    productId: number,
    metadata?: any
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'stock.notification' }, {
          type,
          title,
          description,
          entity_id: productId,
          entity_type: 'stock_product',
          metadata,
          priority: 'high',
        })
      );
    } catch (error) {
      console.error('Failed to send stock notification:', error);
    }
  }

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
    // Idempotency: if supplier_order_item_id provided, avoid duplicates
    if (dto.supplier_order_item_id) {
      const existing = await this.stockRepo.findOne({ where: { supplier_order_item_id: dto.supplier_order_item_id } });
      if (existing) {
        return existing;
      }
    }
    const stock = this.stockRepo.create({ ...dto, product });
    return await this.stockRepo.save(stock);
  }

  async findAllStocks(locationId?: number): Promise<Stock[]> {
    const queryBuilder = this.stockRepo.createQueryBuilder('stock')
      .leftJoinAndSelect('stock.product', 'product');
    
    if (locationId !== undefined) {
      queryBuilder.where('stock.location_id = :locationId', { locationId });
      console.log('🔍 [StockService] Filtrăm stock-urile după location_id:', locationId);
    }
    
    return await queryBuilder.getMany();
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

  async consumeProduct(productId: number, quantity: number, target: string = 'recipe-preparation', employeeId?: number, locationId?: number): Promise<void> {
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

    // Get product info for consumption record
    const product = await this.findProduct(productId);
    
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

    // Create consumption record
    if (employeeId && locationId) {
      const consumptionRecord = this.consumptionRecordRepo.create({
        product_id: productId,
        employee_id: employeeId,
        quantity,
        unit: product.unit,
        location_id: locationId,
        consumed_at: new Date(),
        reason: `Consum pentru ${target}`,
        product,
      });
      await this.consumptionRecordRepo.save(consumptionRecord);
    }
  }

  async createTransaction(dto: CreateStockTransactionDto): Promise<StockTransaction> {
    const stock = await this.findStock(dto.stock_id);
    // Idempotency: avoid duplicate transactions for the same stock_id + type + target
    if (dto.target) {
      const existingTx = await this.txRepo.findOne({ where: { stock_id: stock.id, type: dto.type as any, target: dto.target } as any });
      if (existingTx) {
        return existingTx;
      }
    }
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

  // === CATEGORY METHODS ===
  async findAllCategories(): Promise<Category[]> {
    return await this.categoryRepo.find({
      where: { is_active: true },
      order: { name: 'ASC' }
    });
  }

  async findCategoriesByType(type: string): Promise<Category[]> {
    return await this.categoryRepo.find({
      where: { type, is_active: true },
      order: { name: 'ASC' }
    });
  }

  async findProductsWithCategories(): Promise<Product[]> {
    return await this.productRepo.find({
      relations: ['categories'],
      order: { name: 'ASC' }
    });
  }

  async findProductWithCategories(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['categories']
    });
    
    if (!product) throw new NotFoundException('Produsul nu a fost găsit');
    return product;
  }

  async assignCategoriesToProduct(productId: number, assignCategoryDto: AssignCategoryDto): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['categories']
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (assignCategoryDto.category_ids) {
      const categories = await this.categoryRepo.findByIds(assignCategoryDto.category_ids);
      product.categories = categories;
    } else {
      product.categories = [];
    }

    return this.productRepo.save(product);
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkExpiringProducts(): Promise<void> {
    try {
      const now = new Date();
      const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Find products with stock expiring within 7 days
      const expiringStocks = await this.stockRepo.find({
        where: {
          expiration_date: MoreThan(now),
          status: StockStatus.VALID,
        },
        relations: ['product'],
      });

      for (const stock of expiringStocks) {
        // Check if expiration_date exists
        if (!stock.expiration_date) {
          continue;
        }
        
        const expirationDate = new Date(stock.expiration_date);
        if (expirationDate <= inSevenDays) {
          // Send notification for expiring product
          await this.sendStockNotification(
            'stock_expiring_soon',
            'Produs care expira in 7 zile',
            `Produsul ${stock.product?.name} va expira la ${expirationDate.toLocaleDateString('ro-RO')}`,
            stock.product_id,
            {
              productName: stock.product?.name,
              expirationDate: expirationDate.toISOString(),
              daysUntilExpiration: Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
            }
          );
        }
      }
    } catch (error) {
      console.error('Error checking expiring products:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkLowStockProducts(): Promise<void> {
    try {
      // Get all products with their total stock quantities
      const products = await this.productRepo.find();
      
      for (const product of products) {
        // Calculate total quantity for this product across all valid stock entries
        const totalQuantity = await this.stockRepo
          .createQueryBuilder('stock')
          .select('SUM(stock.quantity)', 'total')
          .where('stock.product_id = :productId', { productId: product.id })
          .andWhere('stock.status = :status', { status: StockStatus.VALID })
          .getRawOne();
        
        const quantity = parseFloat(totalQuantity?.total || '0');
        
        // Check if the product has a minimum stock level defined and if quantity is at or below that level
        if (product.min_stock_level && quantity <= product.min_stock_level && quantity > 0) {
          // Send notification for low stock product
          await this.sendStockNotification(
            'stock_low_quantity',
            'Stoc minim atins',
            `Produsul ${product.name} are doar ${quantity} unitati ramase in stoc`,
            product.id,
            {
              productName: product.name,
              currentQuantity: quantity,
              threshold: product.min_stock_level,
            }
          );
        }
      }
    } catch (error) {
      console.error('Error checking low stock products:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiringProductsCheck() {
    console.log('Checking for expiring products...');
    await this.checkExpiringProducts();
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleLowStockCheck() {
    console.log('Checking for low stock products...');
    await this.checkLowStockProducts();
  }

  async createWasteRecord(dto: CreateWasteRecordDto): Promise<WasteRecord> {
    // Verify product exists
    const product = await this.findProduct(dto.product_id);
    
    const wasteRecord = this.wasteRecordRepo.create({ ...dto, product });
    const savedWasteRecord = await this.wasteRecordRepo.save(wasteRecord);
    
    // Send notification for wasted product
    await this.sendStockNotification(
      'stock_wasted',
      'Produs aruncat',
      `Produsul ${product.name} a fost inregistrat ca deseu (cantitate: ${dto.quantity} ${dto.unit})`,
      product.id,
      {
        productName: product.name,
        quantity: dto.quantity,
        unit: dto.unit,
        reason: dto.reason,
        wasteRecordId: savedWasteRecord.id,
      }
    );
    
    return savedWasteRecord;
  }

  // === CONSUMPTION RECORDS ===

  async createConsumptionRecord(dto: CreateConsumptionRecordDto): Promise<ConsumptionRecord> {
    // Verify product exists if product_id is provided
    let product = null;
    if (dto.product_id) {
      product = await this.findProduct(dto.product_id);
    }
    
    const consumptionRecord = this.consumptionRecordRepo.create({
      ...dto,
      consumed_at: new Date(dto.consumed_at),
      ...(dto.created_at && { created_at: new Date(dto.created_at) }),
      ...(dto.updated_at && { updated_at: new Date(dto.updated_at) }),
      product,
    });
    
    return await this.consumptionRecordRepo.save(consumptionRecord);
  }

  async findConsumptionRecord(id: number): Promise<ConsumptionRecord> {
    const consumptionRecord = await this.consumptionRecordRepo.findOne({ 
      where: { id }, 
      relations: ['product'] 
    });
    if (!consumptionRecord) throw new NotFoundException('Înregistrarea de consum nu a fost găsită');
    return consumptionRecord;
  }

  async updateConsumptionRecord(id: number, dto: UpdateConsumptionRecordDto): Promise<ConsumptionRecord> {
    const consumptionRecord = await this.findConsumptionRecord(id);
    
    // If product_id is being updated, verify new product exists
    if (dto.product_id && dto.product_id !== consumptionRecord.product_id) {
      await this.findProduct(dto.product_id);
    }
    
    Object.assign(consumptionRecord, dto);
    if (dto.consumed_at) {
      consumptionRecord.consumed_at = new Date(dto.consumed_at);
    }
    if (dto.created_at) {
      consumptionRecord.created_at = new Date(dto.created_at);
    }
    if (dto.updated_at) {
      consumptionRecord.updated_at = new Date(dto.updated_at);
    }
    
    return await this.consumptionRecordRepo.save(consumptionRecord);
  }

  async deleteConsumptionRecord(id: number): Promise<void> {
    const consumptionRecord = await this.findConsumptionRecord(id);
    await this.consumptionRecordRepo.remove(consumptionRecord);
  }

  async findAllConsumptionRecords(filters?: {
    product_id?: number;
    location_id?: number;
    employee_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<ConsumptionRecord[]> {
    const queryBuilder = this.consumptionRecordRepo.createQueryBuilder('consumption')
      .leftJoinAndSelect('consumption.product', 'product')
      .orderBy('consumption.consumed_at', 'DESC');

    if (filters?.product_id) {
      queryBuilder.andWhere('consumption.product_id = :productId', { productId: filters.product_id });
    }

    if (filters?.location_id) {
      queryBuilder.andWhere('consumption.location_id = :locationId', { locationId: filters.location_id });
    }

    if (filters?.employee_id) {
      queryBuilder.andWhere('consumption.employee_id = :employeeId', { employeeId: filters.employee_id });
    }

    if (filters?.start_date) {
      queryBuilder.andWhere('consumption.consumed_at >= :startDate', { startDate: filters.start_date });
    }

    if (filters?.end_date) {
      queryBuilder.andWhere('consumption.consumed_at <= :endDate', { endDate: filters.end_date });
    }

    return await queryBuilder.getMany();
  }

  async getConsumptionStats(filters?: {
    product_id?: number;
    location_id?: number;
    employee_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    totalConsumed: number;
    byProduct: Array<{ product_id: number; product_name: string; total_quantity: number; unit: string }>;
    byLocation: Array<{ location_id: number; total_quantity: number }>;
    byEmployee: Array<{ employee_id: number; total_quantity: number }>;
  }> {
    const queryBuilder = this.consumptionRecordRepo.createQueryBuilder('consumption')
      .leftJoin('consumption.product', 'product');

    // Apply filters
    if (filters?.product_id) {
      queryBuilder.andWhere('consumption.product_id = :productId', { productId: filters.product_id });
    }

    if (filters?.location_id) {
      queryBuilder.andWhere('consumption.location_id = :locationId', { locationId: filters.location_id });
    }

    if (filters?.employee_id) {
      queryBuilder.andWhere('consumption.employee_id = :employeeId', { employeeId: filters.employee_id });
    }

    if (filters?.start_date) {
      queryBuilder.andWhere('consumption.consumed_at >= :startDate', { startDate: filters.start_date });
    }

    if (filters?.end_date) {
      queryBuilder.andWhere('consumption.consumed_at <= :endDate', { endDate: filters.end_date });
    }

    // Total consumed
    const totalResult = await queryBuilder
      .select('SUM(consumption.quantity)', 'total')
      .getRawOne();
    
    const totalConsumed = parseFloat(totalResult?.total || '0');

    // By product
    const byProduct = await queryBuilder
      .select([
        'consumption.product_id as product_id',
        'product.name as product_name',
        'SUM(consumption.quantity) as total_quantity',
        'product.unit as unit'
      ])
      .groupBy('consumption.product_id, product.name, product.unit')
      .getRawMany();

    // By location
    const byLocation = await queryBuilder
      .select([
        'consumption.location_id as location_id',
        'SUM(consumption.quantity) as total_quantity'
      ])
      .groupBy('consumption.location_id')
      .getRawMany();

    // By employee
    const byEmployee = await queryBuilder
      .select([
        'consumption.employee_id as employee_id',
        'SUM(consumption.quantity) as total_quantity'
      ])
      .where('consumption.employee_id IS NOT NULL')
      .groupBy('consumption.employee_id')
      .getRawMany();

    return {
      totalConsumed,
      byProduct: byProduct.map(item => ({
        product_id: parseInt(item.product_id),
        product_name: item.product_name || 'Unknown',
        total_quantity: parseFloat(item.total_quantity),
        unit: item.unit || ''
      })),
      byLocation: byLocation.map(item => ({
        location_id: parseInt(item.location_id),
        total_quantity: parseFloat(item.total_quantity)
      })),
      byEmployee: byEmployee.map(item => ({
        employee_id: parseInt(item.employee_id),
        total_quantity: parseFloat(item.total_quantity)
      }))
    };
  }

  async consumeForRecipePreparation(payload: {
    recipe_preparation_id: number;
    ingredients: Array<{ product_id: number; quantity: number }>;
    employee_id: number;
    location_id: number;
  }): Promise<void> {
    const { recipe_preparation_id, ingredients, employee_id, location_id } = payload;

    // Process each ingredient
    for (const ingredient of ingredients) {
      // First consume the product from stock
      await this.consumeProduct(
        ingredient.product_id,
        ingredient.quantity,
        'recipe-preparation',
        employee_id,
        location_id
      );

      // Create consumption record for recipe preparation
      const product = await this.findProduct(ingredient.product_id);
      const consumptionRecord = this.consumptionRecordRepo.create({
        recipe_preparation_id,
        product_id: ingredient.product_id,
        employee_id,
        quantity: ingredient.quantity,
        unit: product.unit,
        location_id,
        consumed_at: new Date(),
        reason: `Consum pentru prepararea rețetei ${recipe_preparation_id}`,
        product,
      });
      await this.consumptionRecordRepo.save(consumptionRecord);
    }
  }

}


