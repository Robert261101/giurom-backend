import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  Res,
  ParseIntPipe,
  UseGuards,
  Request,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { CreateSupplierWithDocumentsDto } from "./dto/create-supplier-with-documents.dto";
import { CreateSupplierProductDto } from "./dto/create-supplier-product.dto";
import { UpdateSupplierProductDto } from "./dto/update-supplier-product.dto";
import { CreateSupplierProductMeasurementVariantDto } from "./dto/create-supplier-product-measurement-variant.dto";
import { UpdateSupplierProductMeasurementVariantDto } from "./dto/update-supplier-product-measurement-variant.dto";
import {
  ApproveReceptionDto,
  RejectReceptionDto,
} from "./dto/approve-reception.dto";
import { CancelRemainingDto } from "./dto/cancel-remaining.dto";
import { CancelOrderItemsDto } from "./dto/cancel-order-items.dto";
import { CreateSupplierOrderAssignmentDto } from "./dto/create-supplier-order-assignment.dto";
import { CreateSupplierOrderDriverAssignmentDto } from "./dto/create-supplier-order-driver-assignment.dto";
import { UpdateOrderDeliveryDateDto } from "./dto/update-order-delivery-date.dto";
import { WarehouseReviewDto } from "./dto/warehouse-review.dto";
import { SendBackToMagazionerDto } from "./dto/send-back-to-magazioner.dto";
import { LinkMySupplierStaffDto } from "./dto/link-my-supplier-staff.dto";
import { Response } from "express";
import { Permissions, PermissionsAny } from "../permissions/permissions.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { CreateSupplierNomenclatorProductDto } from "./dto/create-supplier-nomenclator-product.dto";
import { buildSupplierProductUserContext } from "./supplier-product-access";
import { buildOrdersPaginatedResponse } from "./suppliers-pagination.util";

@ApiTags("suppliers")
@Controller("suppliers")
@UseGuards(PermissionsGuard)
export class SuppliersHttpController {
  private readonly logger = new Logger(SuppliersHttpController.name);

  constructor(private readonly service: SuppliersService) {}

  @Get()
  @Permissions("suppliers.read")
  async getSuppliers(
    @Query("page") _page?: string,
    @Query("limit") _limit?: string,
    @Query("search") _search?: string,
    @Query("is_active") _is_active?: string,
    @Query("location_id") location_id?: string,
    @Request() req?: any,
  ) {
    // location_id este OBLIGATORIU - din query sau din user context
    let locationId: number | undefined;
    const maybeLid = location_id ? parseInt(location_id, 10) : undefined;
    if (Number.isFinite(maybeLid as number) && (maybeLid as number) > 0) {
      locationId = maybeLid as number;
    } else {
      // Încearcă să obțină din user context
      const user = req?.user;
      locationId = user?.work_location_id || user?.work_location_default_id;
    }

    this.logger.log(`[SUPPLIERS HTTP] GET /suppliers called with query location_id=${location_id} resolved locationId=${locationId}`);
    this.logger.log(`[SUPPLIERS HTTP] Authorization header: ${req?.headers?.authorization ? 'PRESENT' : 'MISSING'}`);
    if (req?.headers?.authorization) {
      this.logger.log(`[SUPPLIERS HTTP] Authorization header value: Bearer ${req.headers.authorization.substring(0, 50)}...`);
      // Decode JWT to log permissions
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.decode(token);
        this.logger.log(`[SUPPLIERS HTTP] JWT decoded payload: ${JSON.stringify(decoded)}`);
        this.logger.log(`[SUPPLIERS HTTP] JWT permissions: ${JSON.stringify(decoded?.permissions || [])}`);
      } catch (error) {
        this.logger.error(`[SUPPLIERS HTTP] Failed to decode JWT: ${(error as any)?.message || error}`);
      }
    }
    this.logger.log(`[SUPPLIERS HTTP] User from JWT: ${JSON.stringify(req?.user ?? {})}`);
    this.logger.log(`[SUPPLIERS HTTP] Received headers: ${JSON.stringify(req?.headers ?? {})}`);

    // Dacă încă nu avem location_id, aruncă eroare
    if (!locationId) {
      this.logger.error('[SUPPLIERS HTTP] Missing location_id for GET /suppliers');
      throw new BadRequestException(
        "Parametrul location_id este obligatoriu pentru a obține furnizorii",
      );
    }

