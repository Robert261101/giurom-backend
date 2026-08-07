import { Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  Request,
  BadRequestException,
  UsePipes,
  ValidationPipe, Logger } from '@nestjs/common';
import { Response } from "express";
import { Permissions } from "../permissions/permissions.decorator";
import { StockService } from "./stock.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateProductAtLocationDto } from "./dto/create-product-at-location.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateStockDto } from "./dto/create-stock.dto";
import { UpdateStockDto } from "./dto/update-stock.dto";
import { IncrementStockBatchDto } from "./dto/increment-stock-batch.dto";
import { CreateStockTransactionDto } from "./dto/create-stock-transaction.dto";
import { TransactionType } from "./entities/stock-transaction.entity";
import { CreateWasteRecordDto } from "./dto/create-waste-record.dto";
import { UpdateWasteRecordDto } from "./dto/update-waste-record.dto";
import { CreateWasteRequestDto } from "./dto/create-waste-request.dto";
import { WasteExportService } from "./waste-export.service";
import { CreateConsumptionRecordDto } from "./dto/create-consumption-record.dto";
import { UpdateConsumptionRecordDto } from "./dto/update-consumption-record.dto";
import { AssignCategoryDto } from "./dto/assign-category.dto";
import { CreateOrderListDto } from "./dto/create-order-list.dto";
import { UpdateOrderListDto } from "./dto/update-order-list.dto";

@Controller("stock")
export class StockHttpController {
  private readonly logger = new Logger(StockHttpController.name);

  constructor(
    private readonly service: StockService,
    private readonly wasteExportService: WasteExportService,
  ) {}

