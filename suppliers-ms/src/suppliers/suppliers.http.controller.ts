import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
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
  ForbiddenException,
  Logger,
  UsePipes,
  ValidationPipe,
  HttpCode,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { SuppliersService } from "./suppliers.service";
import { SuppliersExportService } from "./suppliers-export.service";
import { EntryDocumentsExportService } from "./entry-documents-export.service";
import { Giurom2ZonesService } from "./giurom2-zones.service";
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
import { UpdateSupplierNomenclatorProductDto } from "./dto/update-supplier-nomenclator-product.dto";
import { SupplierIncrementStockDto } from "./dto/supplier-increment-stock.dto";
import { UpsertSupplierProductClientConfigDto } from "./dto/upsert-supplier-product-client-config.dto";
import { UpsertSupplierProductClientPriceDto } from "./dto/upsert-supplier-product-client-price.dto";
import { SetClientProductVisibilityDto } from "./dto/set-client-product-visibility.dto";
import { SetSupplierProductClientActivationDto } from "./dto/set-supplier-product-client-activation.dto";
import { ConnectSupplierDto } from "./dto/connect-supplier.dto";
import {
  buildSupplierProductUserContext,
  buildSupplierAccessRequester,
  isTenantScopedSupplierRequester,
} from "./supplier-product-access";
import { resolveOrderActorUserId } from "./order-access";
import { buildOrdersPaginatedResponse } from "./suppliers-pagination.util";

@ApiTags("suppliers")
@Controller("suppliers")
@UseGuards(PermissionsGuard)
export class SuppliersHttpController {
  private readonly logger = new Logger(SuppliersHttpController.name);

  constructor(
    private readonly service: SuppliersService,
    private readonly suppliersExportService: SuppliersExportService,
    private readonly entryDocumentsExportService: EntryDocumentsExportService,
    private readonly giurom2ZonesService: Giurom2ZonesService,
  ) {}

  /**
   * Gestiunile din giurom 2.0 pe care le poate alimenta locația dată.
   *
   * Listă goală = locația nu e legată (sau canalul de comenzi e oprit): frontend-ul ascunde
   * selectorul, iar comanda merge exact ca înainte. Permisiunea e cea de comandă, nu una nouă
   * — cine poate deschide formularul de comandă poate vedea lista.
   */
  @Get("giurom2/zones")
  @PermissionsAny("order.read", "suppliers.create")
  async listGiurom2Zones(
    @Query("company_id") companyId?: string,
    @Query("location_id") locationId?: string,
  ) {
    const zones = await this.giurom2ZonesService.listForLocation(
      Number(companyId),
      Number(locationId),
    );
    return {
      zones: zones.map((zone) => ({
        id: zone.external_zone_id,
        name: zone.name,
        code: zone.code ?? null,
        is_default: Number(zone.is_default) === 1,
      })),
    };
  }

  /**
   * Reîncarcă forțat catalogul de gestiuni al unei locații, ocolind TTL-ul cache-ului.
   * Necesar imediat după ce în giurom 2.0 se schimbă setul de gestiuni al legăturii.
   */
  @Post("giurom2/zones/refresh")
  @PermissionsAny("order.read", "suppliers.create")
  async refreshGiurom2Zones(
    @Query("company_id") companyId?: string,
    @Query("location_id") locationId?: string,
  ) {
    await this.giurom2ZonesService.refresh(Number(companyId), Number(locationId));
    return this.listGiurom2Zones(companyId, locationId);
  }

  /**
   * Ultimele gestiuni alese pe produsele locației — pentru precompletarea selectorului
   * la următoarea comandă. Listă goală dacă nu s-a comandat încă nimic pe locația legată.
   */
  @Get("giurom2/last-zones")
  @PermissionsAny("order.read", "suppliers.create")
  async listLastGiurom2Zones(
    @Query("company_id") companyId?: string,
    @Query("location_id") locationId?: string,
  ) {
    const last_zones = await this.service.listLastGiurom2Zones(
      Number(companyId),
      Number(locationId),
    );
    return { last_zones };
  }

  /**
   * Export manual, one-shot, al comenzilor recente/active către giurom 2.0.
   * Nu rulează automat pe cron.
   */
  @Post("export/run-manual")
  @Permissions("suppliers.create")
  async runManualExport() {
    return this.suppliersExportService.runManualExport();
  }

  /**
   * Retrimite manual documentele de intrare (recepții aprobate) către giurom 2.0.
   * În mod normal pleacă singure la aprobarea recepției; asta e pentru recuperare.
   */
  @Post("export/entry-documents/run-manual")
  @Permissions("suppliers.create")
  async runManualEntryDocumentsExport() {
    return this.entryDocumentsExportService.runManualExport();
  }

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

    // Dacă încă nu avem location_id, aruncă eroare
    if (!locationId) {
      this.logger.error('[SUPPLIERS HTTP] Missing location_id for GET /suppliers');
      throw new BadRequestException(
        "Parametrul location_id este obligatoriu pentru a obține furnizorii",
      );
    }

