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
import { Repository, MoreThan, DeepPartial } from "typeorm";
import { ClientProxy } from "@nestjs/microservices";
import { Cron, CronExpression } from "@nestjs/schedule";
import { firstValueFrom, defaultIfEmpty } from "rxjs";
import * as fs from "fs";
import * as path from "path";
import { Product } from "./entities/product.entity";
import { Stock, StockStatus, StockSource } from "./entities/stock.entity";
import {
  StockTransaction,
  TransactionType,
} from "./entities/stock-transaction.entity";
import { WasteRecord } from "./entities/waste-record.entity";
import { WasteRequest } from "./entities/waste-request.entity";
import { ConsumptionRecord } from "./entities/consumption-record.entity";
import { CreateProductDto } from "./dto/create-product.dto";
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

  async findProductsByLocation(locationId: number): Promise<Product[]> {
    // Returnează doar produsele care au stock items în locația specificată
    const productsWithStock = await this.productRepo
      .createQueryBuilder("product")
      .innerJoin("product.stocks", "stock")
      .where("stock.location_id = :locationId", { locationId })
      .andWhere("product.is_active = :isActive", { isActive: true })
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

  async createStock(dto: CreateStockDto): Promise<Stock> {
    console.log(
      `🔍 [StockService] Creating stock for product_id: ${dto.product_id}, quantity: ${dto.quantity}`
    );
    const product = await this.findProduct(dto.product_id);
    console.log(
      `📦 [StockService] Found product ${product.id} (${product.name})`
    );

    // NOTĂ: Am eliminat idempotency pentru supplier_order_item_id
    // De ce? Pentru a permite recepții parțiale - fiecare recepție parțială trebuie să
    // creeze un stock item SEPARAT cu entry_date diferit, astfel încât să vedem în rapoarte
    // recepțiile separate pe zile diferite. Fiecare recepție parțială creează un stock item nou
    // pentru a păstra istoricul precis al recepțiilor.

    // Determine source: if supplier_order_item_id present and source not provided, treat as 'comanda'
    const payload: DeepPartial<Stock> = {
      ...(dto as any),
      product,
      status: StockStatus.VALID,
    };
    // If supplier_order_item_id present and no explicit source provided, treat as 'comanda'
    const hasSupplier =
      dto.supplier_order_item_id !== undefined &&
      dto.supplier_order_item_id !== null;
    // Decide source: if created from a supplier order item, mark as COMANDA, otherwise MANUAL
    if (hasSupplier && (dto as any).source === undefined) {
      payload.source = StockSource.COMANDA;
    } else if ((dto as any).source) {
      payload.source =
        (dto as any).source === "comanda"
          ? StockSource.COMANDA
          : StockSource.MANUAL;
    } else {
      payload.source = StockSource.MANUAL;
    }

    // Log the chosen source so it's obvious in runtime logs that order-based stocks get 'comanda'
    this.logger.log(
      `ℹ️ [createStock] Determined source for product ${dto.product_id}: ${payload.source}`
    );

    const stock = this.stockRepo.create(payload) as Stock;
    const savedStock = await this.stockRepo.save<Stock>(stock);
    this.logger.log(
      `✅ [StockService] Created stock ID ${savedStock.id} for product ${product.id}${dto.supplier_order_item_id ? ` (from order item ${dto.supplier_order_item_id})` : ""}`
    );

    const sourceLabel = payload.source === StockSource.COMANDA ? "preluare comanda furnizor" : "introducere manuală";
    const qty = Number(dto.quantity) ?? 0;
    const unit = (product as any).unit ? ` ${(product as any).unit}` : "";
    await this.sendStockNotification(
      payload.source === StockSource.COMANDA ? "stock_in_comanda" : "stock_in_manual",
      "Stoc intrare",
      `A intrat ${qty}${unit} ${product.name} prin ${sourceLabel}.`,
      product.id,
      { stockId: savedStock.id, quantity: qty, source: payload.source, productName: product.name },
      "/stoc",
      (dto as any).location_id,
    );
    return savedStock;
  }

  async findAllStocks(
    locationId?: number,
    productId?: number
  ): Promise<Stock[]> {
    const queryBuilder = this.stockRepo
      .createQueryBuilder("stock")
      .leftJoinAndSelect("stock.product", "product");

    if (locationId !== undefined || productId !== undefined) {
      const conditions: string[] = [];
      const params: any = {};

      if (locationId !== undefined) {
        conditions.push("stock.location_id = :locationId");
        params.locationId = locationId;
      }

      if (productId !== undefined) {
        conditions.push("stock.product_id = :productId");
        params.productId = productId;
      }

      if (conditions.length > 0) {
        queryBuilder.where(conditions.join(" AND "), params);
      }
    }

    const stocks = await queryBuilder.getMany();
    return stocks;
  }

  async findStock(id: number): Promise<Stock> {
    const s = await this.stockRepo.findOne({
      where: { id },
      relations: ["product", "transactions"],
    });
    if (!s) throw new NotFoundException("Stocul nu a fost găsit");
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

  /**
   * Verifică disponibilitatea stocului pentru mai multe produse simultan
   * Returnează lista de produse cu stoc insuficient (dacă există)
   */
  async checkStockAvailability(
    products: Array<{ product_id: number; quantity: number }>
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
      const stocks = await this.stockRepo.find({
        where: {
          product_id: item.product_id,
          status: StockStatus.VALID,
          quantity: MoreThan(0),
        },
      });

      const totalAvailable = stocks.reduce(
        (sum, stock) => sum + Number(stock.quantity),
        0
      );

      if (totalAvailable < item.quantity) {
        // Get product name for better error message
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
    recipePreparationId?: number
  ): Promise<void> {
    // Use explicit transaction handling
    const queryRunner = this.stockRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let remaining = quantity;
      const stockRepo = queryRunner.manager.getRepository(Stock);
      const txRepo = queryRunner.manager.getRepository(StockTransaction);
      const consumptionRecordRepo =
        queryRunner.manager.getRepository(ConsumptionRecord);

      const stocks = await stockRepo.find({
        where: {
          product_id: productId,
          status: StockStatus.VALID,
          quantity: MoreThan(0),
        },
        order: { expiration_date: "ASC", entry_date: "ASC" },
      });

      if (stocks.length === 0) {
        throw new BadRequestException(
          `Nu există stoc valid pentru produsul ${productId}`
        );
      }

      const totalAvailable = stocks.reduce(
        (sum, stock) => sum + Number(stock.quantity),
        0
      );

      if (totalAvailable < quantity) {
        throw new BadRequestException(
          `Cantitate insuficientă în stoc pentru produsul ${productId}. Disponibil: ${totalAvailable}, Necesar: ${quantity}, Lipsesc: ${quantity - totalAvailable}`
        );
      }

      // Get product info for consumption record
      const productRepo = queryRunner.manager.getRepository(Product);
      const product = await productRepo.findOne({ where: { id: productId } });
      if (!product) {
        throw new NotFoundException(
          `Produsul cu ID ${productId} nu a fost găsit`
        );
      }

      for (const stock of stocks) {
        if (remaining <= 0) break;
        const availableInStock = Number(stock.quantity);
        const toConsume = Math.min(availableInStock, remaining);

        const tx = txRepo.create({
          stock: stock,
          stock_id: stock.id,
          type: TransactionType.EXIT,
          quantity: toConsume,
          location: "production",
          target,
        });
        await txRepo.save(tx);

        stock.quantity = availableInStock - toConsume;
        stock.last_update = new Date();

        // Update stock status if quantity is zero or below minimum
        if (stock.quantity <= 0) {
          stock.status = StockStatus.EXPIRED;
        } else if (
          product.min_stock_level &&
          stock.quantity < product.min_stock_level
        ) {
          stock.status = StockStatus.BELOW_MINIMUM;
        }

        await stockRepo.save(stock);
        remaining -= toConsume;
      }

      if (remaining > 0) {
        throw new BadRequestException(
          `Eroare în logica de consum pentru produsul ${productId}. Cantitate rămasă neconsumat: ${remaining}`
        );
      }

      // Create consumption record ONLY if it's not waste
      // Waste records should be created separately in waste_records table
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
          location_id: locationId,
          consumed_at: new Date(),
          reason: `Consum pentru ${target}`,
          product,
        });
        await consumptionRecordRepo.save(consumptionRecord);
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      // Notificare ieșire stoc către admin + manager (aruncat este notificat din createWasteRecord)
      const isWasteTarget =
        target === "waste" ||
        (target && (target.toLowerCase().includes("waste") || target.toLowerCase().includes("aruncat")));
      if (!isWasteTarget && product) {
        const exitType =
          target === "recipe-preparation" || (target && target.toLowerCase().includes("recipe"))
            ? "stock_out_preparation"
            : "stock_out_consumed";
        const exitLabel =
          exitType === "stock_out_preparation" ? "preparare" : "consumat";
        const unit = (product as any).unit ? ` ${(product as any).unit}` : "";
        await this.sendStockNotification(
          exitType,
          "Stoc ieșire",
          `A ieșit ${quantity}${unit} ${product.name} prin ${exitLabel}.`,
          productId,
          { quantity, target, productName: product.name },
          "/stoc",
          locationId,
        );
      }
    } catch (error) {
      // Rollback transaction in case of error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  async createTransaction(
    dto: CreateStockTransactionDto
  ): Promise<StockTransaction> {
    console.log(
      `🔍 [StockService] Starting createTransaction for stock_id: ${dto.stock_id}, type: ${dto.type}, quantity: ${dto.quantity}`
    );

    // Use explicit transaction handling
    const queryRunner = this.stockRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      console.log(
        `🔄 [StockService] Starting database transaction for createTransaction`
      );

      const stockRepo = queryRunner.manager.getRepository(Stock);
      const txRepo = queryRunner.manager.getRepository(StockTransaction);

      const stock = await stockRepo.findOne({
        where: { id: dto.stock_id },
        relations: ["product", "transactions"],
      });
      if (!stock) {
        console.error(`❌ [StockService] Stock ${dto.stock_id} not found`);
        throw new NotFoundException("Stocul nu a fost găsit");
      }

      console.log(
        `📦 [StockService] Found stock ID ${dto.stock_id} for product ${stock.product_id} (${stock.product?.name}), current quantity: ${stock.quantity}`
      );

      // Idempotency: avoid duplicate transactions for the same stock_id + type + target
      if (dto.target) {
        const existingTx = await txRepo.findOne({
          where: {
            stock_id: stock.id,
            type: dto.type as any,
            target: dto.target,
          } as any,
        });
        if (existingTx) {
          console.log(
            `↩️ [StockService] Returning existing transaction for stock_id: ${dto.stock_id}, type: ${dto.type}, target: ${dto.target}`
          );
          await queryRunner.commitTransaction();
          return existingTx;
        }
      }

      const oldQuantity = Number(stock.quantity) || 0;
      const dtoQuantity = Number(dto.quantity) || 0;

      if (dto.type === TransactionType.ENTRY) {
        stock.quantity = oldQuantity + dtoQuantity;
        console.log(
          `📈 [StockService] ENTRY transaction: ${oldQuantity} + ${dtoQuantity} = ${stock.quantity}`
        );
      } else {
        if (oldQuantity < dtoQuantity) {
          console.error(
            `❌ [StockService] Insufficient stock for stock_id: ${dto.stock_id}. Available: ${oldQuantity}, Requested: ${dtoQuantity}`
          );
          throw new BadRequestException("Cantitate insuficientă în stoc");
        }
        stock.quantity = oldQuantity - dtoQuantity;
        console.log(
          `📉 [StockService] EXIT transaction: ${oldQuantity} - ${dtoQuantity} = ${stock.quantity}`
        );
      }
      stock.last_update = new Date();

      // Update stock status if quantity is zero or below minimum
      console.log(
        `🔄 [StockService] Checking stock status for stock ID ${stock.id}, quantity: ${stock.quantity}`
      );
      if (stock.quantity <= 0) {
        stock.status = StockStatus.EXPIRED;
        console.log(
          `⚠️ [StockService] Stock ID ${stock.id} is now EXPIRED (quantity: ${stock.quantity})`
        );
      } else {
        // Get the product to check min_stock_level
        const productRepo = queryRunner.manager.getRepository(Product);
        const product = await productRepo.findOne({
          where: { id: stock.product_id },
        });
        if (
          product &&
          product.min_stock_level &&
          stock.quantity < product.min_stock_level
        ) {
          stock.status = StockStatus.BELOW_MINIMUM;
          console.log(
            `⚠️ [StockService] Stock ID ${stock.id} is BELOW_MINIMUM (quantity: ${stock.quantity}, min: ${product.min_stock_level})`
          );
        } else if (stock.status !== StockStatus.EXPIRED) {
          // Only set to VALID if it's not already expired
          stock.status = StockStatus.VALID;
          console.log(
            `✅ [StockService] Stock ID ${stock.id} is now VALID (quantity: ${stock.quantity})`
          );
        }
      }

      await stockRepo.save(stock);
      console.log(`💾 [StockService] Saved updated stock ID ${stock.id}`);

      const tx = txRepo.create({ ...dto, stock });
      const savedTx = await txRepo.save(tx);
      console.log(`💾 [StockService] Saved transaction ID ${savedTx.id}`);

      // Commit transaction
      await queryRunner.commitTransaction();
      console.log(
        `✅ [StockService] Completed createTransaction for stock_id: ${dto.stock_id}`
      );
      return savedTx;
    } catch (error) {
      // Rollback transaction in case of error
      await queryRunner.rollbackTransaction();
      console.error(
        `❌ [StockService] Error in createTransaction for stock_id: ${dto.stock_id}`,
        error
      );
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  async findAllTransactions(): Promise<StockTransaction[]> {
    return await this.txRepo.find({ relations: ["stock"] });
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

      // Find products with stock expiring within 7 days
      const expiringStocks = await this.stockRepo.find({
        where: {
          expiration_date: MoreThan(now),
          status: StockStatus.VALID,
        },
        relations: ["product"],
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
            "stock_expiring_soon",
            "Produs care expira in 7 zile",
            `Produsul ${stock.product?.name} va expira la ${expirationDate.toLocaleDateString("ro-RO")}`,
            stock.product_id,
            {
              productName: stock.product?.name,
              expirationDate: expirationDate.toISOString(),
              daysUntilExpiration: Math.ceil(
                (expirationDate.getTime() - now.getTime()) /
                  (24 * 60 * 60 * 1000)
              ),
            },
            "/stoc" // Add target_url
          );
        }
      }
    } catch (error) {
      console.error("Error checking expiring products:", error);
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
          .createQueryBuilder("stock")
          .select("SUM(stock.quantity)", "total")
          .where("stock.product_id = :productId", { productId: product.id })
          .andWhere("stock.status = :status", { status: StockStatus.VALID })
          .getRawOne();

        const quantity = parseFloat(totalQuantity?.total || "0");

        // Check if the product has a minimum stock level defined and if quantity is at or below that level
        if (
          product.min_stock_level &&
          quantity <= product.min_stock_level &&
          quantity > 0
        ) {
          // Send notification for low stock product
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
            "/stoc" // Add target_url
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