    try {
      const result = await this.service.findAll(locationId);
      this.logger.log(`[SUPPLIERS HTTP] GET /suppliers result count=${result?.length}`);
      return result;
    } catch (error) {
      this.logger.error('[SUPPLIERS HTTP] GET /suppliers failed', (error as any)?.message || error, (error as any)?.stack);
      throw error;
    }
  }

  @Get("for-orders")
  @Permissions("order.read")
  getSuppliersForOrders(@Query("location_id") location_id?: string) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.findForOrders(locationId);
  }

  @Get("my-supplier")
  @Permissions("order.read")
  @ApiOperation({
    summary:
      "Furnizor operațional al companiei tenant (owner_company_id = JWT company_id)",
  })
  @ApiResponse({ status: 200, description: "Furnizor găsit" })
  @ApiResponse({ status: 403, description: "Nu este cont furnizor sau lipsește company_id" })
  @ApiResponse({ status: 404, description: "Niciun furnizor asociat companiei" })
  getMySupplier(@Request() req?: { user?: { company_id?: number | null; company_type?: string | null } }) {
    const user = req?.user;
    return this.service.findMySupplierForFurnizorTenant(
      user?.company_id,
      user?.company_type,
    );
  }

  @Get("my-supplier/profile")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Profil complet furnizor operațional (produse, documente) pentru cont furnizor",
  })
  getMySupplierProfile(
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null } },
  ) {
    const user = req?.user;
    return this.service.findMySupplierProfileForFurnizorTenant(
      user?.company_id,
      user?.company_type,
    );
  }

  @Post("my-supplier/staff")
  @Permissions("suppliers.create")
  @ApiOperation({ summary: "Leagă un angajat (magazioner/șofer) la furnizorul operațional al contului logat" })
  @ApiResponse({ status: 201, description: "Legătură creată/actualizată" })
  @ApiResponse({ status: 403, description: "Nu este cont furnizor" })
  linkMySupplierStaff(
    @Body() dto: LinkMySupplierStaffDto,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null } },
  ) {
    const user = req?.user;
    return this.service.linkMySupplierStaff(
      user?.company_id,
      user?.company_type,
      dto.employee_id,
      dto.staff_type,
    );
  }

  @Get("my-supplier/stock")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Stoc depozit furnizor (nomenclator × stock-ms) pentru cont tenant furnizor",
  })
  getMySupplierStock(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("stock_filter") stockFilter?: string,
    @Query("sort_by") sortBy?: string,
    @Query("sort_direction") sortDirection?: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null } },
  ) {
    const user = req?.user;
    return this.service.getMySupplierStockForFurnizorTenant(
      user?.company_id,
      user?.company_type,
      page ? Number(page) : 1,
      limit ? Number(limit) : 9,
      {
        search,
        status,
        stock_filter: stockFilter,
        sort_by: sortBy,
        sort_direction: sortDirection,
      },
    );
  }

  @Get("my-supplier/nomenclator-products")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Nomenclator depozit furnizor (stock.products × stock.stock la locația depozit)",
  })
  getMySupplierNomenclatorProducts(
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null } },
  ) {
    const user = req?.user;
    return this.service.getMySupplierNomenclatorProducts(
      user?.company_id,
      user?.company_type,
    );
  }

  @Post("my-supplier/nomenclator-products")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Adaugă produs în nomenclatorul depozitului furnizorului (products + stock shell)",
  })
  createMySupplierNomenclatorProduct(
    @Body() dto: CreateSupplierNomenclatorProductDto,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    return this.service.createMySupplierNomenclatorProduct(
      dto,
      buildSupplierProductUserContext(req?.user),
    );
  }

  @Post("my-supplier/nomenclator-products/:productId/photo")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary: "Upload imagine pentru produs din nomenclatorul depozitului furnizorului",
  })
  uploadMySupplierNomenclatorProductPhoto(
    @Param("productId") productId: string,
    @Body() body: { fileName: string; content: string },
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    return this.service.updateMySupplierNomenclatorProductPhoto(
      Number(productId),
      body.fileName,
      body.content,
      buildSupplierProductUserContext(req?.user),
    );
  }

  @Post()
  @Permissions("suppliers.create")
  @ApiQuery({ name: "location_id", required: false, description: "Locația selectată în UI (colț dreapta sus)" })
  create(
    @Body() dto: CreateSupplierDto,
    @Request() req?: any,
    @Headers("x-work-location-id") xWorkLocationId?: string,
    @Query("location_id") location_id?: string,
  ) {
    const selectedId = parseSelectedWorkLocationId(xWorkLocationId ?? location_id);
    const user = req?.user;
    const location_id_resolved =
      selectedId ?? user?.work_location_id ?? user?.work_location_default_id;

    if (!location_id_resolved) {
      throw new BadRequestException(
        "Nu se poate crea un furnizor fără o locație asignată. Vă rugăm să selectați o locație.",
      );
    }

    return this.service.create(dto, location_id_resolved);
  }

  @Post("with-documents")
  @Permissions("suppliers.create")
  createWithDocs(@Body() dto: CreateSupplierWithDocumentsDto) {
    const location_id = (dto as any).location_id != null ? Number((dto as any).location_id) : undefined;
    return this.service.createWithDocuments(dto, location_id);
  }

  // === SUPPLIER LOCATIONS ENDPOINTS (trebuie să fie înainte de :id pentru a evita conflictele de rute) ===
  @Post(":supplierId/locations/:locationId")
  @Permissions("suppliers.create")
  @ApiOperation({ summary: "Atribuie un furnizor la o locație" })
  @ApiParam({ name: "supplierId", description: "ID-ul furnizorului" })
  @ApiParam({ name: "locationId", description: "ID-ul locației" })
  @ApiResponse({
    status: 201,
    description: "Furnizorul a fost atribuit cu succes la locație",
  })
  assignSupplierToLocation(
    @Param("supplierId") supplierId: string,
    @Param("locationId") locationId: string,
  ) {
    return this.service.assignSupplierToLocation(
      Number(supplierId),
      Number(locationId),
    );
  }

  @Get(":supplierId/locations")
  @Permissions("suppliers.read")
  @ApiOperation({ summary: "Listă locațiile unui furnizor" })
  @ApiParam({ name: "supplierId", description: "ID-ul furnizorului" })
  @ApiResponse({ status: 200, description: "Lista locațiilor furnizorului" })
  findSupplierLocations(@Param("supplierId") supplierId: string) {
    return this.service.findSupplierLocations(Number(supplierId));
  }

  @Get(":supplierId/stock-location")
  @PermissionsAny("suppliers.read", "order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Locația depozitului furnizorului (HQ/companie) — pentru filtrarea nomenclatorului la comandă",
  })
  getSupplierStockLocation(@Param("supplierId") supplierId: string) {
    return this.service.getSupplierStockLocationId(Number(supplierId));
  }

  @Get(":supplierId/products")
  @PermissionsAny("suppliers.read", "order.read", "suppliers.create")
  getProducts(
    @Param("supplierId") supplierId: string,
    @Query("include_inactive") includeInactive?: string,
    @Query("location_id") locationId?: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    const includeInactiveBool = includeInactive === undefined
      ? true
      : !["0", "false"].includes(includeInactive.toLowerCase());
    const parsedLocationId =
      locationId != null && Number.isFinite(Number(locationId)) && Number(locationId) > 0
        ? Number(locationId)
        : undefined;
    return this.service.getSupplierProducts(
      Number(supplierId),
      includeInactiveBool,
      buildSupplierProductUserContext(req?.user),
      parsedLocationId,
    );
  }

  @Get("locations/:locationId/suppliers")
  @Permissions("suppliers.read")
  @ApiOperation({ summary: "Listă furnizorii unei locații" })
  @ApiParam({ name: "locationId", description: "ID-ul locației" })
  @ApiResponse({ status: 200, description: "Lista furnizorilor locației" })
  findLocationSuppliers(@Param("locationId") locationId: string) {
    return this.service.findLocationSuppliers(Number(locationId));
  }

  @Delete(":supplierId/locations/:locationId")
  @Permissions("suppliers.delete")
  @ApiOperation({ summary: "Îndepărtează un furnizor dintr-o locație" })
  @ApiParam({ name: "supplierId", description: "ID-ul furnizorului" })
  @ApiParam({ name: "locationId", description: "ID-ul locației" })
  @ApiResponse({
    status: 200,
    description: "Furnizorul a fost îndepărtat cu succes din locație",
  })
  removeSupplierFromLocation(
    @Param("supplierId") supplierId: string,
    @Param("locationId") locationId: string,
  ) {
    return this.service.removeSupplierFromLocation(
      Number(supplierId),
      Number(locationId),
    );
  }

  @Get(":supplierId/drivers")
  @Permissions("order.read")
  getDrivers(@Param("supplierId") supplierId: string) {
    const id = Number(supplierId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException("Invalid supplier id");
    }
    return this.service.getSupplierDrivers(id);
  }

  @Get(":supplierId/warehouse")
  @Permissions("order.read")
  getWarehouseEmployees(@Param("supplierId") supplierId: string) {
    const id = Number(supplierId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException("Invalid supplier id");
    }
    return this.service.getSupplierWarehouseEmployees(id);
  }

  @Patch("order-items/:itemId/toggle-availability")
  @Permissions("order.read")
  @ApiOperation({ summary: "Toggle availability_status for a supplier order item" })
  toggleItemAvailability(@Param("itemId") itemId: string) {
    return this.service.toggleItemAvailability(Number(itemId));
  }

  @Get(":id")
  @Permissions("suppliers.read")
  findOne(
    @Param("id") id: string,
    @Query("location_id") location_id?: string,
    @Request() req?: any,
  ) {
    this.logger.log(`[DOCUMENTE] GET /suppliers/${id} ?location_id=${location_id}`);
    // Obține location_id din query sau din user context
    let locationId: number | undefined;
    const maybeLid = location_id ? parseInt(location_id, 10) : undefined;
    if (Number.isFinite(maybeLid as number) && (maybeLid as number) > 0) {
      locationId = maybeLid as number;
    } else {
      const user = req?.user;
      locationId = user?.work_location_id || user?.work_location_default_id;
    }
    // location_id opțional: dacă lipsește, returnăm furnizorul fără verificare locație (ex. pentru documente / sync)
    return this.service.findOne(Number(id), locationId);
  }

  @Patch(":id")
  @Permissions("suppliers.update")
  @ApiQuery({ name: "location_id", required: false })
  update(
    @Param("id") id: string,
    @Body() dto: any,
    @Headers("x-work-location-id") xWorkLocationId?: string,
    @Query("location_id") location_id?: string,
    @Request() req?: any,
  ) {
    const fromHeaderOrQuery = parseSelectedWorkLocationId(xWorkLocationId ?? location_id);
    const selectedWorkLocationId = fromHeaderOrQuery ?? req?.user?.work_location_id ?? req?.user?.work_location_default_id;
    return this.service.update(Number(id), dto, selectedWorkLocationId);
  }

  @Delete(":id")
  @Permissions("suppliers.delete")
  @ApiQuery({ name: "location_id", required: false })
  remove(
    @Param("id") id: string,
    @Headers("x-work-location-id") xWorkLocationId?: string,
    @Query("location_id") location_id?: string,
    @Request() req?: any,
  ) {
    const fromHeaderOrQuery = parseSelectedWorkLocationId(xWorkLocationId ?? location_id);
    const selectedWorkLocationId = fromHeaderOrQuery ?? req?.user?.work_location_id ?? req?.user?.work_location_default_id;
    return this.service.remove(Number(id), selectedWorkLocationId);
  }

  // Measurement Variants (products/:productId must stay before generic :supplierId routes if added)
  @Post("products")
  @Permissions("suppliers.create")
  addProduct(
    @Body() dto: CreateSupplierProductDto,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    return this.service.addProduct(dto, buildSupplierProductUserContext(req?.user));
  }

  @Patch("products/:productId")
  @Permissions("suppliers.update")
  updateProduct(
    @Param("productId") productId: string,
    @Body() dto: UpdateSupplierProductDto,
    @Query("supplier_id") supplierIdRaw?: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    const supplierId = supplierIdRaw ? parseInt(supplierIdRaw, 10) : undefined;
    if (!supplierId || !Number.isFinite(supplierId) || supplierId <= 0) {
      throw new BadRequestException("Parametrul supplier_id este obligatoriu și trebuie să fie un număr valid");
    }
    return this.service.updateSupplierProduct(
      Number(productId),
      supplierId,
      dto,
      buildSupplierProductUserContext(req?.user),
    );
  }

  @Delete("products/:productId")
  @Permissions("suppliers.delete")
  removeProduct(
    @Param("productId") productId: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    return this.service.removeSupplierProduct(
      Number(productId),
      buildSupplierProductUserContext(req?.user),
    );
  }

  // Measurement Variants
  @Get("products/:productId/variants")
  @PermissionsAny("suppliers.read", "order.read", "suppliers.create")
  @ApiOperation({ summary: "List measurement variants for a supplier product" })
  getVariants(
    @Param("productId") productId: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    return this.service.getVariants(
      Number(productId),
      buildSupplierProductUserContext(req?.user),
    );
  }

  @Post("products/:productId/variants")
  @Permissions("suppliers.create")
  @ApiOperation({ summary: "Create a measurement variant for a supplier product" })
  createVariant(
    @Param("productId") productId: string,
    @Body() dto: CreateSupplierProductMeasurementVariantDto,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    const variantDto = { ...dto, supplier_product_id: Number(productId) };
    return this.service.createVariant(variantDto, buildSupplierProductUserContext(req?.user));
  }

  @Patch("variants/:variantId")
  @Permissions("suppliers.update")
  @ApiOperation({ summary: "Update a measurement variant" })
  updateVariant(
    @Param("variantId") variantId: string,
    @Body() dto: UpdateSupplierProductMeasurementVariantDto,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    return this.service.updateVariant(
      Number(variantId),
      dto,
      buildSupplierProductUserContext(req?.user),
    );
  }

  @Delete("variants/:variantId")
  @Permissions("suppliers.delete")
  @ApiOperation({ summary: "Delete a measurement variant" })
  deleteVariant(
    @Param("variantId") variantId: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    return this.service.deleteVariant(
      Number(variantId),
      buildSupplierProductUserContext(req?.user),
    );
  }

  // Orders
  @Get(":supplierId/orders")
  @Permissions("order.read")
  getOrders(
    @Param("supplierId") supplierId: string,
    @Query("location_id") location_id?: string,
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.getSupplierOrders(Number(supplierId), locationId);
  }

  /**
   * Batch: toate comenzile pentru mai mulți furnizori, cu filtre opționale de perioadă și locație.
   * Ex: GET /suppliers/orders/batch?supplier_ids=1,2,3&date_from=2025-01-01&date_to=2025-01-31&location_id=10
   */
  @Get("orders/batch")
  @Permissions("order.read")
  getOrdersBatch(
    @Query("supplier_ids") supplierIdsRaw: string,
    @Query("date_from") dateFrom?: string,
    @Query("date_to") dateTo?: string,
    @Query("location_id") location_id?: string,
  ) {
    if (!supplierIdsRaw) {
      return [];
    }

    const supplierIds = supplierIdsRaw
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => Number.isFinite(id));

    if (supplierIds.length === 0) {
      return [];
    }

    const locationId = location_id ? parseInt(location_id, 10) : undefined;

    return this.service.getSupplierOrdersBatch(supplierIds, {
      dateFrom,
      dateTo,
      locationId,
    });
  }

  /**
   * Batch paginat — dashboard furnizor (implicit limit 15, max 15).
   * GET /suppliers/orders/batch/paginated?supplier_ids=1&page=1&limit=15
   */
  @Get("orders/batch/paginated")
  @Permissions("order.read")
  @ApiOperation({ summary: "Listează comenzi furnizor cu paginare (dashboard tenant)" })
  getOrdersBatchPaginated(
    @Query("supplier_ids") supplierIdsRaw: string,
    @Query("date_from") dateFrom?: string,
    @Query("date_to") dateTo?: string,
    @Query("location_id") location_id?: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
  ) {
    if (!supplierIdsRaw) {
      return { data: [], pagination: { page: 1, limit: 15, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false } };
    }
    const supplierIds = supplierIdsRaw
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => Number.isFinite(id));
    if (supplierIds.length === 0) {
      return { data: [], pagination: { page: 1, limit: 15, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false } };
    }
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.getSupplierOrdersBatchPaginated(
      supplierIds,
      { dateFrom, dateTo, locationId },
      pageRaw,
      limitRaw,
    );
  }

  /**
   * Comenzi anulate – paginate (10 per pagină).
   * GET /suppliers/orders/cancelled/paginated?supplier_ids=1,2&location_id=1&page=1&limit=10
   */
  @Get("orders/cancelled/paginated")
  @Permissions("order.read")
  @ApiOperation({ summary: "Listează comenzi anulate cu paginare" })
  @ApiQuery({ name: "supplier_ids", required: true, description: "ID-uri furnizori separate prin virgulă" })
  @ApiQuery({ name: "location_id", required: true, description: "ID locație" })
  @ApiQuery({ name: "page", required: false, description: "Pagina (implicit 1)" })
  @ApiQuery({ name: "limit", required: false, description: "Elemente per pagină (implicit 10)" })
  getCancelledOrdersPaginated(
    @Query("supplier_ids") supplierIdsRaw: string,
    @Query("location_id") locationIdRaw: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
  ) {
    if (!supplierIdsRaw || !locationIdRaw) {
      return buildOrdersPaginatedResponse([], 1, 10, 0);
    }
    const supplierIds = supplierIdsRaw
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => Number.isFinite(id));
    const locationId = parseInt(locationIdRaw, 10);
    const page = Math.max(1, parseInt(pageRaw || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw || "10", 10) || 10));
    return this.service.getCancelledOrdersPaginated(supplierIds, locationId, page, limit);
  }

  /**
   * Comenzi active – paginate (10 per pagină).
   * GET /suppliers/orders/active/paginated?supplier_ids=1,2&location_id=1&page=1&limit=10
   */
  @Get("orders/active/paginated")
  @Permissions("order.read")
  @ApiOperation({ summary: "Listează comenzi active cu paginare" })
  @ApiQuery({ name: "supplier_ids", required: true, description: "ID-uri furnizori separate prin virgulă" })
  @ApiQuery({ name: "location_id", required: true, description: "ID locație" })
  @ApiQuery({ name: "page", required: false, description: "Pagina (implicit 1)" })
  @ApiQuery({ name: "limit", required: false, description: "Elemente per pagină (implicit 10)" })
  getActiveOrdersPaginated(
    @Query("supplier_ids") supplierIdsRaw: string,
    @Query("location_id") locationIdRaw: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
  ) {
    if (!supplierIdsRaw || !locationIdRaw) {
      return buildOrdersPaginatedResponse([], 1, 10, 0);
    }
    const supplierIds = supplierIdsRaw
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => Number.isFinite(id));
    const locationId = parseInt(locationIdRaw, 10);
    const page = Math.max(1, parseInt(pageRaw || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw || "10", 10) || 10));
    return this.service.getActiveOrdersPaginated(supplierIds, locationId, page, limit);
  }

  /**
   * Comenzi receptionate – paginate (10 per pagină).
   * GET /suppliers/orders/received/paginated?supplier_ids=1,2&location_id=1&page=1&limit=10
   */
  @Get("orders/received/paginated")
  @Permissions("order.read")
  @ApiOperation({ summary: "Listează comenzi receptionate cu paginare" })
  @ApiQuery({ name: "supplier_ids", required: true, description: "ID-uri furnizori separate prin virgulă" })
  @ApiQuery({ name: "location_id", required: true, description: "ID locație" })
  @ApiQuery({ name: "page", required: false, description: "Pagina (implicit 1)" })
  @ApiQuery({ name: "limit", required: false, description: "Elemente per pagină (implicit 10)" })
  getReceivedOrdersPaginated(
    @Query("supplier_ids") supplierIdsRaw: string,
    @Query("location_id") locationIdRaw: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
  ) {
    if (!supplierIdsRaw || !locationIdRaw) {
      return buildOrdersPaginatedResponse([], 1, 10, 0);
    }
    const supplierIds = supplierIdsRaw
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => Number.isFinite(id));
    const locationId = parseInt(locationIdRaw, 10);
    const page = Math.max(1, parseInt(pageRaw || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw || "10", 10) || 10));
    return this.service.getReceivedOrdersPaginated(supplierIds, locationId, page, limit);
  }

  @Post("orders")
  @Permissions("order.create")
  createOrder(@Body() dto: any) {
    return this.service.createOrder(dto);
  }

  @Patch("orders/:orderId/deliver")
  @Permissions("order.update")
  deliver(@Param("orderId") orderId: string) {
    return this.service.markOrderAsDelivered(Number(orderId));
  }

  @Patch("orders/:orderId/return-to-supplier")
  @Permissions("order.update")
  returnToSupplier(@Param("orderId") orderId: string) {
    return this.service.returnOrderToSupplier(Number(orderId));
  }

  @Patch("orders/:orderId/send-back-to-magazioner")
  /** Conturile furnizor (tenant) au `suppliers.create`, nu `order.update`. */
  @PermissionsAny("order.update", "suppliers.create")
  sendBackToMagazioner(
    @Param("orderId") orderId: string,
    @Body() dto: SendBackToMagazionerDto,
  ) {
    return this.service.sendOrderBackToMagazioner(Number(orderId), dto);
  }

  @Patch("orders/:orderId/warehouse-review")
  /** Magazionerii au `order.read` în rol; acțiunea face parte din fluxul lor. */
  @Permissions("order.read")
  warehouseReviewOrder(
    @Param("orderId") orderId: string,
    @Body() dto: WarehouseReviewDto,
  ) {
    return this.service.warehouseReview(Number(orderId), dto);
  }

  @Post("orders/partial-reception")
  @Permissions("order.reception")
  partialReception(@Body() dto: any) {
    return this.service.markOrderAsPartiallyReceived(dto);
  }

  @Post("orders/receptions/approve")
  @Permissions("order.approve")
  @ApiOperation({ summary: "Aprobă recepțiile și creează stock items" })
  approveReceptions(@Body() dto: ApproveReceptionDto) {
    return this.service.approveReceptions(dto.orderId, dto.receptionIds);
  }

  @Post("orders/receptions/reject")
  @Permissions("order.approve")
  @ApiOperation({ summary: "Respinge recepțiile" })
  rejectReceptions(@Body() dto: RejectReceptionDto) {
    return this.service.rejectReceptions(
      dto.orderId,
      dto.receptionIds,
      dto.reason,
    );
  }

  @Post("orders/:orderId/assignments")
  @Permissions("order.read")
  @ApiOperation({ summary: "Atribuie o comandă furnizor unui magazioner" })
  createAssignment(
    @Param("orderId") orderId: string,
    @Body() dto: CreateSupplierOrderAssignmentDto,
    @Headers("x-user-id") userId?: string,
  ) {
    const createdBy = userId ? Number(userId) : undefined;
    return this.service.createOrderAssignment(Number(orderId), dto, createdBy);
  }

  @Patch("order-assignments/:assignmentId/approve")
  @Permissions("order.read")
  @ApiOperation({ summary: "Marchează o atribuire magazioner ca finalizată" })
  approveAssignment(
    @Param("assignmentId") assignmentId: string,
    @Headers("x-user-id") userId?: string,
  ) {
    const approver = userId ? Number(userId) : undefined;
    return this.service.approveOrderAssignment(Number(assignmentId), approver);
  }

  @Post("orders/:orderId/driver-assignments")
  /** Conturile furnizor (tenant) au `suppliers.create`, nu `order.update`. */
  @PermissionsAny("order.update", "suppliers.create")
  @ApiOperation({ summary: "Atribuie o comandă unui șofer" })
  createDriverAssignment(
    @Param("orderId") orderId: string,
    @Body() dto: CreateSupplierOrderDriverAssignmentDto,
    @Headers("x-user-id") userId?: string,
  ) {
    const assignedBy = userId ? Number(userId) : undefined;
    return this.service.createDriverAssignment(Number(orderId), dto, assignedBy);
  }

  @Get("drivers/:driverId/delivery-priorities")
  @Permissions("order.read")
  @ApiOperation({ summary: "Priorități de livrare deja folosite de șofer într-o zi" })
  getDriverUsedPriorities(
    @Param("driverId") driverId: string,
    @Query("delivery_date") delivery_date: string,
  ) {
    return this.service.getDriverUsedPriorities(Number(driverId), delivery_date);
  }

  @Get("drivers/:driverId/orders/paginated")
  @Permissions("order.read")
  @ApiOperation({ summary: "Comenzi șofer paginate (dashboard șofer)" })
  getDriverAssignmentsPaginated(
    @Param("driverId") driverId: string,
    @Query("location_id") location_id?: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.getDriverAssignmentsPaginated(
      Number(driverId),
      locationId,
      pageRaw,
      limitRaw,
    );
  }

  @Get("drivers/:driverId/orders")
  @Permissions("order.read")
  @ApiOperation({ summary: "Obține comenzile atribuite unui șofer" })
  getDriverAssignments(
    @Param("driverId") driverId: string,
    @Query("location_id") location_id?: string,
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.getDriverAssignments(Number(driverId), locationId);
  }

  @Patch("driver-assignments/:assignmentId/complete")
  /** Șoferii și conturile furnizor au `order.read`, nu `order.approve`. */
  @PermissionsAny("order.approve", "order.read")
  @ApiOperation({ summary: "Marchează o atribuire șofer ca finalizată" })
  completeDriverAssignment(@Param("assignmentId") assignmentId: string) {
    return this.service.completeDriverAssignment(Number(assignmentId));
  }

  @Get("storekeepers/:employeeId/orders/paginated")
  @Permissions("order.read")
  @ApiOperation({ summary: "Comenzi magazioner paginate (dashboard magazioner)" })
  getStorekeeperOrdersPaginated(
    @Param("employeeId") employeeId: string,
    @Query("location_id") location_id?: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.getStorekeeperAssignmentsPaginated(
      Number(employeeId),
      locationId,
      pageRaw,
      limitRaw,
    );
  }

  @Get("storekeepers/:employeeId/orders")
  @Permissions("order.read")
  @ApiOperation({ summary: "Obține comenzile atribuite unui magazioner" })
  getStorekeeperOrders(
    @Param("employeeId") employeeId: string,
    @Query("location_id") location_id?: string,
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.getStorekeeperAssignments(Number(employeeId), locationId);
  }

  @Patch("orders/:orderId/status")
  /** Conturile furnizor (tenant) au `suppliers.create`, nu `order.update`. */
  @PermissionsAny("order.update", "suppliers.create")
  @ApiOperation({ summary: "Actualizează statusul unei comenzi" })
  updateOrderStatus(
    @Param("orderId") orderId: string,
    @Body("status") status: string,
  ) {
    return this.service.updateOrderStatus(Number(orderId), status);
  }

  @Patch("orders/:orderId/delivery-date")
  /** Conturile furnizor (tenant) au `suppliers.create`, nu `order.update`. */
  @PermissionsAny("order.update", "suppliers.create")
  @ApiOperation({ summary: "Actualizează data de livrare a comenzii" })
  updateOrderDeliveryDate(
    @Param("orderId") orderId: string,
    @Body() dto: UpdateOrderDeliveryDateDto,
  ) {
    return this.service.updateOrderDeliveryDate(Number(orderId), dto);
  }

  @Get("orders/reception-report")
  @Permissions("order.read")
  @ApiOperation({ summary: "Raport recepții și returnări pe perioadă" })
  getReceptionReport(
    @Query("start_date") startDate: string,
    @Query("end_date") endDate: string,
    @Query("location_id") locationId?: string,
  ) {
    if (!startDate || !endDate) {
      throw new Error("start_date și end_date sunt obligatorii");
    }
    const locId = locationId ? parseInt(locationId, 10) : undefined;
    return this.service.getReceptionReport(startDate, endDate, locId);
  }

  @Get("orders/reception-report/events")
  @Permissions("order.read")
  @ApiOperation({
    summary:
      "Evenimente individuale de recepție/returnare pe perioadă (cronologic)",
  })
  getReceptionEvents(
    @Query("start_date") startDate: string,
    @Query("end_date") endDate: string,
    @Query("order_id") orderId?: string,
    @Query("order_item_id") orderItemId?: string,
    @Query("product_id") productId?: string,
    @Query("user_id") userId?: string,
  ) {
    if (!startDate || !endDate) {
      throw new Error("start_date și end_date sunt obligatorii");
    }
    return this.service.getReceptionEvents(
      startDate,
      endDate,
      orderId ? Number(orderId) : undefined,
      orderItemId ? Number(orderItemId) : undefined,
      productId ? Number(productId) : undefined,
      userId ? Number(userId) : undefined,
    );
  }

  @Get("orders/receptions/batch")
  @Permissions("order.read")
  @ApiOperation({
    summary: "Obține recepțiile pentru mai multe comenzi (batch)",
  })
  @ApiQuery({
    name: "order_ids",
    required: true,
    description:
      "Lista de ID-uri de comenzi, separate prin virgulă (ex: 1,2,3)",
  })
  getOrderReceptionsBatch(@Query("order_ids") orderIdsRaw: string) {
    if (!orderIdsRaw) {
      return [];
    }

    const orderIds = orderIdsRaw
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => Number.isFinite(id));

    if (orderIds.length === 0) {
      return [];
    }

    return this.service.getOrderReceptionsBatch(orderIds);
  }

  @Get("orders/:orderId/receptions")
  @Permissions("order.read")
  @ApiOperation({ summary: "Obține recepțiile pentru o comandă" })
  getOrderReceptions(@Param("orderId") orderId: string) {
    return this.service.getOrderReceptions(Number(orderId));
  }

  @Get("orders/:orderId/cancelled-items")
  @Permissions("order.read")
  @ApiOperation({ summary: "Obține item-urile anulate pentru o comandă" })
  getOrderCancelledItems(@Param("orderId") orderId: string) {
    return this.service.getOrderCancelledItems(Number(orderId));
  }

  /**
   * Batch: item-uri anulate pentru mai multe comenzi.
   * Ex: GET /suppliers/orders/cancelled-items/batch?order_ids=1,2,3
   */
  @Get("orders/cancelled-items/batch")
  @Permissions("order.read")
  @ApiOperation({
    summary: "Obține item-urile anulate pentru mai multe comenzi (batch)",
  })
  getOrderCancelledItemsBatch(@Query("order_ids") orderIdsRaw: string) {
    if (!orderIdsRaw) {
      return [];
    }

    const orderIds = orderIdsRaw
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => Number.isFinite(id));

    if (orderIds.length === 0) {
      return [];
    }

    return this.service.getOrderCancelledItemsBatch(orderIds);
  }

  @Post("orders/:orderId/cancel-remaining")
  @Permissions("order.cancel")
  @ApiOperation({
    summary:
      "[DEPRECATED] Anulează partea rămasă de recepționat pentru o comandă",
  })
  cancelRemaining(
    @Param("orderId") orderId: string,
    @Body() dto: CancelRemainingDto,
  ) {
    return this.service.cancelRemainingQuantity(Number(orderId), dto.reason);
  }

  @Post("orders/cancel-items")
  @Permissions("order.cancel")
  @ApiOperation({
    summary: "Anulează item-uri dintr-o comandă (nouă abordare)",
  })
  cancelOrderItems(@Body() dto: CancelOrderItemsDto) {
    return this.service.cancelOrderItems(dto);
  }
  @Get(":supplierId/orders/:orderId/email-link")
  @Permissions("order.read")
  emailLink(
    @Param("supplierId") supplierId: string,
    @Param("orderId") orderId: string,
  ) {
    return {
      emailLink: this.service.generateEmailLink(
        Number(supplierId),
        Number(orderId),
      ),
    };
  }

  @Get(":supplierId/orders/:orderId/whatsapp-link")
  @Permissions("order.read")
  whatsappLink(
    @Param("supplierId") supplierId: string,
    @Param("orderId") orderId: string,
  ) {
    return {
      whatsappLink: this.service.generateWhatsAppLink(
        Number(supplierId),
        Number(orderId),
      ),
    };
  }

  // Documents – upload: fie suppliers.create fie suppliers.update (cine poate edita furnizorul poate adăuga documente)
  @Post(":supplierId/documents")
  @PermissionsAny("suppliers.create", "suppliers.update")
  addDocument(@Param("supplierId") supplierId: string, @Body() body: any) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Body invalid sau lipsă (verifică că request-ul este JSON cu Content-Type: application/json).');
    }
    return this.service.addDocument(Number(supplierId), body);
  }

  /** Creează un folder nou pentru furnizor (în DB și pe disk). Body: { description, parent_id? }. */
  @Post(":supplierId/folders")
  @PermissionsAny("suppliers.create", "suppliers.update")
  createFolder(
    @Param("supplierId") supplierId: string,
    @Body() body: { description: string; parent_id?: number },
    @Query("location_id") location_id?: string,
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    if (!body || !body.description) {
      throw new BadRequestException('description is required');
    }
    return this.service.createFolder(Number(supplierId), body, locationId);
  }

  /** Actualizează numele unui folder (nu permite duplicate). */
  @Patch(":supplierId/folders/:folderId")
  @Permissions("suppliers.update")
  updateFolder(
    @Param("supplierId") supplierId: string,
    @Param("folderId") folderId: string,
    @Body() body: { description: string },
  ) {
    if (!body || !body.description) {
      throw new BadRequestException('description is required');
    }
    return this.service.updateFolder(Number(supplierId), Number(folderId), body);
  }

  /** Șterge un folder al furnizorului (și documentele asociate). */
  @Delete(":supplierId/folders/:folderId")
  @Permissions("suppliers.delete")
  removeFolder(
    @Param("supplierId") supplierId: string,
    @Param("folderId") folderId: string,
  ) {
    return this.service.removeFolder(Number(supplierId), Number(folderId));
  }

  /** Sincronizează documentele unui folder din disk în DB (creează înregistrări pentru fișiere existente pe disk). */
  @Post(":supplierId/folders/:folderId/sync-from-disk")
  @Permissions("suppliers.read")
  syncFolderFromDisk(
    @Param("supplierId") supplierId: string,
    @Param("folderId") folderId: string,
  ) {
    this.logger.log(`[DOCUMENTE] POST /suppliers/${supplierId}/folders/${folderId}/sync-from-disk`);
    return this.service.syncFolderFromDisk(Number(supplierId), Number(folderId));
  }

  @Delete("documents/:documentId")
  @Permissions("suppliers.delete")
  removeDocument(@Param("documentId") documentId: string) {
    return this.service.removeDocument(Number(documentId));
  }

  // Serve supplier document (download or inline)
  @Get("file/:fileId")
  @Permissions("suppliers.read")
  async getSupplierFile(
    @Param("fileId", ParseIntPipe) fileId: number,
    @Query("download") download: string,
    @Res() res: Response,
  ) {
    const forceDownload = download === "true";
    const served = await this.service.serveDocument(fileId, forceDownload);
    const buffer = Buffer.from(served.data, "base64");
    res.setHeader(
      "Content-Type",
      served.mimeType || "application/octet-stream",
    );
    res.setHeader(
      "Content-Disposition",
      `${forceDownload || served.disposition === "attachment" ? "attachment" : "inline"}; filename="${served.fileName}"`,
    );
    res.setHeader("Content-Length", buffer.length.toString());
    return res.send(buffer);
  }

  @Get("file/:fileId/view")
  @Permissions("suppliers.read")
  async viewSupplierFile(
    @Param("fileId", ParseIntPipe) fileId: number,
    @Res() res: Response,
  ) {
    const served = await this.service.serveDocument(fileId, false);
    const buffer = Buffer.from(served.data, "base64");
    res.setHeader(
      "Content-Type",
      served.mimeType || "application/octet-stream",
    );
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${served.fileName}"`,
    );
    res.setHeader("Content-Length", buffer.length.toString());
    return res.send(buffer);
  }

  // Get documents expiring on a specific date
  @Get("documents/expiring/:targetDate")
  @Permissions("suppliers.read")
  getExpiringDocuments(@Param("targetDate") targetDate: string) {
    return this.service.findExpiringDocuments(targetDate);
  }

  // Get documents that have already expired
  @Get("documents/expired")
  @Permissions("suppliers.read")
  getExpiredDocuments() {
    return this.service.findExpiredDocuments();
  }
}

function parseSelectedWorkLocationId(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}