    try {
      const result = await this.service.findAll(
        locationId,
        buildSupplierAccessRequester(req?.user),
      );
      this.logger.log(`[SUPPLIERS HTTP] GET /suppliers result count=${result?.length}`);
      return result;
    } catch (error) {
      this.logger.error('[SUPPLIERS HTTP] GET /suppliers failed', (error as any)?.message || error, (error as any)?.stack);
      throw error;
    }
  }

  @Get("for-orders")
  @Permissions("order.read")
  @ApiOperation({
    summary:
      "Furnizori activi pentru dropdown comenzi (tenant-scoped ca /catalog)",
    description:
      "Platform-wide: toți activi. Client: Manual pe locațiile companiei + Cont via client_supplier_links. Excluie inactivii și quota_status blocked/removed.",
  })
  getSuppliersForOrders(
    @Query("location_id") location_id?: string,
    @Request() req?: any,
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.findForOrders(
      locationId,
      buildSupplierAccessRequester(req?.user),
    );
  }

  @Get("catalog")
  @PermissionsAny("suppliers.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Catalog furnizori pentru pagina /furnizori (fără duplicate pe supplier_locations)",
    description:
      "Platform-wide: toți furnizorii. Client: Manual pe locațiile companiei; Cont doar via client_supplier_links. Furnizor tenant: propriul supplier (owner_company_id).",
  })
  @ApiQuery({ name: "search", required: false, description: "Căutare după nume sau CUI" })
  @ApiQuery({
    name: "is_active",
    required: false,
    description: "Filtru activ/inactiv (omit = toți)",
  })
  getSuppliersCatalog(
    @Query("search") search?: string,
    @Query("is_active") is_active?: string,
    @Request() req?: any,
  ) {
    let isActive: boolean | undefined;
    if (is_active === "true" || is_active === "1") {
      isActive = true;
    } else if (is_active === "false" || is_active === "0") {
      isActive = false;
    }
    return this.service.findCatalog(
      {
        search: search?.trim() || undefined,
        is_active: isActive,
      },
      buildSupplierAccessRequester(req?.user),
    );
  }

  @Get("internal/employees/:employeeId/supplier-ids")
  @ApiOperation({
    summary:
      'Listează supplier_id-urile din employees_suppliers (apel intern între microservicii)',
  })
  async getEmployeeSupplierIdsInternal(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Request() req?: { bypassAuth?: boolean },
  ) {
    if (req?.bypassAuth !== true) {
      throw new ForbiddenException('Endpoint intern — necesită x-service-secret');
    }
    const supplier_ids = await this.service.getEmployeeSupplierIds(employeeId);
    return { employee_id: employeeId, supplier_ids };
  }

  @Post("internal/companies/:companyId/locations/:locationId/attach-suppliers")
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Internal: după create location — atașează toți supplierii company-wide (Manual + Cont linked) la locația nouă',
  })
  async attachCompanySuppliersToLocationInternal(
    @Param("companyId", ParseIntPipe) companyId: number,
    @Param("locationId", ParseIntPipe) locationId: number,
    @Request() req?: { bypassAuth?: boolean },
  ) {
    if (req?.bypassAuth !== true) {
      throw new ForbiddenException('Endpoint intern — necesită x-service-secret');
    }
    return this.service.attachCompanySuppliersToLocation(companyId, locationId);
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
  getMySupplier(@Request() req?: {
    user?: {
      userId?: number | null;
      company_id?: number | null;
      company_type?: string | null;
      roles?: string[];
      work_location_id?: number | null;
    };
  }) {
    const user = req?.user;
    return this.service.findMySupplierForFurnizorTenant(
      user?.company_id,
      user?.company_type,
      user?.roles,
      {
        workLocationId: user?.work_location_id,
        employeeId: user?.userId,
      },
    );
  }

  @Get("my-supplier/profile")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Profil complet furnizor operațional (produse, documente) pentru cont furnizor",
  })
  getMySupplierProfile(
    @Request() req?: {
      user?: {
        userId?: number | null;
        company_id?: number | null;
        company_type?: string | null;
        roles?: string[];
        work_location_id?: number | null;
      };
    },
  ) {
    const user = req?.user;
    return this.service.findMySupplierProfileForFurnizorTenant(
      user?.company_id,
      user?.company_type,
      user?.roles,
      {
        workLocationId: user?.work_location_id,
        employeeId: user?.userId,
      },
    );
  }

  @Get("my-supplier/clients")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Firme-client asociate furnizorului autentificat (supplier_locations)",
  })
  getMySupplierClients(
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null } },
  ) {
    const user = req?.user;
    return this.service.findMySupplierClientsForFurnizorTenant(
      user?.company_id,
      user?.company_type,
      { search, status },
    );
  }

  @Get("my-supplier/connection-code")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Codul unic de asociere al furnizorului operațional (owner_company_id = JWT company)",
  })
  @ApiResponse({ status: 200, description: "Cod returnat" })
  @ApiResponse({ status: 403, description: "Nu este cont furnizor" })
  getMySupplierConnectionCode(
    @Request() req?: {
      user?: {
        userId?: number | null;
        company_id?: number | null;
        company_type?: string | null;
        roles?: string[];
        work_location_id?: number | null;
      };
    },
  ) {
    const user = req?.user;
    return this.service.getMySupplierConnectionCode(
      user?.company_id,
      user?.company_type,
      user?.roles,
      {
        workLocationId: user?.work_location_id,
        employeeId: user?.userId,
      },
    );
  }

  @Post("my-supplier/connection-code/regenerate")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Regenerează codul de asociere (codul vechi devine invalid; link-urile existente rămân)",
  })
  regenerateMySupplierConnectionCode(
    @Request() req?: {
      user?: {
        userId?: number | null;
        company_id?: number | null;
        company_type?: string | null;
        roles?: string[];
        work_location_id?: number | null;
      };
    },
  ) {
    const user = req?.user;
    return this.service.regenerateMySupplierConnectionCode(
      user?.company_id,
      user?.company_type,
      user?.roles,
      {
        workLocationId: user?.work_location_id,
        employeeId: user?.userId,
      },
    );
  }

  @Get("me/subscription-usage")
  @PermissionsAny("suppliers.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Plan + usage furnizori (Cont / Manual) pentru tenant-ul client din JWT",
  })
  getMySubscriptionUsage(@Request() req?: any) {
    return this.service.getMySupplierSubscriptionUsage(
      buildSupplierAccessRequester(req?.user),
    );
  }

  @Get("me/subscription/downgrade-preview")
  @PermissionsAny("companies.read_own", "companies.read", "suppliers.read")
  @ApiOperation({
    summary:
      "Previzualizare downgrade: surplus și furnizori eligibili pentru blocare",
  })
  getDowngradePreview(
    @Query("plan_code") planCode: string,
    @Query("account_limit") accountLimit: string,
    @Query("manual_limit") manualLimit: string,
    @Request() req?: any,
  ) {
    return this.service.getDowngradePreviewForPlan(
      String(planCode || "").toLowerCase().trim(),
      Number(accountLimit),
      Number(manualLimit),
      buildSupplierAccessRequester(req?.user),
    );
  }

  @Post(":id/quota/unblock")
  @PermissionsAny("suppliers.update", "suppliers.create")
  @HttpCode(200)
  @ApiOperation({
    summary: "Deblochează un furnizor blocat de abonament (dacă există slot)",
  })
  unblockSupplierQuota(@Param("id") id: string, @Request() req?: any) {
    return this.service.unblockSupplierQuota(
      Number(id),
      buildSupplierAccessRequester(req?.user),
    );
  }

  @Post(":id/remove-from-account")
  @Permissions("suppliers.delete")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Elimină furnizorul din contul clientului fără hard-delete (păstrează istoricul)",
  })
  removeFromAccount(@Param("id") id: string, @Request() req?: any) {
    return this.service.removeFromAccount(
      Number(id),
      buildSupplierAccessRequester(req?.user),
    );
  }

  @Get("internal/companies/:companyId/subscription/downgrade-preview")
  @ApiOperation({ summary: "Internal: downgrade preview for company-ms" })
  getDowngradePreviewInternal(
    @Param("companyId", ParseIntPipe) companyId: number,
    @Query("plan_code") planCode: string,
    @Query("account_limit") accountLimit: string,
    @Query("manual_limit") manualLimit: string,
    @Request() req?: { bypassAuth?: boolean },
  ) {
    if (req?.bypassAuth !== true) {
      throw new ForbiddenException("Endpoint intern — necesită x-service-secret");
    }
    return this.service.getDowngradePreviewForPlan(
      String(planCode || "").toLowerCase().trim(),
      Number(accountLimit),
      Number(manualLimit),
      { company_id: companyId, company_type: "client" },
    );
  }

  @Post("internal/companies/:companyId/subscription/apply-downgrade-blocks")
  @HttpCode(200)
  @ApiOperation({ summary: "Internal: apply downgrade blocks before plan change" })
  async applyDowngradeBlocksInternal(
    @Param("companyId", ParseIntPipe) companyId: number,
    @Body()
    body: {
      account_limit?: number;
      manual_limit?: number;
      block_account_supplier_ids?: number[];
      block_manual_supplier_ids?: number[];
    },
    @Request() req?: { bypassAuth?: boolean },
  ) {
    if (req?.bypassAuth !== true) {
      throw new ForbiddenException("Endpoint intern — necesită x-service-secret");
    }
    const locationIds = await this.service.fetchCompanyLocationIdsForInternal(
      companyId,
    );
    const rollbackItems = await this.service.applyDowngradeBlocksInternal(
      companyId,
      locationIds,
      Number(body?.account_limit),
      Number(body?.manual_limit),
      body?.block_account_supplier_ids || [],
      body?.block_manual_supplier_ids || [],
    );
    return { rollback_items: rollbackItems };
  }

  @Post("internal/companies/:companyId/subscription/rollback-downgrade-blocks")
  @HttpCode(200)
  @ApiOperation({ summary: "Internal: rollback downgrade blocks on plan activation failure" })
  rollbackDowngradeBlocksInternal(
    @Param("companyId", ParseIntPipe) companyId: number,
    @Body() body: { rollback_items?: unknown[] },
    @Request() req?: { bypassAuth?: boolean },
  ) {
    if (req?.bypassAuth !== true) {
      throw new ForbiddenException("Endpoint intern — necesită x-service-secret");
    }
    return this.service.rollbackDowngradeBlocksInternal(
      companyId,
      (body?.rollback_items || []) as any,
    );
  }

  @Post("connect")
  @PermissionsAny("suppliers.read", "suppliers.create")
  @HttpCode(201)
  @ApiOperation({
    summary:
      "Asociază un furnizor cu cont la firma client folosind codul unic (company_id doar din JWT)",
  })
  @ApiResponse({ status: 201, description: "Asociere creată" })
  @ApiResponse({ status: 404, description: "Cod invalid" })
  @ApiResponse({ status: 409, description: "Deja asociat" })
  connectSupplier(
    @Body() dto: ConnectSupplierDto,
    @Request() req?: any,
  ) {
    return this.service.connectSupplierByCode(
      dto?.code,
      buildSupplierAccessRequester(req?.user),
    );
  }

  @Patch(":id/client-association")
  @Permissions("suppliers.update")
  @ApiOperation({
    summary:
      "Client: Activează/dezactivează asocierea Cont (client_supplier_links.is_active). Nu modifică suppliers.is_active.",
  })
  updateClientAssociation(
    @Param("id") id: string,
    @Body() body: { is_active?: boolean },
    @Request() req?: any,
  ) {
    if (typeof body?.is_active !== "boolean") {
      throw new BadRequestException("is_active (boolean) este obligatoriu");
    }
    return this.service.updateMyClientSupplierAssociation(
      Number(id),
      body.is_active,
      buildSupplierAccessRequester(req?.user),
    );
  }

  @Get("my-supplier/clients/:companyId")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary: "Detalii firmă-client asociată furnizorului autentificat",
  })
  getMySupplierClientById(
    @Param("companyId") companyId: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null } },
  ) {
    const user = req?.user;
    return this.service.findMySupplierClientByIdForFurnizorTenant(
      user?.company_id,
      user?.company_type,
      Number(companyId),
    );
  }

  @Get("my-supplier/clients/:companyId/product-prices")
  @Permissions("suppliers.create")
  @ApiOperation({
    summary: "Prețurile preferențiale curente pentru un client al furnizorului",
  })
  getMySupplierClientProductPrices(
    @Param("companyId") companyId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null } },
  ) {
    const user = req?.user;
    return this.service.getMySupplierClientProductPrices(
      user?.company_id,
      user?.company_type,
      Number(companyId),
      page,
      limit,
    );
  }

  @Put("my-supplier/clients/:companyId/products/:supplierProductId/preferred-price")
  @Permissions("suppliers.create")
  @ApiOperation({
    summary: "Setează sau actualizează prețul preferențial pentru un client și produs",
  })
  setMySupplierClientProductPrice(
    @Param("companyId") companyId: string,
    @Param("supplierProductId") supplierProductId: string,
    @Body() dto: UpsertSupplierProductClientPriceDto,
    @Request() req?: {
      user?: {
        company_id?: number | null;
        company_type?: string | null;
        sub?: number;
        userId?: number;
        first_name?: string;
        last_name?: string;
        full_name?: string;
      };
    },
  ) {
    const user = req?.user;
    const jwtName =
      String(user?.full_name ?? "").trim() ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
      null;
    return this.service.upsertMySupplierClientProductPrice(
      user?.company_id,
      user?.company_type,
      Number(companyId),
      Number(supplierProductId),
      dto,
      resolveOrderActorUserId(user),
      jwtName,
    );
  }

  @Put("my-supplier/clients/:companyId/products/:supplierProductId/activation")
  @Permissions("suppliers.create")
  @ApiOperation({
    summary: "Activează sau dezactivează un produs furnizor pentru un client",
  })
  setMySupplierClientProductActivation(
    @Param("companyId") companyId: string,
    @Param("supplierProductId") supplierProductId: string,
    @Body() dto: SetSupplierProductClientActivationDto,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null } },
  ) {
    const user = req?.user;
    return this.service.setMySupplierClientProductActivation(
      user?.company_id,
      user?.company_type,
      Number(companyId),
      Number(supplierProductId),
      dto,
    );
  }

  @Delete("my-supplier/clients/:companyId/products/:supplierProductId/preferred-price")
  @Permissions("suppliers.create")
  @ApiOperation({
    summary: "Elimină prețul preferențial și revine la prețul standard",
  })
  resetMySupplierClientProductPrice(
    @Param("companyId") companyId: string,
    @Param("supplierProductId") supplierProductId: string,
    @Request() req?: {
      user?: {
        company_id?: number | null;
        company_type?: string | null;
        sub?: number;
        userId?: number;
        first_name?: string;
        last_name?: string;
        full_name?: string;
      };
    },
  ) {
    const user = req?.user;
    const jwtName =
      String(user?.full_name ?? "").trim() ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
      null;
    return this.service.removeMySupplierClientProductPrice(
      user?.company_id,
      user?.company_type,
      Number(companyId),
      Number(supplierProductId),
      resolveOrderActorUserId(user),
      jwtName,
    );
  }

  @Get("my-supplier/clients/:companyId/product-price-history")
  @Permissions("suppliers.create")
  @ApiOperation({
    summary: "Istoric prețuri preferențiale pentru un client al furnizorului",
  })
  getMySupplierClientProductPriceHistory(
    @Param("companyId") companyId: string,
    @Query("supplier_product_id") supplierProductId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null } },
  ) {
    const user = req?.user;
    return this.service.getMySupplierClientProductPriceHistory(
      user?.company_id,
      user?.company_type,
      Number(companyId),
      supplierProductId != null ? Number(supplierProductId) : undefined,
      page,
      limit,
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

  @Post("my-supplier/stock/increment")
  @PermissionsAny("order.read", "suppliers.create")
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({
    summary:
      "Incrementare manuală cantități în stocul depozitului furnizorului (batch atomic)",
  })
  incrementMySupplierStock(
    @Body() dto: SupplierIncrementStockDto,
    @Request()
    req?: {
      user?: {
        company_id?: number | null;
        company_type?: string | null;
        permissions?: string[];
      };
    },
  ) {
    return this.service.incrementMySupplierStock(
      dto.items,
      buildSupplierProductUserContext(req?.user),
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

  @Patch("my-supplier/nomenclator-products/:productId")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Actualizează produs din nomenclatorul depozitului furnizorului (apel intern stock-ms)",
  })
  updateMySupplierNomenclatorProduct(
    @Param("productId") productId: string,
    @Body() dto: UpdateSupplierNomenclatorProductDto,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    return this.service.updateMySupplierNomenclatorProduct(
      Number(productId),
      dto,
      buildSupplierProductUserContext(req?.user),
    );
  }

  @Delete("my-supplier/nomenclator-products/:productId")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Șterge produs din nomenclatorul depozitului furnizorului (cleanup intern stock-ms)",
  })
  deleteMySupplierNomenclatorProduct(
    @Param("productId") productId: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[] } },
  ) {
    return this.service.deleteMySupplierNomenclatorProduct(
      Number(productId),
      buildSupplierProductUserContext(req?.user),
    );
  }

  @Post()
  @Permissions("suppliers.create")
  @ApiQuery({
    name: "location_id",
    required: false,
    description:
      "Locație UI opțională (context ops/foldere). Ownership Manual = toate locațiile companiei din JWT.",
  })
  create(
    @Body() dto: CreateSupplierDto,
    @Request() req?: any,
    @Headers("x-work-location-id") xWorkLocationId?: string,
    @Query("location_id") location_id?: string,
  ) {
    const selectedId = parseSelectedWorkLocationId(xWorkLocationId ?? location_id);
    const user = req?.user;
    const requester = buildSupplierAccessRequester(user);
    const location_id_resolved =
      selectedId ?? user?.work_location_id ?? user?.work_location_default_id;

    // Tenant client: company-wide seed — location optional (UI only).
    // Platform/internal: keep requiring a location for legacy assign.
    if (
      !isTenantScopedSupplierRequester(requester) &&
      !location_id_resolved
    ) {
      throw new BadRequestException(
        "Nu se poate crea un furnizor fără o locație asignată. Vă rugăm să selectați o locație.",
      );
    }

    return this.service.create(
      dto,
      location_id_resolved != null ? Number(location_id_resolved) : undefined,
      requester,
    );
  }

  @Post("with-documents")
  @Permissions("suppliers.create")
  createWithDocs(
    @Body() dto: CreateSupplierWithDocumentsDto,
    @Request() req?: any,
  ) {
    const location_id = (dto as any).location_id != null ? Number((dto as any).location_id) : undefined;
    return this.service.createWithDocuments(
      dto,
      location_id,
      buildSupplierAccessRequester(req?.user),
    );
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
    @Request() req?: {
      user?: {
        company_id?: number | null;
        company_type?: string | null;
        isAdmin?: boolean;
        isSuperAdmin?: boolean;
        permissions?: string[];
        roles?: string[];
      };
    },
  ) {
    return this.service.assignSupplierToLocationForRequester(
      Number(supplierId),
      Number(locationId),
      {
        company_id: req?.user?.company_id,
        company_type: req?.user?.company_type,
        isAdmin: req?.user?.isAdmin,
        isSuperAdmin: req?.user?.isSuperAdmin,
        permissions: req?.user?.permissions,
        roles: req?.user?.roles,
      },
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

  @Get(":supplierId/stock-availability")
  @PermissionsAny("suppliers.read", "order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Stoc disponibil la depozitul furnizorului (aceeași locație ca la confirmare / GIU-08). Nu modifică stocul.",
  })
  @ApiQuery({
    name: "supplier_product_ids",
    required: false,
    description: "IDs supplier_products separate prin virgulă",
  })
  getSupplierStockAvailability(
    @Param("supplierId") supplierId: string,
    @Query("supplier_product_ids") supplierProductIdsRaw?: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[]; isAdmin?: boolean; isSuperAdmin?: boolean } },
  ) {
    const ids =
      supplierProductIdsRaw != null && String(supplierProductIdsRaw).trim() !== ""
        ? String(supplierProductIdsRaw)
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0)
        : undefined;
    return this.service.getSupplierStockAvailabilityForOrdering(
      Number(supplierId),
      ids,
      buildSupplierProductUserContext(req?.user),
    );
  }

  @Get(":supplierId/products")
  @PermissionsAny("suppliers.read", "order.read", "suppliers.create")
  getProducts(
    @Param("supplierId") supplierId: string,
    @Query("include_inactive") includeInactive?: string,
    @Query("location_id") locationId?: string,
    @Query("apply_client_visibility") applyClientVisibility?: string,
    @Request() req?: { user?: { company_id?: number | null; company_type?: string | null; permissions?: string[]; roles?: string[]; isAdmin?: boolean; isSuperAdmin?: boolean } },
  ) {
    const includeInactiveBool = includeInactive === undefined
      ? true
      : !["0", "false"].includes(includeInactive.toLowerCase());
    const parsedLocationId =
      locationId != null && Number.isFinite(Number(locationId)) && Number(locationId) > 0
        ? Number(locationId)
        : undefined;
    const applyClientVisibilityBool =
      applyClientVisibility != null &&
      ["1", "true", "yes"].includes(String(applyClientVisibility).toLowerCase());
    return this.service.getSupplierProducts(
      Number(supplierId),
      includeInactiveBool,
      buildSupplierProductUserContext(req?.user),
      parsedLocationId,
      req?.user?.roles,
      applyClientVisibilityBool,
    );
  }

  @Get(":supplierId/client-product-mappings")
  @PermissionsAny("suppliers.read", "suppliers.create", "order.read")
  @ApiOperation({
    summary:
      "Asocieri produs furnizor → nomenclator client per locație (compania autentificată)",
  })
  getClientProductMappings(
    @Param("supplierId") supplierId: string,
    @Query("location_id") locationIdQuery?: string,
    @Headers("x-work-location-id") xWorkLocationId?: string,
    @Request() req?: {
      user?: {
        company_id?: number | null;
        company_type?: string | null;
        permissions?: string[];
        work_location_id?: number;
        work_location_default_id?: number;
      };
    },
  ) {
    const selectedWorkLocationId =
      parseSelectedWorkLocationId(locationIdQuery) ??
      parseSelectedWorkLocationId(xWorkLocationId) ??
      req?.user?.work_location_id ??
      req?.user?.work_location_default_id;
    return this.service.getClientProductMappingsForSupplier(
      Number(supplierId),
      buildSupplierProductUserContext(req?.user),
      selectedWorkLocationId,
    );
  }

  @Put(":supplierId/products/:supplierProductId/client-config")
  @PermissionsAny("assignment.read_all", "assignment.read_company")
  @ApiOperation({
    summary:
      "Salvează asocierea nomenclator client + cantități brut/net pentru produs furnizor",
  })
  upsertSupplierProductClientConfig(
    @Param("supplierId") supplierId: string,
    @Param("supplierProductId") supplierProductId: string,
    @Body() dto: UpsertSupplierProductClientConfigDto,
    @Headers("x-work-location-id") xWorkLocationId?: string,
    @Request() req?: {
      user?: {
        company_id?: number | null;
        company_type?: string | null;
        permissions?: string[];
        work_location_id?: number;
        work_location_default_id?: number;
        isAdmin?: boolean;
        isSuperAdmin?: boolean;
      };
    },
  ) {
    const selectedWorkLocationId =
      parseSelectedWorkLocationId(xWorkLocationId) ??
      req?.user?.work_location_id ??
      req?.user?.work_location_default_id;
    return this.service.upsertSupplierProductClientConfig(
      Number(supplierId),
      Number(supplierProductId),
      dto,
      buildSupplierProductUserContext(req?.user),
      selectedWorkLocationId,
    );
  }

  @Get(":supplierId/client-product-visibility")
  @PermissionsAny("assignment.read_all", "assignment.read_company", "suppliers.create")
  @ApiOperation({
    summary:
      "Produse ascunse de client pentru un furnizor (GIU-12). Lipsă configurare = toate vizibile.",
  })
  getClientProductVisibility(
    @Param("supplierId") supplierId: string,
    @Request() req?: {
      user?: {
        company_id?: number | null;
        company_type?: string | null;
        permissions?: string[];
        isAdmin?: boolean;
        isSuperAdmin?: boolean;
      };
    },
  ) {
    return this.service.getClientProductVisibilityForSupplier(
      Number(supplierId),
      buildSupplierProductUserContext(req?.user),
    );
  }

  @Put(":supplierId/client-product-visibility")
  @PermissionsAny("assignment.read_all", "assignment.read_company", "suppliers.create")
  @ApiOperation({
    summary:
      "Salvează produsele ascunse de client pentru un furnizor (GIU-12). Doar admin companie client.",
  })
  setClientProductVisibility(
    @Param("supplierId") supplierId: string,
    @Body() dto: SetClientProductVisibilityDto,
    @Request() req?: {
      user?: {
        company_id?: number | null;
        company_type?: string | null;
        permissions?: string[];
        isAdmin?: boolean;
        isSuperAdmin?: boolean;
      };
    },
  ) {
    return this.service.setClientProductVisibilityForSupplier(
      Number(supplierId),
      dto,
      buildSupplierProductUserContext(req?.user),
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
  getDrivers(@Param("supplierId") supplierId: string, @Request() req?: any) {
    const id = Number(supplierId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException("Invalid supplier id");
    }
    return this.service.getSupplierDrivers(id, req?.user);
  }

  @Get(":supplierId/warehouse")
  @Permissions("order.read")
  getWarehouseEmployees(@Param("supplierId") supplierId: string, @Request() req?: any) {
    const id = Number(supplierId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException("Invalid supplier id");
    }
    return this.service.getSupplierWarehouseEmployees(id, req?.user);
  }

  @Patch("order-items/:itemId/toggle-availability")
  @Permissions("order.read")
  @ApiOperation({ summary: "Toggle availability_status for a supplier order item" })
  async toggleItemAvailability(@Param("itemId") itemId: string, @Request() req: any) {
    await this.service.assertActiveShiftForOperationalUser(req?.user, req?.headers?.authorization);
    return this.service.toggleItemAvailability(Number(itemId), req?.user);
  }

  @Get(":id")
  @Permissions("suppliers.read")
  findOne(
    @Param("id") id: string,
    @Query("location_id") location_id?: string,
    @Request() req?: any,
  ) {
    this.logger.log(
      `[DOCUMENTE] GET /suppliers/${id} ?location_id=${location_id}`,
    );

    // Verificarea pe supplier_locations se aplică doar dacă
    // location_id este trimis explicit.
    const maybeLid = location_id
      ? parseInt(location_id, 10)
      : undefined;

    const locationId =
      Number.isFinite(maybeLid as number) &&
      (maybeLid as number) > 0
        ? (maybeLid as number)
        : undefined;

    return this.service.findOne(
      Number(id),
      locationId,
      buildSupplierAccessRequester(req?.user),
    );
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
    return this.service.update(
      Number(id),
      dto,
      selectedWorkLocationId,
      buildSupplierAccessRequester(req?.user),
    );
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
    return this.service.remove(
      Number(id),
      selectedWorkLocationId,
      buildSupplierAccessRequester(req?.user),
    );
  }

  // Measurement Variants (products/:productId must stay before generic :supplierId routes if added)
  @Post("products")
  @Permissions("suppliers.create")
  addProduct(
    @Body() dto: CreateSupplierProductDto,
    @Request() req?: {
      user?: {
        company_id?: number | null;
        company_type?: string | null;
        permissions?: string[];
        roles?: string[];
        isAdmin?: boolean;
        isSuperAdmin?: boolean;
      };
    },
  ) {
    return this.service.addProduct(dto, buildSupplierProductUserContext(req?.user));
  }

  @Patch("products/:productId")
  @PermissionsAny("suppliers.update", "suppliers.create")
  updateProduct(
    @Param("productId") productId: string,
    @Body() dto: UpdateSupplierProductDto,
    @Query("supplier_id") supplierIdRaw?: string,
    @Request() req?: {
      user?: {
        company_id?: number | null;
        company_type?: string | null;
        permissions?: string[];
        roles?: string[];
        isAdmin?: boolean;
        isSuperAdmin?: boolean;
      };
    },
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
  @PermissionsAny("suppliers.delete", "suppliers.create")
  removeProduct(
    @Param("productId") productId: string,
    @Query("supplier_id") supplierIdRaw?: string,
    @Request() req?: {
      user?: {
        company_id?: number | null;
        company_type?: string | null;
        permissions?: string[];
        isAdmin?: boolean;
        isSuperAdmin?: boolean;
      };
    },
  ) {
    const supplierId = supplierIdRaw ? parseInt(supplierIdRaw, 10) : undefined;
    return this.service.removeSupplierProduct(
      Number(productId),
      buildSupplierProductUserContext(req?.user),
      supplierId != null && Number.isFinite(supplierId) && supplierId > 0
        ? supplierId
        : undefined,
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
  @PermissionsAny("suppliers.update", "suppliers.create")
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
  @PermissionsAny("suppliers.delete", "suppliers.create")
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
    @Query("company_id") company_id?: string,
    @Request() req?: { user?: Record<string, unknown> },
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    const requestedCompanyId = company_id ? parseInt(company_id, 10) : undefined;
    const requester = buildSupplierAccessRequester(req?.user);
    return this.service.getSupplierOrders(
      Number(supplierId),
      locationId,
      requester,
      requestedCompanyId,
    );
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
    @Query("company_id") company_id?: string,
    @Request() req?: { user?: Record<string, unknown> },
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
    const requestedCompanyId = company_id ? parseInt(company_id, 10) : undefined;
    const requester = buildSupplierAccessRequester(req?.user);

    return this.service.getSupplierOrdersBatch(supplierIds, {
      dateFrom,
      dateTo,
      locationId,
      requester,
      requestedCompanyId,
    });
  }

  /**
   * Batch paginat — dashboard furnizor / detaliu furnizor (implicit limit 15, max 20).
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
    @Query("company_id") company_id?: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
    @Request() req?: { user?: Record<string, unknown> },
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
    const requestedCompanyId = company_id ? parseInt(company_id, 10) : undefined;
    const requester = buildSupplierAccessRequester(req?.user);
    return this.service.getSupplierOrdersBatchPaginated(
      supplierIds,
      { dateFrom, dateTo, locationId, requester, requestedCompanyId },
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
    @Query("company_id") company_id?: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
    @Request() req?: { user?: Record<string, unknown> },
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
    const requestedCompanyId = company_id ? parseInt(company_id, 10) : undefined;
    const requester = buildSupplierAccessRequester(req?.user);
    return this.service.getCancelledOrdersPaginated(
      supplierIds,
      locationId,
      page,
      limit,
      requester,
      requestedCompanyId,
    );
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
    @Query("company_id") company_id?: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
    @Request() req?: { user?: Record<string, unknown> },
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
    const requestedCompanyId = company_id ? parseInt(company_id, 10) : undefined;
    const requester = buildSupplierAccessRequester(req?.user);
    return this.service.getActiveOrdersPaginated(
      supplierIds,
      locationId,
      page,
      limit,
      requester,
      requestedCompanyId,
    );
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
    @Query("company_id") company_id?: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
    @Request() req?: { user?: Record<string, unknown> },
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
    const requestedCompanyId = company_id ? parseInt(company_id, 10) : undefined;
    const requester = buildSupplierAccessRequester(req?.user);
    return this.service.getReceivedOrdersPaginated(
      supplierIds,
      locationId,
      page,
      limit,
      requester,
      requestedCompanyId,
    );
  }

  @Post("orders")
  @Permissions("order.create")
  createOrder(@Body() dto: any, @Request() req: any) {
    return this.service.createOrder(dto, req?.user);
  }

  @Patch("orders/:orderId/deliver")
  @Permissions("order.update")
  deliver(@Param("orderId") orderId: string, @Request() req: any) {
    return this.service.markOrderAsDelivered(Number(orderId), req?.user);
  }

  @Patch("orders/:orderId/return-to-supplier")
  @Permissions("order.update")
  returnToSupplier(@Param("orderId") orderId: string, @Request() req: any) {
    return this.service.returnOrderToSupplier(Number(orderId));
  }

  @Patch("orders/:orderId/send-back-to-magazioner")
  /** Conturile furnizor (tenant) au `suppliers.create`, nu `order.update`. */
  @PermissionsAny("order.update", "suppliers.create")
  sendBackToMagazioner(
    @Param("orderId") orderId: string,
    @Body() dto: SendBackToMagazionerDto,
    @Request() req: any,
  ) {
    return this.service.sendOrderBackToMagazioner(Number(orderId), dto, req?.user);
  }

  @Patch("orders/:orderId/warehouse-review")
  /** Magazionerii au `order.read` în rol; acțiunea face parte din fluxul lor. */
  @Permissions("order.read")
  async warehouseReviewOrder(
    @Param("orderId") orderId: string,
    @Body() dto: WarehouseReviewDto,
    @Request() req: any,
  ) {
    await this.service.assertActiveShiftForOperationalUser(req?.user, req?.headers?.authorization);
    return this.service.warehouseReview(Number(orderId), dto, req?.user);
  }

  @Post("orders/partial-reception")
  @Permissions("order.reception")
  partialReception(@Body() dto: any, @Request() req: any) {
    return this.service.markOrderAsPartiallyReceived(dto, req?.user);
  }

  @Post("orders/receptions/approve")
  @Permissions("order.approve")
  @ApiOperation({ summary: "Aprobă recepțiile și creează stock items" })
  approveReceptions(@Body() dto: ApproveReceptionDto, @Request() req: any) {
    return this.service.approveReceptions(dto.orderId, dto.receptionIds, req?.user);
  }

  @Post("orders/receptions/reject")
  @Permissions("order.approve")
  @ApiOperation({ summary: "Respinge recepțiile" })
  rejectReceptions(@Body() dto: RejectReceptionDto, @Request() req: any) {
    return this.service.rejectReceptions(
      dto.orderId,
      dto.receptionIds,
      dto.reason,
      req?.user,
    );
  }

  @Post("orders/:orderId/assignments")
  @Permissions("order.read")
  @ApiOperation({ summary: "Atribuie o comandă furnizor unui magazioner" })
  createAssignment(
    @Param("orderId") orderId: string,
    @Body() dto: CreateSupplierOrderAssignmentDto,
    @Request() req: any,
  ) {
    const createdBy = req?.user?.sub ?? req?.user?.userId;
    const actorId = createdBy != null ? Number(createdBy) : undefined;
    return this.service.createOrderAssignment(
      Number(orderId),
      dto,
      Number.isFinite(actorId) && actorId! > 0 ? actorId : undefined,
      req?.user,
    );
  }

  @Patch("order-assignments/:assignmentId/approve")
  @Permissions("order.read")
  @ApiOperation({ summary: "Marchează o atribuire magazioner ca finalizată" })
  approveAssignment(
    @Param("assignmentId") assignmentId: string,
    @Request() req: any,
  ) {
    const approver = req?.user?.sub ?? req?.user?.userId;
    const actorId = approver != null ? Number(approver) : undefined;
    return this.service.approveOrderAssignment(
      Number(assignmentId),
      Number.isFinite(actorId) && actorId! > 0 ? actorId : undefined,
    );
  }

  @Post("orders/:orderId/driver-assignments")
  /** Conturile furnizor (tenant) au `suppliers.create`, nu `order.update`. */
  @PermissionsAny("order.update", "suppliers.create")
  @ApiOperation({ summary: "Atribuie o comandă unui șofer" })
  createDriverAssignment(
    @Param("orderId") orderId: string,
    @Body() dto: CreateSupplierOrderDriverAssignmentDto,
    @Request() req: any,
  ) {
    const assignedBy = req?.user?.sub ?? req?.user?.userId;
    const actorId = assignedBy != null ? Number(assignedBy) : undefined;
    return this.service.createDriverAssignment(
      Number(orderId),
      dto,
      Number.isFinite(actorId) && actorId! > 0 ? actorId : undefined,
      req?.user,
    );
  }

  @Get("drivers/:driverId/delivery-priorities")
  @Permissions("order.read")
  @ApiOperation({ summary: "Priorități de livrare deja folosite de șofer într-o zi" })
  getDriverUsedPriorities(
    @Param("driverId") driverId: string,
    @Query("delivery_date") delivery_date: string,
    @Request() req: any,
  ) {
    return this.service.getDriverUsedPriorities(
      Number(driverId),
      delivery_date,
      req?.user,
    );
  }

  @Get("drivers/:driverId/orders/paginated")
  @Permissions("order.read")
  @ApiOperation({ summary: "Comenzi șofer paginate (dashboard șofer)" })
  getDriverAssignmentsPaginated(
    @Param("driverId") driverId: string,
    @Query("location_id") location_id?: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
    @Request() req?: any,
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.getDriverAssignmentsPaginated(
      Number(driverId),
      locationId,
      pageRaw,
      limitRaw,
      req?.user,
    );
  }

  @Get("drivers/:driverId/orders")
  @Permissions("order.read")
  @ApiOperation({ summary: "Obține comenzile atribuite unui șofer" })
  getDriverAssignments(
    @Param("driverId") driverId: string,
    @Query("location_id") location_id?: string,
    @Request() req?: any,
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.getDriverAssignments(
      Number(driverId),
      locationId,
      req?.user,
    );
  }

  @Patch("driver-assignments/:assignmentId/complete")
  /** Șoferii și conturile furnizor au `order.read`, nu `order.approve`. */
  @PermissionsAny("order.approve", "order.read")
  @ApiOperation({ summary: "Marchează o atribuire șofer ca finalizată" })
  async completeDriverAssignment(@Param("assignmentId") assignmentId: string, @Request() req: any) {
    await this.service.assertActiveShiftForOperationalUser(req?.user, req?.headers?.authorization);
    return this.service.completeDriverAssignment(Number(assignmentId), req?.user);
  }

  @Patch("driver-assignments/:assignmentId/arrived")
  /** Doar șoferul atribuit (verificat în service) confirmă sosirea la client. */
  @PermissionsAny("order.approve", "order.read")
  @ApiOperation({
    summary: "GIU-10: șoferul confirmă „Ajuns în locație” (deblochează recepție/anulare client)",
  })
  async markDriverAssignmentArrived(
    @Param("assignmentId") assignmentId: string,
    @Request() req: any,
  ) {
    await this.service.assertActiveShiftForOperationalUser(req?.user, req?.headers?.authorization);
    return this.service.markDriverAssignmentArrived(Number(assignmentId), req?.user);
  }

  @Get("storekeepers/:employeeId/orders/paginated")
  @Permissions("order.read")
  @ApiOperation({ summary: "Comenzi magazioner paginate (dashboard magazioner)" })
  getStorekeeperOrdersPaginated(
    @Param("employeeId") employeeId: string,
    @Query("location_id") location_id?: string,
    @Query("page") pageRaw?: string,
    @Query("limit") limitRaw?: string,
    @Request() req?: any,
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.getStorekeeperAssignmentsPaginated(
      Number(employeeId),
      locationId,
      pageRaw,
      limitRaw,
      req?.user,
    );
  }

  @Get("storekeepers/:employeeId/orders")
  @Permissions("order.read")
  @ApiOperation({ summary: "Obține comenzile atribuite unui magazioner" })
  getStorekeeperOrders(
    @Param("employeeId") employeeId: string,
    @Query("location_id") location_id?: string,
    @Request() req?: any,
  ) {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    return this.service.getStorekeeperAssignments(
      Number(employeeId),
      locationId,
      req?.user,
    );
  }

  @Patch("orders/:orderId/status")
  /** Conturile furnizor (tenant) au `suppliers.create`, nu `order.update`. */
  @PermissionsAny("order.update", "suppliers.create")
  @ApiOperation({ summary: "Actualizează statusul unei comenzi" })
  updateOrderStatus(
    @Param("orderId") orderId: string,
    @Body("status") status: string,
    @Request() req: any,
  ) {
    return this.service.updateOrderStatus(Number(orderId), status, req?.user);
  }

  @Patch("orders/:orderId/delivery-date")
  /** Conturile furnizor (tenant) au `suppliers.create`, nu `order.update`. */
  @PermissionsAny("order.update", "suppliers.create")
  @ApiOperation({ summary: "Actualizează data de livrare a comenzii" })
  updateOrderDeliveryDate(
    @Param("orderId") orderId: string,
    @Body() dto: UpdateOrderDeliveryDateDto,
    @Request() req: any,
  ) {
    return this.service.updateOrderDeliveryDate(Number(orderId), dto, req?.user);
  }

  /**
   * Rezolvă un interval de date implicit (ultimele 365 de zile → azi) când nu sunt
   * furnizate explicit, dar există alt filtru (location_id, order_id etc.) care
   * restrânge suficient rezultatul. Fără dates ȘI fără alt filtru → BadRequestException.
   */
  private resolveReceptionDateRange(
    startDate?: string,
    endDate?: string,
    hasOtherFilter?: boolean,
  ): { startDate: string; endDate: string } {
    if (startDate && endDate) {
      return { startDate, endDate };
    }
    if (!hasOtherFilter) {
      throw new BadRequestException(
        "start_date și end_date sunt obligatorii (sau furnizați location_id / alt filtru)",
      );
    }
    const today = new Date();
    const past = new Date(today);
    past.setDate(past.getDate() - 365);
    const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);
    return {
      startDate: startDate || toDateOnly(past),
      endDate: endDate || toDateOnly(today),
    };
  }

  @Get("orders/reception-report")
  @Permissions("order.read")
  @ApiOperation({ summary: "Raport recepții și returnări pe perioadă" })
  getReceptionReport(
    @Query("start_date") startDate: string,
    @Query("end_date") endDate: string,
    @Query("location_id") locationId?: string,
    @Query("company_id") company_id?: string,
    @Request() req?: { user?: Record<string, unknown> },
  ) {
    const locId = locationId ? parseInt(locationId, 10) : undefined;
    const requestedCompanyId = company_id ? parseInt(company_id, 10) : undefined;
    const requester = buildSupplierAccessRequester(req?.user);
    const range = this.resolveReceptionDateRange(
      startDate,
      endDate,
      locId != null,
    );
    return this.service.getReceptionReport(
      range.startDate,
      range.endDate,
      locId,
      requester,
      requestedCompanyId,
    );
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
    @Query("company_id") company_id?: string,
    @Request() req?: { user?: Record<string, unknown> },
  ) {
    const hasOtherFilter =
      !!orderId || !!orderItemId || !!productId || !!userId;
    const range = this.resolveReceptionDateRange(
      startDate,
      endDate,
      hasOtherFilter,
    );
    const requestedCompanyId = company_id ? parseInt(company_id, 10) : undefined;
    const requester = buildSupplierAccessRequester(req?.user);
    return this.service.getReceptionEvents(
      range.startDate,
      range.endDate,
      orderId ? Number(orderId) : undefined,
      orderItemId ? Number(orderItemId) : undefined,
      productId ? Number(productId) : undefined,
      userId ? Number(userId) : undefined,
      requester,
      requestedCompanyId,
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
  getOrderReceptionsBatch(@Query("order_ids") orderIdsRaw: string, @Request() req: any) {
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

    return this.service.getOrderReceptionsBatch(orderIds, req?.user);
  }

  @Get("orders/:orderId/remaining-stock")
  @PermissionsAny("order.read", "suppliers.create")
  @ApiOperation({
    summary:
      "Stoc curent (depozit furnizor) pentru produsele din comandă — doar furnizor/magazioner",
  })
  getOrderRemainingStock(@Param("orderId") orderId: string, @Request() req: any) {
    return this.service.getOrderRemainingStock(Number(orderId), req?.user);
  }

  @Get("orders/:orderId/receptions")
  @Permissions("order.read")
  @ApiOperation({ summary: "Obține recepțiile pentru o comandă" })
  getOrderReceptions(@Param("orderId") orderId: string, @Request() req: any) {
    return this.service.getOrderReceptions(Number(orderId), req?.user);
  }

  @Get("orders/:orderId/cancelled-items")
  @Permissions("order.read")
  @ApiOperation({ summary: "Obține item-urile anulate pentru o comandă" })
  getOrderCancelledItems(@Param("orderId") orderId: string, @Request() req: any) {
    return this.service.getOrderCancelledItems(Number(orderId), req?.user);
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
  getOrderCancelledItemsBatch(@Query("order_ids") orderIdsRaw: string, @Request() req: any) {
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

    return this.service.getOrderCancelledItemsBatch(orderIds, req?.user);
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
    @Request() req: any,
  ) {
    return this.service.cancelRemainingQuantity(Number(orderId), dto.reason, req?.user);
  }

  @Post("orders/cancel-items")
  @Permissions("order.cancel")
  @ApiOperation({
    summary: "Anulează item-uri dintr-o comandă (nouă abordare)",
  })
  cancelOrderItems(@Body() dto: CancelOrderItemsDto, @Request() req: any) {
    return this.service.cancelOrderItems(dto, req?.user);
  }
  @Get(":supplierId/orders/:orderId/email-link")
  @Permissions("order.read")
  async emailLink(
    @Param("supplierId") supplierId: string,
    @Param("orderId") orderId: string,
    @Request() req: any,
  ) {
    await this.service.findOrderForRequester(Number(orderId), req?.user);
    return {
      emailLink: this.service.generateEmailLink(
        Number(supplierId),
        Number(orderId),
      ),
    };
  }

  @Get(":supplierId/orders/:orderId/whatsapp-link")
  @Permissions("order.read")
  async whatsappLink(
    @Param("supplierId") supplierId: string,
    @Param("orderId") orderId: string,
    @Request() req: any,
  ) {
    await this.service.findOrderForRequester(Number(orderId), req?.user);
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

