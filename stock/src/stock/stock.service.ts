import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  Logger,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager, In } from "typeorm";
import { ClientProxy } from "@nestjs/microservices";
import { Cron, CronExpression } from "@nestjs/schedule";
import { firstValueFrom, defaultIfEmpty } from "rxjs";
import * as fs from "fs";
import * as path from "path";
import { Product } from "./entities/product.entity";
import {
  Stock,
  StockStatus,
  StockSource,
  StockLotStatus,
} from "./entities/stock.entity";
import {
  StockTransaction,
  TransactionType,
} from "./entities/stock-transaction.entity";
import { WasteRecord } from "./entities/waste-record.entity";
import { WasteRequest } from "./entities/waste-request.entity";
import { ConsumptionRecord } from "./entities/consumption-record.entity";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateProductAtLocationDto } from "./dto/create-product-at-location.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateStockDto } from "./dto/create-stock.dto";
import { UpdateStockDto } from "./dto/update-stock.dto";
import { CreateStockTransactionDto } from "./dto/create-stock-transaction.dto";
import { UpdateStockTransactionDto } from "./dto/update-stock-transaction.dto";
import { CreateWasteRecordDto } from "./dto/create-waste-record.dto";
import { UpdateWasteRecordDto } from "./dto/update-waste-record.dto";
import { CreateConsumptionRecordDto } from "./dto/create-consumption-record.dto";
import { UpdateConsumptionRecordDto } from "./dto/update-consumption-record.dto";
import { AssignCategoryDto } from "./dto/assign-category.dto";
import { Category } from "./entities/category.entity";
import { OrderList } from "./entities/order-list.entity";
import { CreateOrderListDto } from "./dto/create-order-list.dto";
import { UpdateOrderListDto } from "./dto/update-order-list.dto";
import {
  PaginatedStockResponse,
  StockListQueryFilters,
  StockLocationSummary,
} from "./dto/paginated-stock.dto";

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    @InjectRepository(StockTransaction)
    private readonly txRepo: Repository<StockTransaction>,
    @InjectRepository(WasteRecord)
    private readonly wasteRecordRepo: Repository<WasteRecord>,
    @InjectRepository(WasteRequest)
    private readonly wasteRequestRepo: Repository<WasteRequest>,
    @InjectRepository(ConsumptionRecord)
    private readonly consumptionRecordRepo: Repository<ConsumptionRecord>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(OrderList)
    private readonly orderListRepo: Repository<OrderList>,
    @Inject("NOTIFICATIONS_RMQ")
    private readonly notificationsClient: ClientProxy,
    private readonly httpService?: HttpService,
    private readonly configService?: ConfigService
  ) {}

  // === WASTE REQUESTS ===
  async createWasteRequest(dto: any, createdBy?: number): Promise<WasteRequest> {
    if (!dto.product_id && !dto.recipe_preparation_id) {
      throw new BadRequestException(
        'Either product_id or recipe_preparation_id must be provided'
      );
    }

    const entity = this.wasteRequestRepo.create({
      ...dto,
      created_by: createdBy,
      status: 'pending',
    });

    const result = await this.wasteRequestRepo.save(entity);
    const saved = Array.isArray(result) ? result[0] : result;
    this.logger.log(`✅ [WasteRequest] Created ID=${saved.id} by ${createdBy || 'unknown'}`);
    // Trimite notificare pentru cererea de aruncare
    const workLocationId = dto.location_id ?? (dto as any).work_location_id;
    try {
      await firstValueFrom(
        this.notificationsClient
          .emit(
            { cmd: 'waste-requests.notification' },
            {
              type: 'waste_request_created',
              title: 'Cerere aruncare produs nouă',
              description: `S-a cerut aruncarea: ${dto.quantity || 0} ${dto.product_id ? 'unități produs' : 'preparat'}${dto.reason ? ` - ${dto.reason}` : ''}`,
              entity_id: saved.id,
              entity_type: 'waste_request',
              metadata: {
                wasteRequestId: saved.id,
                work_location_id: workLocationId,
                product_id: dto.product_id,
                recipe_preparation_id: dto.recipe_preparation_id,
                quantity: dto.quantity,
                reason: dto.reason,
                created_by: createdBy,
              },
              priority: 'medium',
              target_url: '/stoc/waste-requests',
            }
          )
          .pipe(defaultIfEmpty(undefined)),
      );
    } catch (err) {
      this.logger.warn('Failed to emit waste-request notification: ' + (err as Error)?.message);
    }

    return saved;
  }

  async getWasteRequests(filters?: { status?: string; location_id?: number }): Promise<(WasteRequest & { created_by_name?: string })[]> {
    const qb = this.wasteRequestRepo.createQueryBuilder('wr').leftJoinAndSelect('wr.product', 'product').orderBy('wr.created_at', 'DESC');
    if (filters?.status) {
      qb.andWhere('wr.status = :status', { status: filters.status });
    }
    if (filters?.location_id) {
      qb.andWhere('wr.location_id = :lid', { lid: filters.location_id });
    }
    const list = await qb.getMany();

    const creatorIds = [...new Set(list.map((r) => r.created_by).filter((id): id is number => id != null))];
    const employeesMap = new Map<number, any>();

    if (creatorIds.length > 0 && this.httpService) {
      let employeesServiceUrl = this.configService?.get<string>('EMPLOYEES_HTTP_URL') || 'http://localhost:3012';
      if (employeesServiceUrl.includes('bitap.ro') || employeesServiceUrl.includes('89.46.6.45')) {
        const portMatch = employeesServiceUrl.match(/:(\d+)/);
        const port = portMatch ? portMatch[1] : '3012';
        employeesServiceUrl = `http://localhost:${port}`;
      }
      const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
      const headers = { 'Content-Type': 'application/json', 'x-internal-service': 'stock', 'x-service-secret': serviceSecret };
      try {
        const idsParam = creatorIds.join(',');
        const employeeResponse: any = await firstValueFrom(
          this.httpService.get(`${employeesServiceUrl}/employees/batch`, { headers, params: { ids: idsParam } })
        );
        const employees = employeeResponse?.data || [];
        for (const emp of employees) {
          if (emp && typeof emp.id === 'number') employeesMap.set(emp.id, emp);
        }
      } catch (err: any) {
        this.logger?.warn(`Could not fetch employees batch for waste requests: ${err?.message}`);
      }
    }

    return list.map((req) => {
      const employee = employeesMap.get(req.created_by!);
      const created_by_name = employee
        ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.email || `Angajat #${req.created_by}`
        : req.created_by ? `Angajat #${req.created_by}` : undefined;
      return { ...req, created_by_name };
    });
  }

  async approveWasteRequest(id: number, approverId?: number): Promise<void> {
    const req = await this.wasteRequestRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Waste request not found');
    if (req.status !== 'pending') throw new BadRequestException('Waste request is not pending');

    // Approve product waste
    if (req.product_id) {
      // Create waste record
      const wrDto: any = {
        product_id: req.product_id,
        quantity: Number(req.quantity) || 0,
        reason: req.reason || null,
        photos: req.photos || undefined,
        location_id: req.location_id || undefined,
      };
      const wasteRecord = this.wasteRecordRepo.create({ ...wrDto, product: undefined });
      await this.wasteRecordRepo.save(wasteRecord);

      // Consume product from stock (uses existing consumeProduct logic)
      try {
        await this.consumeProduct(req.product_id, Number(req.quantity) || 0, 'waste', approverId, req.location_id);
      } catch (err) {
        this.logger.error(`Error consuming stock during approveWasteRequest ${id}: ${err}`);
        throw err;
      }
    }

    // Approve preparation waste (consume ingredients)
    if (req.recipe_preparation_id && this.httpService) {
      try {
        let recipesUrl = this.configService?.get<string>('RECIPES_HTTP_URL') || 'http://localhost:3003';
        // convert external to internal if necessary 
        if (recipesUrl.includes('bitap.ro') || recipesUrl.includes('89.46.6.45')) {
          const portMatch = recipesUrl.match(/:(\d+)/);
          const port = portMatch ? portMatch[1] : '3003';
          recipesUrl = `http://localhost:${port}`;
        }
        const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
        const headers = { 'x-internal-service': 'stock', 'x-service-secret': serviceSecret };

        // Get preparation to obtain produced quantity and recipe id
        const prepResp: any = await firstValueFrom(this.httpService.get(`${recipesUrl}/recipe-preparations/${req.recipe_preparation_id}`, { headers }));
        const preparation = prepResp?.data || prepResp;
        const prepQuantity = Number(preparation?.quantity) || 1;
        const recipeId = preparation?.recipe?.id || preparation?.recipe_id;

        if (!recipeId) {
          throw new BadRequestException('Could not determine recipe for preparation');
        }

        // Fetch scaled ingredients for the produced quantity
        const scaledResp: any = await firstValueFrom(this.httpService.get(`${recipesUrl}/recipes/${recipeId}/scaled-ingredients-with-stock`, { headers, params: { quantity: prepQuantity } }));
        const ingredients = scaledResp?.data || scaledResp;

        if (Array.isArray(ingredients)) {
          for (const ing of ingredients) {
            const productId = ing.product_id || ing.productId || ing.product;
            const qty = Number(ing.quantity || ing.qty || 0);
            if (!productId || !qty) continue;

            // Create waste record per ingredient linking to preparation
            const wr = this.wasteRecordRepo.create({ product_id: productId, recipe_preparation_id: req.recipe_preparation_id, quantity: qty, reason: req.reason || null, location_id: req.location_id });
            await this.wasteRecordRepo.save(wr);

            // Consume product from stock
            await this.consumeProduct(productId, qty, 'waste', approverId, req.location_id);
          }
        }
      } catch (err) {
        this.logger.error(`Error approving preparation waste request ${id}: ${err}`);
        throw err;
      }
    }

    // Update request status
    req.status = 'approved';
    await this.wasteRequestRepo.save(req);
    this.logger.log(`✅ [WasteRequest] Approved ID=${id} by ${approverId || 'unknown'}`);
  }

  async rejectWasteRequest(id: number, approverId?: number): Promise<void> {
    const req = await this.wasteRequestRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Waste request not found');
    if (req.status !== 'pending') throw new BadRequestException('Waste request is not pending');
    req.status = 'rejected';
    await this.wasteRequestRepo.save(req);
    this.logger.log(`🚫 [WasteRequest] Rejected ID=${id} by ${approverId || 'unknown'}`);
  }

  /** selectedWorkLocationId = locația selectată în UI (colț dreapta sus). */
  private async sendStockNotification(
    type: string,
    title: string,
    description: string,
    productId: number,
    metadata?: any,
    target_url?: string,
    selectedWorkLocationId?: number,
  ): Promise<void> {
    try {
      const payloadMetadata = {
        ...metadata,
        ...(selectedWorkLocationId != null && { work_location_id: selectedWorkLocationId }),
      };
      await firstValueFrom(
        this.notificationsClient.emit(
          { cmd: "stock.notification" },
          {
            type,
            title,
            description,
            entity_id: productId,
            entity_type: "stock_product",
            metadata: payloadMetadata,
            priority: "high",
            target_url,
          }
        )
      );
    } catch (error) {
      console.error("Failed to send stock notification:", error);
    }
  }

  /**
   * Normalize product.photo - keep it as-is since frontend will handle URL construction
   * Photo paths are stored as /api/images/products/... which work through API Gateway
   */
  private normalizeProductPhoto(product: Product): Product {
    // Simply return the product as-is without URL transformation
    // The /api/images/... paths work directly through API Gateway (port 3002)
    if (product.photo) {
      this.logger.log(
        `📸 [normalizeProductPhoto] Product ID ${product.id} (${product.name}) - Photo path: ${product.photo}`
      );
    } else {
      this.logger.log(
        `📸 [normalizeProductPhoto] Product ID ${product.id} (${product.name}) - No photo`
      );
    }
    return product;
  }

  async createProduct(dto: CreateProductDto): Promise<Product> {
    const existing = await this.productRepo.findOne({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException("Produsul există deja");
    const product = this.productRepo.create(dto);
    this.logger.log(
      `💾 [createProduct] Creating product with photo: ${dto.photo || "no photo"}`
    );
    const saved = await this.productRepo.save(product);
    this.logger.log(
      `✅ [createProduct] Saved product ID ${saved.id} with photo: ${saved.photo || "no photo"}`
    );
    return this.normalizeProductPhoto(saved);
  }

  async createProductAtLocation(
    dto: CreateProductAtLocationDto,
  ): Promise<{ product: Product; stock: Stock }> {
    const locationId = Number(dto.location_id);
    if (!Number.isFinite(locationId) || locationId <= 0) {
      throw new BadRequestException("location_id invalid");
    }

    const queryRunner = this.productRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const productRepo = queryRunner.manager.getRepository(Product);
      const stockRepo = queryRunner.manager.getRepository(Stock);

      const existingByName = await productRepo.findOne({
        where: { name: dto.name },
      });
      if (existingByName) {
        throw new ConflictException("Produsul există deja");
      }

      const skuTrimmed = dto.sku?.trim();
      if (skuTrimmed) {
        const existingBySku = await productRepo.findOne({
          where: { sku: skuTrimmed },
        });
        if (existingBySku) {
          throw new ConflictException("SKU-ul există deja");
        }
      }

      const product = productRepo.create({
        name: dto.name,
        unit: dto.unit,
        sku: skuTrimmed || undefined,
        description: dto.description ?? undefined,
        min_stock_level: dto.min_stock_level ?? undefined,
        is_active: dto.is_active ?? true,
        is_consumable: dto.is_consumable ?? false,
        photo: dto.photo ?? undefined,
      });
      const savedProduct = await productRepo.save(product);

      const stockRow = stockRepo.create({
        product_id: savedProduct.id,
        location_id: locationId,
        location_key: this.locationKey(locationId),
        quantity: 0,
        status: StockStatus.VALID,
      });
      const savedStock = await stockRepo.save(stockRow);

      await queryRunner.commitTransaction();

      return {
        product: this.normalizeProductPhoto(savedProduct),
        stock: savedStock,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllProducts(): Promise<Product[]> {
    const products = await this.productRepo.find();
    this.logger.log(`📦 [findAllProducts] Found ${products.length} products`);
    const productsWithPhotos = products.filter((p) => p.photo);
    if (productsWithPhotos.length > 0) {
      this.logger.log(
        `📸 [findAllProducts] Products with photos: ${productsWithPhotos.length}`
      );
      productsWithPhotos.forEach((p) => {
        this.logger.log(`   - Product ID ${p.id} (${p.name}): ${p.photo}`);
      });
    }
    return products.map((p) => this.normalizeProductPhoto(p));
  }

  /** Produse din nomenclatorul global care au rând în stock pentru locația dată (existență, nu qty>0). */
  async findProductsByLocation(locationId: number): Promise<Product[]> {
    const productsWithStock = await this.productRepo
      .createQueryBuilder("product")
      .innerJoin("product.stocks", "stock")
      .where("stock.location_key = :locationKey", {
        locationKey: this.locationKey(locationId),
      })
      .distinct(true)
      .getMany();

    return productsWithStock.map((p) => this.normalizeProductPhoto(p));
  }

  async findProduct(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException("Produsul nu a fost găsit");
    return this.normalizeProductPhoto(product);
  }

  async updateProduct(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findProduct(id);
    this.logger.log(
      `🔄 [updateProduct] Product ID ${id} - Current photo: ${product.photo || "no photo"}, New photo: ${dto.photo || "no change"}`
    );

    // Dacă se actualizează imaginea și există o imagine veche, șterge-o
    if (dto.photo && dto.photo !== product.photo && product.photo) {
      try {
        // Extrage numele fișierului din URL-ul vechi
        // Format URL: /api/images/products/{fileName}
        const oldPhotoUrl = product.photo;
        let oldFileName: string | null = null;

        if (oldPhotoUrl.includes("/api/images/products/")) {
          oldFileName = oldPhotoUrl.split("/api/images/products/")[1];
        } else if (oldPhotoUrl.includes("/products/")) {
          // Fallback pentru alte formate posibile
          const parts = oldPhotoUrl.split("/products/");
          if (parts.length > 1) {
            oldFileName = parts[parts.length - 1];
          }
        }

        // Șterge fișierul vechi dacă s-a găsit numele
        if (oldFileName) {
          const repoRoot = this.getRepoRoot();
          const imagesDir = path.join(repoRoot, "images", "products");
          const oldFilePath = path.join(imagesDir, oldFileName);

          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
            this.logger.log(`🗑️ Ștersă imaginea veche: ${oldFilePath}`);
          } else {
            this.logger.warn(
              `⚠️ Fișierul vechi nu a fost găsit: ${oldFilePath}`
            );
          }
        }
      } catch (error: any) {
        // Nu aruncăm eroare dacă nu se poate șterge imaginea veche
        // Continuăm cu actualizarea produsului
        this.logger.error(
          `❌ Eroare la ștergerea imaginii vechi: ${error?.message || error}`
        );
      }
    }

    Object.assign(product, dto);
    const updated = await this.productRepo.save(product);
    this.logger.log(
      `✅ [updateProduct] Updated product ID ${id} with final photo: ${updated.photo || "no photo"}`
    );
    return updated;
  }

  async deleteProduct(id: number): Promise<void> {
    const product = await this.findProduct(id);
    const stockCount = await this.stockRepo.count({
      where: { product_id: id },
    });
    if (stockCount > 0)
      throw new BadRequestException("Produsul este folosit în stocuri");
    await this.productRepo.remove(product);
  }

  /** IFNULL(location_id, -1) — matches migrated DB location_key. */
  private locationKey(locationId?: number | null): number {
    return locationId != null && Number.isFinite(Number(locationId))
      ? Number(locationId)
      : -1;
  }

  private async findOrCreateAggregate(
    productId: number,
    locationId: number | null | undefined,
    manager?: EntityManager,
  ): Promise<Stock> {
    const repo = manager ? manager.getRepository(Stock) : this.stockRepo;
    const location_key = this.locationKey(locationId);
    let row = await repo.findOne({
      where: { product_id: productId, location_key },
    });
    if (!row) {
      row = repo.create({
        product_id: productId,
        location_id: locationId ?? null,
        location_key,
        quantity: 0,
        status: StockStatus.VALID,
      });
      row = await repo.save(row);
    }
    return row;
  }

  private applyAggregateStatus(stock: Stock, product?: Product | null): void {
    const qty = Number(stock.quantity) || 0;
    if (qty <= 0) {
      stock.quantity = 0;
      stock.status = StockStatus.VALID;
      return;
    }
    if (
      product?.min_stock_level != null &&
      qty <= Number(product.min_stock_level)
    ) {
      stock.status = StockStatus.BELOW_MINIMUM;
    } else {
      stock.status = StockStatus.VALID;
    }
  }

  /** FEFO open balance per ENTRY row after replaying prior EXIT movements. */
  private async computeEntryOpenBalances(
    productId: number,
    locationKey: number | undefined,
    txRepo: Repository<StockTransaction>,
  ): Promise<Array<{ entry: StockTransaction; open: number }>> {
    const entryQb = txRepo
      .createQueryBuilder("tx")
      .where("tx.product_id = :productId", { productId })
      .andWhere("tx.type = :entry", { entry: TransactionType.ENTRY })
      .andWhere("(tx.status IS NULL OR tx.status IN (:...statuses))", {
        statuses: [StockLotStatus.VALID, StockLotStatus.BELOW_MINIMUM],
      })
      .orderBy("tx.expiration_date IS NULL", "ASC")
      .addOrderBy("tx.expiration_date", "ASC")
      .addOrderBy("tx.entry_date", "ASC")
      .addOrderBy("tx.id", "ASC");

    if (locationKey !== undefined) {
      entryQb.andWhere("tx.location_key = :locationKey", { locationKey });
    }

    const entries = await entryQb.getMany();
    const openMap = new Map<number, number>();
    for (const entry of entries) {
      openMap.set(entry.id, Number(entry.quantity) || 0);
    }

    const exitQb = txRepo
      .createQueryBuilder("tx")
      .where("tx.product_id = :productId", { productId })
      .andWhere("tx.type = :exit", { exit: TransactionType.EXIT })
      .orderBy("tx.timestamp", "ASC")
      .addOrderBy("tx.id", "ASC");

    if (locationKey !== undefined) {
      exitQb.andWhere("tx.location_key = :locationKey", { locationKey });
    }

    const exits = await exitQb.getMany();
    for (const exit of exits) {
      let remaining = Number(exit.quantity) || 0;
      for (const entry of entries) {
        if (remaining <= 0) break;
        const open = openMap.get(entry.id) || 0;
        if (open <= 0) continue;
        const take = Math.min(open, remaining);
        openMap.set(entry.id, open - take);
        remaining -= take;
      }
    }

    return entries.map((entry) => ({
      entry,
      open: openMap.get(entry.id) || 0,
    }));
  }

  private async getAvailableQuantity(
    productId: number,
    locationId?: number,
  ): Promise<number> {
    if (locationId != null && Number.isFinite(locationId)) {
      const row = await this.stockRepo.findOne({
        where: {
          product_id: productId,
          location_key: this.locationKey(locationId),
        },
      });
      return row ? Number(row.quantity) || 0 : 0;
    }

    const result = await this.stockRepo
      .createQueryBuilder("stock")
      .select("COALESCE(SUM(stock.quantity), 0)", "total")
      .where("stock.product_id = :productId", { productId })
      .getRawOne();
    return parseFloat(result?.total || "0");
  }

  async createStock(
    dto: CreateStockDto,
  ): Promise<Stock & { entry_transaction_id: number }> {
    this.logger.log(
      `🔍 [createStock] product_id=${dto.product_id}, qty=${dto.quantity}, location_id=${dto.location_id ?? "null"}`,
    );

    const product = await this.findProduct(dto.product_id);
    const qty = Number(dto.quantity) || 0;
    if (qty <= 0) {
      throw new BadRequestException("Cantitatea trebuie să fie mai mare decât 0");
    }

    const hasSupplier =
      dto.supplier_order_item_id !== undefined &&
      dto.supplier_order_item_id !== null;

    let source: StockSource = StockSource.MANUAL;
    if (hasSupplier && dto.source === undefined) {
      source = StockSource.COMANDA;
    } else if (dto.source === "comanda") {
      source = StockSource.COMANDA;
    } else if (dto.source === "manual") {
      source = StockSource.MANUAL;
    }

    const queryRunner = this.stockRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const stockRepo = queryRunner.manager.getRepository(Stock);
      const txRepo = queryRunner.manager.getRepository(StockTransaction);

      if (dto.target) {
        const existing = await txRepo.findOne({
          where: {
            type: TransactionType.ENTRY,
            target: dto.target,
          } as any,
        });
        if (existing) {
          const existingStock = await stockRepo.findOne({
            where: { id: existing.stock_id },
            relations: ["product"],
          });
          if (!existingStock) {
            throw new NotFoundException("Stocul agregat nu a fost găsit");
          }
          await queryRunner.commitTransaction();
          return Object.assign(existingStock, {
            entry_transaction_id: existing.id,
          });
        }
      }

      const aggregate = await this.findOrCreateAggregate(
        dto.product_id,
        dto.location_id,
        queryRunner.manager,
      );

      aggregate.quantity = Number(aggregate.quantity) + qty;
      this.applyAggregateStatus(aggregate, product);
      const savedStock = await stockRepo.save(aggregate);

      const entryTx = txRepo.create({
        stock_id: savedStock.id,
        product_id: dto.product_id,
        location_id: dto.location_id ?? null,
        location_key: this.locationKey(dto.location_id),
        supplier_order_item_id: dto.supplier_order_item_id ?? null,
        type: TransactionType.ENTRY,
        quantity: qty,
        price: dto.price,
        entry_date: dto.entry_date,
        expiration_date: dto.expiration_date,
        source,
        status: dto.status ?? StockLotStatus.VALID,
        document_url: dto.document_url,
        location:
          dto.location_id != null ? String(dto.location_id) : "unset",
        target:
          dto.target ??
          (hasSupplier
            ? `entry:supplier-item:${dto.supplier_order_item_id}:${savedStock.id}:${Date.now()}`
            : undefined),
        reference_type: hasSupplier ? "supplier_reception" : "manual_entry",
        reference_id: dto.supplier_order_item_id ?? null,
      });
      const savedTx = await txRepo.save(entryTx);

      await queryRunner.commitTransaction();

      const sourceLabel =
        source === StockSource.COMANDA
          ? "preluare comanda furnizor"
          : "introducere manuală";
      const unit = product.unit ? ` ${product.unit}` : "";
      await this.sendStockNotification(
        source === StockSource.COMANDA ? "stock_in_comanda" : "stock_in_manual",
        "Stoc intrare",
        `A intrat ${qty}${unit} ${product.name} prin ${sourceLabel}.`,
        product.id,
        {
          stockId: savedStock.id,
          transactionId: savedTx.id,
          quantity: qty,
          source,
          productName: product.name,
        },
        "/stoc",
        dto.location_id,
      );

      return Object.assign(savedStock, { entry_transaction_id: savedTx.id });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllStocks(
    locationId?: number,
    productId?: number,
  ): Promise<Stock[]> {
    const queryBuilder = this.stockRepo
      .createQueryBuilder("stock")
      .leftJoinAndSelect("stock.product", "product");

    const conditions: string[] = [];
    const params: Record<string, number> = {};

    if (locationId !== undefined && Number.isFinite(locationId)) {
      conditions.push("stock.location_key = :locationKey");
      params.locationKey = this.locationKey(locationId);
    }

    if (productId !== undefined && Number.isFinite(productId)) {
      conditions.push("stock.product_id = :productId");
      params.productId = productId;
    }

    if (conditions.length > 0) {
      queryBuilder.where(conditions.join(" AND "), params);
    }

    queryBuilder.orderBy("product.name", "ASC").addOrderBy("stock.id", "ASC");

    return queryBuilder.getMany();
  }

  private applyStockListFilters(
    queryBuilder: ReturnType<Repository<Stock>["createQueryBuilder"]>,
    filters: StockListQueryFilters,
  ): void {
    const conditions: string[] = [];
    const params: Record<string, string | number> = {};

    if (filters.locationId !== undefined && Number.isFinite(filters.locationId)) {
      conditions.push("stock.location_key = :locationKey");
      params.locationKey = this.locationKey(filters.locationId);
    }

    if (filters.productId !== undefined && Number.isFinite(filters.productId)) {
      conditions.push("stock.product_id = :productId");
      params.productId = filters.productId;
    }

    const search = filters.search?.trim().toLowerCase();
    if (search) {
      conditions.push("LOWER(product.name) LIKE :search");
      params.search = `%${search}%`;
    }

    if (filters.status && filters.status !== "all" && filters.status !== "none") {
      conditions.push("stock.status = :stockStatus");
      params.stockStatus = filters.status;
    }

    if (filters.stockFilter === "with_stock") {
      conditions.push("stock.quantity > 0");
    } else if (filters.stockFilter === "without_stock") {
      conditions.push("stock.quantity <= 0");
    }

    if (conditions.length > 0) {
      queryBuilder.where(conditions.join(" AND "), params);
    }
  }

  private applyStockListSort(
    queryBuilder: ReturnType<Repository<Stock>["createQueryBuilder"]>,
    filters: StockListQueryFilters,
  ): void {
    const sortDir = filters.sortDirection === "desc" ? "DESC" : "ASC";
    switch (filters.sortBy) {
      case "quantity":
        queryBuilder.orderBy("stock.quantity", sortDir);
        break;
      case "status":
        queryBuilder.orderBy("stock.status", sortDir);
        break;
      case "updated_at":
        queryBuilder.orderBy("stock.updated_at", sortDir);
        break;
      default:
        queryBuilder.orderBy("product.name", sortDir);
        break;
    }
    queryBuilder.addOrderBy("stock.id", "ASC");
  }

  async getStockLocationSummary(
    locationId: number,
  ): Promise<StockLocationSummary> {
    const row = await this.stockRepo
      .createQueryBuilder("stock")
      .select(
        "SUM(CASE WHEN stock.status IN ('below_minimum', 'expired') THEN 1 ELSE 0 END)",
        "below_minimum_count",
      )
      .where("stock.location_key = :locationKey", {
        locationKey: this.locationKey(locationId),
      })
      .getRawOne<{ below_minimum_count: string | null }>();

    return {
      below_minimum_count: Number(row?.below_minimum_count) || 0,
    };
  }

  async findAllStocksPaginated(
    page = 1,
    limit = 9,
    filters: StockListQueryFilters = {},
  ): Promise<PaginatedStockResponse<Stock>> {
    const cappedLimit = Math.min(Math.max(1, Number(limit) || 9), 9);
    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * cappedLimit;

    const countQb = this.stockRepo
      .createQueryBuilder("stock")
      .leftJoin("stock.product", "product");
    this.applyStockListFilters(countQb, filters);

    const dataQb = this.stockRepo
      .createQueryBuilder("stock")
      .leftJoinAndSelect("stock.product", "product");
    this.applyStockListFilters(dataQb, filters);
    this.applyStockListSort(dataQb, filters);

    const total = await countQb.getCount();
    const data = await dataQb.skip(skip).take(cappedLimit).getMany();
    const totalPages = total > 0 ? Math.ceil(total / cappedLimit) : 0;

    const pagination = {
      page: pageNum,
      limit: cappedLimit,
      total,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPreviousPage: pageNum > 1,
    };

    const response: PaginatedStockResponse<Stock> = { data, pagination };

    if (filters.locationId !== undefined && Number.isFinite(filters.locationId)) {
      response.summary = await this.getStockLocationSummary(filters.locationId);
    }

    return response;
  }

  async findStock(
    id: number,
  ): Promise<Stock & { transactions?: StockTransaction[] }> {
    const s = await this.stockRepo.findOne({
      where: { id },
      relations: ["product", "transactions"],
    });
    if (!s) throw new NotFoundException("Stocul nu a fost găsit");
    return s;
  }

  async updateStock(id: number, dto: UpdateStockDto): Promise<Stock> {
    const stock = await this.findStock(id);
    if (dto.quantity !== undefined) {
      stock.quantity = Number(dto.quantity);
    }
    if (dto.status !== undefined) {
      stock.status = dto.status;
    }
    const product = await this.productRepo.findOne({
      where: { id: stock.product_id },
    });
    if (dto.quantity !== undefined && dto.status === undefined) {
      this.applyAggregateStatus(stock, product);
    }
    return await this.stockRepo.save(stock);
  }

  async deleteStock(id: number): Promise<void> {
    const stock = await this.findStock(id);
    if (Number(stock.quantity) > 0) {
      throw new BadRequestException(
        "Nu se poate șterge stocul agregat cât timp cantitatea este mai mare decât 0",
      );
    }
    await this.stockRepo.remove(stock);
  }

  /**
   * Verifică disponibilitatea stocului pentru mai multe produse simultan
   * Returnează lista de produse cu stoc insuficient (dacă există)
   */
  async checkStockAvailability(
    products: Array<{ product_id: number; quantity: number; location_id?: number }>,
  ): Promise<{
    available: boolean;
    missing: Array<{
      product_id: number;
      needed: number;
      available: number;
      product_name?: string;
    }>;
  }> {
    const missing: Array<{
      product_id: number;
      needed: number;
      available: number;
      product_name?: string;
    }> = [];

    for (const item of products) {
      const totalAvailable = await this.getAvailableQuantity(
        item.product_id,
        item.location_id,
      );

      if (totalAvailable < item.quantity) {
        let productName: string | undefined;
        try {
          const product = await this.productRepo.findOne({
            where: { id: item.product_id },
          });
          productName = product?.name;
        } catch {
          // ignore
        }

        missing.push({
          product_id: item.product_id,
          needed: item.quantity,
          available: totalAvailable,
          product_name: productName,
        });
      }
    }

    return {
      available: missing.length === 0,
      missing,
    };
  }

  async consumeProduct(
    productId: number,
    quantity: number,
    target: string = "recipe-preparation",
    employeeId?: number,
    locationId?: number,
    recipePreparationId?: number,
  ): Promise<void> {
    const resolvedLocationId =
      locationId != null && Number.isFinite(Number(locationId))
        ? Number(locationId)
        : undefined;

    this.logger.log(
      `[consumeProduct] productId=${productId}, quantity=${quantity}, location_id=${resolvedLocationId ?? 'ALL'}, target=${target}`,
    );

    if (
      target?.startsWith('supplier-order-') &&
      resolvedLocationId === undefined
    ) {
      throw new BadRequestException(
        'location_id este obligatoriu pentru scăderea stocului la comanda furnizor',
      );
    }

    const queryRunner = this.stockRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let remaining = quantity;
      const stockRepo = queryRunner.manager.getRepository(Stock);
      const txRepo = queryRunner.manager.getRepository(StockTransaction);
      const consumptionRecordRepo =
        queryRunner.manager.getRepository(ConsumptionRecord);
      const productRepo = queryRunner.manager.getRepository(Product);

      const product = await productRepo.findOne({ where: { id: productId } });
      if (!product) {
        throw new NotFoundException(
          `Produsul cu ID ${productId} nu a fost găsit`,
        );
      }

      // Idempotency pentru scăderea stocului la comenzile furnizor: dacă există deja
      // un EXIT cu acest target, consumul a fost deja efectuat (ex. dublu-click pe
      // confirmare sau comandă scăzută anterior). Sărim — fără dublă-scădere.
      //
      // Compatibilitate flux nou ↔ vechi: aceeași scădere per (order, item) poate fi
      // marcată cu `supplier-order-confirm:*` (flux nou) sau `supplier-order-create:*`
      // (flux vechi). Verificăm AMBELE variante ca să nu re-scădem o comandă deja
      // scăzută sub fluxul vechi atunci când e confirmată acum.
      if (target?.startsWith("supplier-order-")) {
        const candidateTargets = new Set<string>([target]);
        if (target.startsWith("supplier-order-confirm:")) {
          candidateTargets.add(
            target.replace("supplier-order-confirm:", "supplier-order-create:"),
          );
        } else if (target.startsWith("supplier-order-create:")) {
          candidateTargets.add(
            target.replace("supplier-order-create:", "supplier-order-confirm:"),
          );
        }
        const existingExit = await txRepo.findOne({
          where: {
            type: TransactionType.EXIT,
            target: In([...candidateTargets]),
          } as any,
        });
        if (existingExit) {
          this.logger.log(
            `[consumeProduct] Idempotent skip: EXIT already exists for target=${existingExit.target} ` +
              `(requested=${target}, checked=[${[...candidateTargets].join(", ")}], tx=${existingExit.id})`,
          );
          await queryRunner.commitTransaction();
          return;
        }
      }

      const locationKey =
        resolvedLocationId !== undefined
          ? this.locationKey(resolvedLocationId)
          : undefined;

      const totalAvailable = await (async () => {
        if (locationKey !== undefined) {
          const row = await stockRepo.findOne({
            where: { product_id: productId, location_key: locationKey },
          });
          return row ? Number(row.quantity) || 0 : 0;
        }
        const raw = await stockRepo
          .createQueryBuilder("stock")
          .select("COALESCE(SUM(stock.quantity), 0)", "total")
          .where("stock.product_id = :productId", { productId })
          .getRawOne();
        return parseFloat(raw?.total || "0");
      })();

      if (totalAvailable <= 0) {
        throw new BadRequestException(
          `Nu există stoc valid pentru produsul ${productId}`,
        );
      }

      if (totalAvailable < quantity) {
        throw new BadRequestException(
          `Cantitate insuficientă în stoc pentru produsul ${productId}. Disponibil: ${totalAvailable}, Necesar: ${quantity}, Lipsesc: ${quantity - totalAvailable}`,
        );
      }

      const openEntries = await this.computeEntryOpenBalances(
        productId,
        locationKey,
        txRepo,
      );
      const totalFefoOpen = openEntries.reduce((sum, row) => sum + row.open, 0);

      const touchedLocationKeys = new Set<number>();

      for (const { entry, open } of openEntries) {
        if (remaining <= 0) break;
        if (open <= 0) continue;

        const toConsume = Math.min(open, remaining);
        const exitLocationId =
          resolvedLocationId !== undefined
            ? resolvedLocationId
            : (entry.location_id ?? null);
        const exitLocationKey =
          resolvedLocationId !== undefined
            ? this.locationKey(resolvedLocationId)
            : entry.location_key;
        const exitTx = txRepo.create({
          stock_id: entry.stock_id,
          product_id: productId,
          location_id: exitLocationId,
          location_key: exitLocationKey,
          type: TransactionType.EXIT,
          quantity: toConsume,
          location: entry.location || "production",
          target,
          reference_type: "consumption",
          reference_id: entry.id,
        });
        await txRepo.save(exitTx);
        touchedLocationKeys.add(exitLocationKey);
        remaining -= toConsume;
      }

      // Agregatul are stoc, dar ledger-ul ENTRY la locație e gol/desincronizat (ex. după migrare).
      if (
        remaining > 0 &&
        locationKey !== undefined &&
        totalAvailable >= quantity
      ) {
        const aggregate = await this.findOrCreateAggregate(
          productId,
          resolvedLocationId,
          queryRunner.manager,
        );
        const exitTx = txRepo.create({
          stock_id: aggregate.id,
          product_id: productId,
          location_id: resolvedLocationId ?? null,
          location_key: locationKey,
          type: TransactionType.EXIT,
          quantity: remaining,
          location:
            resolvedLocationId != null ? String(resolvedLocationId) : "unset",
          target,
          reference_type: "consumption",
          reference_id: null,
        });
        await txRepo.save(exitTx);
        touchedLocationKeys.add(locationKey);
        this.logger.warn(
          `[consumeProduct] Aggregate fallback EXIT productId=${productId}, location_id=${resolvedLocationId}, qty=${remaining}, fefoOpen=${totalFefoOpen}`,
        );
        remaining = 0;
      }

      if (remaining > 0) {
        throw new BadRequestException(
          `Eroare în logica FEFO pentru produsul ${productId}. Cantitate rămasă neconsumată: ${remaining}`,
        );
      }

      if (locationKey !== undefined) {
        const aggregate = await this.findOrCreateAggregate(
          productId,
          resolvedLocationId,
          queryRunner.manager,
        );
        aggregate.quantity = Math.max(0, Number(aggregate.quantity) - quantity);
        this.applyAggregateStatus(aggregate, product);
        await stockRepo.save(aggregate);
      } else {
        let toDeduct = quantity;
        for (const key of touchedLocationKeys) {
          if (toDeduct <= 0) break;
          const aggregate = await stockRepo.findOne({
            where: { product_id: productId, location_key: key },
          });
          if (!aggregate) continue;
          const deduct = Math.min(Number(aggregate.quantity) || 0, toDeduct);
          aggregate.quantity = Math.max(0, Number(aggregate.quantity) - deduct);
          this.applyAggregateStatus(aggregate, product);
          await stockRepo.save(aggregate);
          toDeduct -= deduct;
        }
      }

      const isWaste =
        target === "waste" ||
        target?.toLowerCase().includes("waste") ||
        target?.toLowerCase().includes("aruncat");

      if (!isWaste) {
        const consumptionRecord = consumptionRecordRepo.create({
          product_id: productId,
          employee_id: employeeId,
          recipe_preparation_id: recipePreparationId,
          quantity,
          location_id: resolvedLocationId,
          consumed_at: new Date(),
          reason: `Consum pentru ${target}`,
          product,
        });
        await consumptionRecordRepo.save(consumptionRecord);
      }

      await queryRunner.commitTransaction();

      const isWasteTarget =
        target === "waste" ||
        (target &&
          (target.toLowerCase().includes("waste") ||
            target.toLowerCase().includes("aruncat")));
      if (!isWasteTarget && product) {
        const exitType =
          target === "recipe-preparation" ||
          (target && target.toLowerCase().includes("recipe"))
            ? "stock_out_preparation"
            : "stock_out_consumed";
        const exitLabel =
          exitType === "stock_out_preparation" ? "preparare" : "consumat";
        const unit = product.unit ? ` ${product.unit}` : "";
        await this.sendStockNotification(
          exitType,
          "Stoc ieșire",
          `A ieșit ${quantity}${unit} ${product.name} prin ${exitLabel}.`,
          productId,
          { quantity, target, productName: product.name },
          "/stoc",
          resolvedLocationId,
        );
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createTransaction(
    dto: CreateStockTransactionDto,
  ): Promise<StockTransaction> {
    this.logger.log(
      `🔍 [createTransaction] stock_id=${dto.stock_id}, type=${dto.type}, qty=${dto.quantity}`,
    );

    const queryRunner = this.stockRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const stockRepo = queryRunner.manager.getRepository(Stock);
      const txRepo = queryRunner.manager.getRepository(StockTransaction);

      const stock = await stockRepo.findOne({
        where: { id: dto.stock_id },
        relations: ["product"],
      });
      if (!stock) {
        throw new NotFoundException("Stocul nu a fost găsit");
      }

      if (dto.target) {
        const existingTx = await txRepo.findOne({
          where: {
            stock_id: stock.id,
            type: dto.type as TransactionType,
            target: dto.target,
          } as any,
        });
        if (existingTx) {
          await queryRunner.commitTransaction();
          return existingTx;
        }
      }

      const oldQuantity = Number(stock.quantity) || 0;
      const dtoQuantity = Number(dto.quantity) || 0;

      if (dto.type === TransactionType.ENTRY) {
        stock.quantity = oldQuantity + dtoQuantity;
      } else {
        if (oldQuantity < dtoQuantity) {
          throw new BadRequestException("Cantitate insuficientă în stoc");
        }
        stock.quantity = oldQuantity - dtoQuantity;
      }

      this.applyAggregateStatus(stock, stock.product);
      await stockRepo.save(stock);

      const tx = txRepo.create({
        stock_id: stock.id,
        product_id: stock.product_id,
        location_id: stock.location_id ?? null,
        location_key: stock.location_key,
        supplier_order_item_id: dto.supplier_order_item_id ?? null,
        type: dto.type,
        quantity: dtoQuantity,
        price: dto.price,
        entry_date: dto.entry_date ?? new Date(),
        expiration_date: dto.expiration_date,
        source: dto.source,
        status: dto.status ?? StockLotStatus.VALID,
        document_url: dto.document_url,
        location: dto.location,
        target: dto.target,
        reference_type: dto.reference_type,
        reference_id: dto.reference_id,
      });
      const savedTx = await txRepo.save(tx);

      await queryRunner.commitTransaction();
      return savedTx;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllTransactions(filters?: {
    product_id?: number;
    location_id?: number;
    stock_id?: number;
    type?: TransactionType;
  }): Promise<StockTransaction[]> {
    const qb = this.txRepo
      .createQueryBuilder("tx")
      .leftJoinAndSelect("tx.stock", "stock")
      .orderBy("tx.timestamp", "DESC");

    if (filters?.product_id != null) {
      qb.andWhere("tx.product_id = :productId", {
        productId: filters.product_id,
      });
    }
    if (filters?.location_id != null) {
      qb.andWhere("tx.location_key = :locationKey", {
        locationKey: this.locationKey(filters.location_id),
      });
    }
    if (filters?.stock_id != null) {
      qb.andWhere("tx.stock_id = :stockId", { stockId: filters.stock_id });
    }
    if (filters?.type != null) {
      qb.andWhere("tx.type = :type", { type: filters.type });
    }

    return qb.getMany();
  }

  // === WASTE RECORDS ===

  async findAllWasteRecords(): Promise<WasteRecord[]> {
    return await this.wasteRecordRepo.find({
      relations: ["product"],
      order: { created_at: "DESC" },
    });
  }

  async findWasteRecord(id: number): Promise<WasteRecord> {
    const wasteRecord = await this.wasteRecordRepo.findOne({
      where: { id },
      relations: ["product"],
    });
    if (!wasteRecord) throw new NotFoundException("Waste record not found");
    return wasteRecord;
  }

  async updateWasteRecord(
    id: number,
    dto: UpdateWasteRecordDto
  ): Promise<WasteRecord> {
    const wasteRecord = await this.findWasteRecord(id);

    // Validate that either product_id or recipe_preparation_id is provided
    const finalProductId =
      dto.product_id !== undefined ? dto.product_id : wasteRecord.product_id;
    const finalRecipePreparationId =
      dto.recipe_preparation_id !== undefined
        ? dto.recipe_preparation_id
        : wasteRecord.recipe_preparation_id;

    if (!finalProductId && !finalRecipePreparationId) {
      throw new BadRequestException(
        "Either product_id or recipe_preparation_id must be provided"
      );
    }

    // If product_id is being updated, verify new product exists
    if (dto.product_id && dto.product_id !== wasteRecord.product_id) {
      await this.findProduct(dto.product_id);
    }

    // Update product relationship if product_id changed
    let product: Product | null = null;
    if (dto.product_id !== undefined) {
      if (dto.product_id) {
        product = await this.findProduct(dto.product_id);
      } else {
        product = null;
      }
    } else if (wasteRecord.product_id) {
      product = await this.findProduct(wasteRecord.product_id);
    }

    Object.assign(wasteRecord, dto, { product: product ?? undefined });
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
      order: { name: "ASC" },
    });
  }

  async findCategoriesByType(type: string): Promise<Category[]> {
    return await this.categoryRepo.find({
      where: { type, is_active: true },
      order: { name: "ASC" },
    });
  }

  async findProductsWithCategories(): Promise<Product[]> {
    const products = await this.productRepo.find({
      relations: ["categories"],
      order: { name: "ASC" },
    });
    return products.map((p) => this.normalizeProductPhoto(p));
  }

  async findProductWithCategories(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ["categories"],
    });

    if (!product) throw new NotFoundException("Produsul nu a fost găsit");
    return this.normalizeProductPhoto(product);
  }

  async assignCategoriesToProduct(
    productId: number,
    assignCategoryDto: AssignCategoryDto
  ): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ["categories"],
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    if (assignCategoryDto.category_ids) {
      const categories = await this.categoryRepo.findByIds(
        assignCategoryDto.category_ids
      );
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

      const entries = await this.txRepo
        .createQueryBuilder("tx")
        .leftJoinAndSelect("tx.stock", "stock")
        .where("tx.type = :entry", { entry: TransactionType.ENTRY })
        .andWhere("tx.expiration_date IS NOT NULL")
        .andWhere("tx.expiration_date > :now", { now })
        .andWhere("tx.expiration_date <= :inSevenDays", { inSevenDays })
        .andWhere("(tx.status IS NULL OR tx.status = :valid)", {
          valid: StockLotStatus.VALID,
        })
        .getMany();

      const notified = new Set<string>();

      for (const entry of entries) {
        const openRows = await this.computeEntryOpenBalances(
          entry.product_id,
          entry.location_key,
          this.txRepo,
        );
        const open =
          openRows.find((row) => row.entry.id === entry.id)?.open ?? 0;
        if (open <= 0) continue;

        const product = await this.productRepo.findOne({
          where: { id: entry.product_id },
        });
        const notifyKey = `${entry.product_id}:${entry.location_key}:${entry.expiration_date}`;
        if (notified.has(notifyKey)) continue;
        notified.add(notifyKey);

        const expirationDate = new Date(entry.expiration_date!);
        await this.sendStockNotification(
          "stock_expiring_soon",
          "Produs care expira in 7 zile",
          `Produsul ${product?.name ?? entry.product_id} va expira la ${expirationDate.toLocaleDateString("ro-RO")}`,
          entry.product_id,
          {
            productName: product?.name,
            expirationDate: expirationDate.toISOString(),
            daysUntilExpiration: Math.ceil(
              (expirationDate.getTime() - now.getTime()) /
                (24 * 60 * 60 * 1000),
            ),
          },
          "/stoc",
          entry.location_id ?? undefined,
        );
      }
    } catch (error) {
      console.error("Error checking expiring products:", error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkLowStockProducts(): Promise<void> {
    try {
      const products = await this.productRepo.find();

      for (const product of products) {
        const totalQuantity = await this.stockRepo
          .createQueryBuilder("stock")
          .select("COALESCE(SUM(stock.quantity), 0)", "total")
          .where("stock.product_id = :productId", { productId: product.id })
          .getRawOne();

        const quantity = parseFloat(totalQuantity?.total || "0");

        if (
          product.min_stock_level &&
          quantity <= product.min_stock_level &&
          quantity > 0
        ) {
          await this.sendStockNotification(
            "stock_low_quantity",
            "Stoc minim atins",
            `Produsul ${product.name} are doar ${quantity} unitati ramase in stoc`,
            product.id,
            {
              productName: product.name,
              currentQuantity: quantity,
              threshold: product.min_stock_level,
            },
            "/stoc",
          );
        }
      }
    } catch (error) {
      console.error("Error checking low stock products:", error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiringProductsCheck() {
    console.log("Checking for expiring products...");
    await this.checkExpiringProducts();
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleLowStockCheck() {
    console.log("Checking for low stock products...");
    await this.checkLowStockProducts();
  }

  async createWasteRecord(dto: CreateWasteRecordDto): Promise<WasteRecord> {
    // Validate that either product_id or recipe_preparation_id is provided
    if (!dto.product_id && !dto.recipe_preparation_id) {
      throw new BadRequestException(
        "Either product_id or recipe_preparation_id must be provided"
      );
    }

    // Verify product exists if product_id is provided
    let product: Product | null = null;
    if (dto.product_id) {
      product = await this.findProduct(dto.product_id);
    }

    const wasteRecord = this.wasteRecordRepo.create({
      ...dto,
      product: product ?? undefined,
    });
    const savedWasteRecord = await this.wasteRecordRepo.save(wasteRecord);
    console.log(
      `✅ [WasteRecord] Created: ID=${savedWasteRecord.id}, product_id=${dto.product_id || "null"}, recipe_preparation_id=${dto.recipe_preparation_id || "null"}, quantity=${dto.quantity}`
    );

    const entityName = dto.recipe_preparation_id
      ? `Preparatul (ID: ${dto.recipe_preparation_id})`
      : product?.name || "Produs necunoscut";
    const displayUnit = product?.unit ? ` ${product.unit}` : "";

    await this.sendStockNotification(
      "stock_out_waste",
      "Stoc ieșire",
      `A ieșit ${dto.quantity}${displayUnit} ${entityName} prin aruncat.`,
      product?.id || 0,
      {
        productName: product?.name || "Preparat",
        quantity: dto.quantity,
        reason: dto.reason,
        wasteRecordId: savedWasteRecord.id,
        recipePreparationId: dto.recipe_preparation_id,
      },
      "/stoc",
      (dto as any).location_id,
    );

    // Notificare waste-records către manageri/admins de la locație (format [Locatie Nume]: ... în notifications-ms)
    const workLocationId = dto.location_id ?? (dto as any).work_location_id;
    try {
      await firstValueFrom(
        this.notificationsClient
          .emit(
            { cmd: "waste-records.notification" },
            {
              type: "waste_record_created",
              title: "Înregistrare deșeu nouă",
              description: `S-a înregistrat un deșeu: ${dto.quantity}${displayUnit} ${entityName}${dto.reason ? ` - ${dto.reason}` : ""}`,
              entity_id: savedWasteRecord.id,
              entity_type: "waste_record",
              metadata: {
                wasteRecordId: savedWasteRecord.id,
                work_location_id: workLocationId,
                product_id: dto.product_id,
                recipe_preparation_id: dto.recipe_preparation_id,
                quantity: dto.quantity,
                reason: dto.reason,
              },
              priority: "medium",
              target_url: "/stoc",
            },
          )
          .pipe(defaultIfEmpty(undefined)),
      );
    } catch (err) {
      this.logger.warn("Failed to send waste-records notification: " + (err as Error)?.message);
    }

    return savedWasteRecord;
  }

  // === CONSUMPTION RECORDS ===

  async createConsumptionRecord(
    dto: CreateConsumptionRecordDto
  ): Promise<ConsumptionRecord> {
    // Verify product exists if product_id is provided
    let product: Product | null = null;
    if (dto.product_id) {
      product = await this.findProduct(dto.product_id);
    }

    const consumptionRecord = this.consumptionRecordRepo.create({
      ...dto,
      consumed_at: new Date(dto.consumed_at),
      ...(dto.created_at && { created_at: new Date(dto.created_at) }),
      ...(dto.updated_at && { updated_at: new Date(dto.updated_at) }),
      product: product ?? undefined,
    });

    return await this.consumptionRecordRepo.save(consumptionRecord);
  }

  async findConsumptionRecord(id: number): Promise<ConsumptionRecord> {
    const consumptionRecord = await this.consumptionRecordRepo.findOne({
      where: { id },
      relations: ["product"],
    });
    if (!consumptionRecord)
      throw new NotFoundException("Înregistrarea de consum nu a fost găsită");
    return consumptionRecord;
  }

  async updateConsumptionRecord(
    id: number,
    dto: UpdateConsumptionRecordDto
  ): Promise<ConsumptionRecord> {
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
  }): Promise<any[]> {
    const queryBuilder = this.consumptionRecordRepo
      .createQueryBuilder("consumption")
      .leftJoinAndSelect("consumption.product", "product")
      .orderBy("consumption.consumed_at", "DESC");

    if (filters?.product_id) {
      queryBuilder.andWhere("consumption.product_id = :productId", {
        productId: filters.product_id,
      });
    }

    if (filters?.location_id) {
      queryBuilder.andWhere("consumption.location_id = :locationId", {
        locationId: filters.location_id,
      });
    }

    if (filters?.employee_id) {
      queryBuilder.andWhere("consumption.employee_id = :employeeId", {
        employeeId: filters.employee_id,
      });
    }

    if (filters?.start_date) {
      queryBuilder.andWhere("consumption.consumed_at >= :startDate", {
        startDate: filters.start_date,
      });
    }

    if (filters?.end_date) {
      queryBuilder.andWhere("consumption.consumed_at <= :endDate", {
        endDate: filters.end_date,
      });
    }

    const records = await queryBuilder.getMany();

    // Obține numele angajaților din employees service
    const employeeIds = [
      ...new Set(
        records
          .map((r) => r.employee_id)
          .filter((id): id is number => id !== null && id !== undefined)
      ),
    ];
    const employeesMap = new Map<number, any>();

    // Obține informații despre angajați din employees service (comunicare internă directă)
    // Pentru comunicare internă pe server, folosim localhost (microserviciile rulează pe același server)
    // Employees service rulează pe portul 3012 (conform API Gateway)
    if (employeeIds.length > 0 && this.httpService) {
      let employeesServiceUrl =
        this.configService?.get<string>("EMPLOYEES_HTTP_URL") ||
        "http://localhost:3012";
      // Dacă EMPLOYEES_HTTP_URL conține "bitap.ro" sau IP extern, folosim localhost pentru comunicare internă
      if (
        employeesServiceUrl.includes("bitap.ro") ||
        employeesServiceUrl.includes("89.46.6.45")
      ) {
        // Pentru comunicare internă, înlocuim URL-ul extern cu localhost
        // Folosim portul 3012 (employees service) sau portul din URL dacă e specificat
        const portMatch = employeesServiceUrl.match(/:(\d+)/);
        const port = portMatch ? portMatch[1] : "3012";
        employeesServiceUrl = `http://localhost:${port}`;
        this.logger?.log(
          `🔧 [STOCK SERVICE] Converted external URL to internal: ${employeesServiceUrl}`
        );
      }
      const serviceSecret =
        process.env.SERVICE_SECRET || "default-service-secret";
      const headers = {
        "Content-Type": "application/json",
        "x-internal-service": "stock",
        "x-service-secret": serviceSecret,
      };

      // Folosim un singur request batch către employees service pentru a evita N+1
      try {
        const idsParam = employeeIds.join(",");
        const employeeResponse: any = await firstValueFrom(
          this.httpService!.get(`${employeesServiceUrl}/employees/batch`, {
            headers,
            params: { ids: idsParam },
          })
        );

        const employees = employeeResponse?.data || [];
        for (const employee of employees) {
          if (employee && typeof employee.id === "number") {
            employeesMap.set(employee.id, employee);
          }
        }
      } catch (error: any) {
        this.logger?.warn(
          `⚠️ [STOCK SERVICE] Could not fetch employees batch from ${employeesServiceUrl}/employees/batch:`,
          error?.message
        );
      }
    }

    // Adaugă numele angajatului la fiecare înregistrare
    return records.map((record) => {
      const employee = employeesMap.get(record.employee_id!);
      const employeeName = employee
        ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim() ||
          employee.email ||
          `Angajat ID: ${record.employee_id}`
        : record.employee_id
          ? `Angajat ID: ${record.employee_id}`
          : null;

      return {
        ...record,
        employee_name: employeeName,
      };
    });
  }

  async getConsumptionStats(filters?: {
    product_id?: number;
    location_id?: number;
    employee_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    totalConsumed: number;
    byProduct: Array<{
      product_id: number;
      product_name: string;
      total_quantity: number;
      unit: string;
    }>;
    byLocation: Array<{ location_id: number; total_quantity: number }>;
    byEmployee: Array<{ employee_id: number; total_quantity: number }>;
  }> {
    const queryBuilder = this.consumptionRecordRepo
      .createQueryBuilder("consumption")
      .leftJoin("consumption.product", "product");

    // Apply filters
    if (filters?.product_id) {
      queryBuilder.andWhere("consumption.product_id = :productId", {
        productId: filters.product_id,
      });
    }

    if (filters?.location_id) {
      queryBuilder.andWhere("consumption.location_id = :locationId", {
        locationId: filters.location_id,
      });
    }

    if (filters?.employee_id) {
      queryBuilder.andWhere("consumption.employee_id = :employeeId", {
        employeeId: filters.employee_id,
      });
    }

    if (filters?.start_date) {
      queryBuilder.andWhere("consumption.consumed_at >= :startDate", {
        startDate: filters.start_date,
      });
    }

    if (filters?.end_date) {
      queryBuilder.andWhere("consumption.consumed_at <= :endDate", {
        endDate: filters.end_date,
      });
    }

    // Total consumed
    const totalResult = await queryBuilder
      .select("SUM(consumption.quantity)", "total")
      .getRawOne();

    const totalConsumed = parseFloat(totalResult?.total || "0");

    // By product
    const byProduct = await queryBuilder
      .select([
        "consumption.product_id as product_id",
        "product.name as product_name",
        "SUM(consumption.quantity) as total_quantity",
        "product.unit as unit",
      ])
      .groupBy("consumption.product_id, product.name, product.unit")
      .getRawMany();

    // By location
    const byLocation = await queryBuilder
      .select([
        "consumption.location_id as location_id",
        "SUM(consumption.quantity) as total_quantity",
      ])
      .groupBy("consumption.location_id")
      .getRawMany();

    // By employee
    const byEmployee = await queryBuilder
      .select([
        "consumption.employee_id as employee_id",
        "SUM(consumption.quantity) as total_quantity",
      ])
      .where("consumption.employee_id IS NOT NULL")
      .groupBy("consumption.employee_id")
      .getRawMany();

    return {
      totalConsumed,
      byProduct: byProduct.map((item) => ({
        product_id: parseInt(item.product_id),
        product_name: item.product_name || "Unknown",
        total_quantity: parseFloat(item.total_quantity),
        unit: item.unit || "",
      })),
      byLocation: byLocation.map((item) => ({
        location_id: parseInt(item.location_id),
        total_quantity: parseFloat(item.total_quantity),
      })),
      byEmployee: byEmployee.map((item) => ({
        employee_id: parseInt(item.employee_id),
        total_quantity: parseFloat(item.total_quantity),
      })),
    };
  }

  async consumeForRecipePreparation(payload: {
    recipe_preparation_id: number;
    ingredients: Array<{ product_id: number; quantity: number }>;
    employee_id: number;
    location_id: number;
  }): Promise<void> {
    const { recipe_preparation_id, ingredients, employee_id, location_id } =
      payload;

    // Process each ingredient
    for (const ingredient of ingredients) {
      // First consume the product from stock
      await this.consumeProduct(
        ingredient.product_id,
        ingredient.quantity,
        "recipe-preparation",
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
        location_id,
        consumed_at: new Date(),
        reason: `Consum pentru prepararea rețetei ${recipe_preparation_id}`,
        product,
      });
      await this.consumptionRecordRepo.save(consumptionRecord);
    }
  }

  /**
   * Calculează repo root-ul - similar cu employees și suppliers services
   */
  private getRepoRoot(): string {
    // Resolve repo root relative to this file location
    // __dirname is .../giurom-backend/stock/src (dev with ts-node) or .../giurom-backend/stock/dist (prod)
    const repoRoot = path.resolve(__dirname, "../../..");
    return repoRoot;
  }

  /**
   * Upload imagine produs - salvează pe server în /home/giurombitap/images/
   */
  async uploadProductImage(
    fileName: string,
    base64Content: string
  ): Promise<string> {
    try {
      // Extract base64 content from data URL (remove data:type;base64, prefix)
      let base64Data = base64Content;
      if (base64Data.includes(",")) {
        base64Data = base64Data.split(",")[1];
      }

      // Add timestamp prefix to filename
      // Frontend sends: compressed_1764180869380.jpeg
      // We save as: 1764180863230_compressed_1764180869380.jpeg (with our own timestamp)
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}_${fileName}`;

      // Save to images/products directory on server
      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images");
      const productsDir = path.join(imagesDir, "products");

      // Create images/products directory if it doesn't exist
      if (!fs.existsSync(productsDir)) {
        fs.mkdirSync(productsDir, { recursive: true });
        this.logger.log(`📁 Created images/products directory: ${productsDir}`);
      }

      const filePath = path.join(productsDir, uniqueFileName);
      const buffer = Buffer.from(base64Data, "base64");

      // ========== DEBUGGING: SALVARE IMAGINE ==========
      console.log("\n🟢 ========== SALVARE IMAGINE ==========");
      console.log("📂 Repo root:", repoRoot);
      console.log("📂 Images dir:", imagesDir);
      console.log("📂 Products dir:", productsDir);
      console.log("💾 File path complet:", filePath);
      console.log("📝 Nume fișier:", uniqueFileName);
      console.log("🟢 ========================================\n");

      fs.writeFileSync(filePath, buffer);
      this.logger.log(
        `✅ Product image saved: ${filePath} (${buffer.length} bytes)`
      );

      // Return the URL path with /api prefix for API Gateway static files endpoint
      const returnPath = `/api/images/products/${uniqueFileName}`;
      console.log("\n🔵 ========== URL RETURNAT ==========");
      console.log("🔗 Path returnat către frontend:", returnPath);
      console.log("🔵 ====================================\n");
      this.logger.log(`🔗 [uploadProductImage] Returning path: ${returnPath}`);
      this.logger.log(
        `📁 [uploadProductImage] Physical file location: ${filePath}`
      );
      return returnPath;
    } catch (error: any) {
      this.logger.error(`❌ Error uploading product image: ${error}`);
      throw new BadRequestException(
        `Eroare la salvarea imaginii: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Servește imaginea unui produs
   */
  async serveProductImage(
    fileName: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images", "products");
      const filePath = path.join(imagesDir, fileName);

      this.logger.log(`🔍 [serveProductImage] Looking for file: ${fileName}`);
      this.logger.log(`📁 [serveProductImage] Full path: ${filePath}`);
      this.logger.log(`📂 [serveProductImage] Images directory: ${imagesDir}`);

      if (!fs.existsSync(filePath)) {
        this.logger.error(`❌ [serveProductImage] File NOT FOUND: ${filePath}`);
        throw new NotFoundException(`Imaginea ${fileName} nu a fost găsită`);
      }

      this.logger.log(
        `✅ [serveProductImage] File found, serving: ${filePath}`
      );

      const buffer = fs.readFileSync(filePath);

      // Determină tipul MIME
      const extension = fileName.split(".").pop()?.toLowerCase() || "jpg";
      let mimeType = "image/jpeg";

      switch (extension) {
        case "png":
          mimeType = "image/png";
          break;
        case "gif":
          mimeType = "image/gif";
          break;
        case "webp":
          mimeType = "image/webp";
          break;
        case "svg":
          mimeType = "image/svg+xml";
          break;
      }

      return { buffer, mimeType };
    } catch (error: any) {
      this.logger.error(`❌ Error serving product image: ${error}`);
      throw error;
    }
  }

  /**
   * Upload imagine waste - salvează pe server în images/waste
   */
  async uploadWasteImage(
    fileName: string,
    base64Content: string
  ): Promise<string> {
    try {
      let base64Data = base64Content;
      if (base64Data.includes(",")) {
        base64Data = base64Data.split(",")[1];
      }

      const timestamp = Date.now();
      const fileExtension = fileName.split(".").pop() || "jpg";
      const baseFileName = fileName.replace(/\.[^/.]+$/, "") || "image";
      const uniqueFileName = `${timestamp}_${baseFileName}.${fileExtension}`;

      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images");
      const wasteDir = path.join(imagesDir, "waste");

      if (!fs.existsSync(wasteDir)) {
        fs.mkdirSync(wasteDir, { recursive: true });
        this.logger.log(`📁 Created images/waste directory: ${wasteDir}`);
      }

      const filePath = path.join(wasteDir, uniqueFileName);
      const buffer = Buffer.from(base64Data, "base64");

      fs.writeFileSync(filePath, buffer);
      this.logger.log(
        `✅ Waste image saved: ${filePath} (${buffer.length} bytes)`
      );

      // Return the URL path with /api prefix for API Gateway static files endpoint
      return `/api/images/waste/${uniqueFileName}`;
    } catch (error: any) {
      this.logger.error(`❌ Error uploading waste image: ${error}`);
      throw new BadRequestException(
        `Eroare la salvarea imaginii: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Servește imaginea unui waste
   */
  async serveWasteImage(
    fileName: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images", "waste");
      const filePath = path.join(imagesDir, fileName);

      if (!fs.existsSync(filePath)) {
        throw new NotFoundException(`Imaginea ${fileName} nu a fost găsită`);
      }

      const buffer = fs.readFileSync(filePath);

      const extension = fileName.split(".").pop()?.toLowerCase() || "jpg";
      let mimeType = "image/jpeg";

      switch (extension) {
        case "png":
          mimeType = "image/png";
          break;
        case "gif":
          mimeType = "image/gif";
          break;
        case "webp":
          mimeType = "image/webp";
          break;
        case "svg":
          mimeType = "image/svg+xml";
          break;
        case "jfif":
          mimeType = "image/jpeg";
          break;
      }

      return { buffer, mimeType };
    } catch (error: any) {
      this.logger.error(`❌ Error serving waste image: ${error}`);
      throw error;
    }
  }

  /**
   * Șterge imaginea unui waste de pe server
   */
  async deleteWasteImage(imageUrl: string): Promise<void> {
    try {
      const urlParts = imageUrl.split("/");
      const fileName = urlParts[urlParts.length - 1];

      if (!fileName) {
        throw new BadRequestException("URL-ul imaginii nu este valid");
      }

      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images", "waste");
      const filePath = path.join(imagesDir, fileName);

      if (!fs.existsSync(filePath)) {
        this.logger.warn(`⚠️ Waste image not found for deletion: ${filePath}`);
        return;
      }

      fs.unlinkSync(filePath);
      this.logger.log(`✅ Waste image deleted: ${filePath}`);
    } catch (error: any) {
      this.logger.error(`❌ Error deleting waste image: ${error}`);
      throw new BadRequestException(
        `Eroare la ștergerea imaginii: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Upload imagine consume - salvează pe server în images/consume
   */
  async uploadConsumeImage(
    fileName: string,
    base64Content: string
  ): Promise<string> {
    try {
      let base64Data = base64Content;
      if (base64Data.includes(",")) {
        base64Data = base64Data.split(",")[1];
      }

      const timestamp = Date.now();
      const fileExtension = fileName.split(".").pop() || "jpg";
      const baseFileName = fileName.replace(/\.[^/.]+$/, "") || "image";
      const uniqueFileName = `${timestamp}_${baseFileName}.${fileExtension}`;

      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images");
      const consumeDir = path.join(imagesDir, "consume");

      if (!fs.existsSync(consumeDir)) {
        fs.mkdirSync(consumeDir, { recursive: true });
        this.logger.log(`📁 Created images/consume directory: ${consumeDir}`);
      }

      const filePath = path.join(consumeDir, uniqueFileName);
      const buffer = Buffer.from(base64Data, "base64");

      fs.writeFileSync(filePath, buffer);
      this.logger.log(
        `✅ Consume image saved: ${filePath} (${buffer.length} bytes)`
      );

      // Return the URL path with /api prefix for API Gateway static files endpoint
      return `/api/images/consume/${uniqueFileName}`;
    } catch (error: any) {
      this.logger.error(`❌ Error uploading consume image: ${error}`);
      throw new BadRequestException(
        `Eroare la salvarea imaginii: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Servește imaginea unui consume
   */
  async serveConsumeImage(
    fileName: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images", "consume");
      const filePath = path.join(imagesDir, fileName);

      if (!fs.existsSync(filePath)) {
        throw new NotFoundException(`Imaginea ${fileName} nu a fost găsită`);
      }

      const buffer = fs.readFileSync(filePath);

      const extension = fileName.split(".").pop()?.toLowerCase() || "jpg";
      let mimeType = "image/jpeg";

      switch (extension) {
        case "png":
          mimeType = "image/png";
          break;
        case "gif":
          mimeType = "image/gif";
          break;
        case "webp":
          mimeType = "image/webp";
          break;
        case "svg":
          mimeType = "image/svg+xml";
          break;
        case "jfif":
          mimeType = "image/jpeg";
          break;
      }

      return { buffer, mimeType };
    } catch (error: any) {
      this.logger.error(`❌ Error serving consume image: ${error}`);
      throw error;
    }
  }

  /**
   * Șterge imaginea unui consume de pe server
   */
  async deleteConsumeImage(imageUrl: string): Promise<void> {
    try {
      const urlParts = imageUrl.split("/");
      const fileName = urlParts[urlParts.length - 1];

      if (!fileName) {
        throw new BadRequestException("URL-ul imaginii nu este valid");
      }

      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images", "consume");
      const filePath = path.join(imagesDir, fileName);

      if (!fs.existsSync(filePath)) {
        this.logger.warn(
          `⚠️ Consume image not found for deletion: ${filePath}`
        );
        return;
      }

      fs.unlinkSync(filePath);
      this.logger.log(`✅ Consume image deleted: ${filePath}`);
    } catch (error: any) {
      this.logger.error(`❌ Error deleting consume image: ${error}`);
      throw new BadRequestException(
        `Eroare la ștergerea imaginii: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Upload PDF - salvează pe server în /images/insert_stock_pdf/
   */
  async uploadStockInsertPdf(
    fileName: string,
    base64Content: string
  ): Promise<string> {
    try {
      let base64Data = base64Content;
      if (base64Data.includes(",")) {
        base64Data = base64Data.split(",")[1];
      }

      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}_${fileName}`;

      // Save PDFs under repoRoot/images/stock_manually to match other image upload locations
      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images");
      const pdfDir = path.join(imagesDir, "stock_manually");

      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
        this.logger.log(`📁 Created directory: ${pdfDir}`);
      }

      const filePath = path.join(pdfDir, uniqueFileName);
      const buffer = Buffer.from(base64Data, "base64");

      fs.writeFileSync(filePath, buffer);
      this.logger.log(`✅ PDF saved: ${filePath} (${buffer.length} bytes)`);

      // Return the URL path with /api prefix matching the physical folder 'stock_manually'
      const returnPath = `/api/images/stock_manually/${uniqueFileName}`;
      this.logger.log(
        `🔗 [uploadStockInsertPdf] Returning path: ${returnPath}`
      );
      return returnPath;
    } catch (error: any) {
      this.logger.error(`❌ Error uploading PDF: ${error}`);
      throw new BadRequestException(
        `Eroare la salvarea PDF-ului: ${error?.message || "Unknown error"}`
      );
    }
  }

  // === ORDER LISTS (lista de comenzi) - CRUD simplu ===
  async findAllOrderLists(workLocationId?: number): Promise<OrderList[]> {
    const qb = this.orderListRepo.createQueryBuilder('ol').orderBy('ol.list_date', 'DESC').addOrderBy('ol.created_at', 'DESC');
    if (workLocationId != null) {
      qb.andWhere('ol.work_location_id = :wid', { wid: workLocationId });
    }
    return qb.getMany();
  }

  async findOneOrderList(id: number): Promise<OrderList> {
    const one = await this.orderListRepo.findOne({ where: { id } });
    if (!one) throw new NotFoundException(`Order list ${id} not found`);
    return one;
  }

  async createOrderList(dto: CreateOrderListDto): Promise<OrderList> {
    const entity = this.orderListRepo.create({
      work_location_id: dto.work_location_id,
      list_date: dto.list_date,
      status: dto.status ?? 'in_asteptare',
      items: dto.items ?? [],
    });
    return this.orderListRepo.save(entity);
  }

  async updateOrderList(id: number, dto: UpdateOrderListDto): Promise<OrderList> {
    const existing = await this.findOneOrderList(id);
    if (dto.list_date != null) existing.list_date = dto.list_date;
    if (dto.status != null) existing.status = dto.status;
    if (dto.items != null) existing.items = dto.items;
    return this.orderListRepo.save(existing);
  }

  async deleteOrderList(id: number): Promise<void> {
    const existing = await this.findOneOrderList(id);
    await this.orderListRepo.remove(existing);
  }
}