  // Products
  @Post("products") @Permissions("stock.create") async createProduct(
    @Body() dto: CreateProductDto,
  ) {
    return await this.service.createProduct(dto);
  }
  @Post("products/at-location")
  @Permissions("stock.create")
  async createProductAtLocation(@Body() dto: CreateProductAtLocationDto) {
    return await this.service.createProductAtLocation(dto);
  }
  @Get("products")
  @Permissions("products.read")
  async getProducts(@Query("location_id") locationId?: string) {
    const parsedLocationId = locationId ? Number(locationId) : undefined;

    if (parsedLocationId !== undefined && Number.isFinite(parsedLocationId)) {
      return await this.service.findProductsByLocation(parsedLocationId);
    }

    return await this.service.findAllProducts();
  }
  @Get("products/names")
  @Permissions("products.read")
  async getProductNames(@Query("ids") ids?: string) {
    const parsedIds = (ids || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    return await this.service.findProductNamesByIds(parsedIds);
  }
  @Get("products/:id") @Permissions("products.read") async getProduct(
    @Param("id") id: string,
    @Request() req?: any,
  ) {
    return await this.service.findProduct(Number(id), req?.user);
  }
  @Patch("products/:id") @Permissions("stock.update") async updateProduct(
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
    @Request() req?: any,
  ) {
    return await this.service.updateProduct(Number(id), dto, req?.user);
  }
  @Patch("products/:id/at-location")
  @Permissions("stock.update")
  async updateProductAtLocation(
    @Param("id") id: string,
    @Query("location_id") locationId: string,
    @Body() dto: UpdateProductDto,
  ) {
    const parsedLocationId = Number(locationId);
    if (!Number.isFinite(parsedLocationId) || parsedLocationId <= 0) {
      throw new BadRequestException("location_id invalid");
    }
    return await this.service.updateProductAtLocation(
      Number(id),
      parsedLocationId,
      dto,
    );
  }
  @Delete("products/:id") @Permissions("stock.delete") async deleteProduct(
    @Param("id") id: string,
    @Request() req?: any,
  ) {
    return await this.service.deleteProduct(Number(id), req?.user);
  }

  // Stock items
  @Post("items") @Permissions("stock.create") async createStock(
    @Body() dto: CreateStockDto,
  ) {
    return await this.service.createStock(dto);
  }

  /** Incrementare atomică batch: stoc_nou = stoc_existent + cantitate (cu jurnal ENTRY). */
  @Post("items/increment-batch")
  @Permissions("stock.create")
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async incrementStockBatch(
    @Body() dto: IncrementStockBatchDto,
    @Request()
    req?: {
      bypassAuth?: boolean;
      user?: {
        company_id?: number | null;
        employee_id?: number;
        id?: number;
      };
      internalService?: string;
    },
  ) {
    return await this.service.incrementStockBatch(dto, {
      companyId: req?.user?.company_id ?? null,
      employeeId: req?.user?.employee_id ?? req?.user?.id ?? null,
      bypassLocationOwnership: !!req?.bypassAuth,
      callerService: req?.internalService ?? null,
    });
  }

  @Get("items") @Permissions("stock.read") async getStocks(
    @Query("location_id") locationId?: string,
    @Query("product_id") productId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("stock_filter") stockFilter?: string,
    @Query("sort_by") sortBy?: string,
    @Query("sort_direction") sortDirection?: string,
  ) {
    const parsedStockFilter =
      stockFilter === "with_stock" || stockFilter === "without_stock"
        ? stockFilter
        : "all";
    const parsedSortDirection =
      sortDirection === "desc" ? "desc" : "asc";

    return await this.service.findAllStocksPaginated(
      page ? Number(page) : 1,
      limit ? Number(limit) : 9,
      {
        locationId: locationId ? Number(locationId) : undefined,
        productId:
          productId != null && productId !== ""
            ? Number(productId)
            : undefined,
        search,
        status,
        stockFilter: parsedStockFilter,
        sortBy,
        sortDirection: parsedSortDirection,
      },
    );
  }
  @Get("items/location/:locationId/product-ids") @Permissions("stock.read") async getProductIdsAtLocation(
    @Param("locationId") locationId: string,
  ) {
    return await this.service.getProductIdsAtLocation(Number(locationId));
  }

  @Get("items/location/:locationId/quantities")
  @Permissions("stock.read")
  async getQuantitiesAtLocation(
    @Param("locationId") locationId: string,
    @Query("product_ids") productIdsRaw?: string,
  ) {
    const productIds = (productIdsRaw ?? "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);
    return await this.service.getQuantitiesForProductsAtLocation(
      Number(locationId),
      productIds,
    );
  }

  @Get("items/:id") @Permissions("stock.read") async getStock(
    @Param("id") id: string,
    @Request() req?: any,
  ) {
    return await this.service.findStock(Number(id), req?.user);
  }
  @Patch("items/:id") @Permissions("stock.update") async updateStock(
    @Param("id") id: string,
    @Body() dto: UpdateStockDto,
    @Request() req?: any,
  ) {
    return await this.service.updateStock(Number(id), dto, req?.user);
  }
  @Delete("items/:id") @Permissions("stock.delete") async deleteStock(
    @Param("id") id: string,
    @Request() req?: any,
  ) {
    return await this.service.deleteStock(Number(id), req?.user);
  }

  // Transactions
  @Post("transactions") @Permissions("stock.create") async createTx(
    @Body() dto: CreateStockTransactionDto,
  ) {
    return await this.service.createTransaction(dto);
  }
  @Get("transactions") @Permissions("stock.read") async getTxs(
    @Query("product_id") productId?: string,
    @Query("location_id") locationId?: string,
    @Query("stock_id") stockId?: string,
    @Query("type") type?: string,
  ) {
    const filters: {
      product_id?: number;
      location_id?: number;
      stock_id?: number;
      type?: TransactionType;
    } = {};
    if (productId) filters.product_id = Number(productId);
    if (locationId) filters.location_id = Number(locationId);
    if (stockId) filters.stock_id = Number(stockId);
    if (type === "entry" || type === "exit") {
      filters.type = type as TransactionType;
    }
    return await this.service.findAllTransactions(
      Object.keys(filters).length > 0 ? filters : undefined,
    );
  }

  // Check stock availability for multiple products (used before consuming)
  @Post("check-availability")
  @Permissions("stock.read")
  async checkAvailability(
    @Body() dto: { products: Array<{ product_id: number; quantity: number }> },
  ) {
    this.logger.log(`📡 [StockHttpController] Checking availability for ${dto.products?.length || 0} products`,);
    return await this.service.checkStockAvailability(dto.products || []);
  }

  // Consume product (FIFO by expiration)
  @Post("consume")
  @Permissions("stock.update")
  async consume(
    @Body()
    dto: {
      product_id: number;
      quantity: number;
      target?: string;
      employee_id?: number;
      location_id?: number;
      recipe_preparation_id?: number;
    },
  ) {
    const locationId =
      dto.location_id != null && Number.isFinite(Number(dto.location_id))
        ? Number(dto.location_id)
        : undefined;
        this.logger.log(`📡 [StockHttpController] Received consume request: product_id=${dto.product_id}, quantity=${dto.quantity}, location_id=${locationId ?? 'null'}, target=${dto.target ?? 'null'}`,);
    const result = await this.service.consumeProduct(
      Number(dto.product_id),
      Number(dto.quantity),
      dto.target,
      dto.employee_id,
      locationId,
      dto.recipe_preparation_id,
    );
    this.logger.log(`📡 [StockHttpController] Completed consume request for product ${dto.product_id}`,);
    return result;
  }

  // === EMPLOYEE-SPECIFIC ENDPOINTS ===
  // Consume product for employees (with separate permission)
  @Post("employee/consume")
  @Permissions("stock.consume_own")
  async employeeConsume(
    @Body()
    dto: {
      product_id: number;
      quantity: number;
      target?: string;
      employee_id?: number;
      location_id?: number;
      recipe_preparation_id?: number;
    },
  ) {
    this.logger.log(`📡 [StockHttpController] Received employee consume request:`,
      dto,);
    const result = await this.service.consumeProduct(
      Number(dto.product_id),
      Number(dto.quantity),
      dto.target || "employee-consumption",
      dto.employee_id,
      dto.location_id,
      dto.recipe_preparation_id,
    );
    this.logger.log(`📡 [StockHttpController] Completed employee consume request for product ${dto.product_id}`,);
    return result;
  }

  // Waste record for employees (with separate permission)
  @Post("employee/waste")
  @Permissions("stock.waste_own")
  async employeeWaste(@Body() dto: CreateWasteRecordDto, @Request() req?: any) {
    const locationId =
      dto.location_id ??
      req?.user?.work_location_id ??
      req?.user?.work_location_default_id;
    const dtoWithLocation =
      locationId != null ? { ...dto, location_id: locationId } : dto;
      this.logger.log(`📡 [WasteRecord] POST /employee/waste - product_id=${dto.product_id || "null"}, recipe_preparation_id=${dto.recipe_preparation_id || "null"}, quantity=${dto.quantity}, location_id=${locationId ?? "n/a"}`,);
    const result = await this.service.createWasteRecord(dtoWithLocation);

    // Also consume the stock when creating waste record (only if product_id is provided)
    // Use 'waste' as target to skip consumption_records creation (only waste_records will be created)
    // If recipe_preparation_id is provided, stock consumption is handled separately in throwPreparation
    if (dto.product_id) {
      try {
        await this.service.consumeProduct(
          dto.product_id,
          dto.quantity,
          "waste",
          undefined,
          locationId ?? undefined,
        );
      } catch (error) {
        // Nu aruncăm eroare aici pentru că waste record-ul a fost deja creat
      }
    }

    return result;
  }

  // === WASTE RECORDS ===
  @Post("waste-records")
  @Permissions("stock.create")
  async createWasteRecord(
    @Body() dto: CreateWasteRecordDto,
    @Request() req?: any,
  ) {
    const locationId =
      dto.location_id ??
      req?.user?.work_location_id ??
      req?.user?.work_location_default_id;
    const dtoWithLocation =
      locationId != null ? { ...dto, location_id: locationId } : dto;
      this.logger.log(`📡 [WasteRecord] POST /waste-records - product_id=${dto.product_id || "null"}, recipe_preparation_id=${dto.recipe_preparation_id || "null"}, quantity=${dto.quantity}, location_id=${locationId ?? "n/a"}`,);
    try {
      const result = await this.service.createWasteRecord(dtoWithLocation);
      return result;
    } catch (error: any) {
      console.error(`❌ [WasteRecord] Error:`, error?.message || error);
      throw error;
    }
  }

  // === WASTE REQUESTS ===
  @Post("waste-requests")
  @Permissions("stock.waste_own")
  async createWasteRequest(
    @Body() dto: CreateWasteRequestDto,
    @Request() req?: any,
  ) {
    const createdBy = req?.user?.id || req?.user?.employee_id || undefined;
    const locationId =
      dto.location_id ??
      req?.user?.work_location_id ??
      req?.user?.work_location_default_id;
    const dtoWithLocation =
      locationId != null ? { ...dto, location_id: locationId } : dto;
    const permissions: string[] = Array.isArray(req?.user?.permissions)
      ? req.user.permissions
      : [];
    const autoApprove = permissions.includes("stock.waste_approve");
    const created = await this.service.createWasteRequest(dtoWithLocation, createdBy, {
      autoApprove,
    });
    // Fire-and-forget: cererea trebuie sa apara repede in giurom 2.0, dar crearea ei nu
    // are voie sa esueze daca App2 e indisponibil.
    void this.wasteExportService.pushRequestSafe(created.id);
    return created;
  }

  @Get("waste-requests")
  @Permissions("stock.waste_approve")
  async listWasteRequests(
    @Query("status") status?: string,
    @Query("location_id") locationId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const filters: {
      status?: string;
      location_id?: number;
      page?: number;
      limit?: number;
    } = {};
    if (status) filters.status = status;
    if (locationId) filters.location_id = Number(locationId);
    if (page != null && page !== "") filters.page = Number(page);
    if (limit != null && limit !== "") filters.limit = Number(limit);
    return await this.service.getWasteRequests(
      Object.keys(filters).length > 0 ? filters : undefined,
    );
  }

  @Post("waste-requests/:id/approve")
  @Permissions("stock.waste_approve")
  async approveWasteRequest(@Param("id") id: string, @Request() req?: any) {
    const numId = Number(id);
    if (Number.isNaN(numId) || numId < 1) {
      throw new BadRequestException("ID cerere invalid");
    }
    const approverId = req?.user?.id || req?.user?.employee_id || undefined;
    await this.service.approveWasteRequest(numId, approverId);
    // Decizia luata aici trebuie sa se vada si in giurom 2.0, altfel cererea ar ramane
    // acolo vesnic "de acceptat".
    void this.wasteExportService.pushRequestSafe(numId);
    return { success: true };
  }

  @Post("waste-requests/:id/reject")
  @Permissions("stock.waste_approve")
  async rejectWasteRequest(@Param("id") id: string, @Request() req?: any) {
    const numId = Number(id);
    if (Number.isNaN(numId) || numId < 1) {
      throw new BadRequestException("ID cerere invalid");
    }
    const approverId = req?.user?.id || req?.user?.employee_id || undefined;
    await this.service.rejectWasteRequest(numId, approverId);
    void this.wasteExportService.pushRequestSafe(numId);
    return { success: true };
  }

  @Get("waste-records")
  @Permissions("stock.read")
  async getWasteRecords(@Request() req?: any) {
    return await this.service.findAllWasteRecords(req?.user);
  }

  @Get("waste-records/:id")
  @Permissions("stock.read")
  async getWasteRecord(@Param("id") id: string, @Request() req?: any) {
    return await this.service.findWasteRecord(Number(id), req?.user);
  }

  @Patch("waste-records/:id")
  @Permissions("stock.update")
  async updateWasteRecord(
    @Param("id") id: string,
    @Body() dto: UpdateWasteRecordDto,
    @Request() req?: any,
  ) {
    return await this.service.updateWasteRecord(Number(id), dto, req?.user);
  }

  @Delete("waste-records/:id")
  @Permissions("stock.delete")
  async deleteWasteRecord(@Param("id") id: string, @Request() req?: any) {
    return await this.service.deleteWasteRecord(Number(id), req?.user);
  }

  // === CATEGORY ENDPOINTS ===
  @Get("categories")
  async getCategories() {
    return await this.service.findAllCategories();
  }

  @Get("categories/type/:type")
  async getCategoriesByType(@Param("type") type: string) {
    return await this.service.findCategoriesByType(type);
  }

  @Get("products-with-categories")
  @Permissions("products.read")
  async getProductsWithCategories() {
    return await this.service.findProductsWithCategories();
  }

  @Post("products/:id/categories")
  async assignCategoriesToProduct(
    @Param("id") id: string,
    @Body() assignCategoryDto: AssignCategoryDto,
  ) {
    return await this.service.assignCategoriesToProduct(
      Number(id),
      assignCategoryDto,
    );
  }

  // === MANUAL NOTIFICATION TRIGGERS ===
  @Post("trigger-expiring-check")
  @Permissions("stock.update")
  async triggerExpiringProductsCheck() {
    return await this.service.checkExpiringProducts();
  }

  @Post("trigger-low-stock-check")
  @Permissions("stock.update")
  async triggerLowStockCheck() {
    return await this.service.checkLowStockProducts();
  }

  // === CONSUMPTION RECORDS ===
  @Post("consumption-records")
  @Permissions("stock.create")
  async createConsumptionRecord(@Body() dto: CreateConsumptionRecordDto) {
    return await this.service.createConsumptionRecord(dto);
  }

  @Get("consumption-records")
  @Permissions("stock.read")
  async getConsumptionRecords(
    @Query("product_id") productId?: string,
    @Query("location_id") locationId?: string,
    @Query("employee_id") employeeId?: string,
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string,
  ) {
    const filters = {
      ...(productId && { product_id: Number(productId) }),
      ...(locationId && { location_id: Number(locationId) }),
      ...(employeeId && { employee_id: Number(employeeId) }),
      ...(startDate && { start_date: startDate }),
      ...(endDate && { end_date: endDate }),
    };
    return await this.service.findAllConsumptionRecords(
      Object.keys(filters).length > 0 ? filters : undefined,
    );
  }

  @Get("consumption-records/:id")
  @Permissions("stock.read")
  async getConsumptionRecord(@Param("id") id: string) {
    return await this.service.findConsumptionRecord(Number(id));
  }

  @Patch("consumption-records/:id")
  @Permissions("stock.update")
  async updateConsumptionRecord(
    @Param("id") id: string,
    @Body() dto: UpdateConsumptionRecordDto,
  ) {
    return await this.service.updateConsumptionRecord(Number(id), dto);
  }

  @Delete("consumption-records/:id")
  @Permissions("stock.delete")
  async deleteConsumptionRecord(@Param("id") id: string) {
    return await this.service.deleteConsumptionRecord(Number(id));
  }

  @Get("consumption-records/stats")
  @Permissions("stock.read")
  async getConsumptionStats(
    @Query("product_id") productId?: string,
    @Query("location_id") locationId?: string,
    @Query("employee_id") employeeId?: string,
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string,
  ) {
    const filters = {
      ...(productId && { product_id: Number(productId) }),
      ...(locationId && { location_id: Number(locationId) }),
      ...(employeeId && { employee_id: Number(employeeId) }),
      ...(startDate && { start_date: startDate }),
      ...(endDate && { end_date: endDate }),
    };
    return await this.service.getConsumptionStats(
      Object.keys(filters).length > 0 ? filters : undefined,
    );
  }

  @Post("consume-for-recipe")
  @Permissions("stock.update")
  async consumeForRecipe(
    @Body()
    payload: {
      recipe_preparation_id: number;
      ingredients: Array<{ product_id: number; quantity: number }>;
      employee_id: number;
      location_id: number;
    },
  ) {
    return await this.service.consumeForRecipePreparation(payload);
  }

  // === PRODUCT IMAGE UPLOAD ===
  @Post("products/upload-image")
  @Permissions("stock.update", "suppliers.create")
  async uploadProductImage(
    @Body() payload: { fileName: string; content: string },
  ) {
    const imageUrl = await this.service.uploadProductImage(
      payload.fileName,
      payload.content,
    );
    return { imageUrl };
  }

  // === PDF UPLOAD ===
  @Post("insert/upload-pdf")
  @Permissions("stock.create")
  async uploadStockInsertPdf(
    @Body() payload: { fileName: string; content: string },
  ) {
    const pdfUrl = await this.service.uploadStockInsertPdf(
      payload.fileName,
      payload.content,
    );
    return { pdfUrl };
  }

  // === PRODUCT IMAGE SERVE ===
  @Get("products/image/:fileName")
  @Permissions("products.read", "suppliers.create", "order.read", "stock.read")
  async serveProductImage(
    @Param("fileName") fileName: string,
    @Res() res: Response,
  ) {
    const { buffer, mimeType } = await this.service.serveProductImage(fileName);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(buffer);
  }

  // === WASTE IMAGE UPLOAD ===
  @Post("waste/upload-image")
  @Permissions("stock.update")
  async uploadWasteImage(
    @Body() payload: { fileName: string; content: string },
  ) {
    const imageUrl = await this.service.uploadWasteImage(
      payload.fileName,
      payload.content,
    );
    return { imageUrl };
  }

  // === WASTE IMAGE UPLOAD FOR EMPLOYEES (with stock.waste_own permission) ===
  @Post("employee/waste/upload-image")
  @Permissions("stock.waste_own")
  async employeeUploadWasteImage(
    @Body() payload: { fileName: string; content: string },
  ) {
    const imageUrl = await this.service.uploadWasteImage(
      payload.fileName,
      payload.content,
    );
    return { imageUrl };
  }

  // === WASTE IMAGE SERVE ===
  @Get("waste/image/:fileName")
  @Permissions("stock.read")
  async serveWasteImage(
    @Param("fileName") fileName: string,
    @Res() res: Response,
  ) {
    const { buffer, mimeType } = await this.service.serveWasteImage(fileName);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(buffer);
  }

  // === WASTE IMAGE DELETE ===
  @Post("waste/delete-image")
  @Permissions("stock.update")
  async deleteWasteImage(@Body() payload: { imageUrl: string }) {
    await this.service.deleteWasteImage(payload.imageUrl);
    return { success: true, message: "Imaginea a fost ștearsă cu succes" };
  }

  // === CONSUME IMAGE UPLOAD ===
  @Post("consume/upload-image")
  @Permissions("stock.update")
  async uploadConsumeImage(
    @Body() payload: { fileName: string; content: string },
  ) {
    const imageUrl = await this.service.uploadConsumeImage(
      payload.fileName,
      payload.content,
    );
    return { imageUrl };
  }

  // === CONSUME IMAGE UPLOAD FOR EMPLOYEES (with stock.consume_own permission) ===
  @Post("employee/consume/upload-image")
  @Permissions("stock.consume_own")
  async employeeUploadConsumeImage(
    @Body() payload: { fileName: string; content: string },
  ) {
    const imageUrl = await this.service.uploadConsumeImage(
      payload.fileName,
      payload.content,
    );
    return { imageUrl };
  }

  // === CONSUME IMAGE SERVE ===
  @Get("consume/image/:fileName")
  @Permissions("stock.read")
  async serveConsumeImage(
    @Param("fileName") fileName: string,
    @Res() res: Response,
  ) {
    const { buffer, mimeType } = await this.service.serveConsumeImage(fileName);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(buffer);
  }

  // === CONSUME IMAGE DELETE ===
  @Post("consume/delete-image")
  @Permissions("stock.update")
  async deleteConsumeImage(@Body() payload: { imageUrl: string }) {
    await this.service.deleteConsumeImage(payload.imageUrl);
    return { success: true, message: "Imaginea a fost ștearsă cu succes" };
  }

  // === ORDER LISTS (lista tampon) - CRUD fără permisiuni, doar JWT ===
  @Get("order-lists")
  async getOrderLists(
    @Query("work_location_id") workLocationId?: string,
    @Request() req?: any,
  ) {
    const locId = workLocationId
      ? Number(workLocationId)
      : (req?.user?.work_location_id ?? req?.user?.work_location_default_id);
    return this.service.findAllOrderLists(locId ?? undefined);
  }

  @Get("order-lists/:id")
  async getOrderList(@Param("id") id: string) {
    return this.service.findOneOrderList(Number(id));
  }

  @Post("order-lists")
  async createOrderList(@Body() dto: CreateOrderListDto, @Request() req?: any) {
    const workLocationId =
      dto.work_location_id ??
      req?.user?.work_location_id ??
      req?.user?.work_location_default_id;
    if (workLocationId == null) {
      throw new BadRequestException("work_location_id este obligatoriu");
    }
    return this.service.createOrderList({
      ...dto,
      work_location_id: workLocationId,
    });
  }

  @Patch("order-lists/:id")
  async updateOrderList(
    @Param("id") id: string,
    @Body() dto: UpdateOrderListDto,
  ) {
    return this.service.updateOrderList(Number(id), dto);
  }

  @Delete("order-lists/:id")
  async deleteOrderList(@Param("id") id: string) {
    await this.service.deleteOrderList(Number(id));
    return { success: true };
  }
}
