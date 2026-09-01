import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException, Logger, Inject, NotImplementedException } from '@nestjs/common';
import { InjectRepository, InjectConnection } from '@nestjs/typeorm';
import {
  Repository,
  Connection,
  In,
  IsNull,
  Not,
  EntityManager,
  InsertResult,
  Between,
  SelectQueryBuilder,
} from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import { EntryDocumentsExportService } from './entry-documents-export.service';
import { Giurom2ZonesService } from './giurom2-zones.service';
import { resolveOrderLineZoneId } from './giurom2-zone-ref';
import { Supplier } from './entities/supplier.entity';
import { SupplierFolder } from './entities/supplier-folder.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SupplierProductMeasurementVariant } from './entities/supplier-product-measurement-variant.entity';
import { Giurom2Zone } from './entities/giurom2-zone.entity';
import { SupplierProductLastGiurom2Zone } from './entities/supplier-product-last-giurom2-zone.entity';
import { SupplierOrder, OrderStatus } from './entities/supplier-order.entity';
import { SupplierOrderItem } from './entities/supplier-order-item.entity';
import {
  SupplierOrderWarehouseReview,
  WarehouseReviewStatus,
} from './entities/supplier-order-warehouse-review.entity';
import {
  SupplierOrderItemChange,
  SupplierOrderItemChangeType,
} from './entities/supplier-order-item-change.entity';
import { SupplierOrderDocument } from './entities/supplier-order-document.entity';
import { SupplierOrderItemReception, ReceptionStatus } from './entities/supplier-order-item-reception.entity';
import { SupplierOrderCancelledItem } from './entities/supplier-order-cancelled-item.entity';
import { SupplierDocument, DocumentType } from './entities/supplier-document.entity';
import { SupplierLocations } from './entities/supplier-locations.entity';
import { ClientSupplierLink } from './entities/client-supplier-link.entity';
import { ClientManualSupplierState } from './entities/client-manual-supplier-state.entity';
import { SupplierProductClientMapping } from './entities/supplier-product-client-mapping.entity';
import { SupplierProductClientPrice } from './entities/supplier-product-client-price.entity';
import {
  SupplierProductClientPriceHistory,
  SupplierProductClientPriceHistoryAction,
  SupplierProductClientPriceEditSource,
} from './entities/supplier-product-client-price-history.entity';
import { SupplierProductClientVisibility } from './entities/supplier-product-client-visibility.entity';
import { SupplierProductClientActivation } from './entities/supplier-product-client-activation.entity';
import { buildSupplierProductImageFields } from './supplier-product-image.helper';
import {
  getOwnerCompanyIdsWithSupplierLogin,
  hasSupplierLoginAccount,
} from './has-supplier-login-account';
import { shouldBlockClientMasterUpdateOnContSupplier } from './cont-supplier-client-edit.rules';
import {
  computeLineSubtotal,
  compareQuantityToStock,
  normalizePriceBaseQuantity,
  priceNetFromGross,
  priceWithVatFromNet,
  resolvePriceBaseUnit,
  resolveProductVatRate,
  roundMoney,
} from './units.util';
import {
  buildSupplierProductUserContext,
  isAdminOrSuperAdminFromContext,
} from './supplier-product-access';
import {
  normalizeSupplierProductIsActive,
  resolveIsActiveForClientProduct,
} from './supplier-product-client-activation.util';
import {
  assertOrderItemProductIdMatchesMapping,
  assertRequestedClientStockProductId,
  ClientStockProductResolutionError,
  resolveClientStockProductIdFromMapping,
} from './client-stock-product-resolution.util';
import {
  assertOrderCompanyAccess,
  assertOrderCompanyIdNotEscalated,
  filterOrdersByRequesterCompany,
  isPlatformOrderRequester,
  OrderRequesterUser,
  resolveOrderActorUserId,
  resolveOrderTenantCompanyId,
} from './order-access';
import {
  applyOrderListTenantScopeToQueryBuilder,
  applyReceptionEventsTenantScopeToQueryBuilder,
  assertOrderListCompanyIdNotEscalated,
} from './order-list-scope.util';
import {
  assertDriverSelfOrOperationalAdmin,
  assertOperationalEmployeeDashboardAccess,
  canManageCompanyOperationalEmployees,
} from './order-assignment-access';
import { EmployeeSupplier } from './entities/employee-supplier.entity';
import {
  SupplierOrderAssignment,
  SupplierOrderAssignmentStatus,
} from './entities/supplier-order-assignment.entity';
import {
  SupplierOrderDriverAssignment,
  SupplierOrderDriverAssignmentStatus,
} from './entities/supplier-order-driver-assignment.entity';
import {
  generateSupplierConnectionCode,
  normalizeSupplierConnectionCode,
} from './connection-code.util';
import {
  decideConnectAttempt,
  isSupplierAccessibleViaLocationOrLink,
} from './client-supplier-connect.rules';
import {
  assertClientSupplierRelationshipResolved,
  ClientSupplierRelationshipError,
  type ClientSupplierRelationshipRequirement,
  type ClientSupplierRelationshipSnapshot,
} from './client-supplier-relationship.util';
import { missingLocationIds } from './supplier-company-locations.util';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierWithDocumentsDto } from './dto/create-supplier-with-documents.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from './dto/update-supplier-product.dto';
import { CreateSupplierProductMeasurementVariantDto } from './dto/create-supplier-product-measurement-variant.dto';
import { UpdateSupplierProductMeasurementVariantDto } from './dto/update-supplier-product-measurement-variant.dto';
import {
  CreateSupplierOrderDto,
  CreateSupplierOrderItemDto,
} from './dto/create-supplier-order.dto';
import { WarehouseReviewDto } from './dto/warehouse-review.dto';
import { UpsertSupplierProductClientConfigDto } from './dto/upsert-supplier-product-client-config.dto';
import { UpsertSupplierProductClientPriceDto } from './dto/upsert-supplier-product-client-price.dto';
import { SetClientProductVisibilityDto } from './dto/set-client-product-visibility.dto';
import { SetSupplierProductClientActivationDto } from './dto/set-supplier-product-client-activation.dto';
import { CreateSupplierOrderAssignmentDto } from './dto/create-supplier-order-assignment.dto';
import { CreateSupplierOrderDriverAssignmentDto } from './dto/create-supplier-order-driver-assignment.dto';
import { UpdateOrderDeliveryDateDto } from './dto/update-order-delivery-date.dto';
import { PartialReceptionDto } from './dto/partial-reception.dto';
import { CancelOrderItemsDto } from './dto/cancel-order-items.dto';
import { SendBackToMagazionerDto } from './dto/send-back-to-magazioner.dto';
import { StockHttpService, CreateStockItemDto } from './stock-http.service';
import { SupplierQuotaService } from './supplier-quota.service';
import { SupplierQuotaLifecycleService } from './supplier-quota-lifecycle.service';
import {
  SUPPLIER_QUOTA_STATUS,
  normalizeSupplierQuotaStatus,
  isSupplierEligibleForNewOrder,
} from './supplier-quota-status';
import {
  assertClientViewOnlyOnMutations,
  assertFurnizorProductManager,
  isAdminOrSuperAdminFromPermissions,
  hasPlatformWideSupplierAccess,
  isTenantScopedSupplierRequester,
  canManageSupplierProductClientMapping,
  isClientAdminCatalogManager,
  isFurnizorProductManager,
  isAllowedClientManagedProductCompany,
  resolveCompanyTypeFromAuth,
  buildSupplierAccessRequester,
  type SupplierProductUserContext,
  type SupplierAccessRequester,
} from './supplier-product-access';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildOrdersPaginatedResponse,
  normalizeOrdersPagination,
  PaginatedOrdersResponse,
  DEFAULT_CLIENT_PRICES_PAGE_LIMIT,
  DEFAULT_CLIENT_PRICE_HISTORY_PAGE_LIMIT,
} from './suppliers-pagination.util';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);
  private readonly locationsServiceUrl: string;
  private readonly serviceSecret: string;

  private internalServiceHeaders() {
    return {
      'x-internal-service': 'suppliers-ms',
      'x-service-secret': this.serviceSecret,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Verifică dacă utilizatorul operațional (magazioner/șofer) are tură activă
   * apelând `GET /attendance/my-active-shift` din attendance-ms cu token-ul JWT original al userului.
   *
   * - hasActiveShift=true  → permite acțiunea
   * - hasActiveShift=false → 403 Forbidden
   * - attendance-ms indisponibil / timeout / eroare → 503 ServiceUnavailable (fail-closed)
   * - 403 primit de la attendance-ms → retransmis ca 403 (nu transformat în 503)
   *
   * Nu aplică restricția pentru utilizatorii non-operaționali (admin, furnizor-tenant):
   * verifică explicit rolurile magazioner/șofer din JWT, nu doar prezenţa unui sub numeric.
   *
   * @param user          - obiectul user din JWT (req.user)
   * @param authorization - header-ul Authorization din request (Bearer <token>)
   */
  async assertActiveShiftForOperationalUser(
    user?: OrderRequesterUser,
    authorization?: string,
  ): Promise<void> {
    // Verificare rol operațional: cel puțin unul din rolurile magazioner/sofer trebuie prezent.
    // Adminii și furnizorii-tenant au `assignment.read_all` / `assignment.read_company` sau nu au
    // aceste roluri — nu aplicăm restricția de tură pentru ei.
    const roles = Array.isArray(user?.roles)
      ? (user.roles as string[]).map((r) => String(r).toLowerCase().trim())
      : [];
    const permissions = Array.isArray(user?.permissions)
      ? (user.permissions as string[])
      : [];
    const isAdmin =
      permissions.includes('assignment.read_all') ||
      permissions.includes('assignment.read_company') ||
      user?.isAdmin === true ||
      user?.isSuperAdmin === true;
    const isOperational =
      !isAdmin && (roles.includes('magazioner') || roles.includes('sofer'));

    if (!isOperational) {
      return;
    }

    const employeeId = resolveOrderActorUserId(user);
    const attendanceUrl =
      this.configService.get<string>('ATTENDANCE_HTTP_URL') ||
      process.env.ATTENDANCE_HTTP_URL ||
      'http://localhost:3016';

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authorization) {
        headers['Authorization'] = authorization;
      }

      const resp = await firstValueFrom(
        this.httpService.get<{ hasActiveShift: boolean }>(
          `${attendanceUrl}/attendance/my-active-shift`,
          { headers, timeout: 5000 },
        ),
      );
      if (!resp.data?.hasActiveShift) {
        throw new ForbiddenException(
          'Trebuie să începi programul înainte de a efectua această acțiune.',
        );
      }
    } catch (err) {
      // ForbiddenException aruncată local (hasActiveShift=false) → retransmitem ca 403
      if (err instanceof ForbiddenException) throw err;

      // AxiosError: attendance-ms a răspuns cu un status HTTP explicit
      const axiosStatus: number | undefined =
        (err as any)?.response?.status ?? (err as any)?.status;
      if (axiosStatus != null) {
        if (axiosStatus === 401) {
          throw new ForbiddenException(
            'Sesiunea a expirat. Autentifică-te din nou.',
          );
        }
        if (axiosStatus === 403) {
          throw new ForbiddenException(
            'Trebuie să începi programul înainte de a efectua această acțiune.',
          );
        }
        // 4xx neașteptat de la attendance-ms → 503 (eroare de infrastructură)
        this.logger.error(
          `❌ [assertActiveShiftForOperationalUser] attendance-ms a returnat ${axiosStatus} pentru employee=${employeeId}`,
        );
        throw new ServiceUnavailableException(
          'Nu s-a putut verifica tura activă. Încearcă din nou.',
        );
      }

      // Timeout, ECONNREFUSED, eroare de rețea sau orice altă eroare neașteptată → 503
      this.logger.error(
        `❌ [assertActiveShiftForOperationalUser] Nu am putut contacta attendance-ms pentru employee=${employeeId}: ${(err as Error)?.message}`,
      );
      throw new ServiceUnavailableException(
        'Nu s-a putut verifica tura activă. Încearcă din nou.',
      );
    }
  }

  /** Statuses where a placed order requires a client delivery location (anything except draft / cancelled). */
  private static readonly STATUSES_WITHOUT_SUPPLIER_STOCK_DEDUCTED = new Set<OrderStatus>([
    OrderStatus.DRAFT,
    OrderStatus.CANCELLED,
  ]);

  private static hasSupplierStockDeducted(status: OrderStatus): boolean {
    return !SuppliersService.STATUSES_WITHOUT_SUPPLIER_STOCK_DEDUCTED.has(status);
  }

  /**
   * Statusuri considerate „stoc furnizor deja scăzut" — folosit DOAR pentru gating-ul
   * restore-ului la anulare (NU pentru gating-ul deduct-ului de la confirmare).
   * Scăderea se face la confirmarea furnizorului. `magazioner` este inclus pentru a acoperi
   * fluxul confirmed → magazioner → cancelled (send-back), unde stocul a fost deja scăzut.
   */
  private static readonly SUPPLIER_STOCK_DEDUCTED_STATUSES = new Set<OrderStatus>([
    OrderStatus.CONFIRMED,
    OrderStatus.MAGAZIONER,
    OrderStatus.SOFER,
    OrderStatus.DELIVERED,
    OrderStatus.RECEIVED,
    OrderStatus.RETURNED_TO_SUPPLIER,
    OrderStatus.RETURNED_FROM_SUPPLIER,
  ]);

  private static isSupplierStockDeducted(status: OrderStatus): boolean {
    return SuppliersService.SUPPLIER_STOCK_DEDUCTED_STATUSES.has(status);
  }
  constructor(
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SupplierFolder) private readonly folderRepo: Repository<SupplierFolder>,
    @InjectRepository(SupplierProduct) private readonly supplierProductRepo: Repository<SupplierProduct>,
    @InjectRepository(SupplierProductMeasurementVariant) private readonly supplierProductMeasurementVariantRepo: Repository<SupplierProductMeasurementVariant>,
    @InjectRepository(SupplierOrder) private readonly orderRepo: Repository<SupplierOrder>,
    @InjectRepository(SupplierOrderItem) private readonly orderItemRepo: Repository<SupplierOrderItem>,
    @InjectRepository(SupplierOrderDocument) private readonly orderDocumentRepo: Repository<SupplierOrderDocument>,
    @InjectRepository(SupplierOrderItemReception) private readonly orderItemReceptionRepo: Repository<SupplierOrderItemReception>,
    @InjectRepository(SupplierOrderCancelledItem) private readonly cancelledItemRepo: Repository<SupplierOrderCancelledItem>,
    @InjectRepository(SupplierDocument) private readonly supplierDocumentRepo: Repository<SupplierDocument>,
    @InjectRepository(SupplierLocations) private readonly supplierLocationsRepo: Repository<SupplierLocations>,
    @InjectRepository(ClientSupplierLink)
    private readonly clientSupplierLinkRepo: Repository<ClientSupplierLink>,
    @InjectRepository(SupplierProductClientMapping)
    private readonly supplierProductClientMappingRepo: Repository<SupplierProductClientMapping>,
    @InjectRepository(SupplierProductClientPrice)
    private readonly supplierProductClientPriceRepo: Repository<SupplierProductClientPrice>,
    @InjectRepository(SupplierProductClientPriceHistory)
    private readonly supplierProductClientPriceHistoryRepo: Repository<SupplierProductClientPriceHistory>,
    @InjectRepository(SupplierProductClientVisibility)
    private readonly supplierProductClientVisibilityRepo: Repository<SupplierProductClientVisibility>,
    @InjectRepository(SupplierProductClientActivation)
    private readonly supplierProductClientActivationRepo: Repository<SupplierProductClientActivation>,
    @InjectRepository(EmployeeSupplier) private readonly employeeSupplierRepo: Repository<EmployeeSupplier>,
    @InjectRepository(SupplierOrderAssignment)
    private readonly orderAssignmentRepo: Repository<SupplierOrderAssignment>,
    @InjectRepository(SupplierProductLastGiurom2Zone)
    private readonly lastGiurom2ZoneRepo: Repository<SupplierProductLastGiurom2Zone>,
    @InjectConnection() private readonly connection: Connection,
    private readonly stockHttpService: StockHttpService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly entryDocumentsExportService: EntryDocumentsExportService,
    private readonly giurom2ZonesService: Giurom2ZonesService,
    private readonly supplierQuotaService: SupplierQuotaService,
    private readonly supplierQuotaLifecycleService: SupplierQuotaLifecycleService,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {
    this.locationsServiceUrl =
      this.configService.get<string>('LOCATIONS_HTTP_URL') ||
      'http://localhost:3004';
    this.serviceSecret =
      this.configService.get<string>('SERVICE_SECRET') ||
      process.env.SERVICE_SECRET || '';
  }

  /**
   * Gestiunea giurom 2.0 cerută pe o linie → valoarea salvată efectiv.
   *
   * O gestiune care nu aparține locației comenzii e o eroare de UI (catalog învechit, locație
   * schimbată după alegere), nu vina operatorului, și n-are voie să facă o comandă să eșueze:
   * o punem pe `null` — în App2 linia cade pe gestiunea implicită — și lăsăm urmă în log.
   */
  private resolveGiurom2ZoneId(
    requested: number | null | undefined,
    allowedZoneIds: Set<number>,
    orderId: number,
  ): number | null {
    const resolved = resolveOrderLineZoneId(requested, allowedZoneIds);
    if (resolved == null && requested != null) {
      this.logger.warn(
        `⚠️ [SUPPLIERS SERVICE] Comanda ${orderId}: gestiunea ${requested} nu aparține ` +
          'locației comenzii — linia rămâne fără gestiune și va cădea pe cea implicită în giurom 2.0.',
      );
    }
    return resolved;
  }

  /**
   * Ultimele gestiuni alese pe produse, pentru locația clientului.
   * Folosit la precompletarea selectorului pe următoarea comandă.
   */
  async listLastGiurom2Zones(
    companyId: number,
    locationId: number,
  ): Promise<Array<{ supplier_product_id: number; giurom2_zone_id: number }>> {
    if (!Number.isFinite(companyId) || !Number.isFinite(locationId)) return [];
    const rows = await this.lastGiurom2ZoneRepo.find({
      where: { company_id: companyId, location_id: locationId },
    });
    return rows.map((row) => ({
      supplier_product_id: Number(row.supplier_product_id),
      giurom2_zone_id: Number(row.giurom2_zone_id),
    }));
  }

  /**
   * Memorează gestiunea aleasă pe fiecare linie, ca la următoarea comandă pe aceeași
   * locație să se precompleteze. Upsert pe (firmă, locație, produs furnizor).
   */
  private async rememberGiurom2ZonesForOrder(
    companyId: number | null | undefined,
    locationId: number | null | undefined,
    lines: Array<{ supplier_product_id: number; giurom2_zone_id: number | null }>,
  ): Promise<void> {
    if (
      companyId == null ||
      locationId == null ||
      !Number.isFinite(Number(companyId)) ||
      !Number.isFinite(Number(locationId))
    ) {
      return;
    }
    const company = Number(companyId);
    const location = Number(locationId);
    const toSave = lines.filter(
      (line) =>
        Number.isFinite(line.supplier_product_id) &&
        line.supplier_product_id > 0 &&
        line.giurom2_zone_id != null &&
        Number.isFinite(line.giurom2_zone_id),
    );
    if (toSave.length === 0) return;

    const now = new Date();
    await this.lastGiurom2ZoneRepo
      .createQueryBuilder()
      .insert()
      .into(SupplierProductLastGiurom2Zone)
      .values(
        toSave.map((line) => ({
          company_id: company,
          location_id: location,
          supplier_product_id: line.supplier_product_id,
          giurom2_zone_id: Number(line.giurom2_zone_id),
          updated_at: now,
        })),
      )
      .orUpdate(['giurom2_zone_id', 'updated_at'], [
        'company_id',
        'location_id',
        'supplier_product_id',
      ])
      .execute();
  }

  /**
   * True dacă supplier-ul (după supplier_id → owner_company_id) are cont furnizor autentificabil.
   * Sursa de adevăr pentru diferențierea flow-ului comenzilor.
   */
  async hasSupplierLoginAccount(supplierId: number): Promise<boolean> {
    const id = Number(supplierId);
    if (!Number.isFinite(id) || id <= 0) {
      return false;
    }
    const supplier = await this.supplierRepo.findOne({
      where: { id },
      select: ['id', 'owner_company_id'],
    });
    return hasSupplierLoginAccount(this.connection, supplier);
  }

  private async assertSupplierAccountRequiredForTenantAction(
    supplierId: number,
    actionLabel: string,
  ): Promise<void> {
    const hasAccount = await this.hasSupplierLoginAccount(supplierId);
    if (!hasAccount) {
      throw new BadRequestException(
        `Acțiunea „${actionLabel}” este disponibilă doar pentru furnizori cu cont autentificabil. ` +
          `Acest furnizor nu are cont de furnizor în aplicație.`,
      );
    }
  }

  private async attachHasSupplierAccountFlag<
    T extends { supplier_id?: number; supplier?: Supplier | null; has_supplier_account?: boolean },
  >(orders: T[]): Promise<T[]> {
    if (!orders.length) {
      return orders;
    }
    const supplierIds = [
      ...new Set(
        orders
          .map((o) => Number(o.supplier_id ?? o.supplier?.id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    const accountBySupplierId = new Map<number, boolean>();
    await Promise.all(
      supplierIds.map(async (supplierId) => {
        accountBySupplierId.set(
          supplierId,
          await this.hasSupplierLoginAccount(supplierId),
        );
      }),
    );
    for (const order of orders) {
      const sid = Number(order.supplier_id ?? order.supplier?.id);
      order.has_supplier_account = accountBySupplierId.get(sid) === true;
    }
    return orders;
  }

  private async attachHasSupplierAccountOnSuppliers<
    T extends { id: number; owner_company_id?: number | null; has_supplier_account?: boolean },
  >(suppliers: T[]): Promise<T[]> {
    if (!suppliers.length) {
      return suppliers;
    }
    const ownerCompanyIds = suppliers
      .map((supplier) => Number(supplier.owner_company_id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const withAccount = await getOwnerCompanyIdsWithSupplierLogin(
      this.connection,
      ownerCompanyIds,
    );
    for (const supplier of suppliers) {
      const ownerCompanyId = Number(supplier.owner_company_id);
      supplier.has_supplier_account =
        Number.isFinite(ownerCompanyId) &&
        ownerCompanyId > 0 &&
        withAccount.has(ownerCompanyId);
    }
    return suppliers;
  }

  /**
   * Attach client_association_is_active from client_supplier_links for the
   * requesting client company (Cont only). Manual → null.
   */
  private async attachClientAssociationActiveOnSuppliers<
    T extends {
      id: number;
      has_supplier_account?: boolean;
      client_association_is_active?: boolean | null;
      quota_status?: string | null;
    },
  >(suppliers: T[], requester?: SupplierAccessRequester): Promise<T[]> {
    for (const s of suppliers) {
      s.client_association_is_active = null;
      s.quota_status = null;
    }
    if (!suppliers.length || !isTenantScopedSupplierRequester(requester)) {
      return suppliers;
    }
    const companyType = resolveCompanyTypeFromAuth(
      requester?.company_type,
      requester?.roles,
    );
    if (companyType !== 'client') {
      return suppliers;
    }
    const companyId = Number(requester!.company_id);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return suppliers;
    }
    const contIds = suppliers
      .filter((s) => s.has_supplier_account === true)
      .map((s) => Number(s.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (!contIds.length) {
      return suppliers;
    }
    const links = await this.clientSupplierLinkRepo.find({
      where: {
        client_company_id: companyId,
        supplier_id: In(contIds),
      },
      select: ['supplier_id', 'is_active', 'quota_status'],
    });
    const bySupplier = new Map(
      links.map((l) => [
        Number(l.supplier_id),
        {
          is_active: l.is_active !== false,
          quota_status: normalizeSupplierQuotaStatus(l.quota_status),
        },
      ]),
    );
    for (const s of suppliers) {
      if (s.has_supplier_account !== true) continue;
      const sid = Number(s.id);
      const link = bySupplier.get(sid);
      s.client_association_is_active = link ? link.is_active : null;
      s.quota_status = link ? link.quota_status : null;
    }
    return suppliers;
  }

  private async attachManualQuotaStatusOnSuppliers<
    T extends {
      id: number;
      has_supplier_account?: boolean;
      quota_status?: string | null;
      client_association_is_active?: boolean | null;
    },
  >(suppliers: T[], requester?: SupplierAccessRequester): Promise<T[]> {
    if (!suppliers.length || !isTenantScopedSupplierRequester(requester)) {
      return suppliers;
    }
    const companyType = resolveCompanyTypeFromAuth(
      requester?.company_type,
      requester?.roles,
    );
    if (companyType !== 'client') {
      return suppliers;
    }
    const companyId = Number(requester!.company_id);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return suppliers;
    }
    const manualIds = suppliers
      .filter((s) => s.has_supplier_account !== true)
      .map((s) => Number(s.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (!manualIds.length) {
      return suppliers;
    }
    const states = await this.connection
      .getRepository(ClientManualSupplierState)
      .find({
        where: {
          client_company_id: companyId,
          supplier_id: In(manualIds),
        },
        select: ['supplier_id', 'quota_status', 'is_active'],
      });
    const bySupplier = new Map(
      states.map((s) => [
        Number(s.supplier_id),
        {
          quota_status: normalizeSupplierQuotaStatus(s.quota_status),
          is_active: s.is_active !== false,
        },
      ]),
    );
    for (const s of suppliers) {
      if (s.has_supplier_account === true) continue;
      const sid = Number(s.id);
      const state = bySupplier.get(sid);
      s.quota_status = state?.quota_status || SUPPLIER_QUOTA_STATUS.ACTIVE;
      s.client_association_is_active = state ? state.is_active : true;
    }
    return suppliers;
  }

  /** selectedWorkLocationId = locația selectată în UI (colț dreapta sus), pentru notificări pe locație. */
  private async sendSupplierNotification(
    type: string,
    title: string,
    description: string,
    supplierId: number,
    metadata?: any,
    target_url?: string,
    selectedWorkLocationId?: number,
  ): Promise<void> {
    try {
      this.logger.log(`🔍 [SUPPLIERS SERVICE] Attempting to send notification - Type: ${type}, Supplier ID: ${supplierId}`);
      const payloadMetadata = {
        ...metadata,
        ...(selectedWorkLocationId != null && { work_location_id: selectedWorkLocationId }),
      };
      const notificationData = {
        type,
        title,
        description,
        entity_id: supplierId,
        entity_type: 'supplier',
        metadata: payloadMetadata,
        priority: 'medium',
        target_url,
      };
      
      this.logger.log(`📤 Sending notification data: ${JSON.stringify(notificationData)}`);
      
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'suppliers.notification' }, notificationData)
      );
      
      this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully sent notification for supplier ${supplierId}`);
    } catch (error: any) {
      this.logger.error(`❌ [SUPPLIERS SERVICE] Failed to send supplier notification: ${error?.message || error}`, error?.stack);
    }
  }

  /** Notificări comenzi: doar admini/manageri (sau doar admini) din locația comenzii */
  private async sendOrderNotification(
    type: string,
    title: string,
    description: string,
    work_location_id: number,
    orderId: number,
    metadata?: any,
    target_url?: string
  ): Promise<void> {
    try {
      this.logger.log(`🔔 [SUPPLIERS SERVICE] Order notification - type: ${type}, orderId: ${orderId}, work_location_id: ${work_location_id}`);
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'orders.notification' }, {
          type,
          title,
          description,
          work_location_id,
          entity_id: orderId,
          entity_type: 'supplier_order',
          metadata,
          priority: 'medium',
          target_url,
        })
      );
    } catch (error: any) {
      this.logger.error(`❌ [SUPPLIERS SERVICE] Failed to send order notification: ${error?.message || error}`, error?.stack);
    }
  }

  async create(
    dto: CreateSupplierDto,
    location_id?: number,
    requester?: SupplierAccessRequester,
  ): Promise<Supplier> {
    const existingSupplier = await this.supplierRepo.findOne({
      where: [
        { registration_number: dto.registration_number },
        { vat_number: dto.vat_number },
      ],
    });

    const companyWide =
      isTenantScopedSupplierRequester(requester) &&
      Number(requester!.company_id) > 0;
    let companyIdForSeed: number | null = null;
    let companyLocationIds: number[] = [];
    if (companyWide) {
      companyIdForSeed = Number(requester!.company_id);
      companyLocationIds = await this.fetchCompanyLocationIds(companyIdForSeed);
    }

    if (existingSupplier && companyWide && companyIdForSeed != null) {
      const ownerId = Number(existingSupplier.owner_company_id);
      const isManual =
        !Number.isFinite(ownerId) || ownerId <= 0;
      if (isManual) {
        const manualState =
          await this.supplierQuotaLifecycleService.getManualState(
            companyIdForSeed,
            existingSupplier.id,
          );
        const status =
          this.supplierQuotaLifecycleService.resolveManualQuotaStatus(
            manualState,
          );
        if (status === SUPPLIER_QUOTA_STATUS.REMOVED) {
          return this.supplierQuotaService.withCompanySupplierQuotaLock(
            companyIdForSeed,
            async () => {
              await this.supplierQuotaLifecycleService.reactivateManualSupplier(
                companyIdForSeed!,
                existingSupplier.id,
                companyLocationIds,
              );
              await this.seedSupplierLocationsForCompany(
                existingSupplier.id,
                companyIdForSeed!,
              );
              return existingSupplier;
            },
          );
        }
      }
    }

    if (existingSupplier) {
      throw new BadRequestException('Furnizor duplicat (registration_number sau vat_number)');
    }

    if (companyWide) {
      if (companyLocationIds.length === 0) {
        throw new BadRequestException(
          'Compania nu are nicio locație configurată. Adaugă o locație înainte de a crea un furnizor Manual.',
        );
      }
      if (location_id != null) {
        await this.assertLocationBelongsToRequesterCompany(location_id, requester!);
      }
    } else if (location_id != null && isTenantScopedSupplierRequester(requester)) {
      await this.assertLocationBelongsToRequesterCompany(location_id, requester!);
    }

    const persistManual = async (): Promise<Supplier> => {
      const payload = { ...dto } as CreateSupplierDto & {
        owner_company_id?: number | null;
        connection_code?: string | null;
      };
      let clientAssociationActive = true;
      // Client Manual create: never attach furnizor tenant ownership.
      if (companyWide) {
        delete payload.owner_company_id;
        (payload as { owner_company_id?: number | null }).owner_company_id = null;
        const rawIsActive = (dto as unknown as Record<string, unknown>).is_active;
        if (rawIsActive !== undefined) {
          clientAssociationActive = rawIsActive !== false;
        }
        delete (payload as unknown as Record<string, unknown>).is_active;
      } else if (isTenantScopedSupplierRequester(requester)) {
        delete payload.owner_company_id;
      }
      delete payload.connection_code;

      const supplier = this.supplierRepo.create(payload);
      const savedSupplier = (await this.supplierRepo.save(supplier as any)) as Supplier;
      await this.ensureConnectionCodeForAccountSupplier(savedSupplier);
      await this.createSupplierFolders(savedSupplier);

      if (companyWide && companyIdForSeed != null) {
        await this.seedSupplierLocationsForCompany(
          savedSupplier.id,
          companyIdForSeed,
        );
        await this.seedManualClientAssociationStateOnCreate(
          companyIdForSeed,
          savedSupplier.id,
          clientAssociationActive,
        );
      } else if (location_id) {
        try {
          await this.assignSupplierToLocation(savedSupplier.id, location_id);
        } catch {
          // logged in assignSupplierToLocation
        }
      }

      return savedSupplier;
    };

    if (companyWide && companyIdForSeed != null) {
      return this.supplierQuotaService.withCompanySupplierQuotaLock(
        companyIdForSeed,
        async () => {
          await this.supplierQuotaService.assertCanCreateManualSupplier(
            companyIdForSeed!,
            companyLocationIds,
          );
          return persistManual();
        },
      );
    }

    return persistManual();
  }

  async createWithDocuments(
    dto: CreateSupplierWithDocumentsDto,
    location_id?: number,
    requester?: SupplierAccessRequester,
  ): Promise<Supplier> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Creating supplier with documents: ${JSON.stringify(dto)}`);

    const existingSupplier = await this.supplierRepo.findOne({
      where: [
        { registration_number: dto.registration_number },
        { vat_number: dto.vat_number },
      ],
    });
    if (existingSupplier) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Duplicate supplier detected: ${dto.registration_number} or ${dto.vat_number}`);
      throw new BadRequestException('Furnizor duplicat (registration_number sau vat_number)');
    }

    const companyWide =
      isTenantScopedSupplierRequester(requester) &&
      Number(requester!.company_id) > 0;
    let companyIdForSeed: number | null = null;
    let companyLocationIds: number[] = [];
    if (companyWide) {
      companyIdForSeed = Number(requester!.company_id);
      companyLocationIds = await this.fetchCompanyLocationIds(companyIdForSeed);
      if (companyLocationIds.length === 0) {
        throw new BadRequestException(
          'Compania nu are nicio locație configurată. Adaugă o locație înainte de a crea un furnizor Manual.',
        );
      }
      if (location_id != null) {
        await this.assertLocationBelongsToRequesterCompany(location_id, requester!);
      }
    } else if (location_id != null && isTenantScopedSupplierRequester(requester)) {
      await this.assertLocationBelongsToRequesterCompany(location_id, requester!);
    }

    // Separate special fields from supplier data.
    // Client-managed create must never attach a furnizor tenant (owner_company_id).
    const supplierData = { ...dto } as any;
    delete supplierData.folderName;
    delete supplierData.documents;
    delete supplierData.location_id;
    delete supplierData.owner_company_id;
    supplierData.owner_company_id = null;
    delete supplierData.connection_code;
    supplierData.connection_code = null;
    supplierData.contact_person =
      typeof supplierData.contact_person === 'string' && supplierData.contact_person.trim()
        ? supplierData.contact_person.trim()
        : String(supplierData.supplier_name || '').trim().slice(0, 150);
    supplierData.phone =
      typeof supplierData.phone === 'string' ? supplierData.phone.trim() : '';
    const email =
      typeof supplierData.email === 'string' ? supplierData.email.trim() : '';
    if (!email) {
      throw new BadRequestException('Email-ul companiei este obligatoriu');
    }
    supplierData.email = email;
    if (typeof supplierData.activity_code === 'string') {
      const code = supplierData.activity_code.trim();
      supplierData.activity_code = code || null;
    }
    if (typeof supplierData.headquarters_name === 'string') {
      const name = supplierData.headquarters_name.trim();
      supplierData.headquarters_name = name || null;
    }

    let clientAssociationActive = true;
    if (companyWide) {
      const rawIsActive = (dto as unknown as Record<string, unknown>).is_active;
      if (rawIsActive !== undefined) {
        clientAssociationActive = rawIsActive !== false;
      }
      delete supplierData.is_active;
    }

    const persistManualWithDocs = async (): Promise<Supplier> => {
      const supplier = this.supplierRepo.create(supplierData);
      const savedSupplier = (await this.supplierRepo.save(supplier as any)) as Supplier;
      this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier saved with ID: ${savedSupplier.id}`);

      // location_id remains optional UI/ops context for folder paths only — not ownership.
      const folderLocationId =
        location_id ??
        (companyLocationIds.length
          ? companyLocationIds[0]
          : companyIdForSeed != null
            ? (await this.fetchCompanyLocationIds(companyIdForSeed))[0]
            : undefined);
      await this.createSupplierFoldersWithCustomName(
        savedSupplier,
        dto.folderName,
        dto.documents,
        folderLocationId,
      );

      if (companyWide && companyIdForSeed != null) {
        await this.seedSupplierLocationsForCompany(
          savedSupplier.id,
          companyIdForSeed,
        );
        await this.seedManualClientAssociationStateOnCreate(
          companyIdForSeed,
          savedSupplier.id,
          clientAssociationActive,
        );
      } else if (location_id) {
        try {
          this.logger.log(
            `📍 [SUPPLIERS SERVICE] Assigning supplier ${savedSupplier.id} to location ${location_id}`,
          );
          await this.assignSupplierToLocation(savedSupplier.id, location_id);
        } catch (error: any) {
          this.logger.warn(
            `⚠️ [SUPPLIERS SERVICE] Failed to assign supplier ${savedSupplier.id} to location ${location_id}:`,
            error?.message || error,
          );
        }
      }

      this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new supplier ${savedSupplier.id}`);
      await this.sendSupplierNotification(
        'supplier_created',
        'Furnizor nou creat',
        `A fost creat un nou furnizor: ${savedSupplier.supplier_name}`,
        savedSupplier.id,
        { supplierName: savedSupplier.supplier_name },
        `/furnizori/${savedSupplier.id}`,
        folderLocationId,
      );

      return savedSupplier;
    };

    if (companyWide && companyIdForSeed != null) {
      return this.supplierQuotaService.withCompanySupplierQuotaLock(
        companyIdForSeed,
        async () => {
          await this.supplierQuotaService.assertCanCreateManualSupplier(
            companyIdForSeed!,
            companyLocationIds,
          );
          return persistManualWithDocs();
        },
      );
    }

    return persistManualWithDocs();
  }

  /** Names for magazioneri/șoferi — callers with order.read (incl. furnizor tenant). */
  private getEmployeesServiceUrl(): string {
    let employeesServiceUrl =
      this.configService.get<string>('EMPLOYEES_HTTP_URL') ||
      process.env.EMPLOYEES_HTTP_URL ||
      'http://localhost:3011';
    if (
      employeesServiceUrl.includes('bitap.ro') ||
      employeesServiceUrl.includes(process.env.PUBLIC_SERVER_IP || '89.46.6.45')
    ) {
      const portMatch = employeesServiceUrl.match(/:(\d+)/);
      const port = portMatch ? portMatch[1] : '3011';
      employeesServiceUrl = `http://localhost:${port}`;
    }
    return employeesServiceUrl.replace(/\/$/, '');
  }

  /**
   * Îmbogățește staff furnizor cu nume/email din employees-ms.
   * Prioritate: HTTP batch (sursă de adevăr). Fallback: cross-DB SQL pe giurombitap_employees.
   */
  private async enrichSupplierStaffWithEmployeeNames<
    T extends { employee_id: number; role: string },
  >(rows: T[]): Promise<
    Array<
      T & {
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        email: string | null;
        work_location_default_id: number | null;
        is_active: boolean;
      }
    >
  > {
    if (!rows.length) {
      return [];
    }

    const employeeIds = Array.from(
      new Set(
        rows
          .map((r) => Number(r.employee_id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
    if (!employeeIds.length) {
      return rows.map((row) => ({
        ...row,
        first_name: null,
        last_name: null,
        full_name: null,
        email: null,
        work_location_default_id: null,
        is_active: true,
      }));
    }

    type EmployeeEnrichRow = {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      work_location_default_id: number | null;
      is_active: number | boolean | null;
    };

    let employeeRows: EmployeeEnrichRow[] = [];
    let enrichSource: 'http-batch' | 'cross-db' | 'none' = 'none';

    // 1) HTTP batch — nu depinde de cross-DB / EMPLOYEES_DB_NAME
    try {
      const serviceSecret = process.env.SERVICE_SECRET || '';
      const headers = {
        'x-internal-service': 'suppliers',
        'x-service-secret': serviceSecret,
      };
      const url = `${this.getEmployeesServiceUrl()}/employees/batch?ids=${employeeIds.join(',')}`;
      this.logger.log(
        `[STAFF-ENRICH] HTTP batch GET ${url} (ids=${employeeIds.join(',')})`,
      );
      const resp: any = await firstValueFrom(
        this.httpService.get(url, { headers, timeout: 8000 }),
      );
      const raw = resp?.data?.data ?? resp?.data ?? resp;
      const list = Array.isArray(raw) ? raw : [];
      employeeRows = list.map((e: any) => ({
        id: Number(e.id),
        first_name: e.first_name ?? null,
        last_name: e.last_name ?? null,
        email: e.email ?? null,
        work_location_default_id:
          e.work_location_default_id != null
            ? Number(e.work_location_default_id)
            : null,
        is_active: e.is_active ?? true,
      }));
      enrichSource = 'http-batch';
    } catch (error: any) {
      const status = error?.response?.status;
      const body = error?.response?.data;
      this.logger.error(
        `[STAFF-ENRICH] HTTP batch FAILED status=${status ?? 'N/A'} message=${error?.message} body=${JSON.stringify(body)}`,
      );
    }

    // 2) Fallback cross-DB dacă HTTP nu a returnat rânduri
    if (!employeeRows.length) {
      const employeesDbName =
        this.configService.get<string>('EMPLOYEES_DB_NAME') ||
        process.env.EMPLOYEES_DB_NAME ||
        'giurombitap_employees';
      const placeholder = employeeIds.map(() => '?').join(',');
      const sql = `SELECT id, first_name, last_name, email, work_location_default_id, is_active FROM \`${employeesDbName}\`.employees WHERE id IN (${placeholder})`;
      try {
        this.logger.log(
          `[STAFF-ENRICH] Fallback SQL db=${employeesDbName} ids=${employeeIds.join(',')}`,
        );
        const result: any = await this.connection.query(sql, employeeIds);
        // TypeORM/mysql2: de obicei array de rânduri; uneori [rows, fields]
        if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0]) && !('id' in (result[0] as object))) {
          employeeRows = result[0] as EmployeeEnrichRow[];
        } else if (Array.isArray(result)) {
          employeeRows = result as EmployeeEnrichRow[];
        } else {
          employeeRows = [];
        }
        enrichSource = 'cross-db';
        this.logger.log(
          `[STAFF-ENRICH] SQL returned ${employeeRows.length} row(s)`,
        );
      } catch (error: any) {
        this.logger.error(
          `[STAFF-ENRICH] SQL FAILED db=${employeesDbName}: ${error?.message}`,
        );
      }
    }

    if (!employeeRows.length) {
      this.logger.warn(
        `[STAFF-ENRICH] No employee rows for ids=${employeeIds.join(',')} (source=${enrichSource})`,
      );
    }

    const nameById = new Map<
      number,
      {
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        email: string | null;
        work_location_default_id: number | null;
        is_active: boolean;
      }
    >();
    for (const row of employeeRows || []) {
      const id = Number(row.id);
      if (!Number.isFinite(id) || id <= 0) {
        continue;
      }
      const firstName = row.first_name ?? null;
      const lastName = row.last_name ?? null;
      const fullName =
        [firstName, lastName].filter(Boolean).join(' ').trim() || null;
      nameById.set(id, {
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        email: row.email ?? null,
        work_location_default_id:
          row.work_location_default_id != null
            ? Number(row.work_location_default_id)
            : null,
        is_active: row.is_active === false || row.is_active === 0 ? false : true,
      });
    }

    return rows.map((row) => {
      const names = nameById.get(Number(row.employee_id));
      return {
        ...row,
        first_name: names?.first_name ?? null,
        last_name: names?.last_name ?? null,
        full_name: names?.full_name ?? null,
        email: names?.email ?? null,
        work_location_default_id: names?.work_location_default_id ?? null,
        is_active: names?.is_active ?? true,
      };
    });
  }

  async getSupplierDrivers(
    supplierId: number,
    user?: OrderRequesterUser,
  ): Promise<
    Array<{
      employee_id: number;
      role: string;
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
      email: string | null;
    }>
  > {
    await this.assertSupplierStaffListAccess(supplierId, user);
    const rows = await this.employeeSupplierRepo.find({
      where: { supplier_id: supplierId, role: 'driver' },
      order: { employee_id: 'ASC' },
    });
    const base = rows.map((row) => ({
      employee_id: row.employee_id,
      role: row.role,
    }));
    return this.enrichSupplierStaffWithEmployeeNames(base);
  }

  async getSupplierWarehouseEmployees(
    supplierId: number,
    user?: OrderRequesterUser,
  ): Promise<
    Array<{
      employee_id: number;
      role: string;
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
      email: string | null;
    }>
  > {
    await this.assertSupplierStaffListAccess(supplierId, user);
    const rows = await this.employeeSupplierRepo.find({
      where: { supplier_id: supplierId, role: 'warehouse' },
      order: { employee_id: 'ASC' },
    });
    const base = rows.map((row) => ({
      employee_id: row.employee_id,
      role: row.role,
    }));
    return this.enrichSupplierStaffWithEmployeeNames(base);
  }

  /** Distinct supplier_id values linked to an employee (employees_suppliers). */
  async getEmployeeSupplierIds(employeeId: number): Promise<number[]> {
    const rows = await this.employeeSupplierRepo.find({
      where: { employee_id: employeeId },
      select: ['supplier_id'],
    });
    return [...new Set(rows.map((row) => row.supplier_id))];
  }

  async returnOrderToSupplier(orderId: number): Promise<SupplierOrder> {
    throw new NotImplementedException('returnOrderToSupplier not implemented yet');
  }

  async sendOrderBackToMagazioner(
    orderId: number,
    dto: SendBackToMagazionerDto,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrder> {
    const order = await this.findOrderForRequester(orderId, user);
    await this.assertSupplierAccountRequiredForTenantAction(
      order.supplier_id,
      'trimite înapoi la magazioner',
    );
    const orderWithRelations = await this.orderRepo.findOne({
      where: { id: order.id },
      relations: ['items', 'supplier'],
    });
    const targetOrder = orderWithRelations ?? order;

    targetOrder.status = OrderStatus.MAGAZIONER;
    if (dto.notes) {
      targetOrder.notes = dto.notes;
    }
    await this.orderRepo.save(targetOrder);

    if (targetOrder.supplier_location_id != null) {
      await this.sendOrderNotification(
        'order_returned_to_magazioner',
        'Comandă retrimisă la magazioner',
        `Comanda ${orderId} (${targetOrder.supplier?.supplier_name ?? 'N/A'}) a fost retrimisă la magazioner`,
        targetOrder.supplier_location_id,
        orderId,
        { orderId, supplierName: targetOrder.supplier?.supplier_name, notes: dto.notes },
        '/magazioner/dashboard',
      );
    }

    return targetOrder;
  }

  async toggleItemAvailability(
    itemId: number,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrderItem> {
    const item = await this.findOrderItemForRequester(itemId, user);
    const orderForGuard = await this.orderRepo.findOne({
      where: { id: item.order_id },
      select: ['id', 'supplier_id'],
    });
    if (orderForGuard) {
      await this.assertSupplierAccountRequiredForTenantAction(
        orderForGuard.supplier_id,
        'modificare disponibilitate produs',
      );
    }
    await this.assertStorekeeperOperationalAccess(item.order_id, user);
    const current = item.availability_status || 'available';
    const newStatus = current === 'unavailable' ? 'available' : 'unavailable';
    await this.orderItemRepo.update(itemId, { availability_status: newStatus });

    const order = await this.orderRepo.findOne({
      where: { id: item.order_id },
      relations: ['items'],
    });
    if (order) {
      let totalAmount = 0;
      let totalAmountWithVat = 0;
      for (const line of order.items ?? []) {
        const lineAvail = line.id === itemId ? newStatus : (line.availability_status || 'available');
        if (lineAvail === 'unavailable') continue;
        totalAmount += Number(line.subtotal);
        totalAmountWithVat += Number(line.total ?? line.subtotal);
      }
      await this.orderRepo.update(order.id, {
        total_amount: totalAmount,
        total_amount_with_vat: totalAmountWithVat,
      });
    }

    const updated = await this.orderItemRepo.findOne({ where: { id: itemId } });
    return updated as SupplierOrderItem;
  }

  async warehouseReview(
    orderId: number,
    dto: WarehouseReviewDto,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrder> {
    const orderForGuard = await this.findOrderForRequester(orderId, user);
    await this.assertSupplierAccountRequiredForTenantAction(
      orderForGuard.supplier_id,
      'verificare magazioner',
    );
    await this.assertStorekeeperOperationalAccess(orderId, user);
    return this.connection.transaction(async (manager) => {
      const order = await manager.findOne(SupplierOrder, {
        where: { id: orderId },
        relations: ['items'],
      });
      if (!order) {
        throw new NotFoundException('Comanda nu a fost găsită');
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Comanda este anulată');
      }

      const reviewTs = new Date();
      /** Nu folosi QueryBuilder + `order_id` în values: e RelationId-only în entitate și MySQL primea DEFAULT. */
      const reviewInsertResult = await manager.insert(SupplierOrderWarehouseReview, {
        status: WarehouseReviewStatus.SENT_TO_SUPPLIER,
        warehouse_employee_id: dto.warehouseEmployeeId ?? undefined,
        warehouse_notes:
          dto.notes != null && dto.notes !== '' ? dto.notes : undefined,
        created_at: reviewTs,
        updated_at: reviewTs,
        order: { id: orderId } as SupplierOrder,
      });
      const reviewId = this.resolveInsertId(reviewInsertResult);

      const itemsById = new Map((order.items ?? []).map((i) => [i.id, i]));
      const changeTs = reviewTs;

      const computeLineMoney = async (
        em: EntityManager,
        supplierId: number,
        productId: number,
        pricePerUnit: number,
        qty: number,
        priceBaseQuantity?: number | null,
      ): Promise<{ subtotal: number; total: number }> => {
        const sp = await em.findOne(SupplierProduct, {
          where: { supplier_id: supplierId, product_id: productId },
        });
        const vat = Number(sp?.vat) || 0;
        const base =
          priceBaseQuantity != null
            ? priceBaseQuantity
            : sp?.price_base_quantity;
        const subtotal = roundMoney(computeLineSubtotal(qty, pricePerUnit, base));
        const total = roundMoney(subtotal + (subtotal * vat) / 100);
        return { subtotal, total };
      };

      for (const entry of dto.items ?? []) {
        const item = itemsById.get(entry.itemId);
        if (!item) {
          throw new BadRequestException(`Articolul ${entry.itemId} nu aparține comenzii`);
        }
        const originalQuantity = Number(item.quantity);
        const currentAvailability = item.availability_status || 'available';

        // Skip items that are unavailable — their status is managed only by toggleItemAvailability
        if (currentAvailability === 'unavailable') {
          continue;
        }

        // Skip items sent as available with no quantity change
        if (entry.available) {
          continue;
        }

        // Partial availability: available=false with availableQuantity > 0
        const rawFinal = Number(entry.availableQuantity ?? 0);
        const finalQuantity = Math.max(0, Math.min(originalQuantity, rawFinal));

        if (finalQuantity === originalQuantity || finalQuantity <= 0) {
          continue;
        }

        const pricePerUnit = Number(item.price_per_unit);
        const { subtotal, total } = await computeLineMoney(
          manager,
          order.supplier_id,
          item.product_id,
          pricePerUnit,
          finalQuantity,
          item.price_base_quantity,
        );
        await manager.update(SupplierOrderItem, { id: item.id }, {
          quantity: finalQuantity,
          returned_quantity: originalQuantity - finalQuantity,
          subtotal,
          total,
        });
        const changePayload = {
          order_id: orderId,
          review_id: reviewId,
          change_type: SupplierOrderItemChangeType.PARTIAL_AVAILABLE,
          original_order_item_id: item.id,
          final_order_item_id: item.id,
          original_product_id: item.product_id,
          final_product_id: item.product_id,
          original_quantity: originalQuantity,
          final_quantity: finalQuantity,
        };
        await this.insertOrderItemChangeRaw(manager, {
          ...changePayload,
          created_at: changeTs,
          updated_at: changeTs,
        });
      }

      for (const added of dto.additionalProducts ?? []) {
        const units = added.units;
        // Regula brut/net: greutatea pe bucată se recalculează server-side din DB
        // (gross_quantity > 0 ? gross : net_quantity > 0 ? net : 0), nu din valoarea
        // trimisă de frontend. Cădere pe variantWeight din payload doar dacă varianta
        // nu poate fi rezolvată din DB.
        let resolvedVariantWeight: number | null = null;
        if (added.variantId != null && Number(added.variantId) > 0) {
          const variant = await manager.findOne(
            SupplierProductMeasurementVariant,
            { where: { id: Number(added.variantId) } },
          );
          if (variant) {
            const gross = Number(variant.gross_quantity);
            const net = Number(variant.net_quantity);
            resolvedVariantWeight =
              Number.isFinite(gross) && gross > 0
                ? gross
                : Number.isFinite(net) && net > 0
                  ? net
                  : null;
          }
        }
        const effectiveVariantWeight =
          resolvedVariantWeight != null
            ? resolvedVariantWeight
            : added.variantWeight;
        const hasVariantQty =
          units != null &&
          effectiveVariantWeight != null &&
          Number.isFinite(Number(units)) &&
          Number.isFinite(Number(effectiveVariantWeight)) &&
          Number(units) > 0 &&
          Number(effectiveVariantWeight) > 0;
        const quantityToSave = hasVariantQty
          ? Number(units) * Number(effectiveVariantWeight)
          : Number(added.quantity);

        if (!Number.isFinite(quantityToSave) || quantityToSave <= 0) {
          throw new BadRequestException('Cantitate invalidă pentru produsul adăugat');
        }

        const sp = await manager.findOne(SupplierProduct, {
          where: { supplier_id: order.supplier_id, product_id: added.productId },
        });
        if (!sp) {
          throw new BadRequestException(
            `Produsul furnizor nu a fost găsit pentru product_id=${added.productId}`,
          );
        }
        const pricePerUnit = Number(sp.price_per_unit);
        const priceBaseQuantity = normalizePriceBaseQuantity(sp.price_base_quantity);
        const priceBaseUnit =
          priceBaseQuantity != null
            ? resolvePriceBaseUnit(sp.price_base_unit, sp.unit_of_measure)
            : null;
        const { subtotal, total } = await computeLineMoney(
          manager,
          order.supplier_id,
          added.productId,
          pricePerUnit,
          quantityToSave,
          priceBaseQuantity,
        );

        const itemInsert = await manager.insert(SupplierOrderItem, {
          order_id: orderId,
          product_id: added.productId,
          supplier_product_id: sp.id,
          quantity: quantityToSave,
          price_per_unit: pricePerUnit,
          price_base_quantity: priceBaseQuantity,
          price_base_unit: priceBaseUnit,
          subtotal,
          total,
          received_quantity: 0,
          returned_quantity: 0,
          is_original: 0,
          ...(added.variantId != null ? { variant_id: added.variantId } : {}),
        });
        const newItemId = this.resolveInsertId(itemInsert);

        const changePayload = {
          order_id: orderId,
          review_id: reviewId,
          change_type: SupplierOrderItemChangeType.ADDED_BY_WAREHOUSE,
          final_order_item_id: newItemId,
          final_product_id: added.productId,
          original_quantity: 0,
          final_quantity: quantityToSave,
          final_total_weight: quantityToSave,
          ...(added.units != null ? { final_units: added.units } : {}),
          ...(added.variantId != null ? { final_variant_id: added.variantId } : {}),
          ...(added.variantLabel != null && added.variantLabel !== ''
            ? { final_variant_label: added.variantLabel }
            : {}),
        };
        await this.insertOrderItemChangeRaw(manager, {
          ...changePayload,
          created_at: changeTs,
          updated_at: changeTs,
        });
      }

      const allItems = await manager.find(SupplierOrderItem, {
        where: { order_id: orderId },
      });
      let totalAmount = 0;
      let totalAmountWithVat = 0;
      for (const line of allItems) {
        const lineAvailability = (line as any).availability_status || 'available';
        if (lineAvailability === 'unavailable') continue;
        totalAmount += Number(line.subtotal);
        totalAmountWithVat += Number(line.total ?? line.subtotal);
      }
      const totals = { total_amount: totalAmount, total_amount_with_vat: totalAmountWithVat };

      await manager.update(SupplierOrder, { id: orderId }, {
        total_amount: totalAmount,
        total_amount_with_vat: totalAmountWithVat,
        status: OrderStatus.RETURNED_TO_SUPPLIER,
      });

      const updated = await manager.findOne(SupplierOrder, {
        where: { id: orderId },
        relations: ['items', 'supplier'],
      });
      if (updated) {
        await this.attachOrderChangesArray([updated], manager);
      }
      return updated as SupplierOrder;
    });
  }

  private resolveInsertId(result: InsertResult): number {
    const ids = result.identifiers;
    if (ids?.length) {
      const row = ids[0] as Record<string, unknown>;
      const v = row.id ?? row.Id;
      if (v != null && v !== '') {
        return Number(v);
      }
    }
    const raw = result.raw as { insertId?: number | bigint } | undefined;
    if (raw && raw.insertId != null) {
      return Number(raw.insertId);
    }
    if (Array.isArray(result.raw) && result.raw.length > 0) {
      const first = result.raw[0] as { insertId?: number | bigint };
      if (first?.insertId != null) {
        return Number(first.insertId);
      }
    }
    throw new Error('Nu s-a putut determina id-ul înregistrării create');
  }

  /**
   * Inserează rând în `supplier_order_item_changes`.
   * Nu folosi QueryBuilder `.into('supplier_order_item_changes')`: string-ul se potrivește cu metadata
   * entității și TypeORM omite `order_id` (e doar RelationId lângă `order`), iar MySQL dă
   * "Field 'order_id' doesn't have a default value".
   */
  private async insertOrderItemChangeRaw(
    manager: EntityManager,
    row: Record<string, unknown>,
  ): Promise<void> {
    const orderId = row.order_id;
    const reviewId = row.review_id;
    if (orderId == null || reviewId == null) {
      throw new Error('insertOrderItemChangeRaw: lipsește order_id sau review_id');
    }
    const { order_id: _oid, review_id: _rid, ...rest } = row;
    await manager.insert(SupplierOrderItemChange, {
      ...rest,
      order: { id: Number(orderId) } as SupplierOrder,
      review: { id: Number(reviewId) } as SupplierOrderWarehouseReview,
    } as Partial<SupplierOrderItemChange>);
  }

  /**
   * PAS 1: atașează `changes` (istoric modificări magazioner) pe fiecare comandă, sortat după created_at.
   * Nu folosim relația `itemChanges` în find-uri (evită join-uri duplicate); încărcăm batch după order_id.
   * `em` opțional: același EntityManager ca într-o tranzacție (ex. warehouseReview) ca să vadă rândurile tocmai inserate.
   */
  private async attachOrderChangesArray(
    orders: SupplierOrder[],
    em?: EntityManager,
  ): Promise<void> {
    if (!orders?.length) {
      return;
    }
    const ids = [
      ...new Set(orders.map((o) => o.id).filter((id) => Number.isFinite(id) && Number(id) > 0)),
    ];
    if (ids.length === 0) {
      return;
    }
    const changeRepo = em
      ? em.getRepository(SupplierOrderItemChange)
      : this.connection.getRepository(SupplierOrderItemChange);
    const all = await changeRepo.find({
      where: { order: { id: In(ids) } },
      order: { created_at: 'ASC', id: 'ASC' },
    });
    const byOrder = new Map<number, SupplierOrderItemChange[]>();
    for (const ch of all) {
      const oid = Number((ch as any).order_id);
      if (!Number.isFinite(oid)) {
        continue;
      }
      const list = byOrder.get(oid) ?? [];
      list.push(ch);
      byOrder.set(oid, list);
    }
    for (const o of orders) {
      (o as SupplierOrder & { changes?: SupplierOrderItemChange[] }).changes = byOrder.get(o.id) ?? [];
    }
  }

  /**
   * Completează câmpurile virtuale de destinație livrare (firmă + adresă locație).
   * Folosit pentru șoferi/magazioneri fără locations.read la locația clientului.
   */
  private async attachOrderDeliveryDetails(orders: SupplierOrder[]): Promise<void> {
    if (!orders?.length) {
      return;
    }

    const companiesUrl =
      this.configService.get<string>('COMPANIES_HTTP_URL') ||
      process.env.COMPANIES_HTTP_URL ||
      'http://localhost:3003';
    const companyNameCache = new Map<number, string>();
    const locationCache = new Map<number, Record<string, unknown>>();

    const fetchCompanyName = async (companyId: number): Promise<string | null> => {
      if (!Number.isFinite(companyId) || companyId <= 0) {
        return null;
      }
      const cached = companyNameCache.get(companyId);
      if (cached) {
        return cached;
      }
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${companiesUrl}/companies/${companyId}`, {
            headers: this.internalServiceHeaders(),
            timeout: 3000,
          }),
        );
        const name =
          response.data?.company_name || response.data?.name || null;
        if (name) {
          companyNameCache.set(companyId, String(name));
        }
        return name ? String(name) : null;
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [attachOrderDeliveryDetails] company ${companyId}: ${error?.message || error}`,
        );
        return null;
      }
    };

    await Promise.all(
      orders.map(async (order) => {
        const rawLocId =
          order.location_id != null && Number(order.location_id) > 0
            ? Number(order.location_id)
            : order.supplier_location_id != null &&
                Number(order.supplier_location_id) > 0
              ? Number(order.supplier_location_id)
              : null;

        if (rawLocId != null) {
          let location = locationCache.get(rawLocId);
          if (!location) {
            const fetched = await this.fetchLocation(rawLocId);
            if (fetched && typeof fetched === 'object') {
              location = fetched as Record<string, unknown>;
              locationCache.set(rawLocId, location);
            }
          }

          if (location) {
            const locName = location.location_name ?? location.name;
            if (locName != null && String(locName).trim()) {
              order.location_name = String(locName);
            }
            if (location.address != null && String(location.address).trim()) {
              order.location_address = String(location.address);
            }
            if (location.city != null && String(location.city).trim()) {
              order.location_city = String(location.city);
            }
            if (location.county != null && String(location.county).trim()) {
              order.location_county = String(location.county);
            }
            if (location.postal_code != null && String(location.postal_code).trim()) {
              order.location_postal_code = String(location.postal_code);
            }
            if (location.country != null && String(location.country).trim()) {
              order.location_country = String(location.country);
            }

            const locCompanyId = Number(location.company_id);
            if (
              !Number.isFinite(Number(order.company_id)) &&
              Number.isFinite(locCompanyId) &&
              locCompanyId > 0
            ) {
              order.company_id = locCompanyId;
            }
          }
        }

        const companyId = Number(order.company_id);
        if (
          Number.isFinite(companyId) &&
          companyId > 0 &&
          !order.company_name
        ) {
          const name = await fetchCompanyName(companyId);
          if (name) {
            order.company_name = name;
          }
        }
      }),
    );
  }

  /**
   * VAL 4: employee belongs to tenant via default location or employees_locations
   * in a work_location owned by JWT company_id.
   */
  private async assertEmployeeBelongsToTenantCompany(
    employeeId: number,
    user?: OrderRequesterUser,
  ): Promise<void> {
    if (!user || isPlatformOrderRequester(user)) {
      return;
    }
    const companyId = resolveOrderTenantCompanyId(user);
    if (companyId == null) {
      throw new ForbiddenException(
        'Compania utilizatorului nu este determinată',
      );
    }

    const employeesDbName =
      this.configService.get<string>('EMPLOYEES_DB_NAME') ||
      process.env.EMPLOYEES_DB_NAME ||
      'giurombitap_employees';
    const locationsDbName =
      this.configService.get<string>('LOCATIONS_DB_NAME') ||
      process.env.LOCATIONS_DB_NAME ||
      'giurombitap_locations';

    const locationRows: Array<{ id: number }> = await this.connection.query(
      `SELECT id FROM \`${locationsDbName}\`.work_location WHERE company_id = ?`,
      [companyId],
    );
    const locationIds = locationRows
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (locationIds.length === 0) {
      throw new ForbiddenException(
        'Angajatul nu aparține companiei dumneavoastră',
      );
    }

    const locPlaceholders = locationIds.map(() => '?').join(',');
    const sql = `
      SELECT e.id
      FROM \`${employeesDbName}\`.employees e
      LEFT JOIN \`${employeesDbName}\`.employees_locations el ON el.employee_id = e.id
      WHERE e.id = ?
        AND (
          e.work_location_default_id IN (${locPlaceholders})
          OR el.id_location IN (${locPlaceholders})
        )
      LIMIT 1
    `;
    const params = [employeeId, ...locationIds, ...locationIds];
    const rows: Array<{ id: number }> = await this.connection.query(sql, params);
    if (!rows?.length) {
      throw new ForbiddenException(
        'Angajatul nu aparține companiei dumneavoastră',
      );
    }
  }

  private async assertOperationalDashboardEmployeeAccess(
    targetEmployeeId: number,
    user?: OrderRequesterUser,
  ): Promise<void> {
    assertOperationalEmployeeDashboardAccess(user, targetEmployeeId);
    if (
      user &&
      !isPlatformOrderRequester(user) &&
      canManageCompanyOperationalEmployees(user)
    ) {
      await this.assertEmployeeBelongsToTenantCompany(targetEmployeeId, user);
    }
  }

  /**
   * VAL 4: operational storekeeper must have an active assignment on the order.
   * Client admin / platform bypass via canManageCompanyOperationalEmployees / isPlatformOrderRequester.
   */
  private async assertStorekeeperOperationalAccess(
    orderId: number,
    user?: OrderRequesterUser,
  ): Promise<void> {
    if (!user || isPlatformOrderRequester(user)) {
      return;
    }
    if (canManageCompanyOperationalEmployees(user)) {
      return;
    }
    const employeeId = resolveOrderActorUserId(user);
    if (employeeId == null) {
      throw new ForbiddenException(
        'Nu aveți permisiunea de a efectua această acțiune pe comandă',
      );
    }
    const assignment = await this.orderAssignmentRepo.findOne({
      where: {
        supplier_order_id: orderId,
        employee_id: employeeId,
        status: In([
          SupplierOrderAssignmentStatus.ASSIGNED,
          SupplierOrderAssignmentStatus.IN_PROGRESS,
        ]),
      },
    });
    if (!assignment) {
      throw new ForbiddenException(
        'Nu aveți o atribuire activă pentru această comandă',
      );
    }
  }

  private async assertSupplierStaffListAccess(
    supplierId: number,
    user?: OrderRequesterUser,
  ): Promise<void> {
    if (!user || isPlatformOrderRequester(user)) {
      return;
    }
    const requester = buildSupplierAccessRequester(user);
    const companyType = resolveCompanyTypeFromAuth(
      requester.company_type,
      requester.roles,
    );
    if (companyType === 'furnizor') {
      const my = await this.findMySupplierForFurnizorTenant(
        requester.company_id ?? 0,
        requester.company_type,
      );
      if (my.id !== supplierId) {
        throw new ForbiddenException(
          'Nu puteți accesa personalul altui furnizor',
        );
      }
      return;
    }
    const clientCompanyId = resolveOrderTenantCompanyId(user);
    if (clientCompanyId == null) {
      throw new ForbiddenException(
        'Compania utilizatorului nu este determinată',
      );
    }
    await this.assertClientSupplierRelationship(clientCompanyId, supplierId, {
      requireOperationalActive: false,
      requireAccessibleQuota: true,
    });
  }

  async createOrderAssignment(
    supplierOrderId: number,
    dto: CreateSupplierOrderAssignmentDto,
    createdByUserId?: number,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrderAssignment> {
    const orderForGuard = await this.findOrderForRequester(supplierOrderId, user);
    await this.assertSupplierAccountRequiredForTenantAction(
      orderForGuard.supplier_id,
      'atribuire magazioner',
    );
    await this.assertEmployeeBelongsToTenantCompany(dto.employee_id, user);
    const warehouseLink = await this.employeeSupplierRepo.findOne({
      where: {
        employee_id: dto.employee_id,
        supplier_id: orderForGuard.supplier_id,
        role: 'warehouse',
      },
    });
    if (!warehouseLink) {
      throw new BadRequestException(
        'Angajatul nu este magazioner pentru acest furnizor',
      );
    }
    return this.connection.transaction(async (manager) => {
      const order = await manager.findOne(SupplierOrder, {
        where: { id: supplierOrderId },
      });
      if (!order) {
        throw new NotFoundException('Comanda nu a fost găsită');
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException('Comanda este anulată');
      }

      const assignment = manager.create(SupplierOrderAssignment, {
        supplier_order_id: supplierOrderId,
        employee_id: dto.employee_id,
        notes: dto.notes,
        status: SupplierOrderAssignmentStatus.ASSIGNED,
        assigned_at: new Date(),
        ...(createdByUserId != null && { created_by_user_id: createdByUserId }),
      });
      const saved = await manager.save(SupplierOrderAssignment, assignment);

      order.status = OrderStatus.MAGAZIONER;
      await manager.save(SupplierOrder, order);

      return saved;
    });
  }

  async approveOrderAssignment(
    assignmentId: number,
    _approverUserId?: number,
  ): Promise<SupplierOrderAssignment> {
    throw new NotImplementedException('approveOrderAssignment not implemented yet');
  }

  async createDriverAssignment(
    orderId: number,
    dto: CreateSupplierOrderDriverAssignmentDto,
    assignedByUserId?: number,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrderDriverAssignment> {
    const orderForGuard = await this.findOrderForRequester(orderId, user);
    await this.assertSupplierAccountRequiredForTenantAction(
      orderForGuard.supplier_id,
      'atribuire șofer',
    );
    return this.connection.transaction(async (manager) => {
      const order = await manager.findOne(SupplierOrder, { where: { id: orderId } });
      if (!order) {
        throw new NotFoundException('Comanda nu a fost găsită');
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Comanda este anulată');
      }
      if (order.status !== OrderStatus.CONFIRMED) {
        throw new BadRequestException(
          `Atribuirea șoferului este permisă doar pentru comenzi confirmate (status curent: ${order.status}).`,
        );
      }

      const driverLink = await manager.findOne(EmployeeSupplier, {
        where: {
          supplier_id: order.supplier_id,
          employee_id: dto.driver_id,
          role: 'driver',
        },
      });
      if (!driverLink) {
        throw new BadRequestException('Șoferul nu este asociat acestui furnizor');
      }

      const scheduledAt = new Date(dto.scheduled_at);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new BadRequestException('Data programării nu este validă');
      }

      const deliveryPriority = Number(dto.delivery_priority);
      if (!Number.isInteger(deliveryPriority) || deliveryPriority < 1) {
        throw new BadRequestException('Prioritatea de livrare trebuie să fie un număr întreg pozitiv');
      }

      // Calendar day for priority uniqueness / sort — not the clock time on scheduled_at.
      const deliveryDate = this.deriveDeliveryDateFromScheduledAt(
        scheduledAt,
        dto.scheduled_at,
      );

      const priorityConflict = await manager.findOne(SupplierOrderDriverAssignment, {
        where: {
          driver_id: dto.driver_id,
          delivery_date: this.parseDeliveryDateOnly(deliveryDate),
          delivery_priority: deliveryPriority,
        },
      });
      if (priorityConflict) {
        throw new ConflictException(
          `Prioritatea ${deliveryPriority} este deja folosită pentru acest șofer în data ${deliveryDate}.`,
        );
      }

      const active = await manager.findOne(SupplierOrderDriverAssignment, {
        where: {
          supplier_order_id: orderId,
          status: SupplierOrderDriverAssignmentStatus.ASSIGNED,
        },
      });
      if (active) {
        throw new BadRequestException('Există deja o atribuire șofer activă pentru această comandă');
      }

      const row = manager.create(SupplierOrderDriverAssignment, {
        supplier_order_id: orderId,
        driver_id: dto.driver_id,
        scheduled_at: scheduledAt,
        delivery_date: this.parseDeliveryDateOnly(deliveryDate),
        delivery_priority: deliveryPriority,
        notes: dto.notes,
        status: SupplierOrderDriverAssignmentStatus.ASSIGNED,
        ...(assignedByUserId != null &&
        Number.isFinite(Number(assignedByUserId)) &&
        Number(assignedByUserId) > 0
          ? { assigned_by_user_id: Number(assignedByUserId) }
          : {}),
      });

      let saved: SupplierOrderDriverAssignment;
      try {
        saved = await manager.save(SupplierOrderDriverAssignment, row);
      } catch (err: unknown) {
        if (this.isDuplicateDriverPriorityError(err)) {
          throw new ConflictException(
            `Prioritatea ${deliveryPriority} este deja folosită pentru acest șofer în data ${deliveryDate}.`,
          );
        }
        throw err;
      }

      order.status = OrderStatus.SOFER;
      await manager.save(SupplierOrder, order);

      return saved;
    });
  }

  async getDriverUsedPriorities(
    driverId: number,
    deliveryDate: string,
    user?: OrderRequesterUser,
  ): Promise<{ driver_id: number; delivery_date: string; used_priorities: number[] }> {
    await this.assertOperationalDashboardEmployeeAccess(driverId, user);
    if (!Number.isFinite(driverId) || driverId < 1) {
      throw new BadRequestException('ID șofer invalid');
    }
    const normalizedDate = String(deliveryDate ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      throw new BadRequestException('delivery_date trebuie să fie în formatul YYYY-MM-DD');
    }

    const rows = await this.connection.getRepository(SupplierOrderDriverAssignment).find({
      where: {
        driver_id: driverId,
        delivery_date: this.parseDeliveryDateOnly(normalizedDate),
        delivery_priority: Not(IsNull()),
      },
      select: ['delivery_priority'],
    });

    const used_priorities = [
      ...new Set(
        rows
          .map((row) => Number(row.delivery_priority))
          .filter((value) => Number.isInteger(value) && value >= 1),
      ),
    ].sort((a, b) => a - b);

    return {
      driver_id: driverId,
      delivery_date: normalizedDate,
      used_priorities,
    };
  }

  async getDriverAssignments(
    driverId: number,
    locationId?: number,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrderDriverAssignment[]> {
    const { rows } = await this.queryDriverAssignmentsForDashboard(
      driverId,
      locationId,
      undefined,
      undefined,
      user,
    );
    return rows;
  }

  async getDriverAssignmentsPaginated(
    driverId: number,
    locationId: number | undefined,
    pageRaw?: string | number,
    limitRaw?: string | number,
    user?: OrderRequesterUser,
  ): Promise<PaginatedOrdersResponse<SupplierOrderDriverAssignment>> {
    const { page, limit } = normalizeOrdersPagination(pageRaw, limitRaw);
    const { rows, total } = await this.queryDriverAssignmentsForDashboard(
      driverId,
      locationId,
      page,
      limit,
      user,
    );
    return buildOrdersPaginatedResponse(rows, page, limit, total);
  }

  private async queryDriverAssignmentsForDashboard(
    driverId: number,
    locationId?: number,
    page?: number,
    limit?: number,
    user?: OrderRequesterUser,
  ): Promise<{ rows: SupplierOrderDriverAssignment[]; total: number }> {
    await this.assertOperationalDashboardEmployeeAccess(driverId, user);
    const repo = this.connection.getRepository(SupplierOrderDriverAssignment);
    const lid =
      locationId != null && Number.isFinite(locationId) && locationId > 0
        ? locationId
        : undefined;

    const applyFilters = (qb: ReturnType<typeof repo.createQueryBuilder>) => {
      qb.where('da.driver_id = :driverId', { driverId }).andWhere(
        'da.status IN (:...statuses)',
        {
          statuses: [
            SupplierOrderDriverAssignmentStatus.ASSIGNED,
            SupplierOrderDriverAssignmentStatus.ARRIVED,
            SupplierOrderDriverAssignmentStatus.DONE,
          ],
        },
      );
      if (lid !== undefined) {
        qb.andWhere(
          '(order.location_id = :lid OR order.supplier_location_id = :lid)',
          { lid },
        );
      }
      applyOrderListTenantScopeToQueryBuilder(qb, user, 'order');
      return qb;
    };

    const countQb = applyFilters(
      repo
        .createQueryBuilder('da')
        .innerJoin('da.order', 'order'),
    );
    const total = await countQb.getCount();

    const idQb = applyFilters(
      repo.createQueryBuilder('da').innerJoin('da.order', 'order'),
    )
      .select('da.id', 'id')
      .orderBy('da.delivery_date', 'DESC')
      .addOrderBy('da.delivery_priority', 'ASC')
      .addOrderBy('da.scheduled_at', 'ASC')
      .addOrderBy('da.id', 'DESC');

    if (page != null && limit != null) {
      idQb.offset((page - 1) * limit).limit(limit);
    }

    const idRows = await idQb.getRawMany();
    const assignmentIds = idRows
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (assignmentIds.length === 0) {
      return { rows: [], total };
    }

    const rowsUnsorted = await applyFilters(
      repo
        .createQueryBuilder('da')
        .innerJoinAndSelect('da.order', 'order')
        .leftJoinAndSelect('order.supplier', 'supplier')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('order.driverAssignments', 'driverAssignments'),
    )
      .andWhere('da.id IN (:...assignmentIds)', { assignmentIds })
      .getMany();

    const rowById = new Map(rowsUnsorted.map((r) => [r.id, r]));
    const rows = assignmentIds
      .map((id) => rowById.get(id))
      .filter((r): r is SupplierOrderDriverAssignment => !!r);

    const drvOrders = rows.map((da) => da.order).filter((o): o is SupplierOrder => !!o);
    await this.attachOrderChangesArray(drvOrders);
    await this.attachOrderDeliveryDetails(drvOrders);

    if (page == null || limit == null) {
      return {
        rows: this.sortDriverAssignmentsForDashboard(rows),
        total,
      };
    }
    return { rows, total };
  }

  private deriveDeliveryDateFromScheduledAt(
    scheduledAt: Date,
    rawScheduledAt?: string,
  ): string {
    const raw = String(rawScheduledAt ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
    return scheduledAt.toISOString().slice(0, 10);
  }

  private parseDeliveryDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private isDuplicateDriverPriorityError(err: unknown): boolean {
    if (!err || typeof err !== 'object') {
      return false;
    }
    const code = (err as { code?: string }).code;
    const errno = (err as { errno?: number }).errno;
    return code === 'ER_DUP_ENTRY' || errno === 1062;
  }

  private sortDriverAssignmentsForDashboard(
    list: SupplierOrderDriverAssignment[],
  ): SupplierOrderDriverAssignment[] {
    const deliveryDateKey = (assignment: SupplierOrderDriverAssignment): string => {
      if (assignment.delivery_date) {
        const raw =
          assignment.delivery_date instanceof Date
            ? assignment.delivery_date.toISOString()
            : String(assignment.delivery_date);
        return raw.slice(0, 10);
      }
      if (assignment.scheduled_at) {
        const scheduled = new Date(assignment.scheduled_at);
        if (!Number.isNaN(scheduled.getTime())) {
          return scheduled.toISOString().slice(0, 10);
        }
      }
      if (assignment.order?.delivery_date) {
        const orderDelivery = new Date(assignment.order.delivery_date);
        if (!Number.isNaN(orderDelivery.getTime())) {
          return orderDelivery.toISOString().slice(0, 10);
        }
      }
      return '';
    };

    return [...list].sort((a, b) => {
      const dateA = deliveryDateKey(a);
      const dateB = deliveryDateKey(b);
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      const priorityA = a.delivery_priority;
      const priorityB = b.delivery_priority;
      const nullA =
        priorityA == null || !Number.isFinite(Number(priorityA));
      const nullB =
        priorityB == null || !Number.isFinite(Number(priorityB));
      if (nullA !== nullB) {
        return nullA ? 1 : -1;
      }
      if (!nullA && !nullB && priorityA !== priorityB) {
        return Number(priorityA) - Number(priorityB);
      }

      const scheduledA = new Date(a.scheduled_at).getTime();
      const scheduledB = new Date(b.scheduled_at).getTime();
      if (scheduledA !== scheduledB) {
        return scheduledA - scheduledB;
      }

      return a.id - b.id;
    });
  }

  async completeDriverAssignment(
    assignmentId: number,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrderDriverAssignment> {
    const existing = await this.connection.getRepository(SupplierOrderDriverAssignment).findOne({
      where: { id: assignmentId },
    });
    if (!existing) {
      throw new NotFoundException('Atribuirea nu a fost găsită');
    }
    assertDriverSelfOrOperationalAdmin(user, Number(existing.driver_id));
    await this.findOrderForRequester(existing.supplier_order_id, user);
    return this.connection.transaction(async (manager) => {
      const da = await manager.findOne(SupplierOrderDriverAssignment, {
        where: { id: assignmentId },
        relations: ['order'],
      });
      if (!da) {
        throw new NotFoundException('Atribuirea nu a fost găsită');
      }
      if (da.status === SupplierOrderDriverAssignmentStatus.DONE) {
        return da;
      }
      if (da.status === SupplierOrderDriverAssignmentStatus.ASSIGNED) {
        throw new BadRequestException(
          'Confirmați mai întâi „Ajuns în locație” înainte de finalizarea livrării',
        );
      }
      da.status = SupplierOrderDriverAssignmentStatus.DONE;
      await manager.save(SupplierOrderDriverAssignment, da);

      /**
       * Nu setăm DELIVERED aici: în fluxul cu recepții, DELIVERED înseamnă „recepție completă”
       * (vezi approveReceptions). markOrderAsPartiallyReceived refuză comenzile DELIVERED.
       * Comanda rămâne SOFER până la recepție; recepția parțială creează PENDING, apoi DELIVERED la aprobare completă.
       */

      return da;
    });
  }

  /**
   * GIU-10: șoferul atribuit confirmă sosirea la client.
   * Idempotent: dacă e deja arrived/done → returnează fără modificare.
   */
  async markDriverAssignmentArrived(
    assignmentId: number,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrderDriverAssignment> {
    const repo = this.connection.getRepository(SupplierOrderDriverAssignment);
    const existing = await repo.findOne({ where: { id: assignmentId } });
    if (!existing) {
      throw new NotFoundException('Atribuirea nu a fost găsită');
    }

    const order = await this.findOrderForRequester(existing.supplier_order_id, user);
    if (order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Comanda este anulată');
    }
    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.RECEIVED
    ) {
      throw new ConflictException('Comanda este deja recepționată / livrată');
    }

    const actorEmployeeId = resolveOrderActorUserId(user);
    if (
      actorEmployeeId == null ||
      Number(existing.driver_id) !== Number(actorEmployeeId)
    ) {
      throw new ForbiddenException(
        'Doar șoferul atribuit poate confirma „Ajuns în locație”',
      );
    }

    if (
      existing.status === SupplierOrderDriverAssignmentStatus.ARRIVED ||
      existing.status === SupplierOrderDriverAssignmentStatus.DONE
    ) {
      return existing;
    }

    existing.status = SupplierOrderDriverAssignmentStatus.ARRIVED;
    return repo.save(existing);
  }

  /**
   * GIU-10: clientul poate recepționa/anula doar după sosirea șoferului
   * (assignment arrived|done) sau dacă comanda e deja delivered/received.
   * Excepție: furnizor fără cont autentificabil — nu există pas șofer pe flow.
   */
  private async assertDriverArrivedForClientActions(
    orderId: number,
    orderStatus?: OrderStatus,
    supplierId?: number,
  ): Promise<void> {
    if (
      orderStatus === OrderStatus.DELIVERED ||
      orderStatus === OrderStatus.RECEIVED
    ) {
      return;
    }

    let resolvedSupplierId = Number(supplierId);
    if (!Number.isFinite(resolvedSupplierId) || resolvedSupplierId <= 0) {
      const order = await this.orderRepo.findOne({
        where: { id: orderId },
        select: ['id', 'supplier_id'],
      });
      resolvedSupplierId = Number(order?.supplier_id);
    }
    if (
      Number.isFinite(resolvedSupplierId) &&
      resolvedSupplierId > 0 &&
      !(await this.hasSupplierLoginAccount(resolvedSupplierId))
    ) {
      return;
    }

    const assignments = await this.connection
      .getRepository(SupplierOrderDriverAssignment)
      .find({ where: { supplier_order_id: orderId } });

    const unlocked = assignments.some((a) => {
      const status = String(a.status).toLowerCase();
      return (
        status === SupplierOrderDriverAssignmentStatus.ARRIVED ||
        status === SupplierOrderDriverAssignmentStatus.DONE ||
        status === 'arrived' ||
        status === 'done'
      );
    });

    if (!unlocked) {
      throw new ForbiddenException(
        'Recepția și anularea sunt disponibile doar după ce șoferul confirmă „Ajuns în locație”.',
      );
    }
  }

  async getStorekeeperAssignments(
    employeeId: number,
    locationId?: number,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrderAssignment[]> {
    const { rows } = await this.queryStorekeeperAssignmentsForDashboard(
      employeeId,
      locationId,
      undefined,
      undefined,
      user,
    );
    return rows;
  }

  async getStorekeeperAssignmentsPaginated(
    employeeId: number,
    locationId: number | undefined,
    pageRaw?: string | number,
    limitRaw?: string | number,
    user?: OrderRequesterUser,
  ): Promise<PaginatedOrdersResponse<SupplierOrderAssignment>> {
    const { page, limit } = normalizeOrdersPagination(pageRaw, limitRaw);
    const { rows, total } = await this.queryStorekeeperAssignmentsForDashboard(
      employeeId,
      locationId,
      page,
      limit,
      user,
    );
    return buildOrdersPaginatedResponse(rows, page, limit, total);
  }

  private async queryStorekeeperAssignmentsForDashboard(
    employeeId: number,
    locationId?: number,
    page?: number,
    limit?: number,
    user?: OrderRequesterUser,
  ): Promise<{ rows: SupplierOrderAssignment[]; total: number }> {
    await this.assertOperationalDashboardEmployeeAccess(employeeId, user);
    const activeStatuses = [
      SupplierOrderAssignmentStatus.ASSIGNED,
      SupplierOrderAssignmentStatus.IN_PROGRESS,
    ];

    const lid =
      locationId != null && Number.isFinite(locationId) && locationId > 0
        ? locationId
        : undefined;

    const applyFilters = (qb: SelectQueryBuilder<SupplierOrderAssignment>) => {
      qb.where('assignment.employee_id = :employeeId', { employeeId }).andWhere(
        'assignment.status IN (:...activeStatuses)',
        { activeStatuses },
      );
      if (lid !== undefined) {
        qb.andWhere(
          '(order.location_id = :lid OR order.supplier_location_id = :lid)',
          { lid },
        );
      }
      applyOrderListTenantScopeToQueryBuilder(qb, user, 'order');
      return qb;
    };

    const countQb = applyFilters(
      this.orderAssignmentRepo
        .createQueryBuilder('assignment')
        .innerJoin('assignment.order', 'order'),
    );
    const total = await countQb.getCount();

    const idQb = applyFilters(
      this.orderAssignmentRepo
        .createQueryBuilder('assignment')
        .innerJoin('assignment.order', 'order'),
    )
      .select('assignment.id', 'id')
      .orderBy('assignment.assigned_at', 'DESC')
      .addOrderBy('assignment.id', 'DESC');

    if (page != null && limit != null) {
      idQb.offset((page - 1) * limit).limit(limit);
    }

    const idRows = await idQb.getRawMany();
    const assignmentIds = idRows
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (assignmentIds.length === 0) {
      return { rows: [], total };
    }

    const assignmentRowsUnsorted = await applyFilters(
      this.orderAssignmentRepo
        .createQueryBuilder('assignment')
        .innerJoinAndSelect('assignment.order', 'order')
        .leftJoinAndSelect('order.supplier', 'supplier')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('order.driverAssignments', 'driverAssignments'),
    )
      .andWhere('assignment.id IN (:...assignmentIds)', { assignmentIds })
      .getMany();

    const rowById = new Map(assignmentRowsUnsorted.map((r) => [r.id, r]));
    const assignmentRows = assignmentIds
      .map((id) => rowById.get(id))
      .filter((r): r is SupplierOrderAssignment => !!r);

    const skOrders = assignmentRows
      .map((a) => a.order)
      .filter((o): o is SupplierOrder => !!o);
    await this.attachOrderChangesArray(skOrders);
    return { rows: assignmentRows, total };
  }

  async updateOrderDeliveryDate(
    orderId: number,
    dto: UpdateOrderDeliveryDateDto,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrder> {
    await this.findOrderForRequester(orderId, user);
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Comanda nu a fost găsită');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Comanda este anulată');
    }
    const next = new Date(dto.delivery_date);
    if (Number.isNaN(next.getTime())) {
      throw new BadRequestException('Data de livrare nu este validă');
    }
    await this.orderRepo.update(orderId, { delivery_date: next });
    const updated = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'supplier', 'documents'],
      relationLoadStrategy: 'query',
    });
    if (!updated) {
      throw new NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
    }
    return updated;
  }

  /**
   * Pe server setează REPO_ROOT=/home/restosoft ca să salvezi în afara giurom-backend/giurom-frontend.
   */
  private getRepoRoot(): string {
    const fromEnv = (process.env.REPO_ROOT || process.env.IMAGES_ROOT || '').trim();
    if (fromEnv) return path.resolve(fromEnv);
    // Try computing from __dirname first
    let repoRoot = path.resolve(__dirname, '../../..'); // src -> suppliers-ms -> giurom-backend -> giurom
    if (path.basename(repoRoot) === 'giurom-backend') {
      // In case resolution ended at giurom-backend due to different runtime path depth
      repoRoot = path.dirname(repoRoot);
    }
    return repoRoot;
  }

  private async createSupplierFolders(supplier: Supplier): Promise<void> {
    // Nu mai creăm directoare pe disk în files/suppliers; documentele nu se salvează fizic aici
  }

  private async createSupplierFoldersWithCustomName(supplier: Supplier, customFolderName?: string, documents?: any[], locationId?: number): Promise<void> {
    try {
      const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
      const repoRoot = this.getRepoRoot();
      
      // Determine the correct base path - location-specific or default
      let basePath: string;
      let supplierDir: string;
      
      if (locationId) {
        // Get location details for location-specific path
        try {
          const location = await this.fetchLocation(locationId);
          if (location) {
            // Get company name for the location
            let companyName = 'UnknownCompany';
            try {
              const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
              const serviceSecret = process.env.SERVICE_SECRET || '';
              
              const response = await firstValueFrom(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
                headers: {
                  'x-internal-service': 'locations',
                  'x-service-secret': serviceSecret,
                  'Content-Type': 'application/json',
                },
                timeout: 3000,
              }));
              
              if (response.data && response.data.company_name) {
                companyName = response.data.company_name;
              }
            } catch (error: any) {
              this.logger.warn(`⚠️ Could not fetch company name for company ID ${location.company_id}:`, error?.message || error);
            }
            
            // Create location-specific path
            const locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
            basePath = `${locationPath}/Furnizori/${supplierNameSimplified}`;
            const locationPathRel = locationPath.startsWith('/') ? locationPath.slice(1) : locationPath;
            supplierDir = path.join(repoRoot, locationPathRel, 'Furnizori', supplierNameSimplified);
            
            this.logger.log(`📍 Using location-specific path for supplier folders: ${basePath}`);
          } else {
            // Even if we can't fetch location details, we still want to use the location-specific structure
            // We'll use a placeholder for company name and location name
            this.logger.warn(`⚠️ Location ${locationId} not found, using placeholder location-specific path`);
            const locationPath = `/files/companies/UnknownCompany/Locații/UnknownLocation`;
            basePath = `${locationPath}/Furnizori/${supplierNameSimplified}`;
            const locationPathRel = locationPath.startsWith('/') ? locationPath.slice(1) : locationPath;
            supplierDir = path.join(repoRoot, locationPathRel, 'Furnizori', supplierNameSimplified);
          }
        } catch (error) {
          this.logger.warn(`⚠️ Error fetching location details, using placeholder location-specific path:`, error);
          const locationPath = `/files/companies/UnknownCompany/Locații/UnknownLocation`;
          basePath = `${locationPath}/Furnizori/${supplierNameSimplified}`;
          const locationPathRel = locationPath.startsWith('/') ? locationPath.slice(1) : locationPath;
          supplierDir = path.join(repoRoot, locationPathRel, 'Furnizori', supplierNameSimplified);
        }
      } else {
        // Default path for non-location-bound suppliers – nu mai creăm nimic pe disk în files/suppliers
        basePath = `/files/suppliers/${supplierNameSimplified}`;
        supplierDir = path.join(repoRoot, 'files', 'suppliers', supplierNameSimplified);
      }
      
      this.logger.log(`📁 Creating supplier folders with custom name for: ${supplier.supplier_name} (${supplierNameSimplified})`);
      this.logger.log(`📁 Base path: ${basePath}`);
      
      // Creăm directoare pe disk doar pentru calea locație (files/companies/.../Furnizori); nu pentru files/suppliers
      const isUnderFilesSuppliers = basePath.startsWith('/files/suppliers/');
      if (!isUnderFilesSuppliers) {
        const dirToCreate = path.dirname(supplierDir);
        if (!fs.existsSync(dirToCreate)) {
          fs.mkdirSync(dirToCreate, { recursive: true });
        }
        if (!fs.existsSync(supplierDir)) {
          fs.mkdirSync(supplierDir, { recursive: true });
        }
      }
      
      this.logger.log(`✅ Folder structure created successfully for supplier ${supplier.id}`);

      const documentFolderName = customFolderName || 'Folder pentru documente și contracte';
      const folders = [
        { supplier_id: supplier.id, description: documentFolderName, folder_path: `${basePath}/` },
      ];
      const savedFolders: SupplierFolder[] = [];
      for (const folderData of folders) {
        const folder = this.folderRepo.create(folderData);
        const savedFolder = await this.folderRepo.save(folder);
        savedFolders.push(savedFolder);
      }
      
      // Scriem fișiere pe disk doar pentru calea locație (files/companies/...); nu pentru files/suppliers
      if (documents && documents.length > 0 && savedFolders[0] && !isUnderFilesSuppliers) {
        const documentFolder = savedFolders[0];
        const supplierSubfolders = [
          'Certificat de Înregistrare furnizor', 'Certificat Fiscal furnizor', 'Act Constitutiv furnizor',
          'Contract furnizare / prestări servicii', 'Acte adiționale', 'Acord GDPR', 'Comenzi (PO)',
          'Confirmări de comandă', 'Recepții totale', 'Recepții parțiale', 'Facturi', 'Dovezi de plată',
          'Procese verbale neconformitate', 'Oferte comerciale', 'Corespondență', 'Alte documente'
        ];
        for (const doc of documents) {
          try {
            const fileName = doc.fileName || doc.name;
            const timestamp = Date.now();
            const uniqueFileName = `${timestamp}_${fileName}`;
            const firstSubfolder = supplierSubfolders[0];
            const filePath = path.join(supplierDir, firstSubfolder, uniqueFileName);
            if (doc.content && doc.content.startsWith('data:')) {
              const base64Data = doc.content.split(',')[1];
              const buffer = Buffer.from(base64Data, 'base64');
              fs.writeFileSync(filePath, buffer);
            } else {
              const fileContent = `Document: ${fileName}\nNote: ${doc.note || doc.notes || ''}\nUpload: ${new Date().toISOString()}\nFurnizor: ${supplier.supplier_name}`;
              fs.writeFileSync(filePath, fileContent, 'utf8');
            }
            const documentData = {
              folder_id: documentFolder.id,
              document_type: DocumentType.OTHER,
              file_name: fileName,
              file_path: `${basePath}/${firstSubfolder}/${uniqueFileName}`,
              notes: doc.note || doc.notes || '',
            };
            const document = this.supplierDocumentRepo.create(documentData);
            await this.supplierDocumentRepo.save(document);
          } catch (error) {
            this.logger.error(`❌ Error creating document: ${error}`);
          }
        }
      } else if (documents && documents.length > 0 && savedFolders[0] && isUnderFilesSuppliers) {
        const documentFolder = savedFolders[0];
        for (const doc of documents) {
          try {
            const fileName = doc.fileName || doc.name;
            const document = this.supplierDocumentRepo.create({
              folder_id: documentFolder.id,
              document_type: DocumentType.OTHER,
              file_name: fileName,
              file_path: `${basePath}/Alte documente/${fileName}`,
              notes: doc.note || doc.notes || '',
            });
            await this.supplierDocumentRepo.save(document);
          } catch (error) {
            this.logger.error(`❌ Error creating document record: ${error}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error creating folder structure for supplier ${supplier.id}:`, error);
    }
  }

  private simplifySupplierName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 50);
  }

  /** Mapează cheile DTO furnizor la etichete în română pentru notificare „ce s-a modificat”. */
  private getSupplierFieldLabelsRo(keys: string[]): string {
    const labels: Record<string, string> = {
      supplier_name: 'Denumire',
      registration_number: 'Nr. înregistrare',
      vat_number: 'CUI',
      address: 'Adresă',
      city: 'Oraș',
      region: 'Județ/Regiune',
      country: 'Țara',
      postal_code: 'Cod poștal',
      phone: 'Telefon',
      email: 'Email',
      contact_person: 'Persoană de contact',
      bank_name: 'Bancă',
      bank_account_number: 'Cont bancar',
      is_active: 'Activ',
    };
    return keys.map((k) => labels[k] ?? k).join(', ');
  }

  async serveDocument(fileId: number, forceDownload: boolean): Promise<{ data: string; mimeType: string; fileName: string; disposition: 'inline' | 'attachment' }> {
    const document = await this.supplierDocumentRepo.findOne({ where: { id: fileId } });
    if (!document) {
      this.logger.warn(`Document with ID ${fileId} not found in database`);
      throw new NotFoundException('Documentul nu a fost găsit');
    }
    
    this.logger.log(`📄 Serving document ID: ${fileId}, Name: ${document.file_name}, Path: ${document.file_path}`);
    
    // Handle both old and new path structures
    let filePathToUse = document.file_path;
    this.logger.log(`📄 Original file path: ${document.file_path}`);
    
    if (document.file_path.includes('/suppliers/')) {
      // Extract supplier ID and name from the path
      const pathParts = document.file_path.split('/');
      const suppliersIndex = pathParts.indexOf('suppliers');
      if (suppliersIndex !== -1 && pathParts.length > suppliersIndex + 2) {
        // Check if the path follows the old structure (with ID)
        const possibleId = pathParts[suppliersIndex + 1];
        if (!isNaN(Number(possibleId))) {
          // This is the old structure with ID, we need to remove the ID part
          const supplierName = pathParts[suppliersIndex + 2];
          filePathToUse = `/files/suppliers/${supplierName}/${pathParts.slice(suppliersIndex + 3).join('/')}`;
          this.logger.log(`📄 Converting old path structure to new: ${filePathToUse}`);
        }
      }
    }
    
    const repoRoot = this.getRepoRoot();
    const filePathRel = (filePathToUse.startsWith('/files') ? filePathToUse : `/files${filePathToUse}`).replace(/^\//, '');
    const absolutePath = path.join(repoRoot, filePathRel);
    this.logger.log(`📄 Absolute file path: ${absolutePath}`);
    
    // If file is not found at the specified path, check in subfolders
    if (!fs.existsSync(absolutePath)) {
      this.logger.log(`📁 File not found at specified path, checking subfolders`);
      
      // Extract the directory path without the filename
      const dirPath = path.dirname(absolutePath);
      const fileName = path.basename(absolutePath);
      
      // If the directory exists, check its subfolders
      if (fs.existsSync(dirPath)) {
        const subfolders = fs.readdirSync(dirPath).filter(item => 
          fs.statSync(path.join(dirPath, item)).isDirectory()
        );
        
        // Check each subfolder for the file
        for (const subfolder of subfolders) {
          const possiblePath = path.join(dirPath, subfolder, fileName);
          if (fs.existsSync(possiblePath)) {
            const newAbsolutePath = possiblePath;
            this.logger.log(`📁 File found in subfolder ${subfolder}: ${newAbsolutePath}`);
            
            // Update the file path in the document record for future requests
            try {
              const relativePath = newAbsolutePath.replace(repoRoot, '').replace(/\\/g, '/');
              document.file_path = relativePath.startsWith('/files') ? relativePath : `/files${relativePath}`;
              await this.supplierDocumentRepo.save(document);
              this.logger.log(`✅ Updated document file path in database: ${document.file_path}`);
            } catch (saveError) {
              this.logger.warn(`⚠️ Failed to update document file path in database:`, saveError);
            }
            
            // Check if the path is a file, not a directory
            const stats = fs.statSync(newAbsolutePath);
            if (stats.isDirectory()) {
              this.logger.error(`❌ Attempted to read directory as file: ${newAbsolutePath}`);
              throw new BadRequestException('EISDIR: illegal operation on a directory, read');
            }
            
            const buffer = fs.readFileSync(newAbsolutePath);
            const fileExt = document.file_name.split('.').pop()?.toLowerCase() || '';
            const mimeMap: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' };
            const mimeType = mimeMap[fileExt] || 'application/octet-stream';
            const disposition: 'inline' | 'attachment' = forceDownload ? 'attachment' : 'inline';
            
            this.logger.log(`✅ Successfully read file: ${document.file_name} (${buffer.length} bytes)`);
            return { data: buffer.toString('base64'), mimeType, fileName: document.file_name, disposition };
          }
        }
      }
    }
    
    if (!fs.existsSync(absolutePath)) {
      this.logger.error(`❌ File not found on disk: ${absolutePath}`);
      this.logger.error(`📄 Database path was: ${document.file_path}`);
      this.logger.error(`📄 Computed path was: ${filePathToUse}`);
      throw new NotFoundException('Fișierul nu a fost găsit pe disk');
    }
    
    // Check if the path is a file, not a directory
    const stats = fs.statSync(absolutePath);
    if (stats.isDirectory()) {
      this.logger.error(`❌ Attempted to read directory as file: ${absolutePath}`);
      throw new BadRequestException('EISDIR: illegal operation on a directory, read');
    }
    
    const buffer = fs.readFileSync(absolutePath);
    const fileExt = document.file_name.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' };
    const mimeType = mimeMap[fileExt] || 'application/octet-stream';
    const disposition: 'inline' | 'attachment' = forceDownload ? 'attachment' : 'inline';
    
    this.logger.log(`✅ Successfully read file: ${document.file_name} (${buffer.length} bytes)`);
    return { data: buffer.toString('base64'), mimeType, fileName: document.file_name, disposition };
  }

  async findAll(
    locationId: number,
    requester?: SupplierAccessRequester,
  ): Promise<Supplier[]> {
    this.logger.log(`[SUPPLIERS SERVICE] findAll called with locationId=${locationId}`);
    if (isTenantScopedSupplierRequester(requester)) {
      await this.assertLocationBelongsToRequesterCompany(locationId, requester!);
    }
    // location_id este OBLIGATORIU
    const queryBuilder = this.supplierRepo.createQueryBuilder('supplier')
      .leftJoinAndSelect('supplier.folders', 'folders')
      .leftJoinAndSelect('supplier.orders', 'orders')
      .innerJoin('supplier_locations', 'sl', 'sl.supplier_id = supplier.id')
      .where('sl.id_location = :locationId', { locationId })
      .orderBy('supplier.created_at', 'DESC');
    
    try {
      const suppliers = await queryBuilder.getMany();
      this.logger.log(`[SUPPLIERS SERVICE] findAll returned ${suppliers.length} suppliers for locationId=${locationId}`);
      return suppliers;
    } catch (error) {
      this.logger.error(`[SUPPLIERS SERVICE] findAll failed for locationId=${locationId}:`, (error as any)?.message || error, (error as any)?.stack);
      throw error;
    }
  }

  /**
   * Dropdown comenzi noi: același scope tenant ca /catalog.
   * Pentru tenant client: eligibilitate per-client (link.is_active / manual state),
   * nu suppliers.is_active global pentru Manual.
   * Manual și Cont sunt deja filtrați în findCatalog (asociere la nivel de companie);
   * locația de livrare se validează la createOrder, nu în dropdown.
   */
  async findForOrders(
    _locationId?: number,
    requester?: SupplierAccessRequester,
  ): Promise<
    Array<{
      id: number;
      supplier_name: string;
      phone: string | null;
      has_supplier_account: boolean;
    }>
  > {
    const tenantScoped = isTenantScopedSupplierRequester(requester);
    const rows = await this.findCatalog(
      tenantScoped ? {} : { is_active: true },
      requester,
    );
    let eligible = rows.filter((s) => isSupplierEligibleForNewOrder(s));

    // Cont: company-wide via client_supplier_links (catalog scope).
    // Manual: company association via supplier_locations on any company location (catalog scope).
    // Delivery location is validated at createOrder; do not narrow manual suppliers again here.

    return eligible.map((s) => ({
      id: s.id,
      supplier_name: s.supplier_name,
      phone: s.phone ?? null,
      has_supplier_account: s.has_supplier_account === true,
    }));
  }

  /**
   * Catalog pentru pagina /furnizori (+ reutilizat de for-orders).
   * - Platform-wide: toți furnizorii.
   * - Tenant client:
   *   Manual (`owner_company_id` null) → locații ale companiei requester
   *   Cont (`owner_company_id` set) → doar `client_supplier_links` (fără fallback pe locație)
   * - Tenant furnizor: propriul supplier (`owner_company_id = company_id`) + aceleași reguli client
   * Nu inventează asociere pe owner_company_id pentru alți clienți.
   * assignment.read_company NU e bypass.
   */
  async findCatalog(
    options?: {
      search?: string;
      is_active?: boolean;
    },
    requester?: SupplierAccessRequester,
  ): Promise<
    Array<{
      id: number;
      supplier_name: string;
      registration_number: string;
      vat_number: string;
      address: string;
      city: string;
      region: string;
      country: string;
      postal_code: string;
      phone: string;
      email: string;
      contact_person: string;
      is_active: boolean;
      owner_company_id?: number | null;
      has_supplier_account?: boolean;
      client_association_is_active?: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>
  > {
    const qb = this.supplierRepo
      .createQueryBuilder('supplier')
      .select([
        'supplier.id',
        'supplier.supplier_name',
        'supplier.registration_number',
        'supplier.vat_number',
        'supplier.address',
        'supplier.city',
        'supplier.region',
        'supplier.country',
        'supplier.postal_code',
        'supplier.phone',
        'supplier.email',
        'supplier.contact_person',
        'supplier.is_active',
        'supplier.owner_company_id',
        'supplier.created_at',
        'supplier.updated_at',
      ]);

    if (isTenantScopedSupplierRequester(requester)) {
      const companyId = Number(requester!.company_id);
      const companyLocationIds = await this.fetchCompanyLocationIds(companyId);
      const hasLocations = companyLocationIds.length > 0;

      if (!hasLocations && !(Number.isFinite(companyId) && companyId > 0)) {
        return [];
      }

      // Manual: locations of requester company.
      // Cont: client_supplier_links only (or own owner_company_id for furnizor tenant).
      qb.andWhere(
        `(
          supplier.owner_company_id = :ownCompanyId
          OR (
            (supplier.owner_company_id IS NULL OR supplier.owner_company_id = 0)
            AND ${
              hasLocations
                ? `EXISTS (
                    SELECT 1 FROM supplier_locations sl
                    WHERE sl.supplier_id = supplier.id
                      AND sl.id_location IN (:...companyLocationIds)
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM client_manual_supplier_state cms
                    WHERE cms.supplier_id = supplier.id
                      AND cms.client_company_id = :linkCompanyId
                      AND cms.quota_status = 'removed'
                  )`
                : '0=1'
            }
          )
          OR EXISTS (
            SELECT 1 FROM client_supplier_links csl
            WHERE csl.supplier_id = supplier.id
              AND csl.client_company_id = :linkCompanyId
              AND csl.quota_status <> 'removed'
          )
        )`,
        {
          ownCompanyId: companyId,
          ...(hasLocations ? { companyLocationIds } : {}),
          linkCompanyId: companyId,
        },
      );
    }

    if (options?.is_active !== undefined) {
      qb.andWhere('supplier.is_active = :isActive', {
        isActive: options.is_active,
      });
    }

    const trimmed = (options?.search || '').trim();
    if (trimmed.length > 0) {
      const cuiDigits = normalizeSupplierCuiDigits(trimmed);
      const escaped = trimmed.replace(/[%_]/g, '');
      const likePattern = `%${escaped}%`;

      if (cuiDigits) {
        qb.andWhere(
          `(
            REPLACE(UPPER(supplier.vat_number), 'RO', '') LIKE :cuiDigits
            OR UPPER(supplier.vat_number) LIKE :cuiWithRo
            OR UPPER(supplier.supplier_name) LIKE :nameLike
            OR UPPER(supplier.registration_number) LIKE :nameLike
          )`,
          {
            cuiDigits: `%${cuiDigits}%`,
            cuiWithRo: `%RO${cuiDigits}%`,
            nameLike: likePattern.toUpperCase(),
          },
        );
      } else {
        qb.andWhere(
          `(
            UPPER(supplier.supplier_name) LIKE :nameLike
            OR UPPER(supplier.registration_number) LIKE :nameLike
            OR UPPER(supplier.vat_number) LIKE :nameLike
          )`,
          { nameLike: likePattern.toUpperCase() },
        );
      }
    }

    qb.orderBy('supplier.supplier_name', 'ASC');
    const suppliers = await qb.getMany();
    await this.attachHasSupplierAccountOnSuppliers(suppliers);
    await this.attachClientAssociationActiveOnSuppliers(suppliers, requester);
    await this.attachManualQuotaStatusOnSuppliers(suppliers, requester);
    return suppliers;
  }

  /**
   * Assign a unique connection_code to an account supplier if missing.
   * Manual suppliers (no owner_company_id) never get a code.
   */
  async ensureConnectionCodeForAccountSupplier(
    supplier: Supplier,
  ): Promise<Supplier> {
    const ownerCompanyId = Number(supplier.owner_company_id);
    if (!Number.isFinite(ownerCompanyId) || ownerCompanyId <= 0) {
      return supplier;
    }
    if (
      typeof supplier.connection_code === 'string' &&
      supplier.connection_code.trim().length > 0
    ) {
      return supplier;
    }

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = generateSupplierConnectionCode();
      try {
        await this.supplierRepo.update(
          { id: supplier.id, connection_code: IsNull() },
          { connection_code: code },
        );
        const refreshed = await this.supplierRepo.findOne({
          where: { id: supplier.id },
        });
        if (refreshed?.connection_code) {
          supplier.connection_code = refreshed.connection_code;
          return refreshed;
        }
      } catch (error: any) {
        const msg = String(error?.message || error || '');
        if (/UQ_suppliers_connection_code|Duplicate|ER_DUP_ENTRY/i.test(msg)) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException(
      'Nu s-a putut genera un cod unic de asociere pentru furnizor',
    );
  }

  async getMySupplierConnectionCode(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    roles?: string[] | null,
    options?: {
      workLocationId?: number | null;
      employeeId?: number | null;
    },
  ): Promise<{ supplier_id: number; connection_code: string }> {
    const mySupplier = await this.findMySupplierForFurnizorTenant(
      companyId,
      companyType,
      roles,
      options,
    );
    const supplier = await this.supplierRepo.findOne({
      where: { id: mySupplier.id },
    });
    if (!supplier) {
      throw new NotFoundException(
        'Nu există un furnizor operațional asociat acestei companii',
      );
    }
    if (
      supplier.owner_company_id == null ||
      Number(supplier.owner_company_id) <= 0
    ) {
      throw new ForbiddenException(
        'Doar furnizorii cu cont pot avea cod de asociere',
      );
    }
    const ensured = await this.ensureConnectionCodeForAccountSupplier(supplier);
    if (!ensured.connection_code) {
      throw new ConflictException('Codul de asociere nu a putut fi generat');
    }
    return {
      supplier_id: ensured.id,
      connection_code: ensured.connection_code,
    };
  }

  async regenerateMySupplierConnectionCode(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    roles?: string[] | null,
    options?: {
      workLocationId?: number | null;
      employeeId?: number | null;
    },
  ): Promise<{ supplier_id: number; connection_code: string }> {
    const mySupplier = await this.findMySupplierForFurnizorTenant(
      companyId,
      companyType,
      roles,
      options,
    );
    const supplier = await this.supplierRepo.findOne({
      where: { id: mySupplier.id },
    });
    if (!supplier) {
      throw new NotFoundException(
        'Nu există un furnizor operațional asociat acestei companii',
      );
    }
    if (
      supplier.owner_company_id == null ||
      Number(supplier.owner_company_id) <= 0
    ) {
      throw new ForbiddenException(
        'Doar furnizorii cu cont pot regenera codul de asociere',
      );
    }

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = generateSupplierConnectionCode();
      try {
        await this.supplierRepo.update(
          { id: supplier.id },
          { connection_code: code },
        );
        return { supplier_id: supplier.id, connection_code: code };
      } catch (error: any) {
        const msg = String(error?.message || error || '');
        if (/UQ_suppliers_connection_code|Duplicate|ER_DUP_ENTRY/i.test(msg)) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException(
      'Nu s-a putut regenera un cod unic de asociere',
    );
  }

  /**
   * Client tenant redeems a connection code → client_supplier_links (+ seed locations).
   * client_company_id comes exclusively from JWT/requester — never from body.
   */
  async connectSupplierByCode(
    rawCode: string,
    requester?: SupplierAccessRequester,
  ): Promise<{
    supplier_id: number;
    supplier_name: string;
    is_active: boolean;
    already_linked: boolean;
    has_supplier_account: boolean;
  }> {
    const companyType = resolveCompanyTypeFromAuth(
      requester?.company_type,
      requester?.roles,
    );
    const clientCompanyId = Number(requester?.company_id);
    const code = normalizeSupplierConnectionCode(rawCode);

    const supplier = code
      ? await this.supplierRepo.findOne({ where: { connection_code: code } })
      : null;

    const existing =
      supplier && Number.isFinite(clientCompanyId) && clientCompanyId > 0
        ? await this.clientSupplierLinkRepo.findOne({
            where: {
              client_company_id: clientCompanyId,
              supplier_id: supplier.id,
            },
          })
        : null;

    const existingActiveLink =
      !!existing &&
      this.supplierQuotaLifecycleService.resolveAccountQuotaStatus(
        existing,
      ) !== SUPPLIER_QUOTA_STATUS.REMOVED;

    const decision = decideConnectAttempt({
      companyType,
      clientCompanyId: Number.isFinite(clientCompanyId) ? clientCompanyId : null,
      normalizedCode: code,
      supplier: supplier
        ? {
            id: supplier.id,
            owner_company_id: supplier.owner_company_id,
            is_active: supplier.is_active !== false,
          }
        : null,
      alreadyLinked: existingActiveLink,
    });

    if (!decision.ok) {
      if (decision.reason === 'forbidden_furnizor') {
        throw new ForbiddenException(
          'Conturile de tip furnizor nu pot folosi asocierea prin cod',
        );
      }
      if (decision.reason === 'forbidden_no_company') {
        throw new ForbiddenException(
          'Doar un tenant client autentificat poate asocia un furnizor prin cod',
        );
      }
      if (decision.reason === 'self_link') {
        throw new BadRequestException(
          'Nu poți asocia firma ta ca furnizor pentru propria firmă',
        );
      }
      if (decision.reason === 'already_linked') {
        throw new ConflictException('Furnizorul este deja asociat firmei tale');
      }
      throw new NotFoundException('Cod invalid');
    }

    // Cont quota / links only for suppliers with a real furnizor login.
    // owner_company_id alone is NOT enough (legacy false Cont).
    if (!(await this.hasSupplierLoginAccount(supplier!.id))) {
      throw new BadRequestException(
        'Acest furnizor nu are un cont de login activ. Adaugă-l ca furnizor Manual.',
      );
    }

    const linkedBy =
      requester?.userId != null && Number.isFinite(Number(requester.userId))
        ? Number(requester.userId)
        : null;

    return this.supplierQuotaService.withCompanySupplierQuotaLock(
      clientCompanyId,
      async () => {
        if (
          existing &&
          this.supplierQuotaLifecycleService.resolveAccountQuotaStatus(
            existing,
          ) === SUPPLIER_QUOTA_STATUS.REMOVED
        ) {
          await this.supplierQuotaLifecycleService.reactivateAccountLink(
            clientCompanyId,
            supplier!.id,
            linkedBy,
          );
        } else {
          await this.supplierQuotaService.assertCanConnectAccountSupplier(
            clientCompanyId,
          );

          try {
            await this.clientSupplierLinkRepo.save(
              this.clientSupplierLinkRepo.create({
                client_company_id: clientCompanyId,
                supplier_id: supplier!.id,
                linked_by_user_id: linkedBy,
                is_active: true,
                quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
              }),
            );
          } catch (error: any) {
            const msg = String(error?.message || error || '');
            if (
              /UQ_client_supplier_links_client_supplier|Duplicate|ER_DUP_ENTRY/i.test(
                msg,
              )
            ) {
              throw new ConflictException('Furnizorul este deja asociat firmei tale');
            }
            throw error;
          }
        }

        await this.seedSupplierLocationsForCompany(
          supplier!.id,
          clientCompanyId,
        );

        return {
          supplier_id: supplier!.id,
          supplier_name: supplier!.supplier_name,
          is_active: supplier!.is_active !== false,
          already_linked: false,
          has_supplier_account: true,
        };
      },
    );
  }

  /**
   * Plan + usage for client tenant (FE Setări / Furnizori).
   * Usage is company-wide; inactive occupies slots.
   */
  async getMySupplierSubscriptionUsage(
    requester?: SupplierAccessRequester,
  ): Promise<{
    plan: { code: string; name: string };
    status: string;
    account: { used: number; limit: number; over_limit: boolean };
    manual: { used: number; limit: number; over_limit: boolean };
    limits: Record<string, number>;
  }> {
    if (
      !isTenantScopedSupplierRequester(requester) ||
      Number(requester!.company_id) <= 0
    ) {
      throw new ForbiddenException(
        'Doar un tenant client autentificat poate citi usage-ul de furnizori',
      );
    }
    if (String(requester!.company_type || '').toLowerCase() === 'furnizor') {
      throw new ForbiddenException(
        'Abonamentul client nu este disponibil pentru conturi furnizor',
      );
    }
    const companyId = Number(requester!.company_id);
    const locationIds = await this.fetchCompanyLocationIds(companyId);
    const view = await this.supplierQuotaService.getSubscriptionUsageView(
      companyId,
      locationIds,
    );
    return {
      plan: { code: view.plan_code, name: view.plan_name },
      status: view.status,
      account: {
        used: view.account_used,
        limit: view.account_limit,
        over_limit: view.account_over_limit,
      },
      manual: {
        used: view.manual_used,
        limit: view.manual_limit,
        over_limit: view.manual_over_limit,
      },
      limits: view.limits,
    };
  }

  /**
   * Company-wide operational materialization: ensure supplier_locations exists
   * for every work_location of the client company. Idempotent; never deletes;
   * never attaches other companies' locations.
   */
  async seedSupplierLocationsForCompany(
    supplierId: number,
    companyId: number,
  ): Promise<{
    supplier_id: number;
    company_id: number;
    location_ids: number[];
    attached: number;
    already_present: number;
  }> {
    const sid = Number(supplierId);
    const cid = Number(companyId);
    if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(cid) || cid <= 0) {
      throw new BadRequestException('supplierId/companyId invalide');
    }

    const locationIds = await this.fetchCompanyLocationIds(cid);
    if (locationIds.length === 0) {
      this.logger.warn(
        `⚠️ [seedSupplierLocationsForCompany] company=${cid} has no locations; supplier=${sid}`,
      );
      return {
        supplier_id: sid,
        company_id: cid,
        location_ids: [],
        attached: 0,
        already_present: 0,
      };
    }

    const existing = await this.supplierLocationsRepo.find({
      where: { supplier_id: sid, id_location: In(locationIds) },
      select: ['id_location'],
    });
    const already = existing.map((r) => Number(r.id_location));
    const missing = missingLocationIds(locationIds, already);

    let attached = 0;
    for (const locationId of missing) {
      try {
        await this.assignSupplierToLocation(sid, locationId);
        attached += 1;
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [seedSupplierLocationsForCompany] supplier=${sid} location=${locationId}: ${error?.message || error}`,
        );
      }
    }

    return {
      supplier_id: sid,
      company_id: cid,
      location_ids: locationIds,
      attached,
      already_present: locationIds.length - missing.length,
    };
  }

  /** @deprecated alias — use seedSupplierLocationsForCompany */
  private async seedSupplierLocationsForClientCompany(
    supplierId: number,
    clientCompanyId: number,
  ): Promise<void> {
    await this.seedSupplierLocationsForCompany(supplierId, clientCompanyId);
  }

  /**
   * After a new work_location is created for company X: attach all company-wide
   * Manual + Cont-linked suppliers to that location (idempotent).
   */
  async attachCompanySuppliersToLocation(
    companyId: number,
    locationId: number,
  ): Promise<{
    company_id: number;
    location_id: number;
    manual_supplier_ids: number[];
    account_supplier_ids: number[];
    inserted: number;
    already_present: number;
  }> {
    const cid = Number(companyId);
    const lid = Number(locationId);
    if (!Number.isFinite(cid) || cid <= 0 || !Number.isFinite(lid) || lid <= 0) {
      throw new BadRequestException('companyId/locationId invalide');
    }

    const location = await this.fetchLocation(lid);
    if (!location) {
      throw new NotFoundException(`Locația ${lid} nu a fost găsită`);
    }
    const locCompanyId = Number(location.company_id ?? location.companyId);
    if (locCompanyId !== cid) {
      throw new BadRequestException(
        `Locația ${lid} nu aparține companiei ${cid}`,
      );
    }

    const companyLocationIds = await this.fetchCompanyLocationIds(cid);
    const manualSupplierIds =
      await this.findManualSupplierIdsForCompanyLocations(companyLocationIds);
    const accountSupplierIds = await this.findLinkedAccountSupplierIds(cid);
    const allIds = [
      ...new Set([...manualSupplierIds, ...accountSupplierIds]),
    ].filter((id) => Number.isFinite(id) && id > 0);

    let inserted = 0;
    let alreadyPresent = 0;
    for (const supplierId of allIds) {
      const existing = await this.supplierLocationsRepo.findOne({
        where: { supplier_id: supplierId, id_location: lid },
        select: ['id'],
      });
      if (existing) {
        alreadyPresent += 1;
        continue;
      }
      try {
        await this.assignSupplierToLocation(supplierId, lid);
        inserted += 1;
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [attachCompanySuppliersToLocation] supplier=${supplierId} location=${lid}: ${error?.message || error}`,
        );
      }
    }

    this.logger.log(
      `✅ [attachCompanySuppliersToLocation] company=${cid} location=${lid} ` +
        `manual=${manualSupplierIds.length} account=${accountSupplierIds.length} ` +
        `inserted=${inserted} already=${alreadyPresent}`,
    );

    return {
      company_id: cid,
      location_id: lid,
      manual_supplier_ids: manualSupplierIds,
      account_supplier_ids: accountSupplierIds,
      inserted,
      already_present: alreadyPresent,
    };
  }

  private async findManualSupplierIdsForCompanyLocations(
    companyLocationIds: number[],
  ): Promise<number[]> {
    if (!companyLocationIds.length) return [];
    const rows = await this.supplierLocationsRepo
      .createQueryBuilder('sl')
      .innerJoin(Supplier, 's', 's.id = sl.supplier_id')
      .select('DISTINCT sl.supplier_id', 'supplier_id')
      .where('sl.id_location IN (:...locationIds)', {
        locationIds: companyLocationIds,
      })
      .andWhere('(s.owner_company_id IS NULL OR s.owner_company_id = 0)')
      .getRawMany<{ supplier_id: number | string }>();
    return rows
      .map((r) => Number(r.supplier_id))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  private async findLinkedAccountSupplierIds(
    clientCompanyId: number,
  ): Promise<number[]> {
    const rows = await this.clientSupplierLinkRepo.find({
      where: { client_company_id: clientCompanyId },
      select: ['supplier_id'],
    });
    return rows
      .map((r) => Number(r.supplier_id))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  private async hasClientSupplierLink(
    clientCompanyId: number,
    supplierId: number,
  ): Promise<boolean> {
    if (
      !Number.isFinite(clientCompanyId) ||
      clientCompanyId <= 0 ||
      !Number.isFinite(supplierId) ||
      supplierId <= 0
    ) {
      return false;
    }
    const link = await this.clientSupplierLinkRepo.findOne({
      where: {
        client_company_id: clientCompanyId,
        supplier_id: supplierId,
      },
      select: ['id', 'quota_status'],
    });
    if (!link) return false;
    return (
      this.supplierQuotaLifecycleService.resolveAccountQuotaStatus(link) !==
      SUPPLIER_QUOTA_STATUS.REMOVED
    );
  }

  private mapClientSupplierRelationshipError(
    error: ClientSupplierRelationshipError,
    supplierId: number,
  ): never {
    switch (error.code) {
      case 'NOT_LINKED':
      case 'REMOVED':
      case 'NO_LOCATION':
        throw new NotFoundException(
          `Furnizorul cu ID ${supplierId} nu a fost găsit`,
        );
      case 'BLOCKED':
        throw new ForbiddenException({
          statusCode: 403,
          code: 'SUPPLIER_QUOTA_BLOCKED',
          message: error.message,
        });
      case 'INACTIVE':
        throw new ForbiddenException({
          statusCode: 403,
          code: 'CLIENT_SUPPLIER_INACTIVE',
          message: error.message,
        });
      default:
        throw error;
    }
  }

  private async resolveClientSupplierRelationship(
    clientCompanyId: number,
    supplierId: number,
  ): Promise<ClientSupplierRelationshipSnapshot> {
    const supplier = await this.supplierRepo.findOne({
      where: { id: supplierId },
      relations: ['locations'],
      select: ['id', 'owner_company_id'],
    });
    if (!supplier) {
      throw new NotFoundException(
        `Furnizorul cu ID ${supplierId} nu a fost găsit`,
      );
    }

    const hasAccount = await this.hasSupplierLoginAccount(supplierId);
    if (hasAccount) {
      const link = await this.clientSupplierLinkRepo.findOne({
        where: {
          client_company_id: clientCompanyId,
          supplier_id: supplierId,
        },
        select: ['client_company_id', 'supplier_id', 'is_active', 'quota_status'],
      });
      return {
        mode: 'account',
        hasLocationAssociation: false,
        link: link
          ? {
              client_company_id: Number(link.client_company_id),
              supplier_id: Number(link.supplier_id),
              is_active: link.is_active !== false,
              quota_status: link.quota_status,
            }
          : null,
      };
    }

    const companyLocationIds = await this.fetchCompanyLocationIds(clientCompanyId);
    const supplierLocationIds = (supplier.locations || [])
      .map((loc: SupplierLocations) => Number(loc.id_location))
      .filter((id: number) => Number.isFinite(id) && id > 0);
    const hasLocationAssociation = supplierLocationIds.some((id) =>
      companyLocationIds.includes(id),
    );

    const manualState = await this.connection
      .getRepository(ClientManualSupplierState)
      .findOne({
        where: {
          client_company_id: clientCompanyId,
          supplier_id: supplierId,
        },
        select: ['client_company_id', 'supplier_id', 'is_active', 'quota_status'],
      });

    return {
      mode: 'manual',
      hasLocationAssociation,
      manualState: manualState
        ? {
            client_company_id: Number(manualState.client_company_id),
            supplier_id: Number(manualState.supplier_id),
            is_active: manualState.is_active !== false,
            quota_status: manualState.quota_status,
          }
        : null,
    };
  }

  /**
   * Canonical per-client supplier relationship gate (Cont vs Manual).
   */
  async assertClientSupplierRelationship(
    clientCompanyId: number,
    supplierId: number,
    requirements: ClientSupplierRelationshipRequirement = {},
  ): Promise<ClientSupplierRelationshipSnapshot> {
    try {
      const snapshot = await this.resolveClientSupplierRelationship(
        clientCompanyId,
        supplierId,
      );
      assertClientSupplierRelationshipResolved(
        clientCompanyId,
        supplierId,
        snapshot,
        requirements,
      );
      return snapshot;
    } catch (error) {
      if (error instanceof ClientSupplierRelationshipError) {
        this.mapClientSupplierRelationshipError(error, supplierId);
      }
      throw error;
    }
  }

  private async seedManualClientAssociationStateOnCreate(
    clientCompanyId: number,
    supplierId: number,
    isActive: boolean,
  ): Promise<void> {
    const repo = this.connection.getRepository(ClientManualSupplierState);
    await repo.save(
      repo.create({
        client_company_id: clientCompanyId,
        supplier_id: supplierId,
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        is_active: isActive !== false,
      }),
    );
  }

  private async upsertManualClientAssociationActive(
    clientCompanyId: number,
    supplierId: number,
    isActive: boolean,
  ): Promise<void> {
    await this.assertClientSupplierRelationship(clientCompanyId, supplierId, {
      requireOperationalActive: false,
      requireAccessibleQuota: true,
    });

    const repo = this.connection.getRepository(ClientManualSupplierState);
    let state = await repo.findOne({
      where: {
        client_company_id: clientCompanyId,
        supplier_id: supplierId,
      },
    });
    const quotaStatus = this.supplierQuotaLifecycleService.resolveManualQuotaStatus(
      state,
    );
    if (quotaStatus === SUPPLIER_QUOTA_STATUS.BLOCKED) {
      throw new ForbiddenException(
        'Furnizorii blocați de abonament nu pot fi activați sau dezactivați operațional.',
      );
    }

    const nextActive = isActive !== false;
    if (!state) {
      state = repo.create({
        client_company_id: clientCompanyId,
        supplier_id: supplierId,
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        is_active: nextActive,
      });
    } else {
      state.is_active = nextActive;
    }
    await repo.save(state);
  }

  /**
   * Operational supplier for the logged-in furnizor tenant (owner_company_id = JWT company_id).
   */
  private async resolveCompanyIdFromWorkLocation(
    workLocationId: number | null | undefined,
  ): Promise<number | null> {
    const locId = Number(workLocationId);
    if (!Number.isFinite(locId) || locId <= 0) {
      return null;
    }
    const location = await this.fetchLocation(locId);
    const companyId = Number(location?.company_id ?? location?.companyId);
    return Number.isFinite(companyId) && companyId > 0 ? companyId : null;
  }

  private async findOperationalSupplierByCompanyId(
    companyId: number,
  ): Promise<{ id: number; supplier_name: string } | null> {
    const byOwner = await this.supplierRepo.findOne({
      where: { owner_company_id: companyId },
      select: ['id', 'supplier_name'],
    });
    if (byOwner) {
      return { id: byOwner.id, supplier_name: byOwner.supplier_name };
    }

    const productRow = await this.supplierProductRepo
      .createQueryBuilder('sp')
      .innerJoinAndSelect('sp.supplier', 'supplier')
      .where('sp.company_id = :companyId', { companyId })
      .orderBy('sp.id', 'ASC')
      .getOne();
    if (productRow?.supplier) {
      return {
        id: productRow.supplier.id,
        supplier_name: productRow.supplier.supplier_name,
      };
    }

    return null;
  }

  async findMySupplierForFurnizorTenant(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    roles?: string[] | null,
    options?: {
      workLocationId?: number | null;
      employeeId?: number | null;
    },
  ): Promise<{ id: number; supplier_name: string }> {
    let resolvedCompanyId = Number(companyId);
    if (!Number.isFinite(resolvedCompanyId) || resolvedCompanyId <= 0) {
      resolvedCompanyId =
        (await this.resolveCompanyIdFromWorkLocation(options?.workLocationId)) ??
        Number.NaN;
    }

    if (Number.isFinite(resolvedCompanyId) && resolvedCompanyId > 0) {
      const supplier = await this.findOperationalSupplierByCompanyId(
        resolvedCompanyId,
      );
      if (supplier) {
        return supplier;
      }
    }

    const employeeId = Number(options?.employeeId);
    if (Number.isFinite(employeeId) && employeeId > 0) {
      const supplierIds = await this.getEmployeeSupplierIds(employeeId);
      if (supplierIds.length === 1) {
        const supplier = await this.supplierRepo.findOne({
          where: { id: supplierIds[0] },
          select: ['id', 'supplier_name'],
        });
        if (supplier) {
          return { id: supplier.id, supplier_name: supplier.supplier_name };
        }
      }
    }

    const normalizedType = resolveCompanyTypeFromAuth(companyType, roles);
    if (normalizedType !== 'furnizor') {
      throw new ForbiddenException(
        'Doar conturile de tip furnizor pot accesa furnizorul operațional asociat',
      );
    }

    if (!Number.isFinite(resolvedCompanyId) || resolvedCompanyId <= 0) {
      throw new ForbiddenException(
        'Contextul companiei furnizor lipsește din sesiune',
      );
    }

    throw new NotFoundException(
      'Nu există un furnizor operațional asociat acestei companii',
    );
  }

  /**
   * Leagă un angajat la furnizorul operațional al contului logat.
   * Upsert în employees_suppliers: dacă legătura există, actualizează rolul; altfel inserează.
   * staff_type: 'magazioner' → role = 'warehouse'; 'sofer' → role = 'driver'
   */
  async linkMySupplierStaff(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    employeeId: number,
    staffType: 'magazioner' | 'sofer',
  ): Promise<{ employee_id: number; supplier_id: number; role: 'warehouse' | 'driver' }> {
    const summary = await this.findMySupplierForFurnizorTenant(companyId, companyType);
    const role: 'warehouse' | 'driver' = staffType === 'magazioner' ? 'warehouse' : 'driver';

    const existing = await this.employeeSupplierRepo.findOne({
      where: { employee_id: employeeId, supplier_id: summary.id },
    });

    if (existing) {
      existing.role = role;
      await this.employeeSupplierRepo.save(existing);
      return { employee_id: employeeId, supplier_id: summary.id, role };
    }

    const link = this.employeeSupplierRepo.create({
      employee_id: employeeId,
      supplier_id: summary.id,
      role,
    });
    await this.employeeSupplierRepo.save(link);
    return { employee_id: employeeId, supplier_id: summary.id, role };
  }

  /** Full supplier record for furnizor tenant (no supplier_locations scope). */
  async findMySupplierProfileForFurnizorTenant(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    roles?: string[] | null,
    options?: {
      workLocationId?: number | null;
      employeeId?: number | null;
    },
  ): Promise<Supplier> {
    const summary = await this.findMySupplierForFurnizorTenant(
      companyId,
      companyType,
      roles,
      options,
    );
    return this.findOne(summary.id, undefined);
  }

  /**
   * Firme-client asociate furnizorului autentificat (prin supplier_locations → locații client).
   */
  private mapSupplierClientCompany(
    company: Record<string, unknown>,
  ): {
    id: number;
    company_name: string;
    cui: string;
    trade_register_number: string | null;
    status: string;
    address: string | null;
    city: string | null;
    county: string | null;
    country: string | null;
    postal_code: string | null;
    phone_number: string | null;
    email: string | null;
    legal_form: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    incorporation_date: string | null;
    vat_payer: boolean;
  } {
    return {
      id: Number(company.id),
      company_name: String(company.company_name ?? ''),
      cui: String(company.cui ?? ''),
      trade_register_number:
        company.trade_register_number != null
          ? String(company.trade_register_number)
          : null,
      status: String(company.status ?? 'activ'),
      address: company.address != null ? String(company.address) : null,
      city: company.city != null ? String(company.city) : null,
      county: company.county != null ? String(company.county) : null,
      country: company.country != null ? String(company.country) : null,
      postal_code:
        company.postal_code != null ? String(company.postal_code) : null,
      phone_number:
        company.phone_number != null ? String(company.phone_number) : null,
      email: company.email != null ? String(company.email) : null,
      legal_form:
        company.legal_form != null ? String(company.legal_form) : null,
      bank_name: company.bank_name != null ? String(company.bank_name) : null,
      bank_account_number:
        company.bank_account_number != null
          ? String(company.bank_account_number)
          : null,
      incorporation_date:
        company.incorporation_date != null
          ? String(company.incorporation_date)
          : null,
      vat_payer: Boolean(company.vat_payer),
    };
  }

  async findMySupplierClientsForFurnizorTenant(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    options?: { search?: string; status?: string },
  ): Promise<
    Array<{
      id: number;
      company_name: string;
      cui: string;
      trade_register_number: string | null;
      status: string;
      address: string | null;
      city: string | null;
      county: string | null;
      country: string | null;
      postal_code: string | null;
      phone_number: string | null;
      email: string | null;
      legal_form: string | null;
      bank_name: string | null;
      bank_account_number: string | null;
      incorporation_date: string | null;
      vat_payer: boolean;
    }>
  > {
    const summary = await this.findMySupplierForFurnizorTenant(
      companyId,
      companyType,
    );
    const resolvedCompanyId = Number(companyId);
    const rows = await this.supplierLocationsRepo.find({
      where: { supplier_id: summary.id },
    });
    const enriched = await this.enrichWithLocations(rows);

    const clientCompanyIds = new Set<number>();
    for (const row of enriched) {
      const loc = row.workLocation as Record<string, unknown> | null | undefined;
      const rawCompanyId = loc?.company_id ?? loc?.companyId;
      const clientCompanyId = Number(rawCompanyId);
      if (!Number.isFinite(clientCompanyId) || clientCompanyId <= 0) {
        continue;
      }
      if (clientCompanyId === resolvedCompanyId) {
        continue;
      }
      clientCompanyIds.add(clientCompanyId);
    }

    const contLinks = await this.clientSupplierLinkRepo.find({
      where: { supplier_id: summary.id },
      select: ['client_company_id', 'quota_status'],
    });
    for (const link of contLinks) {
      const clientCompanyId = Number(link.client_company_id);
      if (!Number.isFinite(clientCompanyId) || clientCompanyId <= 0) {
        continue;
      }
      if (clientCompanyId === resolvedCompanyId) {
        continue;
      }
      if (
        this.supplierQuotaLifecycleService.resolveAccountQuotaStatus(link) ===
        SUPPLIER_QUOTA_STATUS.REMOVED
      ) {
        continue;
      }
      clientCompanyIds.add(clientCompanyId);
    }

    const companiesUrl =
      this.configService.get<string>('COMPANIES_HTTP_URL') ||
      process.env.COMPANIES_HTTP_URL ||
      'http://localhost:3003';

    const clients: Array<ReturnType<SuppliersService['mapSupplierClientCompany']>> =
      [];

    for (const clientCompanyId of clientCompanyIds) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${companiesUrl}/companies/${clientCompanyId}`, {
            headers: this.internalServiceHeaders(),
            timeout: 5000,
          }),
        );
        const company = response.data as Record<string, unknown>;
        const mapped = this.mapSupplierClientCompany(company);
        if (
          options?.status &&
          options.status !== 'all' &&
          mapped.status !== options.status
        ) {
          continue;
        }
        const search = options?.search?.trim().toLowerCase();
        if (search) {
          const haystack = [
            mapped.company_name,
            mapped.cui,
            mapped.trade_register_number,
            mapped.email,
            mapped.city,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(search)) {
            continue;
          }
        }
        clients.push(mapped);
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [findMySupplierClients] company ${clientCompanyId}: ${error?.message || error}`,
        );
      }
    }

    return clients.sort((a, b) =>
      a.company_name.localeCompare(b.company_name, 'ro'),
    );
  }

  async findMySupplierClientByIdForFurnizorTenant(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    clientCompanyId: number,
  ): Promise<Record<string, unknown>> {
    const clients = await this.findMySupplierClientsForFurnizorTenant(
      companyId,
      companyType,
    );
    const allowed = clients.find((c) => c.id === clientCompanyId);
    if (!allowed) {
      throw new ForbiddenException(
        'Clientul nu este asociat furnizorului autentificat',
      );
    }

    const companiesUrl =
      this.configService.get<string>('COMPANIES_HTTP_URL') ||
      process.env.COMPANIES_HTTP_URL ||
      'http://localhost:3003';

    const response = await firstValueFrom(
      this.httpService.get(`${companiesUrl}/companies/${clientCompanyId}`, {
        headers: this.internalServiceHeaders(),
        timeout: 5000,
      }),
    );

    return this.mapSupplierClientCompany(
      response.data as Record<string, unknown>,
    );
  }

  /**
   * Stoc depozit furnizor pentru UI tenant — nomenclator × agregat stock-ms la locația depozit.
   * Nu necesită permisiunea stock.read pe JWT (apel intern către stock-ms).
   */
  async getMySupplierStockForFurnizorTenant(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    page = 1,
    limit = 9,
    filters?: {
      search?: string;
      status?: string;
      stock_filter?: string;
      sort_by?: string;
      sort_direction?: string;
    },
  ): Promise<{
    supplier_id: number;
    supplier_name: string;
    location_id: number;
    location_name: string | null;
    data: Array<{
      supplier_product_id: number;
      product_id: number;
      product_name: string;
      unit: string;
      quantity: number;
      price_per_unit: number | null;
      stock_status: string | null;
      image_url: string | null;
      linked_product_photo: string | null;
      resolved_image_url: string | null;
      is_active: boolean;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    summary?: { below_minimum_count: number };
  }> {
    const summary = await this.findMySupplierForFurnizorTenant(
      companyId,
      companyType,
    );
    const supplierStockLocationId = await this.resolveSupplierStockLocationId(
      summary.id,
    );

    let stockPage: Awaited<
      ReturnType<StockHttpService['listStockItemsPaginated']>
    >;
    try {
      stockPage = await this.stockHttpService.listStockItemsPaginated(
        supplierStockLocationId,
        page,
        limit,
        filters,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ [getMySupplierStockForFurnizorTenant] stock list failed for location ${supplierStockLocationId}: ${error?.message ?? error}`,
      );
      throw new BadRequestException(
        'Nu s-a putut încărca stocul depozitului furnizorului din serviciul stock',
      );
    }

    const productIds = stockPage.data
      .map((row) => Number(row.product_id))
      .filter((id) => Number.isFinite(id) && id > 0);

    const supplierProducts =
      productIds.length > 0
        ? await this.supplierProductRepo.find({
            where: { supplier_id: summary.id, product_id: In(productIds) },
          })
        : [];

    const supplierProductByProductId = new Map(
      supplierProducts.map((sp) => [Number(sp.product_id), sp]),
    );

    let locationName: string | null = null;
    const location = await this.fetchLocation(supplierStockLocationId);
    if (location?.location_name) {
      locationName = String(location.location_name);
    }

    const data = stockPage.data.map((stock) => {
      const productId = Number(stock.product_id);
      const sp = supplierProductByProductId.get(productId);
      const stockProduct = stock.product as
        | { name?: string; unit?: string; photo?: string | null }
        | undefined;
      const imageFields = buildSupplierProductImageFields(
        sp?.image_url,
        stockProduct?.photo,
      );

      return {
        supplier_product_id: sp?.id ?? 0,
        product_id: productId,
        product_name:
          sp?.product_name?.trim() ||
          stockProduct?.name?.trim() ||
          `Produs #${productId}`,
        unit: sp?.unit_of_measure?.trim() || stockProduct?.unit?.trim() || '—',
        quantity: Number(stock.quantity) || 0,
        price_per_unit:
          sp?.price_per_unit != null && Number.isFinite(Number(sp.price_per_unit))
            ? Number(sp.price_per_unit)
            : null,
        stock_status: stock.status != null ? String(stock.status) : null,
        image_url: imageFields.image_url,
        linked_product_photo: imageFields.linked_product_photo,
        resolved_image_url: imageFields.resolved_image_url,
        is_active: sp?.is_active !== false,
      };
    });

    return {
      supplier_id: summary.id,
      supplier_name: summary.supplier_name,
      location_id: supplierStockLocationId,
      location_name: locationName,
      data,
      pagination: stockPage.pagination,
      summary: stockPage.summary,
    };
  }

  /** Locațiile reale la care angajatul are acces, verificate via employees-ms (nu doar declarate de client). */
  private async getEmployeeLocationIds(requester?: SupplierAccessRequester): Promise<number[]> {
    const fallback = [requester?.work_location_id, requester?.work_location_default_id].filter(
      (v): v is number => Number.isFinite(v as number) && (v as number) > 0,
    );

    const employeeId = requester?.userId;
    if (!employeeId || !Number.isFinite(employeeId)) {
      return Array.from(new Set(fallback));
    }

    try {
      const employeesServiceUrl =
        this.configService.get<string>('EMPLOYEES_HTTP_URL') || 'http://localhost:3012';
      const resp: any = await firstValueFrom(
        this.httpService.get(`${employeesServiceUrl}/employees/${employeeId}/locations`, {
          headers: this.internalServiceHeaders(),
          timeout: 3000,
        }),
      );
      const rows = Array.isArray(resp?.data) ? resp.data : [];
      const ids = rows
        .map((el: any) => Number(el.idLocation ?? el.id_location ?? el.locationId ?? el.location_id))
        .filter((id: number) => Number.isFinite(id) && id > 0);
      return Array.from(new Set([...ids, ...fallback]));
    } catch (error: any) {
      this.logger.error(
        `⚠️ [getEmployeeLocationIds] Nu am putut obține locațiile angajatului ${employeeId}: ${error?.message || error}`,
      );
      return Array.from(new Set(fallback));
    }
  }

  private async assertLocationBelongsToRequesterCompany(
    locationId: number,
    requester: SupplierAccessRequester,
  ): Promise<void> {
    if (hasPlatformWideSupplierAccess(requester)) {
      return;
    }
    const location = await this.fetchLocation(Number(locationId));
    if (!location) {
      throw new NotFoundException(`Locația ${locationId} nu a fost găsită`);
    }
    const locationCompanyId = Number(
      location.company_id ?? location.companyId,
    );
    const userCompanyId = Number(requester.company_id);
    if (
      !Number.isFinite(userCompanyId) ||
      userCompanyId <= 0 ||
      userCompanyId !== locationCompanyId
    ) {
      throw new ForbiddenException(
        'Locația selectată nu aparține companiei dumneavoastră',
      );
    }
  }

  /**
   * Acces tenant non-platform:
   * - Cont: `client_supplier_links` SAU `owner_company_id === requester.company_id`
   * - Manual: intersecție supplier_locations ∩ locațiile companiei requester
   * Platform-wide (`assignment.read_all` / super-admin): sare peste verificare.
   * `assignment.read_company` NU este bypass global.
   * Fără `requester` = apel intern (server-to-server), comportament neschimbat.
   */
  private async assertSupplierAccessibleToRequester(
    supplier: Supplier,
    requester?: SupplierAccessRequester,
  ): Promise<void> {
    if (!requester) {
      return;
    }
    if (hasPlatformWideSupplierAccess(requester)) {
      return;
    }

    const companyId = Number(requester.company_id);
    const linked =
      Number.isFinite(companyId) && companyId > 0
        ? await this.hasClientSupplierLink(companyId, supplier.id)
        : false;

    const supplierLocationIds = (supplier.locations || [])
      .map((loc: any) => Number(loc.id_location))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    const companyLocationIds =
      Number.isFinite(companyId) && companyId > 0
        ? await this.fetchCompanyLocationIds(companyId)
        : [];

    const hasAccess = isSupplierAccessibleViaLocationOrLink({
      hasPlatformWideAccess: false,
      linkedByCompany: linked,
      supplierLocationIds,
      employeeLocationIds: companyLocationIds,
      ownerCompanyId: supplier.owner_company_id,
      requesterCompanyId: companyId,
    });

    if (!hasAccess) {
      throw new NotFoundException(`Furnizorul cu ID ${supplier.id} nu a fost găsit`);
    }

    const companyType = resolveCompanyTypeFromAuth(
      requester?.company_type,
      requester?.roles,
    );
    if (companyType === 'client' && Number.isFinite(companyId) && companyId > 0) {
      await this.assertClientSupplierRelationship(companyId, supplier.id, {
        requireOperationalActive: false,
        requireAccessibleQuota: true,
      });
    }
  }

  /**
   * Batch supplier access gate for order list endpoints.
   * Loads suppliers once, then applies the same rules as assertSupplierAccessibleToRequester.
   */
  private async assertSuppliersAccessibleToRequester(
    supplierIds: number[],
    requester?: SupplierAccessRequester,
  ): Promise<void> {
    if (!requester || !supplierIds?.length) {
      return;
    }
    if (hasPlatformWideSupplierAccess(requester)) {
      return;
    }

    const uniqueIds = Array.from(
      new Set(
        supplierIds.filter((id) => Number.isFinite(id) && Number(id) > 0),
      ),
    );
    if (uniqueIds.length === 0) {
      return;
    }

    const suppliers = await this.supplierRepo.find({
      where: { id: In(uniqueIds) },
      relations: ['locations'],
    });
    const byId = new Map(suppliers.map((s) => [s.id, s]));

    for (const supplierId of uniqueIds) {
      const supplier = byId.get(supplierId);
      if (!supplier) {
        throw new NotFoundException(
          `Furnizorul cu ID ${supplierId} nu a fost găsit`,
        );
      }
      await this.assertSupplierAccessibleToRequester(supplier, requester);
    }
  }

  private async prepareOrderListAccess(
    supplierIds: number[],
    requester?: SupplierAccessRequester,
    opts?: { locationId?: number; requestedCompanyId?: number | null },
  ): Promise<void> {
    assertOrderListCompanyIdNotEscalated(requester, opts?.requestedCompanyId);
    await this.assertSuppliersAccessibleToRequester(supplierIds, requester);
    if (opts?.locationId != null && requester) {
      await this.assertLocationBelongsToRequesterCompany(
        opts.locationId,
        requester,
      );
    }
  }

  async findOne(
    id: number,
    location_id?: number,
    requester?: SupplierAccessRequester,
  ): Promise<Supplier> {
    // Încărcare explicită folders + documents cu QueryBuilder pentru a evita relațiile nested neîncărcate
    const qb = this.supplierRepo
      .createQueryBuilder('supplier')
      .leftJoinAndSelect('supplier.folders', 'folders')
      .leftJoinAndSelect('folders.documents', 'documents')
      .leftJoinAndSelect('supplier.products', 'products')
      .leftJoinAndSelect('supplier.orders', 'orders')
      .leftJoinAndSelect('orders.items', 'items')
      .leftJoinAndSelect('orders.documents', 'orders_documents')
      .leftJoinAndSelect('supplier.locations', 'locations')
      .where('supplier.id = :id', { id });

    const supplier = await qb.getOne();

    if (!supplier) {
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    // Dacă location_id este furnizat, verifică dacă furnizorul este asignat la acea locație
    if (location_id !== undefined) {
      const isAssignedToLocation = supplier.locations?.some(
        (loc: any) => loc.id_location === location_id
      );

      if (!isAssignedToLocation) {
        throw new NotFoundException(`Furnizorul cu ID ${id} nu este asignat la locația specificată`);
      }
    }

    // Verificare reală de acces (independentă de ce location_id a trimis clientul) — vezi assertSupplierAccessibleToRequester.
    await this.assertSupplierAccessibleToRequester(supplier, requester);

    const folders = (supplier as any).folders || [];
    this.logger.log(`📂 [findOne] Furnizor ${id}: ${folders.length} foldere returnate`);
    folders.forEach((f: any, i: number) => {
      const docs = f.documents || [];
      this.logger.log(`📂 [findOne]   folder[${i}] id=${f.id} description="${f.description}" folder_path="${f.folder_path}" documents=${docs.length}`);
    });

    supplier.has_supplier_account = await this.hasSupplierLoginAccount(supplier.id);
    await this.attachClientAssociationActiveOnSuppliers([supplier], requester);
    return supplier;
  }

  async update(
    id: number,
    dto: UpdateSupplierDto,
    selectedWorkLocationId?: number,
    requester?: SupplierAccessRequester,
  ): Promise<Supplier> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Updating supplier ${id} with data: ${JSON.stringify(dto)}`);

    const supplier = await this.findOne(id, undefined, requester);

    const isClientTenant =
      isTenantScopedSupplierRequester(requester) &&
      resolveCompanyTypeFromAuth(requester?.company_type, requester?.roles) ===
        'client';
    const hasRealAccount = await this.hasSupplierLoginAccount(supplier.id);
    if (
      shouldBlockClientMasterUpdateOnContSupplier({
        isTenantScopedClient: isClientTenant,
        hasRealSupplierLoginAccount: hasRealAccount,
        dto: dto as Record<string, unknown>,
      })
    ) {
      throw new ForbiddenException(
        'Datele acestui furnizor cu cont sunt administrate de furnizor. Poți modifica doar asocierea Activ/Inactiv pentru firma ta.',
      );
    }

    if (dto.registration_number || dto.vat_number) {
      const existingSupplier = await this.supplierRepo.findOne({
        where: [
          { registration_number: dto.registration_number },
          { vat_number: dto.vat_number },
        ],
      });
      if (existingSupplier && existingSupplier.id !== id) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Duplicate supplier detected during update: ${dto.registration_number} or ${dto.vat_number}`);
        throw new BadRequestException('Furnizor duplicat');
      }
    }
    const oldName = supplier.supplier_name;
    const safeDto = { ...(dto as any) };
    if (isTenantScopedSupplierRequester(requester)) {
      delete safeDto.owner_company_id;
    }
    // connection_code is managed only via my-supplier connection-code endpoints
    delete safeDto.connection_code;
    delete safeDto.client_association_is_active;

    const clientCompanyId = Number(requester?.company_id);
    const manualIsActiveFromDto = (dto as Record<string, unknown>).is_active;
    if (
      isClientTenant &&
      !hasRealAccount &&
      manualIsActiveFromDto !== undefined &&
      Number.isFinite(clientCompanyId) &&
      clientCompanyId > 0
    ) {
      await this.upsertManualClientAssociationActive(
        clientCompanyId,
        supplier.id,
        manualIsActiveFromDto !== false,
      );
      delete safeDto.is_active;
    } else if (isClientTenant && !hasRealAccount) {
      delete safeDto.is_active;
    }

    Object.assign(supplier, safeDto);
    const updatedSupplier = await this.supplierRepo.save(supplier);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier ${id} updated successfully`);

    // Send notification for updated supplier (mesaj simplu, fără lista de câmpuri)
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for updated supplier ${updatedSupplier.id}`);
    await this.sendSupplierNotification(
      'supplier_updated',
      'Furnizor modificat',
      `Furnizorul ${oldName} a fost modificat.`,
      updatedSupplier.id,
      {
        oldName,
        newName: updatedSupplier.supplier_name,
      },
      `/furnizori/${updatedSupplier.id}`,
      selectedWorkLocationId,
    );

    updatedSupplier.has_supplier_account = hasRealAccount;
    await this.attachClientAssociationActiveOnSuppliers(
      [updatedSupplier],
      requester,
    );
    return updatedSupplier;
  }

  /**
   * Client tenant: toggle Cont association usage (client_supplier_links.is_active).
   * Does NOT touch suppliers.is_active (global).
   */
  async updateMyClientSupplierAssociation(
    supplierId: number,
    isActive: boolean,
    requester?: SupplierAccessRequester,
  ): Promise<{
    supplier_id: number;
    client_association_is_active: boolean;
    has_supplier_account: boolean;
  }> {
    const companyType = resolveCompanyTypeFromAuth(
      requester?.company_type,
      requester?.roles,
    );
    const clientCompanyId = Number(requester?.company_id);
    if (
      !isTenantScopedSupplierRequester(requester) ||
      companyType !== 'client' ||
      !Number.isFinite(clientCompanyId) ||
      clientCompanyId <= 0
    ) {
      throw new ForbiddenException(
        'Doar un tenant client autentificat poate modifica asocierea furnizorului',
      );
    }

    const id = Number(supplierId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException('supplier_id invalid');
    }

    const supplier = await this.findOne(id, undefined, requester);
    const hasAccount = await this.hasSupplierLoginAccount(supplier.id);

    if (!hasAccount) {
      await this.upsertManualClientAssociationActive(
        clientCompanyId,
        supplier.id,
        isActive !== false,
      );
      return {
        supplier_id: supplier.id,
        client_association_is_active: isActive !== false,
        has_supplier_account: false,
      };
    }

    const link = await this.clientSupplierLinkRepo.findOne({
      where: {
        client_company_id: clientCompanyId,
        supplier_id: supplier.id,
      },
    });
    if (!link) {
      throw new NotFoundException(
        'Nu există o asociere Cont între firma ta și acest furnizor',
      );
    }

    if (
      this.supplierQuotaLifecycleService.resolveAccountQuotaStatus(link) ===
      SUPPLIER_QUOTA_STATUS.BLOCKED
    ) {
      throw new ForbiddenException(
        'Furnizorii blocați de abonament nu pot fi activați sau dezactivați operațional.',
      );
    }

    const nextActive = isActive !== false;
    if (link.is_active !== false && nextActive) {
      return {
        supplier_id: supplier.id,
        client_association_is_active: true,
        has_supplier_account: true,
      };
    }
    if (link.is_active === false && !nextActive) {
      return {
        supplier_id: supplier.id,
        client_association_is_active: false,
        has_supplier_account: true,
      };
    }

    // Toggle only — does not free/consume Cont quota (row still exists).
    link.is_active = nextActive;
    await this.clientSupplierLinkRepo.save(link);

    return {
      supplier_id: supplier.id,
      client_association_is_active: nextActive,
      has_supplier_account: true,
    };
  }

  async remove(
    id: number,
    selectedWorkLocationId?: number,
    requester?: SupplierAccessRequester,
  ): Promise<void> {
    const companyType = resolveCompanyTypeFromAuth(
      requester?.company_type,
      requester?.roles,
    );
    const clientCompanyId = Number(requester?.company_id);
    if (
      isTenantScopedSupplierRequester(requester) &&
      companyType === 'client' &&
      Number.isFinite(clientCompanyId) &&
      clientCompanyId > 0 &&
      !hasPlatformWideSupplierAccess(requester)
    ) {
      await this.removeFromAccount(id, requester);
      return;
    }

    this.logger.log(`🔍 [SUPPLIERS SERVICE] Removing supplier ${id}`);

    const supplier = await this.findOne(id, undefined, requester);
    const supplierName = supplier.supplier_name;
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    
    // Remove physical files from file system (both old and new structures)
    const repoRoot = this.getRepoRoot();
    const filesDir = path.join(repoRoot, 'files');
    const suppliersDir = path.join(filesDir, 'suppliers');
    
    // Try to remove the new structure (name-based)
    const supplierDirNew = path.join(suppliersDir, supplierNameSimplified);
    if (fs.existsSync(supplierDirNew)) {
      try {
        fs.rmSync(supplierDirNew, { recursive: true, force: true });
        this.logger.log(`✅ Deleted supplier files directory (new structure): ${supplierDirNew}`);
      } catch (error) {
        this.logger.error(`Failed to delete supplier files directory (new structure): ${supplierDirNew}`, error);
      }
    }
    
    // Try to remove the old structure (ID-based)
    const supplierDirOld = path.join(suppliersDir, id.toString(), supplierNameSimplified);
    if (fs.existsSync(supplierDirOld)) {
      try {
        fs.rmSync(supplierDirOld, { recursive: true, force: true });
        this.logger.log(`✅ Deleted supplier files directory (old structure): ${supplierDirOld}`);
      } catch (error) {
        this.logger.error(`Failed to delete supplier files directory (old structure): ${supplierDirOld}`, error);
      }
    }
    
    await this.supplierRepo.remove(supplier);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier ${id} removed successfully`);

    // Send notification for deleted supplier
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for deleted supplier ${id}`);
    await this.sendSupplierNotification(
      'supplier_deleted',
      'Furnizor sters',
      `Furnizorul ${supplierName} a fost sters`,
      id,
      { supplierName },
      undefined,
      selectedWorkLocationId,
    );
  }

  async removeFromAccount(
    supplierId: number,
    requester?: SupplierAccessRequester,
  ): Promise<void> {
    const companyType = resolveCompanyTypeFromAuth(
      requester?.company_type,
      requester?.roles,
    );
    const clientCompanyId = Number(requester?.company_id);
    if (
      !isTenantScopedSupplierRequester(requester) ||
      companyType !== 'client' ||
      !Number.isFinite(clientCompanyId) ||
      clientCompanyId <= 0
    ) {
      throw new ForbiddenException(
        'Doar un tenant client autentificat poate elimina furnizori din cont',
      );
    }

    const id = Number(supplierId);
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    const hasAccount = await this.hasSupplierLoginAccount(supplier.id);
    if (hasAccount) {
      await this.supplierQuotaLifecycleService.removeAccountSupplierFromClient(
        clientCompanyId,
        supplier.id,
      );
      return;
    }

    await this.supplierQuotaLifecycleService.removeManualSupplierFromClient(
      clientCompanyId,
      supplier.id,
    );
  }

  async unblockSupplierQuota(
    supplierId: number,
    requester?: SupplierAccessRequester,
  ): Promise<{ supplier_id: number; quota_status: string }> {
    const companyType = resolveCompanyTypeFromAuth(
      requester?.company_type,
      requester?.roles,
    );
    const clientCompanyId = Number(requester?.company_id);
    if (
      !isTenantScopedSupplierRequester(requester) ||
      companyType !== 'client' ||
      !Number.isFinite(clientCompanyId) ||
      clientCompanyId <= 0
    ) {
      throw new ForbiddenException(
        'Doar un tenant client autentificat poate debloca furnizori',
      );
    }

    const id = Number(supplierId);
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    const locationIds = await this.fetchCompanyLocationIds(clientCompanyId);
    const hasAccount = await this.hasSupplierLoginAccount(supplier.id);
    if (hasAccount) {
      await this.supplierQuotaLifecycleService.unblockAccountSupplier(
        clientCompanyId,
        supplier.id,
      );
    } else {
      await this.supplierQuotaLifecycleService.unblockManualSupplier(
        clientCompanyId,
        supplier.id,
        locationIds,
      );
    }

    return {
      supplier_id: supplier.id,
      quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
    };
  }

  async getDowngradePreviewForPlan(
    planCode: string,
    targetAccountLimit: number,
    targetManualLimit: number,
    requester?: SupplierAccessRequester,
  ) {
    const companyType = resolveCompanyTypeFromAuth(
      requester?.company_type,
      requester?.roles,
    );
    const clientCompanyId = Number(requester?.company_id);
    if (
      !isTenantScopedSupplierRequester(requester) ||
      companyType !== 'client' ||
      !Number.isFinite(clientCompanyId) ||
      clientCompanyId <= 0
    ) {
      throw new ForbiddenException(
        'Doar un tenant client autentificat poate previzualiza downgrade-ul',
      );
    }

    const locationIds = await this.fetchCompanyLocationIds(clientCompanyId);
    const accountSuppliers =
      await this.supplierQuotaLifecycleService.listAccountSuppliersForQuota(
        clientCompanyId,
        true,
      );
    const manualSuppliers =
      await this.supplierQuotaLifecycleService.listManualSuppliersForQuota(
        clientCompanyId,
        locationIds,
        true,
      );

    return this.supplierQuotaLifecycleService.buildDowngradePreview(
      planCode,
      targetAccountLimit,
      targetManualLimit,
      accountSuppliers,
      manualSuppliers,
    );
  }

  async fetchCompanyLocationIdsForInternal(companyId: number): Promise<number[]> {
    return this.fetchCompanyLocationIds(companyId);
  }

  async applyDowngradeBlocksInternal(
    companyId: number,
    companyLocationIds: number[],
    accountLimit: number,
    manualLimit: number,
    blockAccountSupplierIds: number[],
    blockManualSupplierIds: number[],
  ) {
    return this.supplierQuotaLifecycleService.applyDowngradeBlocks({
      companyId,
      companyLocationIds,
      accountLimit,
      manualLimit,
      blockAccountSupplierIds,
      blockManualSupplierIds,
    });
  }

  async rollbackDowngradeBlocksInternal(
    companyId: number,
    rollbackItems: Array<{
      kind: 'account' | 'manual';
      supplier_id: number;
      previous_status: string;
    }>,
  ): Promise<void> {
    await this.supplierQuotaLifecycleService.rollbackDowngradeBlocks(
      companyId,
      rollbackItems as any,
    );
  }

  async addProduct(
    dto: CreateSupplierProductDto,
    userContext?: SupplierProductUserContext,
  ): Promise<SupplierProduct> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Adding product to supplier with data: ${JSON.stringify(dto)}`);

    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }

    if (isClientAdminCatalogManager(userContext) && !isFurnizorProductManager(userContext)) {
      return this.addProductAsClientAdmin(dto, userContext);
    }

    if (!isFurnizorProductManager(userContext)) {
      assertClientViewOnlyOnMutations(userContext);
    }

    assertFurnizorProductManager(userContext);

    const my = await this.findMySupplierForFurnizorTenant(
      userContext.companyId,
      userContext.companyType,
    );
    const supplierId = my.id;
    const companyId = userContext.companyId;

    const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
    if (!supplier) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for product addition: ${supplierId}`);
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    if (
      supplier.owner_company_id != null &&
      supplier.owner_company_id !== userContext.companyId
    ) {
      throw new ForbiddenException(
        'Furnizorul operațional nu aparține companiei din sesiune',
      );
    }

    const visibleForClients = dto.is_active === true;
    const savedProduct = await this.persistNewSupplierProduct(
      dto,
      supplierId,
      companyId,
      visibleForClients,
    );
    this.logger.log(`✅ [SUPPLIERS SERVICE] Product added to supplier successfully with ID: ${savedProduct.id}`);
    this.logger.log(`💾 [SUPPLIERS SERVICE] Persisted fields - net_quantity: ${savedProduct.net_quantity}, gross_quantity: ${savedProduct.gross_quantity}, unit_of_measure: ${savedProduct.unit_of_measure}`);

    const resolvedCompanyId = Number(companyId ?? savedProduct.company_id ?? 0);
    if (Number.isFinite(resolvedCompanyId) && resolvedCompanyId > 0) {
      await this.bootstrapClientActivationForNewProduct(
        supplierId,
        resolvedCompanyId,
        Number(savedProduct.id),
        visibleForClients,
      );
    }

    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new product ${savedProduct.id}`);
    await this.sendSupplierNotification(
      'supplier_product_added',
      'Produs adaugat furnizor',
      `A fost adaugat un produs la furnizorul ${supplier.supplier_name}`,
      supplier.id,
      {
        productId: savedProduct.id,
        supplierName: supplier.supplier_name,
        productData: dto,
      },
      `/furnizori/${supplier.id}`,
    );

    return savedProduct;
  }

  private async addProductAsClientAdmin(
    dto: CreateSupplierProductDto,
    userContext: SupplierProductUserContext,
  ): Promise<SupplierProduct> {
    const supplierId = Number(dto.supplier_id);
    const { supplier, clientCompanyId } =
      await this.assertClientAdminCanManageClientManagedSupplier(
        supplierId,
        userContext,
      );

    const isActive = dto.is_active !== false;
    const savedProduct = await this.persistNewSupplierProduct(
      dto,
      supplier.id,
      clientCompanyId,
      isActive,
    );
    await this.bootstrapClientManagedProductRelations(
      supplier,
      clientCompanyId,
      Number(savedProduct.id),
      isActive,
    );

    this.logger.log(
      `✅ [SUPPLIERS SERVICE] Client-managed product ${savedProduct.id} added for supplier ${supplier.id} by client company ${clientCompanyId}`,
    );

    await this.sendSupplierNotification(
      'supplier_product_added',
      'Produs adaugat furnizor',
      `A fost adaugat un produs la furnizorul ${supplier.supplier_name}`,
      supplier.id,
      {
        productId: savedProduct.id,
        supplierName: supplier.supplier_name,
        productData: dto,
      },
      `/furnizori/${supplier.id}`,
    );

    return savedProduct;
  }

  /**
   * Locația depozitului/HQ al furnizorului (aceeași logică ca la scăderea stocului la confirmare).
   * NU este locația clientului de livrare.
   */
  async getSupplierStockLocationId(
    supplierId: number,
  ): Promise<{ location_id: number }> {
    const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
    if (!supplier) {
      throw new NotFoundException(`Furnizorul ${supplierId} nu a fost găsit`);
    }
    const locationId = await this.resolveSupplierStockLocationId(supplierId);
    return { location_id: locationId };
  }

  /**
   * Stoc disponibil la depozitul furnizorului (aceeași locație ca GIU-08 / confirm).
   * Accesibil clienților care plasează comenzi — nu modifică stocul.
   */
  async getSupplierStockAvailabilityForOrdering(
    supplierId: number,
    supplierProductIds?: number[],
    userContext?: SupplierProductUserContext,
  ): Promise<{
    location_id: number;
    items: Array<{
      supplier_product_id: number;
      product_id: number;
      product_name: string;
      quantity: number;
      unit: string;
    }>;
  }> {
    const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
    if (!supplier) {
      throw new NotFoundException(`Furnizorul ${supplierId} nu a fost găsit`);
    }

    const locationId = await this.resolveSupplierStockLocationId(supplierId);
    const where: Record<string, unknown> = {
      supplier_id: supplierId,
      is_active: true,
    };
    if (supplierProductIds?.length) {
      where.id = In(
        supplierProductIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      );
    }

    const products = await this.supplierProductRepo.find({ where });
    let visibleProducts = products;
    if (
      userContext &&
      userContext.companyType !== 'furnizor' &&
      userContext.companyId != null &&
      userContext.companyId > 0
    ) {
      visibleProducts = await this.filterProductsByClientVisibility(
        products,
        Number(userContext.companyId),
        supplierId,
      );
    }
    const stockProductIds = [
      ...new Set(
        visibleProducts
          .map((p) => Number(p.product_id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    const stockRows =
      stockProductIds.length > 0
        ? await this.stockHttpService.getQuantitiesForProductsAtLocation(
            locationId,
            stockProductIds,
          )
        : [];
    const qtyByProductId = new Map(
      stockRows.map((r) => [Number(r.product_id), r]),
    );

    return {
      location_id: locationId,
      items: visibleProducts.map((sp) => {
        const row = qtyByProductId.get(Number(sp.product_id));
        return {
          supplier_product_id: sp.id,
          product_id: Number(sp.product_id),
          product_name: sp.product_name,
          quantity: row != null ? Number(row.quantity) || 0 : 0,
          unit:
            (row?.unit && String(row.unit).trim()) ||
            sp.unit_of_measure ||
            '—',
        };
      }),
    };
  }

  /**
   * Validează stocul furnizorului pentru toate liniile înainte de creare comandă.
   * Nu modifică stocul. Respinge toată comanda dacă orice linie e invalidă.
   * Furnizor fără cont autentificabil (`has_supplier_account === false`): nu verificăm stocul.
   */
  private async assertSupplierStockSufficientForNewOrder(
    supplierId: number,
    resolvedLines: Array<{
      supplierProduct: SupplierProduct;
      quantity: number;
      productName: string;
    }>,
  ): Promise<void> {
    if (resolvedLines.length === 0) return;
    if (!(await this.hasSupplierLoginAccount(supplierId))) {
      return;
    }

    const locationId = await this.resolveSupplierStockLocationId(supplierId);
    const stockProductIds = [
      ...new Set(
        resolvedLines
          .map((l) => Number(l.supplierProduct.product_id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    const stockRows = await this.stockHttpService.getQuantitiesForProductsAtLocation(
      locationId,
      stockProductIds,
    );
    const qtyByProductId = new Map(
      stockRows.map((r) => [Number(r.product_id), r]),
    );

    const errors: string[] = [];
    for (const line of resolvedLines) {
      const stockProductId = Number(line.supplierProduct.product_id);
      const row = qtyByProductId.get(stockProductId);
      const stockQty = row != null ? Number(row.quantity) || 0 : 0;
      const stockUnit =
        (row?.unit && String(row.unit).trim()) ||
        line.supplierProduct.unit_of_measure;
      const orderUnit = line.supplierProduct.unit_of_measure;
      const comparison = compareQuantityToStock({
        orderQuantity: line.quantity,
        orderUnit,
        stockQuantity: stockQty,
        stockUnit,
      });

      if (comparison.reason === 'incompatible_units') {
        errors.push(
          `${line.productName}: unități incompatibile (comandă ${orderUnit || '—'}, stoc ${stockUnit || '—'}).`,
        );
        continue;
      }
      if (stockQty <= 0 || comparison.reason === 'insufficient' || !comparison.ok) {
        const availableLabel =
          comparison.availableInOrderUnit != null
            ? `${Number(comparison.availableInOrderUnit.toFixed(4))} ${orderUnit || ''}`.trim()
            : `${stockQty} ${stockUnit || ''}`.trim();
        errors.push(
          `${line.productName}: Cantitatea solicitată depășește stocul disponibil. Stoc disponibil: ${availableLabel}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        errors.length === 1
          ? errors[0]
          : `Comanda a fost respinsă:\n${errors.join('\n')}`,
      );
    }
  }

  private resolveClientCompanyIdFromContext(
    userContext?: SupplierProductUserContext,
  ): number {
    const companyId = userContext?.companyId;
    if (
      companyId == null ||
      !Number.isFinite(Number(companyId)) ||
      Number(companyId) <= 0
    ) {
      throw new ForbiddenException(
        'Contextul companiei client lipsește din sesiune',
      );
    }
    if (userContext?.companyType === 'furnizor') {
      throw new ForbiddenException(
        'Doar conturile client/admin pot gestiona asocierile de nomenclator',
      );
    }
    return Number(companyId);
  }

  /** GIU-12: preferință client — produse ascunse explicit; lipsă rând = vizibil. */
  private async getClientPreferenceHiddenProductIds(
    clientCompanyId: number,
    supplierId: number,
  ): Promise<Set<number>> {
    const rows = await this.supplierProductClientVisibilityRepo
      .createQueryBuilder('visibility')
      .innerJoin(
        SupplierProduct,
        'sp',
        'sp.id = visibility.supplier_product_id',
      )
      .where('visibility.client_company_id = :clientCompanyId', {
        clientCompanyId,
      })
      .andWhere('sp.supplier_id = :supplierId', { supplierId })
      .andWhere('visibility.is_visible = :visible', { visible: false })
      .select('visibility.supplier_product_id', 'supplier_product_id')
      .getRawMany<{ supplier_product_id: number }>();

    return new Set(
      rows
        .map((row) => Number(row.supplier_product_id))
        .filter((id) => Number.isFinite(id) && id > 0),
    );
  }

  /** Produse dezactivate de furnizor pentru compania client (activare per-client). */
  private async getSupplierDeactivatedProductIdsForClient(
    clientCompanyId: number,
    supplierId: number,
  ): Promise<Set<number>> {
    const products = await this.supplierProductRepo.find({
      where: { supplier_id: supplierId },
      select: ['id', 'is_active'],
    });
    if (products.length === 0) {
      return new Set();
    }

    const productIds = products
      .map((product) => Number(product.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const activationByProductId = await this.getClientActivationRowsForProducts(
      clientCompanyId,
      productIds,
    );

    const deactivated = new Set<number>();
    for (const product of products) {
      const isActiveForClient = resolveIsActiveForClientProduct(
        product.is_active,
        activationByProductId.get(Number(product.id)),
      );
      if (!isActiveForClient) {
        deactivated.add(Number(product.id));
      }
    }
    return deactivated;
  }

  /** Vizibilitate efectivă = dezactivat de furnizor ∪ ascuns de client. */
  private async getEffectiveHiddenProductIdsForClient(
    clientCompanyId: number,
    supplierId: number,
  ): Promise<Set<number>> {
    const [clientPreferenceHidden, supplierDeactivated] = await Promise.all([
      this.getClientPreferenceHiddenProductIds(clientCompanyId, supplierId),
      this.getSupplierDeactivatedProductIdsForClient(
        clientCompanyId,
        supplierId,
      ),
    ]);
    return new Set([...clientPreferenceHidden, ...supplierDeactivated]);
  }

  private shouldApplyClientProductVisibilityFilter(
    userContext: SupplierProductUserContext | undefined,
    applyClientVisibility: boolean,
  ): boolean {
    if (!applyClientVisibility) {
      return false;
    }
    if (!userContext || userContext.companyType === 'furnizor') {
      return false;
    }
    return userContext.companyId != null && userContext.companyId > 0;
  }

  private async filterProductsByClientVisibility(
    products: SupplierProduct[],
    clientCompanyId: number,
    supplierId: number,
  ): Promise<SupplierProduct[]> {
    const hiddenIds = await this.getEffectiveHiddenProductIdsForClient(
      clientCompanyId,
      supplierId,
    );
    if (!hiddenIds.size) {
      return products;
    }
    return products.filter((product) => !hiddenIds.has(Number(product.id)));
  }

  private async assertSupplierProductOrderableForClient(
    clientCompanyId: number,
    supplierId: number,
    supplierProduct: SupplierProduct,
  ): Promise<void> {
    const productIds = [Number(supplierProduct.id)];
    const activationByProductId = await this.getClientActivationRowsForProducts(
      clientCompanyId,
      productIds,
    );
    const isActiveForClient = resolveIsActiveForClientProduct(
      supplierProduct.is_active,
      activationByProductId.get(Number(supplierProduct.id)),
    );
    if (!isActiveForClient) {
      throw new BadRequestException(
        `Produsul „${supplierProduct.product_name}” nu este activ pentru compania dumneavoastră`,
      );
    }
    const hiddenIds = await this.getEffectiveHiddenProductIdsForClient(
      clientCompanyId,
      supplierId,
    );
    if (hiddenIds.has(Number(supplierProduct.id))) {
      throw new BadRequestException(
        `Produsul „${supplierProduct.product_name}” nu este disponibil pentru compania dumneavoastră`,
      );
    }
  }

  async getClientProductVisibilityForSupplier(
    supplierId: number,
    userContext?: SupplierProductUserContext,
  ): Promise<{ hidden_supplier_product_ids: number[] }> {
    const clientCompanyId = this.resolveClientCompanyIdFromContext(userContext);
    if (!userContext || !canManageSupplierProductClientMapping(userContext)) {
      throw new ForbiddenException(
        'Nu aveți permisiunea de a configura vizibilitatea produselor furnizor',
      );
    }
    await this.assertSupplierLinkedToClientCompany(supplierId, clientCompanyId);

    const hiddenIds = await this.getEffectiveHiddenProductIdsForClient(
      clientCompanyId,
      supplierId,
    );
    return { hidden_supplier_product_ids: [...hiddenIds].sort((a, b) => a - b) };
  }

  async setClientProductVisibilityForSupplier(
    supplierId: number,
    dto: SetClientProductVisibilityDto,
    userContext?: SupplierProductUserContext,
  ): Promise<{ hidden_supplier_product_ids: number[] }> {
    const clientCompanyId = this.resolveClientCompanyIdFromContext(userContext);
    if (!userContext || !canManageSupplierProductClientMapping(userContext)) {
      throw new ForbiddenException(
        'Nu aveți permisiunea de a configura vizibilitatea produselor furnizor',
      );
    }
    await this.assertSupplierLinkedToClientCompany(supplierId, clientCompanyId);

    const supplierDeactivatedIds =
      await this.getSupplierDeactivatedProductIdsForClient(
        clientCompanyId,
        supplierId,
      );

    const requestedHiddenIds = [
      ...new Set(
        (dto.hidden_supplier_product_ids ?? [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];

    if (requestedHiddenIds.length > 0) {
      const products = await this.supplierProductRepo.find({
        where: { id: In(requestedHiddenIds), supplier_id: supplierId },
        select: ['id'],
      });
      const validIds = new Set(products.map((product) => Number(product.id)));
      for (const id of requestedHiddenIds) {
        if (!validIds.has(id)) {
          throw new BadRequestException(
            `Produsul furnizor (id=${id}) nu aparține furnizorului selectat`,
          );
        }
      }
    }

    const clientPreferenceHiddenIds = requestedHiddenIds.filter(
      (id) => !supplierDeactivatedIds.has(id),
    );

    await this.connection.transaction(async (manager) => {
      const visibilityRepo = manager.getRepository(
        SupplierProductClientVisibility,
      );
      const existingRows = await visibilityRepo
        .createQueryBuilder('visibility')
        .innerJoin(
          SupplierProduct,
          'sp',
          'sp.id = visibility.supplier_product_id',
        )
        .where('visibility.client_company_id = :clientCompanyId', {
          clientCompanyId,
        })
        .andWhere('sp.supplier_id = :supplierId', { supplierId })
        .getMany();

      if (existingRows.length > 0) {
        await visibilityRepo.delete(existingRows.map((row) => row.id));
      }

      if (clientPreferenceHiddenIds.length > 0) {
        await visibilityRepo.save(
          clientPreferenceHiddenIds.map((supplierProductId) =>
            visibilityRepo.create({
              client_company_id: clientCompanyId,
              supplier_product_id: supplierProductId,
              is_visible: false,
            }),
          ),
        );
      }
    });

    const effectiveHiddenIds = [
      ...new Set([
        ...clientPreferenceHiddenIds,
        ...supplierDeactivatedIds,
      ]),
    ].sort((a, b) => a - b);
    return { hidden_supplier_product_ids: effectiveHiddenIds };
  }

  private async getPreferredPriceMapForClientCompany(
    clientCompanyId: number,
    supplierId: number,
  ): Promise<Map<number, SupplierProductClientPrice>> {
    const rows = await this.supplierProductClientPriceRepo
      .createQueryBuilder('price')
      .innerJoin(
        SupplierProduct,
        'sp',
        'sp.id = price.supplier_product_id',
      )
      .where('price.client_company_id = :clientCompanyId', {
        clientCompanyId,
      })
      .andWhere('sp.supplier_id = :supplierId', { supplierId })
      .getMany();

    return new Map(rows.map((row) => [Number(row.supplier_product_id), row]));
  }

  private async getPreferredPriceForClientCompany(
    clientCompanyId: number,
    supplierId: number,
    supplierProductId: number,
  ): Promise<SupplierProductClientPrice | null> {
    const row = await this.supplierProductClientPriceRepo
      .createQueryBuilder('price')
      .innerJoin(
        SupplierProduct,
        'sp',
        'sp.id = price.supplier_product_id',
      )
      .where('price.client_company_id = :clientCompanyId', {
        clientCompanyId,
      })
      .andWhere('price.supplier_product_id = :supplierProductId', {
        supplierProductId,
      })
      .andWhere('sp.supplier_id = :supplierId', { supplierId })
      .getOne();
    return row ?? null;
  }

  private async attachEffectivePricesForClientCompany<
    T extends SupplierProduct & {
      linked_product_photo: string | null;
      resolved_image_url: string | null;
    },
  >(
    products: T[],
    clientCompanyId: number,
    supplierId: number,
  ): Promise<T[]> {
    const map = await this.getPreferredPriceMapForClientCompany(
      clientCompanyId,
      supplierId,
    );
    return products.map((product) => {
      const priceRow = map.get(Number(product.id));
      const preferredPrice = priceRow ? Number(priceRow.preferred_price) : null;
      return Object.assign(product, {
        preferred_price: preferredPrice,
        effective_price:
          preferredPrice != null
            ? preferredPrice
            : Number(product.price_per_unit) || 0,
      }) as T;
    });
  }

  private async resolveChangedByNameSnapshot(
    changedByUserId: number | null | undefined,
    preferredName?: string | null,
  ): Promise<string | null> {
    const preferred = String(preferredName ?? '').trim();
    if (
      preferred &&
      !/^User #\d+$/i.test(preferred) &&
      !/^Utilizator #\d+$/i.test(preferred)
    ) {
      return preferred;
    }
    if (changedByUserId == null || !Number.isFinite(Number(changedByUserId))) {
      return null;
    }
    const userId = Number(changedByUserId);
    const names = await this.resolveAuthUserDisplayNames([userId]);
    const label = names.get(userId);
    if (!label) {
      return null;
    }
    // Avoid persisting the generic fallback as a "real" snapshot.
    if (/^User #\d+$/i.test(label) || /^Utilizator #\d+$/i.test(label)) {
      return null;
    }
    return label;
  }

  private async appendClientPriceHistory(
    manager: EntityManager,
    params: {
      supplierCompanyId: number;
      clientCompanyId: number;
      supplierProductId: number;
      oldPrice: number | null;
      newPrice: number | null;
      vatRate: number | null;
      oldPriceWithVat: number | null;
      newPriceWithVat: number | null;
      editSource: SupplierProductClientPriceEditSource | null;
      action: SupplierProductClientPriceHistoryAction;
      changedByUserId: number | null;
      changedByName?: string | null;
      standardPriceSnapshot?: number | null;
      standardPriceWithVatSnapshot?: number | null;
    },
  ): Promise<void> {
    const repo = manager.getRepository(SupplierProductClientPriceHistory);
    await repo.save(
      repo.create({
        supplier_company_id: params.supplierCompanyId,
        client_company_id: params.clientCompanyId,
        supplier_product_id: params.supplierProductId,
        old_price: params.oldPrice,
        new_price: params.newPrice,
        vat_rate: params.vatRate,
        old_price_with_vat: params.oldPriceWithVat,
        new_price_with_vat: params.newPriceWithVat,
        edit_source: params.editSource,
        standard_price_snapshot: params.standardPriceSnapshot ?? null,
        standard_price_with_vat_snapshot:
          params.standardPriceWithVatSnapshot ?? null,
        action: params.action,
        changed_by_user_id: params.changedByUserId,
        changed_by_name: params.changedByName ?? null,
        // Explicit UTC instant so TypeORM (+00:00) persists UTC wall-clock, not MariaDB SYSTEM NOW().
        changed_at: new Date(),
      }),
    );
  }

  private resolvePreferredPriceFromDto(
    dto: UpsertSupplierProductClientPriceDto,
    vatRate: number | null,
  ): {
    preferredPrice: number;
    preferredPriceWithVat: number | null;
    editSource: SupplierProductClientPriceEditSource;
  } {
    const editSource =
      dto.edit_source === 'with_vat'
        ? SupplierProductClientPriceEditSource.WITH_VAT
        : SupplierProductClientPriceEditSource.WITHOUT_VAT;

    if (editSource === SupplierProductClientPriceEditSource.WITH_VAT) {
      const gross = Number(dto.preferred_price_with_vat);
      if (!Number.isFinite(gross) || gross <= 0) {
        throw new BadRequestException(
          'preferred_price_with_vat trebuie să fie strict mai mare decât 0',
        );
      }
      if (vatRate == null) {
        throw new BadRequestException(
          'Produsul nu are TVA configurat; nu se poate deriva prețul fără TVA',
        );
      }
      const preferredPrice = priceNetFromGross(gross, vatRate);
      if (preferredPrice <= 0) {
        throw new BadRequestException(
          'Prețul fără TVA rezultat trebuie să fie mai mare decât 0',
        );
      }
      return {
        preferredPrice,
        preferredPriceWithVat: roundMoney(gross),
        editSource,
      };
    }

    const net = Number(dto.preferred_price);
    if (!Number.isFinite(net) || net <= 0) {
      throw new BadRequestException(
        'preferred_price trebuie să fie strict mai mare decât 0',
      );
    }
    const preferredPrice = roundMoney(net);
    return {
      preferredPrice,
      preferredPriceWithVat:
        vatRate != null ? priceWithVatFromNet(preferredPrice, vatRate) : null,
      editSource,
    };
  }

  private async getClientActivationRowsForProducts(
    clientCompanyId: number,
    supplierProductIds: number[],
  ): Promise<Map<number, SupplierProductClientActivation>> {
    if (supplierProductIds.length === 0) {
      return new Map();
    }
    const rows = await this.supplierProductClientActivationRepo.find({
      where: {
        client_company_id: clientCompanyId,
        supplier_product_id: In(supplierProductIds),
      },
    });
    const map = new Map<number, SupplierProductClientActivation>();
    for (const row of rows) {
      map.set(Number(row.supplier_product_id), row);
    }
    return map;
  }

  /** Companii client legate de furnizor prin locații de livrare și/sau client_supplier_links. */
  private async getLinkedClientCompanyIdsForSupplier(
    supplierId: number,
    supplierCompanyId?: number | null,
  ): Promise<number[]> {
    const clientIds = new Set<number>();
    const rows = await this.supplierLocationsRepo.find({
      where: { supplier_id: supplierId },
    });
    for (const row of rows) {
      const { location, failed } = await this.fetchLocationOrFail(row.id_location);
      if (failed || !location) {
        continue;
      }
      const locCompanyId = Number(
        location?.company_id ?? location?.companyId ?? 0,
      );
      if (!Number.isFinite(locCompanyId) || locCompanyId <= 0) {
        continue;
      }
      if (
        supplierCompanyId != null &&
        Number.isFinite(Number(supplierCompanyId)) &&
        locCompanyId === Number(supplierCompanyId)
      ) {
        continue;
      }
      clientIds.add(locCompanyId);
    }

    const links = await this.clientSupplierLinkRepo.find({
      where: { supplier_id: supplierId },
      select: ['client_company_id', 'quota_status'],
    });
    for (const link of links) {
      const clientCompanyId = Number(link.client_company_id);
      if (!Number.isFinite(clientCompanyId) || clientCompanyId <= 0) {
        continue;
      }
      if (
        supplierCompanyId != null &&
        Number.isFinite(Number(supplierCompanyId)) &&
        clientCompanyId === Number(supplierCompanyId)
      ) {
        continue;
      }
      if (
        this.supplierQuotaLifecycleService.resolveAccountQuotaStatus(link) ===
        SUPPLIER_QUOTA_STATUS.REMOVED
      ) {
        continue;
      }
      clientIds.add(clientCompanyId);
    }

    return [...clientIds];
  }

  /**
   * Produse noi: inactiv per-client implicit; bifarea „Vizibil pentru client” la creare = activ pentru toți clienții legați.
   * Produse vechi fără rânduri de activare rămân pe fallback global is_active.
   */
  private async bootstrapClientActivationForNewProduct(
    supplierId: number,
    supplierCompanyId: number,
    supplierProductId: number,
    visibleForClients: boolean,
  ): Promise<void> {
    const clientCompanyIds = await this.getLinkedClientCompanyIdsForSupplier(
      supplierId,
      supplierCompanyId,
    );
    if (clientCompanyIds.length === 0) {
      return;
    }

    const rows = clientCompanyIds.map((clientCompanyId) =>
      this.supplierProductClientActivationRepo.create({
        supplier_company_id: supplierCompanyId,
        client_company_id: clientCompanyId,
        supplier_product_id: supplierProductId,
        is_active: visibleForClients,
      }),
    );
    await this.supplierProductClientActivationRepo.save(rows);
  }

  private async attachResolvedIsActiveForClientCompany<
    T extends SupplierProduct,
  >(
    products: T[],
    clientCompanyId: number,
  ): Promise<Array<T & { is_active: boolean }>> {
    if (products.length === 0) {
      return products;
    }
    const productIds = products
      .map((product) => Number(product.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const activationByProductId = await this.getClientActivationRowsForProducts(
      clientCompanyId,
      productIds,
    );
    return products.map((product) => ({
      ...product,
      is_active: resolveIsActiveForClientProduct(
        product.is_active,
        activationByProductId.get(Number(product.id)),
      ),
    }));
  }

  async getMySupplierClientProductPrices(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    clientCompanyId: number,
    pageRaw?: string | number,
    limitRaw?: string | number,
  ): Promise<
    PaginatedOrdersResponse<{
      supplier_product_id: number;
      product_name: string;
      standard_price: number;
      standard_price_with_vat: number | null;
      effective_price: number;
      effective_price_with_vat: number | null;
      preferred_price: number | null;
      preferred_price_with_vat: number | null;
      vat_rate: number | null;
      price_base_quantity: number | null;
      price_base_unit: string | null;
      unit_of_measure: string;
      is_active: boolean;
      updated_at: Date | null;
      updated_by_user_id: number | null;
    }>
  > {
    const summary = await this.findMySupplierForFurnizorTenant(
      companyId,
      companyType,
    );
    await this.findMySupplierClientByIdForFurnizorTenant(
      companyId,
      companyType,
      clientCompanyId,
    );

    const { page: requestedPage, limit } = normalizeOrdersPagination(
      pageRaw,
      limitRaw ?? DEFAULT_CLIENT_PRICES_PAGE_LIMIT,
    );
    const total = await this.supplierProductRepo.count({
      where: { supplier_id: summary.id },
    });
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const page = Math.min(requestedPage, totalPages);

    const products = await this.supplierProductRepo.find({
      where: { supplier_id: summary.id },
      select: [
        'id',
        'product_name',
        'price_per_unit',
        'price_base_quantity',
        'price_base_unit',
        'unit_of_measure',
        'is_active',
        'vat',
      ],
      order: { product_name: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const pricesMap = await this.getPreferredPriceMapForClientCompany(
      clientCompanyId,
      summary.id,
    );

    const supplierProductIds = products.map((product) => Number(product.id));
    const activationByProductId = await this.getClientActivationRowsForProducts(
      clientCompanyId,
      supplierProductIds,
    );

    const data = products.map((product) => {
      const currentPrice = pricesMap.get(Number(product.id)) ?? null;
      const standardPrice = Number(product.price_per_unit) || 0;
      const vatRate = resolveProductVatRate(product.vat);
      const preferredPrice =
        currentPrice != null ? Number(currentPrice.preferred_price) || 0 : null;
      const effectivePrice =
        preferredPrice != null ? preferredPrice : standardPrice;
      const priceBaseQuantity = normalizePriceBaseQuantity(
        product.price_base_quantity,
      );
      return {
        supplier_product_id: Number(product.id),
        product_name: product.product_name,
        standard_price: standardPrice,
        standard_price_with_vat:
          vatRate != null ? priceWithVatFromNet(standardPrice, vatRate) : null,
        effective_price: effectivePrice,
        effective_price_with_vat:
          vatRate != null ? priceWithVatFromNet(effectivePrice, vatRate) : null,
        preferred_price: preferredPrice,
        preferred_price_with_vat:
          preferredPrice != null && vatRate != null
            ? priceWithVatFromNet(preferredPrice, vatRate)
            : null,
        vat_rate: vatRate,
        price_base_quantity: priceBaseQuantity,
        price_base_unit:
          priceBaseQuantity != null
            ? resolvePriceBaseUnit(
                product.price_base_unit,
                product.unit_of_measure,
              )
            : null,
        unit_of_measure: product.unit_of_measure,
        is_active: resolveIsActiveForClientProduct(
          product.is_active,
          activationByProductId.get(Number(product.id)),
        ),
        updated_at: currentPrice?.updated_at ?? null,
        updated_by_user_id: currentPrice?.updated_by_user_id ?? null,
      };
    });

    return buildOrdersPaginatedResponse(data, page, limit, total);
  }

  async setMySupplierClientProductActivation(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    clientCompanyId: number,
    supplierProductId: number,
    dto: SetSupplierProductClientActivationDto,
  ): Promise<{ supplier_product_id: number; is_active: boolean }> {
    const summary = await this.findMySupplierForFurnizorTenant(
      companyId,
      companyType,
    );
    await this.findMySupplierClientByIdForFurnizorTenant(
      companyId,
      companyType,
      clientCompanyId,
    );

    const supplierProduct = await this.supplierProductRepo.findOne({
      where: {
        id: supplierProductId,
        supplier_id: summary.id,
      },
    });
    if (!supplierProduct) {
      throw new NotFoundException('Produsul furnizor nu a fost găsit');
    }

    const resolvedCompanyId = Number(companyId);
    const shouldActivate = dto.is_active === true;

    if (shouldActivate) {
      const existing = await this.supplierProductClientActivationRepo.findOne({
        where: {
          client_company_id: clientCompanyId,
          supplier_product_id: supplierProductId,
        },
      });
      if (existing) {
        existing.is_active = true;
        await this.supplierProductClientActivationRepo.save(existing);
      } else {
        await this.supplierProductClientActivationRepo.save(
          this.supplierProductClientActivationRepo.create({
            supplier_company_id: resolvedCompanyId,
            client_company_id: clientCompanyId,
            supplier_product_id: supplierProductId,
            is_active: true,
          }),
        );
      }
    } else {
      const existing = await this.supplierProductClientActivationRepo.findOne({
        where: {
          client_company_id: clientCompanyId,
          supplier_product_id: supplierProductId,
        },
      });
      if (existing) {
        existing.is_active = false;
        await this.supplierProductClientActivationRepo.save(existing);
      } else {
        await this.supplierProductClientActivationRepo.save(
          this.supplierProductClientActivationRepo.create({
            supplier_company_id: resolvedCompanyId,
            client_company_id: clientCompanyId,
            supplier_product_id: supplierProductId,
            is_active: false,
          }),
        );
      }
    }

    const activationByProductId = await this.getClientActivationRowsForProducts(
      clientCompanyId,
      [supplierProductId],
    );
    const isActive = resolveIsActiveForClientProduct(
      supplierProduct.is_active,
      activationByProductId.get(supplierProductId),
    );

    return {
      supplier_product_id: supplierProductId,
      is_active: isActive,
    };
  }

  async upsertMySupplierClientProductPrice(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    clientCompanyId: number,
    supplierProductId: number,
    dto: UpsertSupplierProductClientPriceDto,
    actorUserId?: number | null,
    actorDisplayName?: string | null,
  ): Promise<SupplierProductClientPrice> {
    const summary = await this.findMySupplierForFurnizorTenant(
      companyId,
      companyType,
    );
    const supplier = await this.findOne(summary.id, undefined);
    await this.findMySupplierClientByIdForFurnizorTenant(
      companyId,
      companyType,
      clientCompanyId,
    );
    const supplierProduct = await this.supplierProductRepo.findOne({
      where: { id: supplierProductId, supplier_id: summary.id },
    });
    if (!supplierProduct) {
      throw new NotFoundException(
        'Produsul nu aparține furnizorului autentificat',
      );
    }

    const vatRate = resolveProductVatRate(supplierProduct.vat);
    const { preferredPrice, preferredPriceWithVat, editSource } =
      this.resolvePreferredPriceFromDto(dto, vatRate);
    const standardPrice = Number(supplierProduct.price_per_unit) || 0;
    const standardPriceWithVat =
      vatRate != null ? priceWithVatFromNet(standardPrice, vatRate) : null;
    const changedByName = await this.resolveChangedByNameSnapshot(
      actorUserId ?? null,
      actorDisplayName ?? null,
    );

    return this.connection.transaction(async (manager) => {
      const repo = manager.getRepository(SupplierProductClientPrice);
      const existing = await repo.findOne({
        where: {
          client_company_id: clientCompanyId,
          supplier_product_id: supplierProductId,
        },
      });
      const action = existing
        ? SupplierProductClientPriceHistoryAction.UPDATED
        : SupplierProductClientPriceHistoryAction.CREATED;
      const row =
        existing ??
        repo.create({
          supplier_company_id: Number(supplier.owner_company_id),
          client_company_id: clientCompanyId,
          supplier_product_id: supplierProductId,
          updated_by_user_id: actorUserId ?? null,
        });
      const oldPrice = existing ? Number(existing.preferred_price) || 0 : null;
      const oldPriceWithVat =
        oldPrice != null && vatRate != null
          ? priceWithVatFromNet(oldPrice, vatRate)
          : null;
      row.preferred_price = preferredPrice;
      row.updated_by_user_id = actorUserId ?? null;
      const saved = await repo.save(row);
      await this.appendClientPriceHistory(manager, {
        supplierCompanyId: Number(supplier.owner_company_id),
        clientCompanyId,
        supplierProductId,
        oldPrice,
        newPrice: preferredPrice,
        vatRate,
        oldPriceWithVat,
        newPriceWithVat: preferredPriceWithVat,
        editSource,
        action,
        changedByUserId: actorUserId ?? null,
        changedByName,
        standardPriceSnapshot: standardPrice,
        standardPriceWithVatSnapshot: standardPriceWithVat,
      });
      return saved;
    });
  }

  async removeMySupplierClientProductPrice(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    clientCompanyId: number,
    supplierProductId: number,
    actorUserId?: number | null,
    actorDisplayName?: string | null,
  ): Promise<{ success: true }> {
    const summary = await this.findMySupplierForFurnizorTenant(
      companyId,
      companyType,
    );
    const supplier = await this.findOne(summary.id, undefined);
    await this.findMySupplierClientByIdForFurnizorTenant(
      companyId,
      companyType,
      clientCompanyId,
    );
    const supplierProduct = await this.supplierProductRepo.findOne({
      where: { id: supplierProductId, supplier_id: summary.id },
      select: ['id', 'vat', 'price_per_unit'],
    });
    if (!supplierProduct) {
      throw new NotFoundException(
        'Produsul nu aparține furnizorului autentificat',
      );
    }

    const vatRate = resolveProductVatRate(supplierProduct.vat);
    const standardPrice = Number(supplierProduct.price_per_unit) || 0;
    const standardPriceWithVat =
      vatRate != null ? priceWithVatFromNet(standardPrice, vatRate) : null;
    const changedByName = await this.resolveChangedByNameSnapshot(
      actorUserId ?? null,
      actorDisplayName ?? null,
    );

    await this.connection.transaction(async (manager) => {
      const repo = manager.getRepository(SupplierProductClientPrice);
      const existing = await repo.findOne({
        where: {
          client_company_id: clientCompanyId,
          supplier_product_id: supplierProductId,
        },
      });
      if (!existing) {
        return;
      }
      const oldPriceRaw = existing.preferred_price;
      const oldPriceNum =
        oldPriceRaw == null ? null : Number(oldPriceRaw);
      const oldPriceSafe =
        oldPriceNum != null && Number.isFinite(oldPriceNum) ? oldPriceNum : null;
      await repo.delete(existing.id);
      await this.appendClientPriceHistory(manager, {
        supplierCompanyId: Number(supplier.owner_company_id),
        clientCompanyId,
        supplierProductId,
        oldPrice: oldPriceSafe,
        newPrice: null,
        vatRate,
        oldPriceWithVat:
          oldPriceSafe != null && vatRate != null
            ? priceWithVatFromNet(oldPriceSafe, vatRate)
            : null,
        newPriceWithVat: null,
        editSource: SupplierProductClientPriceEditSource.WITHOUT_VAT,
        action: SupplierProductClientPriceHistoryAction.REMOVED,
        changedByUserId: actorUserId ?? null,
        changedByName,
        standardPriceSnapshot: standardPrice,
        standardPriceWithVatSnapshot: standardPriceWithVat,
      });
    });

    return { success: true };
  }

  async getMySupplierClientProductPriceHistory(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
    clientCompanyId: number,
    supplierProductId?: number,
    pageRaw?: string | number,
    limitRaw?: string | number,
  ): Promise<
    PaginatedOrdersResponse<
      SupplierProductClientPriceHistory & {
        product_name: string | null;
        changed_by_label: string | null;
      }
    >
  > {
    const summary = await this.findMySupplierForFurnizorTenant(
      companyId,
      companyType,
    );
    const supplier = await this.findOne(summary.id, undefined);
    await this.findMySupplierClientByIdForFurnizorTenant(
      companyId,
      companyType,
      clientCompanyId,
    );

    const qb = this.supplierProductClientPriceHistoryRepo
      .createQueryBuilder('history')
      .innerJoin(
        SupplierProduct,
        'sp',
        'sp.id = history.supplier_product_id',
      )
      .where('history.client_company_id = :clientCompanyId', {
        clientCompanyId,
      })
      .andWhere('history.supplier_company_id = :supplierCompanyId', {
        supplierCompanyId: Number(supplier.owner_company_id),
      })
      .andWhere('sp.supplier_id = :supplierId', { supplierId: summary.id });

    if (
      supplierProductId != null &&
      Number.isFinite(Number(supplierProductId)) &&
      Number(supplierProductId) > 0
    ) {
      qb.andWhere('history.supplier_product_id = :supplierProductId', {
        supplierProductId: Number(supplierProductId),
      });
    }

    const { page: requestedPage, limit } = normalizeOrdersPagination(
      pageRaw,
      limitRaw ?? DEFAULT_CLIENT_PRICE_HISTORY_PAGE_LIMIT,
    );
    const total = await qb.clone().getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const page = Math.min(requestedPage, totalPages);

    const rows = await qb
      .select([
        'history.id AS id',
        'history.supplier_company_id AS supplier_company_id',
        'history.client_company_id AS client_company_id',
        'history.supplier_product_id AS supplier_product_id',
        'history.old_price AS old_price',
        'history.new_price AS new_price',
        'history.vat_rate AS vat_rate',
        'history.old_price_with_vat AS old_price_with_vat',
        'history.new_price_with_vat AS new_price_with_vat',
        'history.edit_source AS edit_source',
        'history.standard_price_snapshot AS standard_price_snapshot',
        'history.standard_price_with_vat_snapshot AS standard_price_with_vat_snapshot',
        'history.action AS action',
        'history.changed_by_user_id AS changed_by_user_id',
        'history.changed_by_name AS changed_by_name',
        'history.changed_at AS changed_at',
        'sp.product_name AS product_name',
      ])
      .orderBy('history.changed_at', 'DESC')
      .addOrderBy('history.id', 'DESC')
      // getRawMany() ignores skip/take in TypeORM — must use offset/limit.
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<
        SupplierProductClientPriceHistory & {
          product_name: string | null;
        }
      >();

    const missingNameUserIds = rows
      .filter((row) => {
        const snapshot = String(
          (row as { changed_by_name?: string | null }).changed_by_name ?? '',
        ).trim();
        return (
          !snapshot &&
          Number.isFinite(Number((row as { changed_by_user_id?: number }).changed_by_user_id)) &&
          Number((row as { changed_by_user_id?: number }).changed_by_user_id) > 0
        );
      })
      .map((row) =>
        Number((row as { changed_by_user_id?: number }).changed_by_user_id),
      );
    const labels = await this.resolveAuthUserDisplayNames(missingNameUserIds);

    const data = rows.map((row) => {
      const changedAtRaw = (row as { changed_at?: Date | string }).changed_at;
      const changedAtIso =
        changedAtRaw instanceof Date
          ? changedAtRaw.toISOString()
          : changedAtRaw != null
            ? new Date(String(changedAtRaw).replace(' ', 'T') + 'Z').toISOString()
            : null;
      const userId = Number(
        (row as { changed_by_user_id?: number }).changed_by_user_id,
      );
      const snapshotName = String(
        (row as { changed_by_name?: string | null }).changed_by_name ?? '',
      ).trim();
      const liveLabel =
        Number.isFinite(userId) && userId > 0 ? labels.get(userId) : undefined;
      const changedByLabel =
        snapshotName ||
        (liveLabel &&
        !/^User #\d+$/i.test(liveLabel) &&
        !/^Utilizator #\d+$/i.test(liveLabel)
          ? liveLabel
          : null) ||
        (Number.isFinite(userId) && userId > 0
          ? `Utilizator #${userId}`
          : null);
      return {
        ...row,
        // Always emit UTC ISO so frontend formats once in local timezone.
        changed_at: (changedAtIso
          ? new Date(changedAtIso)
          : row.changed_at) as Date,
        changed_by_label: changedByLabel,
      };
    });

    return buildOrdersPaginatedResponse(data, page, limit, total);
  }

  private validateOptionalGrossNetQuantities(
    gross?: number | null,
    net?: number | null,
  ): { gross_quantity: number | null; net_quantity: number | null } {
    const grossVal =
      gross === undefined || gross === null ? null : Number(gross);
    const netVal = net === undefined || net === null ? null : Number(net);

    if (grossVal !== null) {
      if (!Number.isFinite(grossVal) || grossVal <= 0) {
        throw new BadRequestException(
          'Cantitatea brută trebuie să fie strict mai mare decât 0',
        );
      }
    }
    if (netVal !== null) {
      if (!Number.isFinite(netVal) || netVal <= 0) {
        throw new BadRequestException(
          'Cantitatea netă trebuie să fie strict mai mare decât 0',
        );
      }
    }
    if (grossVal !== null && netVal !== null && netVal > grossVal) {
      throw new BadRequestException(
        'Cantitatea netă nu poate fi mai mare decât cantitatea brută',
      );
    }
    return { gross_quantity: grossVal, net_quantity: netVal };
  }

  private async assertSupplierLinkedToClientCompany(
    supplierId: number,
    clientCompanyId: number,
  ): Promise<void> {
    if (await this.hasClientSupplierLink(clientCompanyId, supplierId)) {
      return;
    }

    const rows = await this.supplierLocationsRepo.find({
      where: { supplier_id: supplierId },
    });
    let hadFetchFailure = false;
    for (const row of rows) {
      const { location, failed } = await this.fetchLocationOrFail(row.id_location);
      if (failed) {
        hadFetchFailure = true;
        continue;
      }
      const locCompanyId = Number(
        location?.company_id ?? location?.companyId ?? 0,
      );
      if (locCompanyId === clientCompanyId) {
        return;
      }
    }
    if (hadFetchFailure) {
      throw new ServiceUnavailableException(
        'Nu am putut verifica asocierea furnizorului (serviciul de locații nu a răspuns). Reîncearcă.',
      );
    }
    throw new ForbiddenException(
      'Furnizorul nu este asociat companiei client autentificate',
    );
  }

  /**
   * Client admin may CRUD supplier_products only for a supplier that:
   * exists, is linked to the current client company, and has no furnizor login.
   */
  private async assertClientAdminCanManageClientManagedSupplier(
    supplierId: number,
    userContext: SupplierProductUserContext,
  ): Promise<{ supplier: Supplier; clientCompanyId: number }> {
    if (!isClientAdminCatalogManager(userContext)) {
      throw new ForbiddenException(
        'Doar un admin al companiei client poate administra catalogul unui furnizor fără cont',
      );
    }
    const id = Number(supplierId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException('supplier_id este obligatoriu și trebuie să fie un număr valid');
    }
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }
    const clientCompanyId = Number(userContext.companyId);
    await this.assertSupplierLinkedToClientCompany(id, clientCompanyId);
    if (await this.hasSupplierLoginAccount(id)) {
      throw new ForbiddenException(
        'Catalogul acestui furnizor este administrat de contul furnizorului, nu de client',
      );
    }
    return { supplier, clientCompanyId };
  }

  private async assertClientAdminOwnsSupplierProduct(
    product: SupplierProduct,
    supplier: Supplier,
    clientCompanyId: number,
  ): Promise<void> {
    if (Number(product.supplier_id) !== Number(supplier.id)) {
      throw new ForbiddenException(
        'Produsul nu aparține furnizorului selectat',
      );
    }
    if (
      !isAllowedClientManagedProductCompany(
        product.company_id,
        clientCompanyId,
        supplier.owner_company_id,
      )
    ) {
      throw new ForbiddenException(
        'Produsul nu aparține companiei client autentificate',
      );
    }
  }

  private async bootstrapClientManagedProductRelations(
    supplier: Supplier,
    clientCompanyId: number,
    supplierProductId: number,
    isActive: boolean,
  ): Promise<void> {
    const ownerCompanyId = Number(supplier.owner_company_id);
    const supplierCompanyId =
      Number.isFinite(ownerCompanyId) && ownerCompanyId > 0
        ? ownerCompanyId
        : clientCompanyId;

    const existingActivation = await this.supplierProductClientActivationRepo.findOne({
      where: {
        client_company_id: clientCompanyId,
        supplier_product_id: supplierProductId,
      },
    });
    if (existingActivation) {
      existingActivation.is_active = isActive;
      existingActivation.supplier_company_id = supplierCompanyId;
      await this.supplierProductClientActivationRepo.save(existingActivation);
    } else {
      await this.supplierProductClientActivationRepo.save(
        this.supplierProductClientActivationRepo.create({
          supplier_company_id: supplierCompanyId,
          client_company_id: clientCompanyId,
          supplier_product_id: supplierProductId,
          is_active: isActive,
        }),
      );
    }

    const existingVisibility = await this.supplierProductClientVisibilityRepo.findOne({
      where: {
        client_company_id: clientCompanyId,
        supplier_product_id: supplierProductId,
      },
    });
    if (existingVisibility) {
      existingVisibility.is_visible = true;
      await this.supplierProductClientVisibilityRepo.save(existingVisibility);
    } else {
      await this.supplierProductClientVisibilityRepo.save(
        this.supplierProductClientVisibilityRepo.create({
          client_company_id: clientCompanyId,
          supplier_product_id: supplierProductId,
          is_visible: true,
        }),
      );
    }

    const supplierProduct = await this.supplierProductRepo.findOne({
      where: { id: supplierProductId },
    });
    const clientStockProductId = Number(supplierProduct?.product_id);
    if (!Number.isFinite(clientStockProductId) || clientStockProductId <= 0) {
      return;
    }

    await this.ensureClientManagedProductMapping(
      clientCompanyId,
      supplierProductId,
      clientStockProductId,
    );
  }

  /**
   * Client-managed create picks a product from the client nomenclator.
   * The order modal requires an explicit mapping (supplier_product → client stock product)
   * to select/submit a line; identity mapping is correct because product_id already is
   * that nomenclator row.
   */
  private async ensureClientManagedProductMapping(
    clientCompanyId: number,
    supplierProductId: number,
    clientStockProductId: number,
  ): Promise<void> {
    const existing = await this.supplierProductClientMappingRepo.findOne({
      where: {
        client_company_id: clientCompanyId,
        supplier_product_id: supplierProductId,
      },
    });
    if (existing) {
      if (Number(existing.client_stock_product_id) !== clientStockProductId) {
        existing.client_stock_product_id = clientStockProductId;
        await this.supplierProductClientMappingRepo.save(existing);
      }
      return;
    }
    await this.supplierProductClientMappingRepo.save(
      this.supplierProductClientMappingRepo.create({
        client_company_id: clientCompanyId,
        supplier_product_id: supplierProductId,
        client_stock_product_id: clientStockProductId,
      }),
    );
  }

  private async persistNewSupplierProduct(
    dto: CreateSupplierProductDto,
    supplierId: number,
    companyId: number | null,
    isActive: boolean,
  ): Promise<SupplierProduct> {
    const existingProduct =
      dto.product_id != null &&
      Number.isFinite(Number(dto.product_id)) &&
      Number(dto.product_id) > 0
        ? await this.supplierProductRepo.findOne({
            where: { supplier_id: supplierId, product_id: Number(dto.product_id) },
          })
        : null;
    if (existingProduct) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Product already associated with supplier: ${dto.product_id}`);
      throw new BadRequestException('Produsul este deja asociat');
    }

    const quantities = this.validateOptionalGrossNetQuantities(
      dto.gross_quantity,
      dto.net_quantity,
    );

    const {
      gross_quantity: _dtoGross,
      net_quantity: _dtoNet,
      supplier_id: _dtoSupplierId,
      price_base_quantity: _dtoPriceBaseQty,
      price_base_unit: _dtoPriceBaseUnit,
      storage_location: _dtoStorageLocation,
      ...productFields
    } = dto;

    const priceBaseQuantity = normalizePriceBaseQuantity(dto.price_base_quantity);
    const priceBaseUnit = resolvePriceBaseUnit(
      dto.price_base_unit,
      dto.unit_of_measure,
    );

    const storageLocationRaw = dto.storage_location;
    const storageLocation =
      storageLocationRaw == null
        ? null
        : (() => {
            const trimmed = String(storageLocationRaw).trim();
            return trimmed === '' ? null : trimmed.slice(0, 255);
          })();

    const supplierProduct = this.supplierProductRepo.create({
      ...productFields,
      product_id:
        dto.product_id != null &&
        Number.isFinite(Number(dto.product_id)) &&
        Number(dto.product_id) > 0
          ? Number(dto.product_id)
          : null,
      is_active: isActive,
      supplier_id: supplierId,
      company_id: companyId,
      gross_quantity: quantities.gross_quantity,
      net_quantity: quantities.net_quantity,
      price_base_quantity: priceBaseQuantity,
      price_base_unit: priceBaseQuantity != null ? priceBaseUnit : null,
      storage_location: storageLocation,
    });
    return this.supplierProductRepo.save(supplierProduct);
  }

  /**
   * Ca assertSupplierLinkedToClientCompany, dar în loc să respingă cu 403 atunci când
   * furnizorul nu are încă nicio locație a companiei client, creează automat asocierea
   * (la locația de lucru curentă, dacă e cunoscută, altfel la prima locație a companiei).
   * Configurarea unei mapări de produs implică deja intenția clientului de a folosi
   * furnizorul, deci pasul manual separat „Locații → Asociază furnizor" devine inutil aici.
   */
  private async ensureSupplierLinkedToClientCompany(
    supplierId: number,
    clientCompanyId: number,
    selectedWorkLocationId?: number,
  ): Promise<void> {
    const rows = await this.supplierLocationsRepo.find({
      where: { supplier_id: supplierId },
    });
    let hadFetchFailure = false;
    for (const row of rows) {
      const { location, failed } = await this.fetchLocationOrFail(row.id_location);
      if (failed) {
        hadFetchFailure = true;
        continue;
      }
      const locCompanyId = Number(
        location?.company_id ?? location?.companyId ?? 0,
      );
      if (locCompanyId === clientCompanyId) {
        return;
      }
    }
    if (hadFetchFailure) {
      throw new ServiceUnavailableException(
        'Nu am putut verifica asocierea furnizorului (serviciul de locații nu a răspuns). Reîncearcă.',
      );
    }

    // Nu atașa automat Manual/Cont străin pe locațiile clientului.
    // Cont: doar dacă există deja client_supplier_links (apoi seed locații).
    // Manual: trebuie deja legat de o locație a companiei — altfel 403.
    const supplier = await this.supplierRepo.findOne({
      where: { id: supplierId },
      select: ['id', 'owner_company_id'],
    });
    const ownerCompanyId = Number(supplier?.owner_company_id);
    const isCont =
      Number.isFinite(ownerCompanyId) && ownerCompanyId > 0;
    if (isCont) {
      const linked = await this.hasClientSupplierLink(
        clientCompanyId,
        supplierId,
      );
      if (!linked) {
        throw new ForbiddenException(
          'Furnizorul nu este asociat companiei client autentificate',
        );
      }
    } else {
      throw new ForbiddenException(
        'Furnizorul nu este asociat companiei client autentificate',
      );
    }

    let targetLocationId: number | null = null;
    if (
      selectedWorkLocationId != null &&
      Number.isFinite(selectedWorkLocationId) &&
      selectedWorkLocationId > 0
    ) {
      const { location, failed } = await this.fetchLocationOrFail(selectedWorkLocationId);
      if (failed) {
        throw new ServiceUnavailableException(
          'Nu am putut verifica locația de lucru (serviciul de locații nu a răspuns). Reîncearcă.',
        );
      }
      const locCompanyId = Number(location?.company_id ?? location?.companyId ?? 0);
      if (location && locCompanyId === clientCompanyId) {
        targetLocationId = selectedWorkLocationId;
      }
    }
    if (targetLocationId == null) {
      throw new BadRequestException(
        'Selectează o locație de lucru validă pentru a asocia furnizorul la livrare',
      );
    }

    await this.assignSupplierToLocation(supplierId, targetLocationId);
  }

  private resolveClientLocationIdForMapping(
    clientCompanyId: number,
    selectedWorkLocationId?: number | null,
  ): number {
    const locationId = Number(selectedWorkLocationId);
    if (!Number.isFinite(locationId) || locationId <= 0) {
      throw new BadRequestException(
        'Selectează o locație de lucru validă pentru maparea produsului',
      );
    }
    return locationId;
  }

  private async assertClientLocationBelongsToCompany(
    locationId: number,
    clientCompanyId: number,
  ): Promise<void> {
    const { location, failed } = await this.fetchLocationOrFail(locationId);
    if (failed) {
      throw new ServiceUnavailableException(
        'Nu am putut verifica locația selectată (serviciul de locații nu a răspuns). Reîncearcă.',
      );
    }
    if (!location) {
      throw new BadRequestException('Locația selectată nu a fost găsită');
    }
    const locCompanyId = Number(location.company_id ?? location.companyId);
    if (!Number.isFinite(locCompanyId) || locCompanyId !== clientCompanyId) {
      throw new BadRequestException(
        'Locația selectată nu aparține companiei autentificate',
      );
    }
  }

  private async assertClientStockProductInCompanyNomenclator(
    clientStockProductId: number,
    clientCompanyId: number,
    locationId?: number | null,
    options?: { requireExactLocation?: boolean },
  ): Promise<void> {
    let locationIdsToCheck: number[] = [];

    if (locationId != null && Number.isFinite(locationId) && locationId > 0) {
      await this.assertClientLocationBelongsToCompany(locationId, clientCompanyId);
      locationIdsToCheck = [locationId];
    } else if (options?.requireExactLocation) {
      throw new BadRequestException(
        'Locația este obligatorie pentru validarea nomenclatorului',
      );
    } else {
      locationIdsToCheck =
        await this.fetchCompanyLocationIds(clientCompanyId);
      if (locationIdsToCheck.length === 0) {
        throw new BadRequestException(
          'Compania nu are locații configurate pentru validarea nomenclatorului',
        );
      }
    }

    for (const locId of locationIdsToCheck) {
      try {
        const catalog =
          await this.stockHttpService.listProductsByLocation(locId);
        if (catalog.some((p) => Number(p.id) === clientStockProductId)) {
          return;
        }
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [assertClientStockProductInCompanyNomenclator] location ${locId}: ${error?.message || error}`,
        );
      }
    }

    throw new BadRequestException(
      'Produsul nu face parte din nomenclatorul disponibil la locațiile companiei',
    );
  }

  /**
   * Rezolvă produsul de stoc client pentru o linie de comandă/recepție.
   * Fără fallback la supplier_products.product_id; mapping obligatoriu per client_company_id.
   */
  private async resolveClientStockProductForOrder(
    clientCompanyId: number,
    supplierProductId: number,
    locationId: number,
    requestedProductId?: number | null,
    options?: { assertOrderItemProductId?: number },
  ): Promise<number> {
    if (!Number.isFinite(clientCompanyId) || clientCompanyId <= 0) {
      throw new BadRequestException('Context companie client invalid');
    }
    if (!Number.isFinite(supplierProductId) || supplierProductId <= 0) {
      throw new BadRequestException('supplier_product_id este obligatoriu');
    }
    if (!Number.isFinite(locationId) || locationId <= 0) {
      throw new BadRequestException(
        'Locația comenzii este obligatorie pentru validarea nomenclatorului',
      );
    }

    const mapping = await this.supplierProductClientMappingRepo.findOne({
      where: {
        client_company_id: clientCompanyId,
        client_location_id: locationId,
        supplier_product_id: supplierProductId,
      },
    });

    let clientStockProductId: number;
    try {
      clientStockProductId = resolveClientStockProductIdFromMapping(
        mapping
          ? {
              client_company_id: Number(mapping.client_company_id),
              client_location_id: Number(mapping.client_location_id),
              supplier_product_id: Number(mapping.supplier_product_id),
              client_stock_product_id: Number(mapping.client_stock_product_id),
            }
          : null,
        clientCompanyId,
        supplierProductId,
        locationId,
      );
      assertRequestedClientStockProductId(
        clientStockProductId,
        requestedProductId,
      );
      if (options?.assertOrderItemProductId != null) {
        assertOrderItemProductIdMatchesMapping(
          options.assertOrderItemProductId,
          clientStockProductId,
        );
      }
    } catch (error) {
      if (error instanceof ClientStockProductResolutionError) {
        if (error.code === 'LEGACY_PRODUCT_ID_MISMATCH') {
          this.logger.warn(
            `[VAL5 data cleanup] clientCompanyId=${clientCompanyId} supplierProductId=${supplierProductId} locationId=${locationId}: ${error.message}`,
          );
        }
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    try {
      await this.assertClientStockProductInCompanyNomenclator(
        clientStockProductId,
        clientCompanyId,
        locationId,
        { requireExactLocation: true },
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException(
          `Produsul furnizor (id=${supplierProductId}) nu este configurat în nomenclatorul locației selectate (location_id=${locationId})`,
        );
      }
      throw error;
    }

    return clientStockProductId;
  }

  async getClientProductMappingsForSupplier(
    supplierId: number,
    userContext?: SupplierProductUserContext,
    clientLocationId?: number | null,
  ): Promise<
    Array<
      SupplierProductClientMapping & {
        client_stock_product_name?: string | null;
      }
    >
  > {
    const clientCompanyId = this.resolveClientCompanyIdFromContext(userContext);
    const locationId = this.resolveClientLocationIdForMapping(
      clientCompanyId,
      clientLocationId,
    );
    await this.assertClientLocationBelongsToCompany(locationId, clientCompanyId);
    await this.assertSupplierLinkedToClientCompany(supplierId, clientCompanyId);

    const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
    if (!supplier) {
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    const rows = await this.supplierProductClientMappingRepo
      .createQueryBuilder('mappings')
      .innerJoin(
        SupplierProduct,
        'sp',
        'sp.id = mappings.supplier_product_id',
      )
      .where('mappings.client_company_id = :clientCompanyId', {
        clientCompanyId,
      })
      .andWhere('mappings.client_location_id = :locationId', { locationId })
      .andWhere('sp.supplier_id = :supplierId', { supplierId })
      .orderBy('mappings.supplier_product_id', 'ASC')
      .getMany();

    const stockUrl =
      this.configService.get<string>('STOCK_HTTP_URL') ||
      process.env.STOCK_HTTP_URL ||
      'http://localhost:3006';
    const nameCache = new Map<number, string>();

    // Un singur request batch pentru toate ID-urile distincte, în loc de N cereri concurente (una per produs).
    const distinctIds = [...new Set(rows.map((row) => row.client_stock_product_id))];
    if (distinctIds.length > 0) {
      try {
        const resp = await firstValueFrom(
          this.httpService.get(`${stockUrl}/stock/products/names`, {
            params: { ids: distinctIds.join(',') },
            headers: this.internalServiceHeaders(),
            timeout: 3000,
          }),
        );
        const items: Array<{ id: number; name: string }> = Array.isArray(resp.data)
          ? resp.data
          : Array.isArray(resp.data?.data)
            ? resp.data.data
            : [];
        for (const item of items) {
          if (item?.name) {
            nameCache.set(Number(item.id), String(item.name));
          }
        }
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [getClientProductMappingsForSupplier] Nu am putut obține numele produselor: ${error?.message || error}`,
        );
      }
    }

    return rows.map((row) => ({
      ...row,
      client_stock_product_name: nameCache.get(row.client_stock_product_id) ?? null,
    }));
  }

  async upsertSupplierProductClientConfig(
    supplierId: number,
    supplierProductId: number,
    dto: UpsertSupplierProductClientConfigDto,
    userContext?: SupplierProductUserContext,
    selectedWorkLocationId?: number,
  ): Promise<{
    mapping: SupplierProductClientMapping;
    supplier_product: SupplierProduct;
  }> {
    const clientCompanyId = this.resolveClientCompanyIdFromContext(userContext);
    if (!userContext || !canManageSupplierProductClientMapping(userContext)) {
      throw new ForbiddenException(
        'Nu aveți permisiunea de a configura asocierile produselor furnizor',
      );
    }

    const clientLocationId = this.resolveClientLocationIdForMapping(
      clientCompanyId,
      selectedWorkLocationId,
    );
    await this.assertClientLocationBelongsToCompany(
      clientLocationId,
      clientCompanyId,
    );

    await this.ensureSupplierLinkedToClientCompany(
      supplierId,
      clientCompanyId,
      clientLocationId,
    );

    const supplierProduct = await this.supplierProductRepo.findOne({
      where: { id: supplierProductId, supplier_id: supplierId },
    });
    if (!supplierProduct) {
      throw new NotFoundException(
        'Produsul furnizorului nu aparține furnizorului selectat',
      );
    }

    const clientStockProductId = Number(dto.client_stock_product_id);
    if (!Number.isFinite(clientStockProductId) || clientStockProductId <= 0) {
      throw new BadRequestException(
        'client_stock_product_id trebuie să fie un număr pozitiv',
      );
    }
    await this.assertClientStockProductInCompanyNomenclator(
      clientStockProductId,
      clientCompanyId,
      clientLocationId,
      { requireExactLocation: true },
    );

    const quantities = this.validateOptionalGrossNetQuantities(
      dto.gross_quantity,
      dto.net_quantity,
    );

    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const mappingRepo = queryRunner.manager.getRepository(
        SupplierProductClientMapping,
      );
      const productRepo = queryRunner.manager.getRepository(SupplierProduct);

      let mapping = await mappingRepo.findOne({
        where: {
          client_company_id: clientCompanyId,
          client_location_id: clientLocationId,
          supplier_product_id: supplierProductId,
        },
      });

      if (mapping) {
        mapping.client_stock_product_id = clientStockProductId;
      } else {
        mapping = mappingRepo.create({
          client_company_id: clientCompanyId,
          client_location_id: clientLocationId,
          supplier_product_id: supplierProductId,
          client_stock_product_id: clientStockProductId,
        });
      }
      mapping = await mappingRepo.save(mapping);

      supplierProduct.gross_quantity = quantities.gross_quantity;
      supplierProduct.net_quantity = quantities.net_quantity;
      const updatedProduct = await productRepo.save(supplierProduct);

      await queryRunner.commitTransaction();
      return { mapping, supplier_product: updatedProduct };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Nomenclator depozit furnizor — produse din stock.products cu rând stock la depozit.
   */
  async getMySupplierNomenclatorProducts(
    companyId: number | null | undefined,
    companyType: string | null | undefined,
  ): Promise<Array<Record<string, unknown>>> {
    const summary = await this.findMySupplierForFurnizorTenant(
      companyId,
      companyType,
    );
    const locationId = await this.resolveSupplierStockLocationId(summary.id);
    try {
      return await this.stockHttpService.listProductsByLocation(locationId);
    } catch (error: any) {
      const status = error?.response?.status;
      const code = error?.code || error?.cause?.code;
      if (
        !status &&
        (code === 'ECONNREFUSED' ||
          code === 'ENOTFOUND' ||
          /ECONNREFUSED|connect/i.test(String(error?.message || '')))
      ) {
        throw new BadRequestException(
          'Serviciul de stoc (stock-ms) nu este disponibil. Porniți microserviciul pe portul 3006 și reîncercați.',
        );
      }
      const message =
        error?.response?.data?.message ??
        error?.message ??
        'Eroare la încărcarea nomenclatorului';
      throw new BadRequestException(message);
    }
  }

  async createMySupplierNomenclatorProduct(
    dto: {
      name: string;
      unit: string;
      sku?: string | null;
      description?: string | null;
      min_stock_level?: number | null;
      is_active?: boolean;
      is_consumable?: boolean;
      photo?: string | null;
    },
    userContext?: SupplierProductUserContext,
  ): Promise<{ product: Record<string, unknown>; stock: Record<string, unknown> }> {
    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    assertFurnizorProductManager(userContext);

    const summary = await this.findMySupplierForFurnizorTenant(
      userContext.companyId,
      userContext.companyType,
    );
    const locationId = await this.resolveSupplierStockLocationId(summary.id);

    try {
      return await this.stockHttpService.createProductAtLocation({
        ...dto,
        location_id: locationId,
      });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ?? error?.message ?? 'Eroare la crearea produsului';
      const status = error?.response?.status;
      const code = error?.code || error?.cause?.code;
      if (
        !status &&
        (code === 'ECONNREFUSED' ||
          code === 'ENOTFOUND' ||
          /ECONNREFUSED|connect/i.test(String(message)))
      ) {
        throw new BadRequestException(
          'Serviciul de stoc (stock-ms) nu este disponibil. Porniți microserviciul pe portul 3006 și reîncercați.',
        );
      }
      if (status === 409 || String(message).includes('există deja')) {
        throw new ConflictException(message);
      }
      throw new BadRequestException(message);
    }
  }

  async updateMySupplierNomenclatorProductPhoto(
    productId: number,
    fileName: string,
    base64Content: string,
    userContext?: SupplierProductUserContext,
  ): Promise<{ product_id: number; photo: string }> {
    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    const { summary, locationId } = await this.assertProductInMySupplierNomenclator(
      productId,
      userContext,
    );

    const imageUrl = await this.stockHttpService.uploadProductImage(
      fileName,
      base64Content,
    );
    await this.stockHttpService.updateProductAtLocation(productId, locationId, {
      photo: imageUrl,
    });

    // Sync supplier_products.image_url — altfel UI preferă URL-ul vechi (ex. .webp 404)
    // și poza nouă din stock.products.photo dispare după refresh.
    await this.supplierProductRepo.update(
      { supplier_id: summary.id, product_id: productId },
      { image_url: imageUrl },
    );

    return { product_id: productId, photo: imageUrl };
  }

  async updateMySupplierNomenclatorProduct(
    productId: number,
    dto: {
      name?: string;
      unit?: string;
      sku?: string | null;
      description?: string | null;
      is_consumable?: boolean;
      photo?: string | null;
    },
    userContext?: SupplierProductUserContext,
  ): Promise<Record<string, unknown>> {
    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    const { locationId } = await this.assertProductInMySupplierNomenclator(
      productId,
      userContext,
    );

    const payload: Record<string, unknown> = {};
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.unit !== undefined) payload.unit = dto.unit;
    if (dto.sku !== undefined) payload.sku = dto.sku;
    if (dto.description !== undefined) payload.description = dto.description;
    if (dto.is_consumable !== undefined) payload.is_consumable = dto.is_consumable;
    if (dto.photo !== undefined) payload.photo = dto.photo;

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('Nicio modificare de aplicat');
    }

    try {
      return await this.stockHttpService.updateProductAtLocation(
        productId,
        locationId,
        payload,
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.message ?? error?.message ?? 'Eroare la actualizarea produsului';
      const status = error?.response?.status;
      if (status === 404) {
        throw new NotFoundException(message);
      }
      throw new BadRequestException(message);
    }
  }

  async deleteMySupplierNomenclatorProduct(
    productId: number,
    userContext?: SupplierProductUserContext,
  ): Promise<void> {
    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    const { summary, locationId } = await this.assertProductInMySupplierNomenclator(
      productId,
      userContext,
    );

    const quantities =
      await this.stockHttpService.getQuantitiesForProductsAtLocation(locationId, [
        productId,
      ]);
    const qtyRow = quantities.find((row) => Number(row.product_id) === productId);
    const quantity = qtyRow?.quantity ?? 0;
    const unit = qtyRow?.unit ?? '';
    if (quantity > 0) {
      throw new BadRequestException(
        `Nu se poate șterge produsul: există stoc de ${quantity}${unit ? ` ${unit}` : ''} la depozit.`,
      );
    }

    const supplierProducts = await this.supplierProductRepo.find({
      where: { supplier_id: summary.id, product_id: productId },
    });
    if (supplierProducts.length > 0) {
      await this.supplierProductRepo.remove(supplierProducts);
    }

    const stockRows =
      await this.stockHttpService.listStockAggregatesForProductAtLocation(
        locationId,
        productId,
      );
    for (const stockRow of stockRows) {
      if (stockRow.quantity > 0) {
        throw new BadRequestException(
          'Nu se poate șterge produsul cât timp există stoc la depozit.',
        );
      }
      await this.stockHttpService.deleteStockAggregateById(stockRow.id);
    }

    try {
      await this.stockHttpService.deleteCatalogProductById(productId);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        error?.message ??
        'Eroare la ștergerea produsului din nomenclator';
      if (
        typeof message === 'string' &&
        message.includes('Produsul este folosit în stocuri')
      ) {
        this.logger.log(
          `ℹ️ [deleteMySupplierNomenclatorProduct] Produs ${productId} păstrat în catalog global — există stoc în alte locații.`,
        );
        return;
      }
      throw new BadRequestException(message);
    }
  }

  private async assertProductInMySupplierNomenclator(
    productId: number,
    userContext: SupplierProductUserContext,
  ): Promise<{ summary: { id: number }; locationId: number }> {
    assertFurnizorProductManager(userContext);

    const summary = await this.findMySupplierForFurnizorTenant(
      userContext.companyId,
      userContext.companyType,
    );
    const locationId = await this.resolveSupplierStockLocationId(summary.id);
    const catalog = await this.stockHttpService.listProductsByLocation(locationId);
    const allowed = catalog.some((p) => Number(p.id) === productId);
    if (!allowed) {
      throw new NotFoundException(
        'Produsul nu aparține nomenclatorului depozitului furnizorului',
      );
    }
    return { summary, locationId };
  }

  /**
   * Incrementare manuală stoc depozit furnizor (proxy atomic către stock-ms).
   * Locația se rezolvă exclusiv din JWT / tenant — nu din body.
   */
  async incrementMySupplierStock(
    items: Array<{ product_id: number; quantity: number }>,
    userContext?: SupplierProductUserContext,
  ): Promise<{
    success: true;
    updated: Array<{
      product_id: number;
      quantity_added: number;
      new_quantity: number;
    }>;
  }> {
    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    assertFurnizorProductManager(userContext);

    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Selectează cel puțin un produs');
    }
    if (items.length > 100) {
      throw new BadRequestException('Maximum 100 de produse per request');
    }

    const seen = new Set<number>();
    for (const item of items) {
      const pid = Number(item.product_id);
      const qty = Number(item.quantity);
      if (!Number.isFinite(pid) || pid <= 0 || !Number.isInteger(pid)) {
        throw new BadRequestException('product_id invalid');
      }
      if (seen.has(pid)) {
        throw new BadRequestException(
          `Produsul ${pid} apare de mai multe ori în request`,
        );
      }
      seen.add(pid);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new BadRequestException(
          `Cantitatea trebuie să fie mai mare decât 0 (produs ${pid})`,
        );
      }
    }

    const summary = await this.findMySupplierForFurnizorTenant(
      userContext.companyId,
      userContext.companyType,
    );
    const locationId = await this.resolveSupplierStockLocationId(summary.id);

    const catalog = await this.stockHttpService.listProductsByLocation(locationId);
    const catalogSet = new Set(
      catalog
        .map((p) => Number(p.id))
        .filter((id) => Number.isFinite(id) && id > 0),
    );

    for (const pid of seen) {
      if (!catalogSet.has(pid)) {
        throw new BadRequestException(
          `Produsul ${pid} nu aparține nomenclatorului depozitului furnizorului`,
        );
      }
    }

    try {
      return await this.stockHttpService.incrementStockBatch(
        locationId,
        items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
        })),
      );
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.message ??
        error?.message ??
        'Nu s-au putut adăuga cantitățile în stoc';
      const code = error?.code || error?.cause?.code;
      if (
        !status &&
        (code === 'ECONNREFUSED' ||
          code === 'ENOTFOUND' ||
          /ECONNREFUSED|connect/i.test(String(message)))
      ) {
        throw new BadRequestException(
          'Serviciul de stoc (stock-ms) nu este disponibil. Porniți microserviciul pe portul 3006 și reîncercați.',
        );
      }
      if (status === 403) {
        throw new ForbiddenException(
          Array.isArray(message) ? message.join(', ') : message,
        );
      }
      if (status === 404) {
        throw new NotFoundException(
          Array.isArray(message) ? message.join(', ') : message,
        );
      }
      throw new BadRequestException(
        Array.isArray(message) ? message.join(', ') : message,
      );
    }
  }

  async getSupplierProducts(
    supplierId: number,
    includeInactive = true,
    userContext?: SupplierProductUserContext,
    locationId?: number,
    requesterRoles?: string[] | null,
    applyClientVisibility = false,
  ): Promise<Array<SupplierProduct & {
    linked_product_photo: string | null;
    resolved_image_url: string | null;
  }>> {
    if (
      userContext?.companyType !== 'furnizor' &&
      userContext?.companyId != null &&
      userContext.companyId > 0
    ) {
      await this.assertClientSupplierRelationship(
        Number(userContext.companyId),
        supplierId,
        {
          requireOperationalActive: false,
          requireAccessibleQuota: true,
        },
      );
    }

    const where: Record<string, unknown> = { supplier_id: supplierId };

    if (userContext && isFurnizorProductManager(userContext)) {
      const my = await this.findMySupplierForFurnizorTenant(
        userContext.companyId,
        userContext.companyType,
      );
      if (supplierId !== my.id) {
        throw new ForbiddenException(
          'Nu puteți accesa produsele altui furnizor operațional',
        );
      }
      where.supplier_id = my.id;
      where.company_id = userContext.companyId;
    }

    if (
      userContext?.companyType !== 'furnizor' &&
      userContext?.companyId != null &&
      userContext.companyId > 0
    ) {
      where.is_active = true;
    } else if (!includeInactive) {
      where.is_active = true;
    }
    const products = await this.supplierProductRepo.find({
      where,
      relations: ['measurement_variants'],
      order: { created_at: 'DESC' },
    });

    const resolvedLocationId =
      locationId != null && Number.isFinite(Number(locationId)) && Number(locationId) > 0
        ? Number(locationId)
        : null;

    let filteredProducts = products;
    const applyWarehouseStockFilter =
      resolvedLocationId != null &&
      (await this.hasSupplierLoginAccount(supplierId));
    if (applyWarehouseStockFilter && resolvedLocationId != null) {
      const productIdsAtLocation =
        await this.stockHttpService.getProductIdsAtLocation(resolvedLocationId);
      const catalogProductIdsAtLocation = new Set(productIdsAtLocation);
      filteredProducts = products.filter((sp) =>
        catalogProductIdsAtLocation.has(Number(sp.product_id)),
      );
    }

    if (
      this.shouldApplyClientProductVisibilityFilter(
        userContext,
        applyClientVisibility,
      ) &&
      userContext?.companyId != null
    ) {
      filteredProducts = await this.filterProductsByClientVisibility(
        filteredProducts,
        Number(userContext.companyId),
        supplierId,
      );
    }

    const productIds = [
      ...new Set(
        filteredProducts
          .map((sp) => Number(sp.product_id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    const linkedPhotoMap =
      await this.stockHttpService.getProductPhotosByIds(productIds);

    const includeStorageLocation = this.canExposeProductStorageLocation(
      userContext,
      requesterRoles,
    );

    let rows = filteredProducts.map((sp) => {
      const linkedPhoto = linkedPhotoMap.get(Number(sp.product_id)) ?? null;
      const imageFields = buildSupplierProductImageFields(
        sp.image_url,
        linkedPhoto,
      );
      const row = Object.assign(sp, {
        linked_product_photo: imageFields.linked_product_photo,
        resolved_image_url: imageFields.resolved_image_url,
      });
      if (!includeStorageLocation) {
        row.storage_location = null;
      }
      return row;
    });
    if (
      userContext?.companyType !== 'furnizor' &&
      userContext?.companyId != null &&
      userContext.companyId > 0
    ) {
      rows = await this.attachEffectivePricesForClientCompany(
        rows,
        Number(userContext.companyId),
        supplierId,
      );
      rows = await this.attachResolvedIsActiveForClientCompany(
        rows,
        Number(userContext.companyId),
      );
      if (!includeInactive) {
        rows = rows.filter((row) => row.is_active !== false);
      }
    }
    return rows;
  }

  /**
   * GIU-09: locația fizică din depozit e doar pentru furnizor / magazioner
   * (nu client, nu șofer).
   * Strip doar când știm clar că e client/șofer — altfel nomenclatorul
   * furnizorului pierde prefill-ul după salvare.
   */
  private canExposeProductStorageLocation(
    userContext?: SupplierProductUserContext,
    requesterRoles?: string[] | null,
  ): boolean {
    const roles = Array.isArray(requesterRoles)
      ? requesterRoles.map((role) => String(role).toLowerCase().trim())
      : [];
    if (roles.includes('sofer') || roles.includes('driver')) {
      return false;
    }
    if (userContext?.companyType === 'client') {
      return false;
    }
    return true;
  }

  private async findSupplierProductForUser(
    productId: number,
    userContext?: SupplierProductUserContext,
  ): Promise<SupplierProduct> {
    const supplierProduct = await this.supplierProductRepo.findOne({
      where: { id: productId },
    });
    if (!supplierProduct) {
      throw new NotFoundException('Produsul furnizor nu a fost găsit');
    }

    if (!userContext) {
      return supplierProduct;
    }

    if (isFurnizorProductManager(userContext)) {
      const my = await this.findMySupplierForFurnizorTenant(
        userContext.companyId,
        userContext.companyType,
      );
      if (
        supplierProduct.supplier_id !== my.id ||
        supplierProduct.company_id !== userContext.companyId
      ) {
        throw new ForbiddenException(
          'Produsul nu aparține nomenclatorului companiei furnizor din sesiune',
        );
      }
    }

    return supplierProduct;
  }

  /** Nomenclatură furnizor pentru linie comandă; fallback legacy pe product_id. */
  private async findSupplierProductForOrderLine(
    supplierId: number,
    orderItem: Pick<SupplierOrderItem, 'product_id' | 'supplier_product_id'>,
  ): Promise<SupplierProduct | null> {
    const spId = orderItem.supplier_product_id;
    if (spId != null && Number(spId) > 0) {
      return this.supplierProductRepo.findOne({
        where: { id: Number(spId), supplier_id: supplierId },
      });
    }
    return this.supplierProductRepo.findOne({
      where: { supplier_id: supplierId, product_id: orderItem.product_id },
    });
  }

  private async resolveSupplierProductForNewOrderItem(
    supplierId: number,
    itemDto: CreateSupplierOrderItemDto,
  ): Promise<{ supplierProduct: SupplierProduct; variantId?: number }> {
    const supplierProduct = await this.supplierProductRepo.findOne({
      where: { id: itemDto.supplier_product_id, supplier_id: supplierId },
    });
    if (!supplierProduct) {
      throw new BadRequestException(
        `Produsul furnizor (id=${itemDto.supplier_product_id}) nu aparține furnizorului selectat`,
      );
    }

    let variantId: number | undefined;
    if (itemDto.variant_id != null && Number(itemDto.variant_id) > 0) {
      const variant = await this.supplierProductMeasurementVariantRepo.findOne({
        where: {
          id: Number(itemDto.variant_id),
          supplier_product_id: supplierProduct.id,
        },
      });
      if (!variant) {
        throw new BadRequestException(
          `Varianta (id=${itemDto.variant_id}) nu aparține produsului furnizor`,
        );
      }
      variantId = variant.id;
    }

    return { supplierProduct, variantId };
  }

  async createOrder(dto: CreateSupplierOrderDto, user?: OrderRequesterUser): Promise<SupplierOrder> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Creating order with data: ${JSON.stringify(dto)}`);

    if (user) {
      assertOrderCompanyIdNotEscalated(user, dto.company_id);
      if (!isPlatformOrderRequester(user)) {
        const tenantCompanyId = resolveOrderTenantCompanyId(user);
        if (tenantCompanyId == null) {
          throw new ForbiddenException(
            'Context de companie lipsă pentru crearea comenzii',
          );
        }
        dto = { ...dto, company_id: tenantCompanyId };
      }
      if (dto.created_by_user_id == null) {
        const actorId = resolveOrderActorUserId(user);
        if (actorId != null) {
          dto = { ...dto, created_by_user_id: actorId };
        }
      }
    }
    
    const orderStatus = (dto.status || OrderStatus.DRAFT) as OrderStatus;
    const resolvedSupplierLocationId =
      dto.supplier_location_id != null &&
      Number.isFinite(Number(dto.supplier_location_id)) &&
      Number(dto.supplier_location_id) > 0
        ? Number(dto.supplier_location_id)
        : dto.location_id != null &&
            Number.isFinite(Number(dto.location_id)) &&
            Number(dto.location_id) > 0
          ? Number(dto.location_id)
          : null;

    if (
      SuppliersService.hasSupplierStockDeducted(orderStatus) &&
      resolvedSupplierLocationId == null
    ) {
      throw new BadRequestException(
        'Locația de livrare (supplier_location_id / location_id) este obligatorie pentru plasarea comenzii',
      );
    }

    const supplier = await this.supplierRepo.findOne({
      where: { id: dto.supplier_id },
      relations: ['locations'],
    });
    if (!supplier) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for order creation: ${dto.supplier_id}`);
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }
    if (user) {
      await this.assertSupplierAccessibleToRequester(
        supplier,
        buildSupplierAccessRequester(user),
      );
    }

    const orderCompanyId = Number(dto.company_id);
    if (Number.isFinite(orderCompanyId) && orderCompanyId > 0) {
      const hasAccount = await this.hasSupplierLoginAccount(supplier.id);
      if (hasAccount && supplier.is_active === false) {
        throw new BadRequestException(
          'Furnizorul este inactiv și nu poate primi comenzi noi',
        );
      }
      await this.assertClientSupplierRelationship(orderCompanyId, supplier.id, {
        requireOperationalActive: true,
        requireAccessibleQuota: true,
      });
    } else if (supplier.is_active === false) {
      throw new BadRequestException(
        'Furnizorul este inactiv și nu poate primi comenzi noi',
      );
    }

    const orderLocationId =
      resolvedSupplierLocationId != null
        ? resolvedSupplierLocationId
        : dto.location_id != null &&
            Number.isFinite(Number(dto.location_id)) &&
            Number(dto.location_id) > 0
          ? Number(dto.location_id)
          : null;

    // Rezolvă toate liniile + validează stocul ÎNAINTE de a crea comanda (fără creare parțială).
    const resolvedLines: Array<{
      itemDto: (typeof dto.items)[number];
      supplierProduct: SupplierProduct;
      variantId: number | null;
      clientStockProductId: number;
      pricePerUnit: number;
      priceBaseQuantity: number | null;
      priceBaseUnit: string | null;
      subtotal: number;
      total: number;
    }> = [];

    for (const itemDto of dto.items) {
      const { supplierProduct, variantId } = await this.resolveSupplierProductForNewOrderItem(
        dto.supplier_id,
        itemDto,
      );

      const orderClientCompanyId =
        dto.company_id != null &&
        Number.isFinite(Number(dto.company_id)) &&
        Number(dto.company_id) > 0
          ? Number(dto.company_id)
          : user
            ? buildSupplierProductUserContext(user).companyId
            : null;

      let clientStockProductId: number;
      if (
        orderClientCompanyId != null &&
        Number.isFinite(orderClientCompanyId) &&
        orderClientCompanyId > 0
      ) {
        if (orderLocationId == null) {
          throw new BadRequestException(
            'Locația comenzii este obligatorie pentru maparea produselor la nomenclator',
          );
        }
        clientStockProductId = await this.resolveClientStockProductForOrder(
          orderClientCompanyId,
          supplierProduct.id,
          orderLocationId,
          itemDto.product_id,
        );
      } else {
        if (
          !Number.isFinite(Number(itemDto.product_id)) ||
          Number(itemDto.product_id) <= 0
        ) {
          throw new BadRequestException(
            'product_id (produs stoc intern) este obligatoriu pentru comenzile fără companie client',
          );
        }
        clientStockProductId = Number(itemDto.product_id);
      }

      if (
        orderClientCompanyId != null &&
        Number.isFinite(orderClientCompanyId) &&
        orderClientCompanyId > 0
      ) {
        await this.assertSupplierProductOrderableForClient(
          orderClientCompanyId,
          dto.supplier_id,
          supplierProduct,
        );
      }

      const preferredPriceRow =
        orderClientCompanyId != null &&
        Number.isFinite(orderClientCompanyId) &&
        orderClientCompanyId > 0
          ? await this.getPreferredPriceForClientCompany(
              orderClientCompanyId,
              dto.supplier_id,
              supplierProduct.id,
            )
          : null;
      const pricePerUnit =
        preferredPriceRow != null
          ? Number(preferredPriceRow.preferred_price) || 0
          : Number(supplierProduct.price_per_unit) || 0;
      const priceBaseQuantity = normalizePriceBaseQuantity(
        supplierProduct.price_base_quantity,
      );
      const priceBaseUnit =
        priceBaseQuantity != null
          ? resolvePriceBaseUnit(
              supplierProduct.price_base_unit,
              supplierProduct.unit_of_measure,
            )
          : null;
      const subtotal = roundMoney(
        computeLineSubtotal(
          itemDto.quantity,
          pricePerUnit,
          priceBaseQuantity,
        ),
      );
      const vat = Number(supplierProduct.vat) || 0;
      const vatAmount = roundMoney((subtotal * vat) / 100);
      const total = roundMoney(subtotal + vatAmount);

      resolvedLines.push({
        itemDto,
        supplierProduct,
        variantId: variantId ?? null,
        clientStockProductId,
        pricePerUnit,
        priceBaseQuantity,
        priceBaseUnit,
        subtotal,
        total,
      });
    }

    const hasAccount = await this.hasSupplierLoginAccount(dto.supplier_id);
    // Furnizor fără cont: nu are depozit operat; auto-confirm nu scade stoc.
    // Assert-ul de cantitate rămâne doar pentru furnizorii cu cont.
    if (hasAccount) {
      await this.assertSupplierStockSufficientForNewOrder(
        dto.supplier_id,
        resolvedLines.map((line) => ({
          supplierProduct: line.supplierProduct,
          quantity: Number(line.itemDto.quantity) || 0,
          productName: line.supplierProduct.product_name,
        })),
      );
    }
    
    // Creează comanda (inclusiv companie / locație muncă pentru UI și rapoarte)
    const orderData = {
      supplier_id: dto.supplier_id,
      order_date: new Date(dto.order_date),
      delivery_date: new Date(dto.delivery_date),
      status: orderStatus,
      notes: dto.notes,
      created_by_user_id: dto.created_by_user_id,
      ...(resolvedSupplierLocationId != null
        ? { supplier_location_id: resolvedSupplierLocationId }
        : {}),
      ...(dto.company_id != null && Number.isFinite(Number(dto.company_id)) && Number(dto.company_id) > 0
        ? { company_id: Number(dto.company_id) }
        : {}),
      ...(resolvedSupplierLocationId != null
        ? { location_id: resolvedSupplierLocationId }
        : dto.location_id != null &&
            Number.isFinite(Number(dto.location_id)) &&
            Number(dto.location_id) > 0
          ? { location_id: Number(dto.location_id) }
          : {}),
      total_amount: 0,
    };
    const order = this.orderRepo.create(orderData);
    const savedOrder = await this.orderRepo.save(order);
    
    this.logger.log(`📦 [SUPPLIERS SERVICE] Order created with supplier_location_id: ${dto.supplier_location_id}`);

    // Gestiunile din giurom 2.0 permise pentru locația comenzii, citite o singură dată:
    // altfel N linii ar însemna N interogări. Perechea (company_id, location_id) e exact
    // cea salvată pe comandă, adică cea pe care o va trimite și exportul — dacă aici am
    // valida pe altă locație, eticheta ar trece validarea și ar pica abia în App2.
    // Set gol = locație nelegată; atunci gestiunile nici nu ajung să fie cerute din UI.
    const allowedZoneIds = await this.giurom2ZonesService.allowedZoneIds(
      Number(savedOrder.company_id),
      Number(savedOrder.location_id),
    );

    let totalAmountWithoutVat = 0;
    let totalAmountWithVat = 0;
    const rememberedZones: Array<{
      supplier_product_id: number;
      giurom2_zone_id: number | null;
    }> = [];
    for (const line of resolvedLines) {
      totalAmountWithoutVat += line.subtotal;
      totalAmountWithVat += line.total;

      const zoneId = this.resolveGiurom2ZoneId(
        line.itemDto.giurom2_zone_id,
        allowedZoneIds,
        savedOrder.id,
      );
      const orderItem = this.orderItemRepo.create({
        order_id: savedOrder.id,
        product_id: line.clientStockProductId,
        supplier_product_id: line.supplierProduct.id,
        ...(line.variantId != null ? { variant_id: line.variantId } : {}),
        quantity: line.itemDto.quantity,
        price_per_unit: line.pricePerUnit,
        price_base_quantity: line.priceBaseQuantity,
        price_base_unit: line.priceBaseUnit,
        subtotal: line.subtotal,
        total: line.total,
        giurom2_zone_id: zoneId,
      });
      await this.orderItemRepo.save(orderItem);
      rememberedZones.push({
        supplier_product_id: line.supplierProduct.id,
        giurom2_zone_id: zoneId,
      });
    }
    savedOrder.total_amount = roundMoney(totalAmountWithoutVat);
    savedOrder.total_amount_with_vat = roundMoney(totalAmountWithVat);
    await this.orderRepo.save(savedOrder);

    await this.rememberGiurom2ZonesForOrder(
      savedOrder.company_id,
      savedOrder.location_id,
      rememberedZones,
    );

    // Regula finală brut/net (timing stoc): la crearea/plasarea comenzii de client NU se
    // scade stocul furnizorului. Scăderea se face la confirmarea furnizorului
    // (vezi updateOrderStatus → tranziția în `confirmed`).
    //
    // Furnizor FĂRĂ cont autentificabil: nu există actor care să confirme / atribuie
    // magazioner/șofer — auto-confirmăm (fără scădere stoc platformă) ca recepția client
    // să poată continua fără pașii de tenant furnizor.
    if (
      !hasAccount &&
      (orderStatus === OrderStatus.SENT || orderStatus === OrderStatus.DRAFT)
    ) {
      await this.orderRepo.update(savedOrder.id, {
        status: OrderStatus.CONFIRMED,
      });
      savedOrder.status = OrderStatus.CONFIRMED;
      this.logger.log(
        `ℹ️ [SUPPLIERS SERVICE] Order ${savedOrder.id}: supplier ${savedOrder.supplier_id} ` +
          `has no login account → auto status=confirmed (skip furnizor tenant steps, no stock deduct)`,
      );
    }

    await this.generateOrderPDF(savedOrder, supplier);

    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new order ${savedOrder.id}`);
    // Notificare către admini/manageri pe locația client (nu depinde de cont furnizor).
    await this.sendSupplierNotification(
      'supplier_order_created',
      'Comanda furnizor noua',
      `A fost creata o comanda noua pentru furnizorul ${supplier.supplier_name}`,
      supplier.id,
      {
        orderId: savedOrder.id,
        supplierName: supplier.supplier_name,
        orderDate: savedOrder.order_date.toISOString(),
        has_supplier_account: hasAccount,
      },
      `/furnizori/${supplier.id}`,
      dto.supplier_location_id ?? undefined,
    );

    const created = (await this.orderRepo.findOne({
      where: { id: savedOrder.id },
      relations: ['items', 'documents', 'supplier'],
    })) as SupplierOrder;
    await this.attachHasSupplierAccountFlag([created]);
    return created;
  }

  private async generateOrderPDF(order: SupplierOrder, supplier: Supplier): Promise<void> {
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    const fileName = `comanda_${order.id}_${supplierNameSimplified}.pdf`;
    const filePath = `/files/suppliers/${supplierNameSimplified}/orders/${fileName}`;
    const document = this.orderDocumentRepo.create({
      order_id: order.id,
      document_type: 'order_pdf',
      file_name: fileName,
      file_path: filePath,
    });
    await this.orderDocumentRepo.save(document);
  }

  async markOrderAsDelivered(
    orderId: number,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrder> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Marking order ${orderId} as delivered`);
    
    await this.findOrderForRequester(orderId, user);
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['items', 'supplier'] });
    if (!order) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order not found: ${orderId}`);
      throw new NotFoundException('Comanda nu a fost găsită');
    }
    if (order.status === OrderStatus.DELIVERED) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order already delivered: ${orderId}`);
      throw new BadRequestException('Comanda este deja livrată');
    }

    // Get supplier for notification
    const supplier = await this.supplierRepo.findOne({ where: { id: order.supplier_id } });
    if (!supplier) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for order delivery: ${order.supplier_id}`);
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    // Create stock items for each order item using the HTTP service
    // Convert gross quantity (from order) to net quantity (for stock) using supplier product metadata
    const stockItems: CreateStockItemDto[] = await Promise.all(
      (order.items || []).map(async (item) => {
        let netQuantity = item.quantity; // Default: use as-is if no supplier product found
        
        try {
          const supplierProduct = await this.findSupplierProductForOrderLine(
            order.supplier_id,
            item,
          );

          if (supplierProduct) {
            const productGrossQuantity = Number(supplierProduct.gross_quantity) || 0;
            const productNetQuantity = Number(supplierProduct.net_quantity) || 0;
            if (productGrossQuantity > 0 && productNetQuantity > 0) {
              const grossQuantityFromOrder = Number(item.quantity) || 0;
              netQuantity = grossQuantityFromOrder * (productNetQuantity / productGrossQuantity);
              this.logger.log(
                `📦 [SUPPLIERS SERVICE] Converting quantity for product ${item.product_id}: ` +
                `gross=${grossQuantityFromOrder.toFixed(2)} → net=${netQuantity.toFixed(2)} ` +
                `(ratio: ${productNetQuantity}/${productGrossQuantity})`
              );
            }
          }
        } catch (err) {
          this.logger.warn(
            `⚠️ [SUPPLIERS SERVICE] Could not fetch supplier product for conversion ` +
            `(supplier=${order.supplier_id}, product=${item.product_id}):`,
            err
          );
        }
        
        return {
          product_id: item.product_id,
          supplier_order_item_id: item.id,
          quantity: netQuantity,
          price: item.price_per_unit,
          entry_date: new Date().toISOString(),
          status: 'valid',
          location_id: order.supplier_location_id || undefined,
        };
      })
    );

    if (stockItems.length > 0) {
      const createdStockItems = await this.stockHttpService.createStockItems(stockItems);
      
      if (createdStockItems.length !== stockItems.length) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Only ${createdStockItems.length} out of ${stockItems.length} stock items were created successfully`);
      }
    }

    order.status = OrderStatus.DELIVERED;
    // Actualizează doar câmpurile comenzii, fără a atinge relația 'items' (evităm cascade overwrite)
    await this.orderRepo.update(order.id, {
      status: order.status,
      total_amount: order.total_amount,
      total_amount_with_vat: order.total_amount_with_vat,
      notes: order.notes,
      delivery_date: order.delivery_date,
    });
    const updatedOrder = await this.orderRepo.findOne({ where: { id: order.id } });
    if (!updatedOrder) {
      throw new NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
    }

    // Send notification for order delivered
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for delivered order ${updatedOrder.id}`);
    await this.sendSupplierNotification(
      'supplier_order_delivered',
      'Comanda furnizor livrata',
      `Comanda ${updatedOrder.id} pentru furnizorul ${supplier.supplier_name} a fost livrata`,
      supplier.id,
      {
        orderId: updatedOrder.id,
        supplierName: supplier.supplier_name,
        orderDate: updatedOrder.order_date.toISOString(),
      },
      `/furnizori/${supplier.id}`,
      order.supplier_location_id ?? undefined,
    );
    if (order.supplier_location_id != null) {
      await this.sendOrderNotification(
        'order_received_total',
        'Comandă recepționată (total)',
        `Comanda ${updatedOrder.id} pentru furnizorul ${supplier.supplier_name} a fost recepționată în totalitate`,
        order.supplier_location_id,
        updatedOrder.id,
        { orderId: updatedOrder.id, supplierName: supplier.supplier_name },
        '/comenzi'
      );
    }

    return updatedOrder;
  }

  async markOrderAsPartiallyReceived(
    dto: PartialReceptionDto,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrder> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Processing partial reception for order ${dto.orderId}`);
    
    await this.findOrderForRequester(dto.orderId, user);
    const order = await this.orderRepo.findOne({ 
      where: { id: dto.orderId }, 
      relations: ['items', 'supplier'] 
    });
    
    if (!order) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order not found: ${dto.orderId}`);
      throw new NotFoundException('Comanda nu a fost găsită');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Comanda este anulată');
    }

    await this.assertDriverArrivedForClientActions(
      order.id,
      order.status,
      order.supplier_id,
    );

    if (order.status === OrderStatus.DELIVERED) {
      const itemsIncomplete = (order.items || []).some((item) => {
        const itemAvail = (item as any).availability_status || 'available';
        if (itemAvail === 'unavailable') return false;
        const ordered = Number(item.quantity) || 0;
        const received = Number(item.received_quantity) || 0;
        const returned = Number(item.returned_quantity) || 0;
        return ordered > 0 && received + returned < ordered - 0.01;
      });
      if (itemsIncomplete) {
        const driverRepo = this.connection.getRepository(SupplierOrderDriverAssignment);
        const doneDriver = await driverRepo.findOne({
          where: [
            {
              supplier_order_id: order.id,
              status: SupplierOrderDriverAssignmentStatus.DONE,
            },
            {
              supplier_order_id: order.id,
              status: SupplierOrderDriverAssignmentStatus.ARRIVED,
            },
          ],
          order: { id: 'DESC' },
        });
        if (doneDriver) {
          this.logger.warn(
            `⚠️ [SUPPLIERS SERVICE] Order ${order.id} was DELIVERED after driver completion but reception is incomplete; resetting status to SOFER for reception flow.`,
          );
          await this.orderRepo.update(order.id, { status: OrderStatus.SOFER });
          order.status = OrderStatus.SOFER;
        } else {
          this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order already delivered: ${dto.orderId}`);
          throw new BadRequestException('Comanda este deja livrată complet');
        }
      } else {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order already delivered: ${dto.orderId}`);
        throw new BadRequestException('Comanda este deja livrată complet');
      }
    }

    // Get supplier for notification
    const supplier = await this.supplierRepo.findOne({ where: { id: order.supplier_id } });
    if (!supplier) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for order delivery: ${order.supplier_id}`);
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    const stockItems: CreateStockItemDto[] = [];
    let hasReturnedItems = false;

    // Un singur lot pentru toate rândurile recepționate în acest apel: e cheia pe care
    // exportul grupează liniile într-un document de intrare. `occurred_at` nu poate servi,
    // fiind calculat per rând mai jos.
    const receptionBatchId = randomUUID();

    // Process each item in the reception DTO
    for (const receptionItem of dto.items) {
      const orderItem = order.items?.find(item => item.id === receptionItem.itemId);
      
      if (!orderItem) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order item not found: ${receptionItem.itemId}`);
        continue;
      }

      const itemAvailability = (orderItem as any).availability_status || 'available';
      if (itemAvailability === 'unavailable') {
        this.logger.log(`⏭️ [SUPPLIERS SERVICE] Skipping unavailable item ${orderItem.id}`);
        continue;
      }

      const receivedQty = Number(receptionItem.receivedQuantity) || 0;
      const originalQty = Number(orderItem.quantity);
      
      // Calculează automat returned_quantity dacă nu este explicit trimis
      // Dacă este trimis explicit, folosește valoarea trimisă
      const isReturnedQuantityExplicit = receptionItem.returnedQuantity !== undefined && receptionItem.returnedQuantity !== null;
      let returnedQty: number;
      if (isReturnedQuantityExplicit) {
        returnedQty = Number(receptionItem.returnedQuantity) || 0;
      } else {
        // Calculează automat: diferența dintre comandat și recepționat
        returnedQty = Math.max(0, originalQty - receivedQty);
      }

      // Acceptăm cazurile în care s-a recepționat mai mult decât a fost comandat
      // Nu mai validăm strict received + returned <= ordered. 
      const isCancellingRemaining = receptionItem.returnReason?.includes('Anulat - partea rămasă') ||
                                     receptionItem.returnReason?.includes('anulat') ||
                                     receptionItem.returnReason?.includes('Anulat');

      if (!isCancellingRemaining && returnedQty > originalQty) {
        throw new BadRequestException(
          `Pentru item-ul ${orderItem.id}: cantitatea returnată (${returnedQty}) depășește cantitatea comandată (${originalQty})`
        );
      }

      // Validare: dacă există returnare EXPLICITĂ, trebuie motiv
      // Dacă returned_quantity este calculat automat, nu cerem motiv
      if (isReturnedQuantityExplicit && returnedQty > 0 && !receptionItem.returnReason?.trim()) {
        throw new BadRequestException(
          `Pentru item-ul ${orderItem.id}: motivul returnării este obligatoriu când există cantitate returnată`
        );
      }

      // Calculează diferența: ce s-a recepționat NOU în această recepție
      // receivedQty este cantitatea TOTALĂ (cumulativă) trimisă în request
      const itemToUpdate = await this.orderItemRepo.findOne({ where: { id: orderItem.id } });
      if (!itemToUpdate) {
        throw new BadRequestException(`Item-ul ${orderItem.id} nu a fost găsit în baza de date.`);
      }
      
      const existingReceivedQty = Number(itemToUpdate.received_quantity) || 0;
      const existingReturnedQty = Number(itemToUpdate.returned_quantity) || 0;
      let newlyReceivedQty = receivedQty - existingReceivedQty; // Diferența = cât se recepționează acum
      let newlyReturnedQty = returnedQty - existingReturnedQty;
      
      // Asigură-te că newlyReceivedQty nu este negativ (protecție împotriva erorilor)
      if (newlyReceivedQty < 0) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Calculated negative newlyReceivedQty for item ${orderItem.id}: ${newlyReceivedQty}. Setting to 0.`);
        newlyReceivedQty = 0;
      }
      
      this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${orderItem.id}: existing=${existingReceivedQty}, new total=${receivedQty}, newly received=${newlyReceivedQty}`);
      
      // NU actualizăm received_quantity în supplier_order_items imediat
      // Vom actualiza doar când recepția este aprobată
      // Creăm recepțiile cu status PENDING pentru aprobare ulterioară

      // Înregistrează evenimentele de recepție/returnare ca delta-uri cu status PENDING
      const occurredAt = new Date();
      const userId = order.created_by_user_id;
      const locationId = order.supplier_location_id || null;

      const clientCompanyId = Number(order.company_id);
      const receptionLocationId =
        locationId != null && Number(locationId) > 0
          ? Number(locationId)
          : order.location_id != null && Number(order.location_id) > 0
            ? Number(order.location_id)
            : null;
      let receptionProductId = Number(orderItem.product_id);
      if (
        Number.isFinite(clientCompanyId) &&
        clientCompanyId > 0 &&
        receptionLocationId != null &&
        orderItem.supplier_product_id != null &&
        Number(orderItem.supplier_product_id) > 0
      ) {
        receptionProductId = await this.resolveClientStockProductForOrder(
          clientCompanyId,
          Number(orderItem.supplier_product_id),
          receptionLocationId,
          undefined,
          { assertOrderItemProductId: Number(orderItem.product_id) },
        );
      } else if (
        Number.isFinite(clientCompanyId) &&
        clientCompanyId > 0 &&
        (!orderItem.supplier_product_id ||
          Number(orderItem.supplier_product_id) <= 0)
      ) {
        throw new BadRequestException(
          `Linia ${orderItem.id} nu are supplier_product_id. Recepția necesită remediere date (VAL 5).`,
        );
      }

      if (newlyReceivedQty > 0) {
        await this.orderItemReceptionRepo.save({
          supplier_order_id: order.id,
          supplier_order_item_id: orderItem.id,
          product_id: receptionProductId,
          received_delta: newlyReceivedQty,
          returned_delta: 0,
          reason: undefined,
          user_id: userId,
          location_id: locationId || undefined,
          occurred_at: occurredAt,
          stock_item_id: undefined,
          status: ReceptionStatus.PENDING, // Status pending pentru aprobare
          reception_batch_id: receptionBatchId,
          // Gestiunea giurom 2.0 moștenită din linia de comandă. Stă pe tranșă, nu doar pe
          // comandă, ca tranșele să poată merge în gestiuni diferite când UI-ul de magazioner
          // va permite schimbarea la recepție. Nu influențează stocul App1.
          giurom2_zone_id: orderItem.giurom2_zone_id ?? null,
        });
        this.logger.log(`📝 [SUPPLIERS SERVICE] Created PENDING reception for item ${orderItem.id} with quantity ${newlyReceivedQty}`);
      }
      if (newlyReturnedQty > 0) {
        await this.orderItemReceptionRepo.save({
          supplier_order_id: order.id,
          supplier_order_item_id: orderItem.id,
          product_id: receptionProductId,
          received_delta: 0,
          returned_delta: newlyReturnedQty,
          reason: receptionItem.returnReason || undefined,
          user_id: userId,
          location_id: locationId || undefined,
          occurred_at: occurredAt,
          stock_item_id: undefined,
          status: ReceptionStatus.PENDING, // Status pending pentru aprobare
          reception_batch_id: receptionBatchId,
        });
        hasReturnedItems = true;
        this.logger.log(`📝 [SUPPLIERS SERVICE] Created PENDING return for item ${orderItem.id} with quantity ${newlyReturnedQty}`);
      }

      // NU creăm stock items imediat - vor fi creați doar când recepția este aprobată
      // Eliminăm logica de creare stock aici

      if (returnedQty > 0) {
        hasReturnedItems = true;
      }
    }

    // NU mai creăm stock items aici - vor fi creați doar când recepțiile sunt aprobate
    this.logger.log(`📝 [SUPPLIERS SERVICE] Recepțiile au fost create cu status PENDING. Stock items vor fi creați după aprobare.`);

    // NU actualizăm statusul comenzii imediat - va fi actualizat doar când recepțiile sunt aprobate
    // Statusul comenzii rămâne neschimbat până la aprobare

    // Actualizează doar comanda fără a persista relația 'items' (evităm rescrierea recepțiilor)
    await this.orderRepo.update(order.id, {
      status: order.status,
      total_amount: order.total_amount,
      total_amount_with_vat: order.total_amount_with_vat,
      notes: order.notes,
      delivery_date: order.delivery_date,
    });
    const updatedOrder = await this.orderRepo.findOne({ where: { id: order.id } });
    if (!updatedOrder) {
      throw new NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
    }

    // Detectează dacă, după această recepție, comanda este complet recepționată (toate item-urile au received >= ordered)
    const allItemsFullyReceivedInThisReception = (order.items || []).every((item) => {
      const itemAvail = (item as any).availability_status || 'available';
      if (itemAvail === 'unavailable') return true;
      const inDto = dto.items.find((i) => i.itemId === item.id);
      const totalReceivedDeclared = inDto != null ? Number(inDto.receivedQuantity) || 0 : Number(item.received_quantity) || 0;
      const ordered = Number(item.quantity) || 0;
      return ordered <= 0 || totalReceivedDeclared >= ordered - 0.01;
    });
    const isFullReception = allItemsFullyReceivedInThisReception && (order.items?.length ?? 0) > 0;

    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for ${isFullReception ? 'fully' : 'partially'} received order ${updatedOrder.id}`);
    await this.sendSupplierNotification(
      isFullReception ? 'supplier_order_delivered' : 'supplier_order_partially_received',
      isFullReception ? 'Comanda furnizor recepționată' : 'Comanda furnizor recepționată parțial',
      isFullReception
        ? `Comanda ${updatedOrder.id} pentru furnizorul ${supplier.supplier_name} a fost recepționată în totalitate`
        : `Comanda ${updatedOrder.id} pentru furnizorul ${supplier.supplier_name} a fost recepționată parțial${hasReturnedItems ? ' cu returnări' : ''}`,
      supplier.id,
      { orderId: updatedOrder.id, supplierName: supplier.supplier_name, orderDate: updatedOrder.order_date.toISOString(), hasReturns: hasReturnedItems },
      `/furnizori/${supplier.id}`,
      order.supplier_location_id ?? undefined,
    );
    if (order.supplier_location_id != null) {
      await this.sendOrderNotification(
        isFullReception ? 'order_received_total' : 'order_received_partial',
        isFullReception ? 'Comandă recepționată (total)' : 'Comandă recepționată (parțial)',
        isFullReception
          ? `Comanda ${updatedOrder.id} pentru furnizorul ${supplier.supplier_name} a fost recepționată în totalitate`
          : `Comanda ${updatedOrder.id} pentru furnizorul ${supplier.supplier_name} a fost recepționată parțial`,
        order.supplier_location_id,
        updatedOrder.id,
        { orderId: updatedOrder.id, supplierName: supplier.supplier_name, hasReturns: hasReturnedItems },
        '/comenzi'
      );
    }

    return updatedOrder;
  }

  /**
   * Locații de livrare client de pe comandă — NU sunt depozitul furnizorului.
   */
  private collectClientDeliveryLocationIds(order?: SupplierOrder): Set<number> {
    const ids = new Set<number>();
    if (!order) return ids;
    for (const raw of [order.supplier_location_id, order.location_id]) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    }
    return ids;
  }

  /** Locații de exclus la scădere: livrare client + toate locațiile companiei client (dacă e diferită de furnizor). */
  private async collectExcludedStockLocationIds(
    order: SupplierOrder | undefined,
    supplierCompanyId: number | null,
  ): Promise<Set<number>> {
    const ids = this.collectClientDeliveryLocationIds(order);
    const clientOrderCompanyId =
      order?.company_id != null && Number(order.company_id) > 0
        ? Number(order.company_id)
        : null;

    if (
      clientOrderCompanyId != null &&
      supplierCompanyId != null &&
      clientOrderCompanyId !== supplierCompanyId
    ) {
      const clientCompanyLocationIds =
        await this.fetchCompanyLocationIds(clientOrderCompanyId);
      for (const locId of clientCompanyLocationIds) {
        ids.add(locId);
      }
    }

    return ids;
  }

  private async fetchCompanyLocationIds(companyId: number): Promise<number[]> {
    try {
      const url = `${this.locationsServiceUrl}/locations/company/${companyId}`;
      const resp = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.internalServiceHeaders(),
          timeout: 5000,
        }),
      );
      const locations = Array.isArray(resp.data) ? resp.data : [];
      return locations
        .map((loc: any) => Number(loc?.id))
        .filter((id) => Number.isFinite(id) && id > 0);
    } catch (error: any) {
      this.logger.warn(
        `⚠️ [fetchCompanyLocationIds] companyId=${companyId}: ${error?.message || error}`,
      );
      return [];
    }
  }

  private async assertValidSupplierStockLocation(
    locationId: number,
    order: SupplierOrder,
    supplierCompanyId: number | null,
  ): Promise<void> {
    const excludedIds = await this.collectExcludedStockLocationIds(
      order,
      supplierCompanyId,
    );
    if (excludedIds.has(locationId)) {
      throw new BadRequestException(
        `Scăderea stocului la locația client (${locationId}) nu este permisă pentru comanda ${order.id}. ` +
          `Trebuie folosit depozitul furnizorului, nu locația clientului sau de livrare.`,
      );
    }
  }

  /** Compania tenant furnizor (owner_company_id sau supplier_products.company_id). */
  private async resolveSupplierCompanyId(
    supplier: Supplier,
    order?: SupplierOrder,
  ): Promise<number | null> {
    if (supplier.owner_company_id != null && Number(supplier.owner_company_id) > 0) {
      return Number(supplier.owner_company_id);
    }

    const clientOrderCompanyId =
      order?.company_id != null && Number(order.company_id) > 0
        ? Number(order.company_id)
        : null;

    let items: SupplierOrderItem[] = [];
    if (order?.items && order.items.length > 0) {
      items = order.items;
    } else if (order?.id) {
      items = await this.orderItemRepo.find({ where: { order_id: order.id } });
    }

    for (const item of items) {
      const sp = await this.findSupplierProductForOrderLine(supplier.id, item);
      if (sp?.company_id != null && Number(sp.company_id) > 0) {
        const productCompanyId = Number(sp.company_id);
        if (
          clientOrderCompanyId != null &&
          productCompanyId === clientOrderCompanyId
        ) {
          continue;
        }
        return productCompanyId;
      }
    }

    const anyProduct = await this.supplierProductRepo.findOne({
      where: { supplier_id: supplier.id },
      order: { id: 'ASC' },
    });
    if (anyProduct?.company_id != null && Number(anyProduct.company_id) > 0) {
      const productCompanyId = Number(anyProduct.company_id);
      if (
        clientOrderCompanyId == null ||
        productCompanyId !== clientOrderCompanyId
      ) {
        return productCompanyId;
      }
    }

    return null;
  }

  /**
   * Locația stocului furnizor (HQ/depozit) — derivată din supplier_id + companie furnizor.
   * Nu folosește locația clientului de pe comandă (supplier_location_id / location_id).
   */
  private async resolveSupplierStockLocationId(
    supplierId: number,
    order?: SupplierOrder,
  ): Promise<number> {
    const orderId = order?.id;
    const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
    if (!supplier) {
      throw new NotFoundException(`Furnizorul ${supplierId} nu a fost găsit`);
    }

    const supplierCompanyId = await this.resolveSupplierCompanyId(supplier, order);
    const excludedLocationIds = await this.collectExcludedStockLocationIds(
      order,
      supplierCompanyId,
    );

    this.logger.log(
      `📍 [resolveSupplierStockLocationId] orderId=${orderId ?? 'N/A'}, supplierId=${supplierId}, ` +
        `supplierCompanyId=${supplierCompanyId ?? 'null'}, excludedLocationIds=[${[...excludedLocationIds].join(', ')}]`,
    );

    // 1) Locații ale companiei furnizor (Sediu / HQ) — prioritate față de supplier_locations
    if (supplierCompanyId != null) {
      const companyLocationId = await this.fetchPrimaryCompanyLocationId(
        supplierCompanyId,
        excludedLocationIds,
      );
      if (companyLocationId != null) {
        this.logger.log(
          `📍 [resolveSupplierStockLocationId] orderId=${orderId ?? 'N/A'}, supplierId=${supplierId}, ` +
            `source=supplier_company_locations, supplierStockLocationId=${companyLocationId}, supplierCompanyId=${supplierCompanyId}`,
        );
        return companyLocationId;
      }

      const assignments = await this.supplierLocationsRepo.find({
        where: { supplier_id: supplierId },
        order: { id: 'ASC' },
      });
      const supplierLocationIds = assignments
        .map((a) => Number(a.id_location))
        .filter((id) => Number.isFinite(id) && id > 0);

      for (const locId of supplierLocationIds) {
        if (excludedLocationIds.has(locId)) {
          this.logger.log(
            `📍 [resolveSupplierStockLocationId] skip excluded locationId=${locId} on order ${orderId ?? 'N/A'}`,
          );
          continue;
        }
        if (await this.locationBelongsToSupplierCompany(locId, supplierCompanyId)) {
          this.logger.log(
            `📍 [resolveSupplierStockLocationId] orderId=${orderId ?? 'N/A'}, supplierId=${supplierId}, ` +
              `source=supplier_locations, supplierStockLocationId=${locId}, candidates=[${supplierLocationIds.join(', ')}]`,
          );
          return locId;
        }
      }

      this.logger.warn(
        `⚠️ [resolveSupplierStockLocationId] orderId=${orderId ?? 'N/A'}, supplierId=${supplierId}: ` +
          `niciuna din supplier_locations [${supplierLocationIds.join(', ')}] nu e depozit furnizor (company ${supplierCompanyId})`,
      );
    } else {
      const assignments = await this.supplierLocationsRepo.find({
        where: { supplier_id: supplierId },
        order: { id: 'ASC' },
      });
      for (const assignment of assignments) {
        const locId = Number(assignment.id_location);
        if (!Number.isFinite(locId) || locId <= 0) continue;
        if (excludedLocationIds.has(locId)) continue;
        this.logger.log(
          `📍 [resolveSupplierStockLocationId] orderId=${orderId ?? 'N/A'}, supplierId=${supplierId}, ` +
            `source=supplier_locations (legacy), supplierStockLocationId=${locId}`,
        );
        return locId;
      }
    }

    throw new BadRequestException(
      'Nu s-a putut determina locația depozitului furnizorului (companie furnizor / supplier_locations, exclusiv locația client)',
    );
  }

  private async locationBelongsToSupplierCompany(
    locationId: number,
    supplierCompanyId: number | null,
  ): Promise<boolean> {
    if (
      supplierCompanyId == null ||
      !Number.isFinite(Number(supplierCompanyId)) ||
      Number(supplierCompanyId) <= 0
    ) {
      return false;
    }

    const location = await this.fetchLocation(locationId);
    if (!location?.company_id) {
      this.logger.warn(
        `⚠️ [locationBelongsToSupplierCompany] locationId=${locationId} not found or missing company_id`,
      );
      return false;
    }

    const locationCompanyId = Number(location.company_id);
    const match = locationCompanyId === Number(supplierCompanyId);
    if (!match) {
      this.logger.log(
        `📍 [locationBelongsToSupplierCompany] locationId=${locationId} company_id=${locationCompanyId} ` +
          `≠ supplierCompanyId=${supplierCompanyId}`,
      );
    }
    return match;
  }

  /** Prima locație a companiei furnizor; preferă denumiri de tip sediu/HQ. */
  private async fetchPrimaryCompanyLocationId(
    companyId: number,
    excludeLocationIds: Set<number> = new Set(),
  ): Promise<number | null> {
    try {
      const url = `${this.locationsServiceUrl}/locations/company/${companyId}`;
      this.logger.log(`📍 [fetchPrimaryCompanyLocationId] GET ${url}`);
      const resp = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.internalServiceHeaders(),
          timeout: 5000,
        }),
      );
      const locations = Array.isArray(resp.data) ? resp.data : [];
      const eligible = locations.filter((loc: any) => {
        const id = Number(loc?.id);
        return Number.isFinite(id) && id > 0 && !excludeLocationIds.has(id);
      });

      if (eligible.length === 0) {
        this.logger.warn(
          `⚠️ [fetchPrimaryCompanyLocationId] companyId=${companyId}: no eligible locations after excluding [${[...excludeLocationIds].join(', ')}]`,
        );
        return null;
      }

      const preferred = eligible.find((loc: any) => {
        const name = String(loc.location_name ?? loc.name ?? '').toLowerCase();
        return (
          name.includes('sediu') ||
          name.includes('principal') ||
          name.includes('hq') ||
          name.includes('head') ||
          name.includes('depozit') ||
          name.includes('warehouse')
        );
      });

      const chosen = preferred ?? eligible[0];
      const id = Number(chosen?.id);
      return Number.isFinite(id) && id > 0 ? id : null;
    } catch (error: any) {
      this.logger.warn(
        `⚠️ [fetchPrimaryCompanyLocationId] companyId=${companyId}: ${error?.message || error}`,
      );
      return null;
    }
  }

  /**
   * Target idempotency pentru scăderea stocului furnizorului în fluxul NOU
   * (scădere la confirmarea furnizorului). Fluxul nou creează DOAR acest target.
   */
  private supplierOrderConfirmConsumeTarget(orderId: number, itemId: number): string {
    return `supplier-order-confirm:${orderId}:item:${itemId}`;
  }

  private supplierOrderCancelRestoreTarget(orderId: number, itemId: number): string {
    return `restore:supplier-order-cancel:${orderId}:item:${itemId}`;
  }

  private supplierOrderConfirmRollbackTarget(orderId: number, itemId: number): string {
    return `restore:supplier-order-confirm-rollback:${orderId}:item:${itemId}`;
  }

  /**
   * Scade stocul furnizorului la confirmarea furnizorului (per linie: supplier_products.product_id × order_item.quantity BRUT).
   * Locația este depozitul/HQ-ul companiei furnizor (resolveSupplierStockLocationId), nu locația clientului.
   */
  private async deductSupplierStockForOrder(
    order: SupplierOrder,
  ): Promise<void> {
    const supplier = await this.supplierRepo.findOne({ where: { id: order.supplier_id } });
    if (!supplier) {
      throw new NotFoundException(`Furnizorul ${order.supplier_id} nu a fost găsit`);
    }
    const supplierCompanyId = await this.resolveSupplierCompanyId(supplier, order);
    const locationId = await this.resolveSupplierStockLocationId(
      order.supplier_id,
      order,
    );
    await this.assertValidSupplierStockLocation(locationId, order, supplierCompanyId);
    const items =
      order.items?.length > 0
        ? order.items
        : await this.orderItemRepo.find({ where: { order_id: order.id } });

    const deducted: Array<{ productId: number; quantity: number; itemId: number; price: number }> =
      [];

    try {
      for (const item of items) {
        if ((item.availability_status || 'available') === 'unavailable') {
          this.logger.log(
            `⏭️ [SUPPLIERS SERVICE] Skipping supplier stock deduct for unavailable item ${item.id}`,
          );
          continue;
        }

        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;

        const supplierProduct = await this.findSupplierProductForOrderLine(order.supplier_id, item);
        if (!supplierProduct?.product_id) {
          throw new BadRequestException(
            `Produs furnizor negăsit pentru linia ${item.id} (supplier_product_id=${item.supplier_product_id ?? 'null'})`,
          );
        }

        const supplierProductId = Number(supplierProduct.id);
        const stockProductId = Number(supplierProduct.product_id);
        const target = this.supplierOrderConfirmConsumeTarget(order.id, item.id);

        this.logger.log(
          `📤 [SUPPLIERS SERVICE] Supplier stock deduct on confirm: orderId=${order.id}, supplierId=${order.supplier_id}, ` +
            `supplierOwnerCompanyId=${supplier.owner_company_id ?? supplierCompanyId ?? 'null'}, ` +
            `resolvedSupplierLocationId=${locationId}, clientLocationId=${order.location_id ?? order.supplier_location_id ?? 'null'}, ` +
            `orderItemId=${item.id}, supplierProductId=${supplierProductId}, stockProductId=${stockProductId}, ` +
            `quantity=${qty} (BRUT), target=${target}`,
        );

        await this.stockHttpService.consumeProduct({
          product_id: stockProductId,
          quantity: qty,
          location_id: locationId,
          target,
        });

        deducted.push({
          productId: stockProductId,
          quantity: qty,
          itemId: item.id,
          price: Number(item.price_per_unit) || 0,
        });
      }
    } catch (err) {
      for (const d of [...deducted].reverse()) {
        await this.stockHttpService.createStockItem({
          product_id: d.productId,
          supplier_order_item_id: d.itemId,
          quantity: d.quantity,
          price: d.price,
          entry_date: new Date().toISOString(),
          status: 'valid',
          location_id: locationId,
          target: this.supplierOrderConfirmRollbackTarget(order.id, d.itemId),
          source: 'manual',
        });
      }
      const message =
        err instanceof BadRequestException
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Eroare la scăderea stocului furnizorului';
      throw new BadRequestException(message);
    }
  }

  /**
   * Restaurează stocul furnizorului când o comandă confirmată este anulată.
   */
  private async restoreSupplierStockForCancelledOrder(
    order: SupplierOrder,
  ): Promise<void> {
    this.logger.log(
      `🧪 [DEBUG restore] restoreSupplierStockForCancelledOrder CALLED orderId=${order.id} status=${order.status} itemsCount=${order.items?.length ?? 0}`,
    );
    const supplier = await this.supplierRepo.findOne({ where: { id: order.supplier_id } });
    if (!supplier) {
      throw new NotFoundException(`Furnizorul ${order.supplier_id} nu a fost găsit`);
    }
    const supplierCompanyId = await this.resolveSupplierCompanyId(supplier, order);
    const locationId = await this.resolveSupplierStockLocationId(
      order.supplier_id,
      order,
    );
    await this.assertValidSupplierStockLocation(locationId, order, supplierCompanyId);
    const items =
      order.items?.length > 0
        ? order.items
        : await this.orderItemRepo.find({ where: { order_id: order.id } });

    for (const item of items) {
      if ((item.availability_status || 'available') === 'unavailable') {
        this.logger.log(
          `🧪 [DEBUG restore] orderId=${order.id} itemId=${item.id} SKIP unavailable`,
        );
        continue;
      }

      const qty = Number(item.quantity) || 0;
      if (qty <= 0) {
        this.logger.log(
          `🧪 [DEBUG restore] orderId=${order.id} itemId=${item.id} SKIP qty<=0`,
        );
        continue;
      }

      const supplierProduct = await this.findSupplierProductForOrderLine(order.supplier_id, item);
      if (!supplierProduct?.product_id) {
        this.logger.warn(
          `⚠️ [SUPPLIERS SERVICE] Skip restore for item ${item.id}: supplier product not found`,
        );
        this.logger.log(
          `🧪 [DEBUG restore] orderId=${order.id} itemId=${item.id} orderItem.product_id=${item.product_id} supplier_product_id=${item.supplier_product_id ?? 'null'} → no supplier product`,
        );
        continue;
      }

      const stockProductId = Number(supplierProduct.product_id);
      const target = this.supplierOrderCancelRestoreTarget(order.id, item.id);

      this.logger.log(
        `🧪 [DEBUG restore] orderId=${order.id} itemId=${item.id} ` +
          `orderItem.product_id=${item.product_id} supplierProductId=${supplierProduct.id} ` +
          `stockProductId=${stockProductId} qty=${qty} restoreTarget=${target}`,
      );

      // Restore DOAR dacă a existat o scădere reală (EXIT) pentru această linie.
      // Acoperă target-ul nou (supplier-order-confirm:*) și pe cel legacy
      // (supplier-order-create:*). Fluxul sent → magazioner → cancelled (fără confirmare)
      // nu are EXIT, deci nu refacem stoc inexistent.
      const hasExit = await this.stockHttpService.hasSupplierOrderExit(
        stockProductId,
        order.id,
        item.id,
      );
      this.logger.log(
        `🧪 [DEBUG restore] orderId=${order.id} itemId=${item.id} hasSupplierOrderExit=${hasExit} ` +
          `(stockProductId=${stockProductId})`,
      );
      if (!hasExit) {
        this.logger.log(
          `⏭️ [SUPPLIERS SERVICE] Skip restore for item ${item.id} (order ${order.id}): ` +
            `niciun EXIT (supplier-order-confirm/create) — stocul nu a fost scăzut.`,
        );
        continue;
      }

      this.logger.log(
        `📥 [SUPPLIERS SERVICE] Restoring supplier stock: order=${order.id}, item=${item.id}, product_id=${stockProductId}, qty=${qty}, location_id=${locationId}`,
      );

      const restorePayload = {
        product_id: stockProductId,
        supplier_order_item_id: item.id,
        quantity: qty,
        price: Number(item.price_per_unit) || 0,
        entry_date: new Date().toISOString(),
        status: 'valid',
        location_id: locationId,
        target,
        source: 'manual' as const,
      };
      this.logger.log(
        `🧪 [DEBUG restore] createStockItem REQUEST orderId=${order.id} itemId=${item.id} ` +
          `payload=${JSON.stringify(restorePayload)}`,
      );

      const restored = await this.stockHttpService.createStockItem({
        ...restorePayload,
      });

      if (!restored) {
        this.logger.error(
          `🧪 [DEBUG restore] createStockItem FAILED (null) orderId=${order.id} itemId=${item.id} target=${target}`,
        );
        throw new BadRequestException(
          `Nu s-a putut restaura stocul furnizorului pentru produsul ${stockProductId} (linia ${item.id})`,
        );
      }
      this.logger.log(
        `🧪 [DEBUG restore] createStockItem SUCCESS orderId=${order.id} itemId=${item.id} ` +
          `stockId=${restored.id} entry_transaction_id=${restored.entry_transaction_id ?? 'N/A'}`,
      );
    }
  }

  async findOrderForRequester(
    orderId: number,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrder> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'supplier'],
    });
    if (!order) {
      throw new NotFoundException('Comanda nu a fost găsită');
    }
    assertOrderCompanyAccess(order, user);
    return order;
  }

  /**
   * Stoc curent din depozitul furnizorului pentru liniile unei comenzi.
   * Strict informativ: nu scade, nu rezervă, nu modifică stocul.
   * Acces: doar tenant furnizor / magazioner (nu client, nu șofer).
   */
  async getOrderRemainingStock(
    orderId: number,
    user?: OrderRequesterUser & { roles?: string[] },
  ): Promise<{
    order_id: number;
    location_id: number | null;
    items: Array<{
      order_item_id: number;
      product_id: number;
      quantity: number | null;
      unit: string | null;
    }>;
  }> {
    const order = await this.findOrderForRequester(orderId, user);
    await this.assertCanViewSupplierOrderRemainingStock(order, user);

    const items = order.items ?? [];

    const mapUnavailable = () =>
      items.map((item) => ({
        order_item_id: item.id,
        product_id: Number(item.product_id) || 0,
        quantity: null as number | null,
        unit: null as string | null,
      }));

    // Aceeași cheie ca la scăderea stocului: supplier_products.product_id (catalog stock).
    const stockProductIdByItemId = new Map<number, number>();
    for (const item of items) {
      const supplierProduct = await this.findSupplierProductForOrderLine(
        order.supplier_id,
        item,
      );
      const stockProductId = Number(
        supplierProduct?.product_id ?? item.product_id,
      );
      if (Number.isFinite(stockProductId) && stockProductId > 0) {
        stockProductIdByItemId.set(item.id, stockProductId);
      }
    }

    const productIds = [...new Set(stockProductIdByItemId.values())];

    let locationId: number;
    try {
      // Aceeași locație ca deductSupplierStockForOrder (depozit furnizor, nu livrare client).
      locationId = await this.resolveSupplierStockLocationId(
        order.supplier_id,
        order,
      );
    } catch (error) {
      this.logger.warn(
        `⚠️ [getOrderRemainingStock] cannot resolve supplier stock location for order ${orderId}: ${
          (error as Error)?.message ?? error
        }`,
      );
      return {
        order_id: order.id,
        location_id: null,
        items: mapUnavailable(),
      };
    }

    let stockRows: Array<{
      product_id: number;
      quantity: number;
      unit: string | null;
    }> = [];
    try {
      stockRows = await this.stockHttpService.getQuantitiesForProductsAtLocation(
        locationId,
        productIds,
      );
    } catch (error) {
      this.logger.error(
        `❌ [getOrderRemainingStock] stock fetch failed order=${orderId} location=${locationId}: ${
          (error as Error)?.message ?? error
        }`,
      );
      return {
        order_id: order.id,
        location_id: locationId,
        items: mapUnavailable(),
      };
    }

    const qtyByProductId = new Map(
      stockRows.map((row) => [Number(row.product_id), row]),
    );

    return {
      order_id: order.id,
      location_id: locationId,
      items: items.map((item) => {
        const productId =
          stockProductIdByItemId.get(item.id) ??
          (Number(item.product_id) || 0);
        const stock = qtyByProductId.get(productId);
        if (!stock) {
          // Fără rând de stoc la locația depozitului = 0, nu „indisponibil”.
          return {
            order_item_id: item.id,
            product_id: productId,
            quantity: 0,
            unit: null,
          };
        }
        return {
          order_item_id: item.id,
          product_id: productId,
          quantity: stock.quantity,
          unit: stock.unit,
        };
      }),
    };
  }

  private async assertCanViewSupplierOrderRemainingStock(
    order: SupplierOrder,
    user?: OrderRequesterUser & { roles?: string[] },
  ): Promise<void> {
    if (!user) {
      throw new ForbiddenException(
        'Autentificare necesară pentru stocul furnizorului',
      );
    }

    const roles = Array.isArray(user.roles)
      ? user.roles.map((role) => String(role).toLowerCase().trim())
      : [];
    if (roles.includes('sofer') || roles.includes('driver')) {
      throw new ForbiddenException(
        'Stocul furnizorului nu este disponibil pentru șofer',
      );
    }

    const ctx = buildSupplierProductUserContext(user);
    if (ctx.companyType === 'client') {
      throw new ForbiddenException(
        'Stocul furnizorului nu este disponibil pentru client',
      );
    }

    if (isAdminOrSuperAdminFromContext(ctx) && ctx.companyType !== 'client') {
      return;
    }

    const supplierOwnerCompanyId = Number(order.supplier?.owner_company_id);
    const userCompanyId = ctx.companyId;
    if (
      userCompanyId == null ||
      !Number.isFinite(supplierOwnerCompanyId) ||
      supplierOwnerCompanyId <= 0 ||
      userCompanyId !== supplierOwnerCompanyId
    ) {
      throw new ForbiddenException(
        'Stocul furnizorului nu este disponibil pentru această comandă',
      );
    }

    const employeeId = Number(user.userId ?? user.sub);
    if (Number.isFinite(employeeId) && employeeId > 0) {
      const link = await this.employeeSupplierRepo.findOne({
        where: {
          employee_id: employeeId,
          supplier_id: order.supplier_id,
        },
      });
      if (link?.role === 'driver') {
        throw new ForbiddenException(
          'Stocul furnizorului nu este disponibil pentru șofer',
        );
      }
      if (link?.role === 'warehouse') {
        return;
      }
    }

    if (
      roles.includes('magazioner') ||
      roles.includes('warehouse') ||
      ctx.companyType === 'furnizor'
    ) {
      return;
    }

    throw new ForbiddenException(
      'Stocul furnizorului este disponibil doar pentru furnizor și magazioner',
    );
  }

  async findOrderItemForRequester(
    itemId: number,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrderItem> {
    const item = await this.orderItemRepo.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException(`Item-ul ${itemId} nu a fost găsit`);
    }
    await this.findOrderForRequester(item.order_id, user);
    return item;
  }

  private async filterOrderIdsForRequester(
    orderIds: number[],
    user?: OrderRequesterUser,
  ): Promise<number[]> {
    if (!orderIds.length || !user) {
      return orderIds;
    }
    const orders = await this.orderRepo.find({
      where: { id: In(orderIds) },
    });
    return filterOrdersByRequesterCompany(orders, user).map((o) => o.id);
  }

  async updateOrderStatus(
    orderId: number,
    status: string,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrder> {
    const order = await this.findOrderForRequester(orderId, user);

    const previousStatus = order.status;
    const newStatus = status as OrderStatus;

    if (previousStatus === OrderStatus.CANCELLED && newStatus !== OrderStatus.CANCELLED) {
      throw new ConflictException('Comanda este anulată');
    }

    if (newStatus === OrderStatus.CANCELLED) {
      await this.assertDriverArrivedForClientActions(
        orderId,
        previousStatus,
        order.supplier_id,
      );
    }

    this.logger.log(
      `🧪 [DEBUG cancel] updateOrderStatus CALLED orderId=${orderId} previousStatus=${previousStatus} newStatus=${newStatus} rawStatusArg=${status}`,
    );

    // Scădere stoc furnizor la confirmarea furnizorului — la tranziția în `confirmed`.
    // NU folosim aici setul SUPPLIER_STOCK_DEDUCTED_STATUSES: `magazioner` e inclus acolo
    // (pentru restore), dar fluxul normal este sent → magazioner → confirmed, deci la
    // confirmare previousStatus este de regulă `magazioner` și deduct-ul TREBUIE să ruleze.
    // Dubla-scădere (ex. re-confirm după send-back) e prevenită idempotent în stock-ms
    // prin target-ul `supplier-order-confirm:*`.
    // Furnizor fără cont: confirmarea tenant nu se aplică (auto-confirm la create fără deduct).
    const hasAccount = await this.hasSupplierLoginAccount(order.supplier_id);
    if (
      newStatus === OrderStatus.CONFIRMED &&
      previousStatus !== OrderStatus.CONFIRMED &&
      !hasAccount
    ) {
      throw new BadRequestException(
        'Confirmarea din contul furnizorului nu este disponibilă pentru furnizori fără cont autentificabil.',
      );
    }

    if (
      newStatus === OrderStatus.CONFIRMED &&
      previousStatus !== OrderStatus.CONFIRMED
    ) {
      await this.deductSupplierStockForOrder(order);
    }

    // Restore autoritar pe ledger: la ORICE tranziție în `cancelled` încercăm restore,
    // indiferent de previousStatus (inclusiv dacă e deja CANCELLED — ex. setat anterior
    // de cancelRemainingQuantity/markOrderAsPartiallyReceived). Decizia reală o ia
    // restoreSupplierStockForCancelledOrder prin guard-ul hasSupplierOrderExit:
    // refacem stoc DOAR dacă există un EXIT real (supplier-order-confirm:* sau legacy
    // supplier-order-create:*). Restore-ul e idempotent prin target-ul ENTRY de cancel.
    if (newStatus === OrderStatus.CANCELLED) {
      this.logger.log(
        `🧪 [DEBUG cancel] updateOrderStatus → restoreSupplierStockForCancelledOrder orderId=${orderId} previousStatus=${previousStatus}`,
      );
      await this.restoreSupplierStockForCancelledOrder(order);
      this.logger.log(
        `🧪 [DEBUG cancel] updateOrderStatus ← restoreSupplierStockForCancelledOrder DONE orderId=${orderId}`,
      );
    }

    const updateData: any = { status: newStatus };

    // Dacă statusul este 'cancelled', setează cancelled_at la momentul curent
    if (newStatus === OrderStatus.CANCELLED && !order.cancelled_at) {
      updateData.cancelled_at = new Date();
    }

    await this.orderRepo.update(order.id, updateData);
    const updated = await this.orderRepo.findOne({
      where: { id: order.id },
      relations: ['supplier'],
    });
    if (!updated) throw new NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
    if (newStatus === OrderStatus.CANCELLED && order.supplier_location_id != null) {
      const supplier = await this.supplierRepo.findOne({ where: { id: order.supplier_id } });
      await this.sendOrderNotification(
        'order_cancelled',
        'Comandă anulată',
        `Comanda ${order.id} pentru furnizorul ${supplier?.supplier_name ?? 'N/A'} a fost anulată`,
        order.supplier_location_id,
        order.id,
        { orderId: order.id, supplierName: supplier?.supplier_name },
        '/comenzi'
      );
    }
    await this.attachHasSupplierAccountFlag([updated]);
    return updated;
  }

  /**
   * Anulează item-uri dintr-o comandă
   * Creează înregistrări în supplier_order_cancelled_items pentru item-urile anulate
   */
  async cancelOrderItems(
    dto: { orderId: number; items: Array<{ itemId: number; returnedQuantity: number; returnReason?: string }> },
    user?: OrderRequesterUser,
  ): Promise<SupplierOrder> {
    this.logger.log(`🚫 [SUPPLIERS SERVICE] Cancelling items for order ${dto.orderId}`);
    
    await this.findOrderForRequester(dto.orderId, user);
    const order = await this.orderRepo.findOne({ 
      where: { id: dto.orderId }, 
      relations: ['items'] 
    });
    
    if (!order) {
      throw new NotFoundException('Comanda nu a fost găsită');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Comanda este deja anulată');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Nu se pot anula item-uri pentru o comandă complet livrată');
    }

    await this.assertDriverArrivedForClientActions(
      order.id,
      order.status,
      order.supplier_id,
    );
    
    if (!order.items || order.items.length === 0) {
      throw new BadRequestException('Comanda nu are item-uri');
    }

    // Obține recepțiile PENDING pentru această comandă
    const pendingReceptions = await this.orderItemReceptionRepo.find({
      where: {
        supplier_order_id: dto.orderId,
        status: ReceptionStatus.PENDING,
      },
    });

    // Creează un map pentru recepțiile PENDING pe order_item_id
    const pendingByItemId = new Map<number, { received: number; returned: number }>();
    pendingReceptions.forEach(reception => {
      const existing = pendingByItemId.get(reception.supplier_order_item_id) || { received: 0, returned: 0 };
      pendingByItemId.set(reception.supplier_order_item_id, {
        received: existing.received + Number(reception.received_delta || 0),
        returned: existing.returned + Number(reception.returned_delta || 0),
      });
    });

    const cancelledItems: SupplierOrderCancelledItem[] = [];

    // Procesează fiecare item de anulat
    for (const cancelItem of dto.items) {
      const orderItem = order.items?.find(item => item.id === cancelItem.itemId);
      
      if (!orderItem) {
        throw new BadRequestException(`Item-ul ${cancelItem.itemId} nu a fost găsit în comandă`);
      }

      const orderedQty = Number(orderItem.quantity) || 0;
      const existingReceivedQty = Number(orderItem.received_quantity) || 0;
      const existingReturnedQty = Number(orderItem.returned_quantity) || 0;
      
      const pending = pendingByItemId.get(orderItem.id) || { received: 0, returned: 0 };
      const totalReceivedQty = existingReceivedQty + pending.received;
      const totalReturnedQty = existingReturnedQty + pending.returned;
      
      // Calculează cantitatea rămasă de recepționat (fără să scadă returned)
      const remainingToReceiveQty = orderedQty - totalReceivedQty;
      
      // Validare: cantitatea de anulat nu poate depăși cât mai rămâne de recepționat
      if (cancelItem.returnedQuantity > remainingToReceiveQty + 0.01) {
        throw new BadRequestException(
          `Pentru item-ul ${orderItem.id}: cantitatea de anulat (${cancelItem.returnedQuantity}) depășește cantitatea rămasă de recepționat (${remainingToReceiveQty})`
        );
      }

      // Verifică dacă nu există deja un item anulat pentru acest order_item_id
      const existingCancelled = await this.cancelledItemRepo.findOne({
        where: { supplier_order_item_id: orderItem.id }
      });

      if (existingCancelled) {
        // Dacă există deja, actualizează cantitatea (dar nu poate depăși limita)
        const maxAllowed = remainingToReceiveQty + existingCancelled.returned_quantity;
        if (cancelItem.returnedQuantity > maxAllowed + 0.01) {
          throw new BadRequestException(
            `Pentru item-ul ${orderItem.id}: cantitatea totală anulată (${existingCancelled.returned_quantity + cancelItem.returnedQuantity}) depășește cantitatea rămasă de recepționat (${remainingToReceiveQty})`
          );
        }
        existingCancelled.returned_quantity = Number(existingCancelled.returned_quantity) + cancelItem.returnedQuantity;
        if (cancelItem.returnReason) {
          existingCancelled.return_reason = cancelItem.returnReason;
        }
        existingCancelled.updated_at = new Date();
        await this.cancelledItemRepo.save(existingCancelled);
        this.logger.log(`✅ [SUPPLIERS SERVICE] Updated cancelled item ${existingCancelled.id} for order item ${orderItem.id}`);
      } else {
        // Creează un nou item anulat
        const cancelledItem = this.cancelledItemRepo.create({
          order_id: order.id,
          supplier_order_item_id: orderItem.id,
          product_id: orderItem.product_id,
          quantity: orderedQty,
          price_per_unit: Number(orderItem.price_per_unit) || 0,
          subtotal: Number(orderItem.subtotal) || 0,
          total: Number(orderItem.total) || 0,
          received_quantity: existingReceivedQty,
          returned_quantity: cancelItem.returnedQuantity,
          return_reason: cancelItem.returnReason || 'Anulat - partea rămasă de recepționat',
          reception_date: new Date(),
          reception_user_id: order.created_by_user_id,
        });
        
        await this.cancelledItemRepo.save(cancelledItem);
        cancelledItems.push(cancelledItem);
        this.logger.log(`✅ [SUPPLIERS SERVICE] Created cancelled item for order item ${orderItem.id}`);
      }
    }

    // Reîncarcă comanda actualizată
    const updatedOrder = await this.orderRepo.findOne({ 
      where: { id: dto.orderId },
      relations: ['items', 'supplier'],
    });

    if (!updatedOrder) {
      throw new NotFoundException('Comanda nu a putut fi reîncărcată după anulare');
    }

    this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully cancelled items for order ${dto.orderId}`);
    return updatedOrder;
  }

  /**
   * Anulează partea rămasă de recepționat pentru o comandă
   * Marchează restul ca returnat cu motivul specificat
   * @deprecated Folosește cancelOrderItems în loc de această metodă
   */
  async cancelRemainingQuantity(
    orderId: number,
    reason?: string,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrder> {
    this.logger.log(
      `🧪 [DEBUG cancel] cancelRemainingQuantity CALLED orderId=${orderId} reason=${reason ?? 'null'}`,
    );
    this.logger.log(`🚫 [SUPPLIERS SERVICE] Cancelling remaining quantity for order ${orderId}`);
    
    await this.findOrderForRequester(orderId, user);
    const order = await this.orderRepo.findOne({ 
      where: { id: orderId }, 
      relations: ['items'] 
    });
    
    if (!order) {
      throw new NotFoundException('Comanda nu a fost găsită');
    }

    this.logger.log(`📦 [SUPPLIERS SERVICE] Order ${orderId} found with ${order.items?.length || 0} items`);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Comanda este deja anulată');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Nu se poate anula partea rămasă pentru o comandă complet livrată');
    }

    await this.assertDriverArrivedForClientActions(
      order.id,
      order.status,
      order.supplier_id,
    );
    
    if (!order.items || order.items.length === 0) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order ${orderId} has no items`);
      throw new BadRequestException('Comanda nu are item-uri');
    }

    // Obține toate recepțiile PENDING pentru această comandă
    const pendingReceptions = await this.orderItemReceptionRepo.find({
      where: {
        supplier_order_id: orderId,
        status: ReceptionStatus.PENDING,
      },
    });

    // Creează un map pentru recepțiile PENDING pe order_item_id
    const pendingByItemId = new Map<number, { received: number; returned: number }>();
    pendingReceptions.forEach(reception => {
      const existing = pendingByItemId.get(reception.supplier_order_item_id) || { received: 0, returned: 0 };
      pendingByItemId.set(reception.supplier_order_item_id, {
        received: existing.received + Number(reception.received_delta || 0),
        returned: existing.returned + Number(reception.returned_delta || 0),
      });
    });

    const receptionItems: Array<{
      itemId: number;
      receivedQuantity: number;
      returnedQuantity: number;
      returnReason: string;
    }> = [];
    const cancelItems: Array<{ itemId: number; returnedQuantity: number; returnReason: string }> = [];

    // Procesează fiecare item din comandă
    for (const item of order.items || []) {
      const orderedQty = Number(item.quantity) || 0;
      const existingReceivedQty = Number(item.received_quantity) || 0;
      const existingReturnedQty = Number(item.returned_quantity) || 0;
      
      const pending = pendingByItemId.get(item.id) || { received: 0, returned: 0 };
      const totalReceivedQty = existingReceivedQty + pending.received;
      const totalReturnedQty = existingReturnedQty + pending.returned;
      
      // Calculează cantitatea rămasă de recepționat (fără să scadă returned)
      // "Rămas de recepționat" = cât mai trebuie adus, indiferent de returnări
      const remainingToReceiveQty = orderedQty - totalReceivedQty;
      
      this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: ordered=${orderedQty}, existingReceived=${existingReceivedQty}, pendingReceived=${pending.received}, totalReceived=${totalReceivedQty}, existingReturned=${existingReturnedQty}, pendingReturned=${pending.returned}, totalReturned=${totalReturnedQty}, remainingToReceive=${remainingToReceiveQty}`);
      
      // Dacă mai rămâne ceva de recepționat, marchează-l ca returnat (anulat)
      if (remainingToReceiveQty > 0.01) {
        // IMPORTANT: Pentru anularea părții rămase, vrem să returnăm exact cât mai rămâne de recepționat
        // Astfel, partea rămasă nu va mai putea fi recepționată ulterior
        // Nu verificăm validarea strictă received + returned <= ordered pentru anulare,
        // pentru că returnăm partea rămasă care nu a fost recepționată
        
        // Cantitatea nouă de returnat = cât mai rămâne de recepționat
        const newlyReturnedQty = remainingToReceiveQty;
        
        // Total returned după această operațiune = returned existent + nou returnat
        const newTotalReturnedQty = totalReturnedQty + newlyReturnedQty;
        
        this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: remainingToReceive=${remainingToReceiveQty}, existingReturned=${totalReturnedQty}, newlyReturnedQty=${newlyReturnedQty}, newTotalReturnedQty=${newTotalReturnedQty}`);
        
        // Pentru anularea părții rămase, validăm doar că returned nu depășește ordered
        // (nu verificăm received + returned <= ordered, pentru că returnăm partea rămasă)
        if (newTotalReturnedQty > orderedQty + 0.01) {
          this.logger.error(`❌ [SUPPLIERS SERVICE] Item ${item.id}: Returned quantity would exceed ordered: returned(${newTotalReturnedQty}) > ordered(${orderedQty})`);
        } else {
            if (newlyReturnedQty > 0.01) {
              receptionItems.push({
                itemId: item.id,
                receivedQuantity: existingReceivedQty, // Doar ce s-a recepționat și aprobat (fără PENDING)
                returnedQuantity: newTotalReturnedQty, // Total returned (existent + PENDING + nou)
                returnReason: reason || 'Anulat - partea rămasă de recepționat',
              });
              // Adaugă și payload-ul pentru creare item-urilor anulate (numai cantitatea nouă anulată)
              cancelItems.push({
                itemId: item.id,
                returnedQuantity: newlyReturnedQty,
                returnReason: reason || 'Anulat - partea rămasă de recepționat',
              });
              this.logger.log(`✅ [SUPPLIERS SERVICE] Item ${item.id}: Added to receptionItems and cancelItems for cancellation`);
            } else {
              this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: Skipped - newlyReturnedQty too small (${newlyReturnedQty})`);
            }
        }
      } else {
        this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: Skipped - no remaining quantity to receive (remainingToReceiveQty=${remainingToReceiveQty})`);
      }
    }

    this.logger.log(`📦 [SUPPLIERS SERVICE] Total receptionItems: ${receptionItems.length}`);
    
    if (receptionItems.length === 0) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] No items to cancel for order ${orderId}`);
      throw new BadRequestException('Nu există cantitate rămasă de anulat pentru această comandă');
    }

    // Folosește mecanismul existent de recepție parțială
    const partialReceptionDto = {
      orderId: order.id,
      items: receptionItems,
    };

    const updatedOrder = await this.markOrderAsPartiallyReceived(partialReceptionDto, user);
    // Persist cancelled items entries so they appear in cancelled-items view
    if (cancelItems.length > 0) {
      try {
        // Debug logs: show the payloads that will be used to create cancelled items
        try {
          const safeReception = JSON.stringify(receptionItems, (_k, v) => (typeof v === 'number' || typeof v === 'string' ? v : v), 2);
          const safeCancel = JSON.stringify(cancelItems, (_k, v) => (typeof v === 'number' || typeof v === 'string' ? v : v), 2);
        } catch (e: any) {
        }

        this.logger.log(`🚫 [SUPPLIERS SERVICE] Creating cancelled items records for order ${orderId}`);
        await this.cancelOrderItems({ orderId: order.id, items: cancelItems as any }, user);
        this.logger.log(`✅ [SUPPLIERS SERVICE] Cancelled items recorded for order ${orderId}`);
      } catch (e: any) {
        this.logger.error(`❌ [SUPPLIERS SERVICE] Failed to create cancelled items for order ${orderId}: ${e?.message || e}`, e?.stack);
      }
    }

    // Aprobă automat recepțiile de returnare create
    const allReceptions = await this.orderItemReceptionRepo.find({
      where: { supplier_order_id: orderId },
    });

    const newPendingReceptions = allReceptions.filter(r => 
      r.status === ReceptionStatus.PENDING && 
      r.returned_delta > 0 &&
      receptionItems.some(item => item.itemId === r.supplier_order_item_id)
    );

    if (newPendingReceptions.length > 0) {
      const receptionIds = newPendingReceptions.map(r => r.id);
      await this.approveReceptions(orderId, receptionIds, user);
      this.logger.log(`✅ [SUPPLIERS SERVICE] Approved ${receptionIds.length} return receptions automatically`);
    }

    // Reîncarcă comanda pentru a obține valorile actualizate
    const orderAfterReception = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    
    if (!orderAfterReception) {
      throw new NotFoundException('Comanda nu a putut fi reîncărcată după anulare');
    }
    
    // Verifică dacă toate item-urile au fost complet procesate (received + returned >= ordered)
    // Dacă da, marchează comanda ca anulată
    let allItemsFullyProcessed = true;
    if (orderAfterReception.items && orderAfterReception.items.length > 0) {
      for (const item of orderAfterReception.items) {
        const orderedQty = Number(item.quantity) || 0;
        const receivedQty = Number(item.received_quantity) || 0;
        const returnedQty = Number(item.returned_quantity) || 0;
        
        // Verifică dacă item-ul este complet procesat
        if (receivedQty + returnedQty < orderedQty - 0.01) {
          allItemsFullyProcessed = false;
          break;
        }
      }
    }
    
    // Dacă toate item-urile sunt complet procesate, marchează comanda ca anulată
    if (allItemsFullyProcessed && orderAfterReception.status !== OrderStatus.CANCELLED) {
      this.logger.log(
        `🚫 [SUPPLIERS SERVICE] All items fully processed, marking order ${orderId} as cancelled`,
      );
      this.logger.log(
        `🧪 [DEBUG cancel] markOrderAsPartiallyReceived sets CANCELLED orderId=${orderId} ` +
          `(înainte de PATCH /status — restore va rula doar în updateOrderStatus)`,
      );
      orderAfterReception.status = OrderStatus.CANCELLED;
      orderAfterReception.cancelled_at = new Date();
      await this.orderRepo.save(orderAfterReception);
      if (orderAfterReception.supplier_location_id != null) {
        const supplier = await this.supplierRepo.findOne({ where: { id: orderAfterReception.supplier_id } });
        await this.sendOrderNotification(
          'order_cancelled',
          'Comandă anulată',
          `Comanda ${orderId} pentru furnizorul ${supplier?.supplier_name ?? 'N/A'} a fost anulată`,
          orderAfterReception.supplier_location_id,
          orderId,
          { orderId, supplierName: supplier?.supplier_name },
          '/comenzi'
        );
      }
    }
    
    // Reîncarcă comanda finală cu toate relațiile
    const finalOrder = await this.orderRepo.findOne({ 
      where: { id: orderId },
      relations: ['items', 'supplier'],
    });

    if (!finalOrder) {
      throw new NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
    }

    this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully cancelled remaining quantity for order ${orderId}`);
    return finalOrder;
  }

  /**
   * Aprobă recepțiile pentru o comandă și creează stock items
   */
  async approveReceptions(
    orderId: number,
    receptionIds: number[],
    user?: OrderRequesterUser,
  ): Promise<{ approved: number; stockCreated: number }> {
    this.logger.log(`✅ [SUPPLIERS SERVICE] Approving ${receptionIds.length} receptions for order ${orderId}`);
    
    await this.findOrderForRequester(orderId, user);
    // Găsește recepțiile cu status PENDING
    const receptions = await this.orderItemReceptionRepo.find({
      where: {
        id: In(receptionIds),
        supplier_order_id: orderId,
        status: ReceptionStatus.PENDING,
      },
      relations: [],
    });

    if (receptions.length === 0) {
      throw new BadRequestException('Nu s-au găsit recepții PENDING pentru aprobare');
    }

    if (receptions.length !== receptionIds.length) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Only ${receptions.length} out of ${receptionIds.length} receptions found with PENDING status`);
    }

    // Obține order items pentru a calcula received_quantity
    const orderItemIds = Array.from(new Set(receptions.map(r => r.supplier_order_item_id)));
    const orderItems = await this.orderItemRepo.find({
      where: { id: In(orderItemIds) },
    });
    const orderItemsMap = new Map(orderItems.map(item => [item.id, item]));

    // Obține comanda pentru a accesa informații
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) {
      throw new NotFoundException(`Comanda ${orderId} nu a fost găsită`);
    }

    const stockItemJobs: Array<{ dto: CreateStockItemDto; receptionId: number }> = [];
    const updatedItemQuantities = new Map<number, { received: number; returned: number }>();
    const cancelledPayload: Array<{ itemId: number; returnedQuantity: number; returnReason?: string }> = [];

    // Un singur moment de aprobare pentru tot lotul: rândurile aprobate împreună formează
    // un document de intrare, iar exportul le grupează pe (reception_batch_id, approved_at).
    const approvedAt = new Date();

    // Procesează fiecare recepție aprobată
    for (const reception of receptions) {
      const orderItem = orderItemsMap.get(reception.supplier_order_item_id);
      if (!orderItem) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order item ${reception.supplier_order_item_id} not found for reception ${reception.id}`);
        continue;
      }

      const itemAvailability = (orderItem as any).availability_status || 'available';
      if (itemAvailability === 'unavailable') {
        this.logger.log(`⏭️ [SUPPLIERS SERVICE] Skipping stock creation for unavailable item ${orderItem.id}`);
        reception.status = ReceptionStatus.APPROVED;
        reception.approved_at = approvedAt;
        await this.orderItemReceptionRepo.save(reception);
        continue;
      }

      // Actualizează statusul recepției la APPROVED
      reception.status = ReceptionStatus.APPROVED;
      reception.approved_at = approvedAt;
      await this.orderItemReceptionRepo.save(reception);

      // Calculează cantitățile cumulate pentru order item
      if (!updatedItemQuantities.has(reception.supplier_order_item_id)) {
        const existingReceived = Number(orderItem.received_quantity) || 0;
        const existingReturned = Number(orderItem.returned_quantity) || 0;
        updatedItemQuantities.set(reception.supplier_order_item_id, {
          received: existingReceived,
          returned: existingReturned,
        });
      }

      const quantities = updatedItemQuantities.get(reception.supplier_order_item_id)!;
      const receivedDelta = Number(reception.received_delta) || 0;

      // Adaugă delta-urile recepției aprobate
      if (receivedDelta > 0) {
        quantities.received += receivedDelta;

        const clientCompanyId = Number(order.company_id);
        const stockLocationId =
          reception.location_id ??
          order.supplier_location_id ??
          order.location_id ??
          undefined;
        const parsedStockLocationId = Number(stockLocationId);
        let clientStockProductId = Number(reception.product_id);

        if (
          Number.isFinite(clientCompanyId) &&
          clientCompanyId > 0 &&
          Number.isFinite(parsedStockLocationId) &&
          parsedStockLocationId > 0
        ) {
          if (
            !orderItem.supplier_product_id ||
            Number(orderItem.supplier_product_id) <= 0
          ) {
            this.logger.warn(
              `[VAL5 data cleanup] Order item ${orderItem.id} missing supplier_product_id on approveReceptions`,
            );
            throw new BadRequestException(
              `Linia ${orderItem.id} nu are supplier_product_id. Recepția necesită remediere date (VAL 5).`,
            );
          }
          clientStockProductId = await this.resolveClientStockProductForOrder(
            clientCompanyId,
            Number(orderItem.supplier_product_id),
            parsedStockLocationId,
            undefined,
            { assertOrderItemProductId: Number(orderItem.product_id) },
          );
        }

        // Convert gross quantity (from order) to net quantity (for stock)
        let netQuantity = receivedDelta; // Default: use as-is
        
        try {
          const supplierProduct = orderItem
            ? await this.findSupplierProductForOrderLine(order.supplier_id, orderItem)
            : null;

          if (supplierProduct) {
            const productGrossQuantity = Number(supplierProduct.gross_quantity) || 0;
            const productNetQuantity = Number(supplierProduct.net_quantity) || 0;
            if (productGrossQuantity > 0 && productNetQuantity > 0) {
              netQuantity = receivedDelta * (productNetQuantity / productGrossQuantity);
              this.logger.log(
                `📦 [SUPPLIERS SERVICE] Converting quantity for product ${clientStockProductId}: ` +
                `gross=${receivedDelta.toFixed(2)} → net=${netQuantity.toFixed(2)} ` +
                `(ratio: ${productNetQuantity}/${productGrossQuantity})`
              );
            }
          }
        } catch (err) {
          this.logger.warn(
            `⚠️ [SUPPLIERS SERVICE] Could not fetch supplier product for conversion ` +
            `(supplier=${order.supplier_id}, product=${clientStockProductId}):`,
            err
          );
        }

        // Persistăm cantitatea netă pe recepție: documentul de intrare exportat către
        // giurom 2.0 trebuie să arate exact ce a intrat în stoc, nu cantitatea brută.
        reception.net_quantity = netQuantity;
        await this.orderItemReceptionRepo.update(reception.id, { net_quantity: netQuantity });

        const locationId = stockLocationId;
        const stockItemDto: CreateStockItemDto = {
          product_id: clientStockProductId,
          supplier_order_item_id: reception.supplier_order_item_id,
          quantity: netQuantity,
          price: Number(orderItem.price_per_unit),
          entry_date: reception.occurred_at instanceof Date ? reception.occurred_at.toISOString() : new Date(reception.occurred_at).toISOString(),
          status: 'valid',
          location_id: locationId,
          target: `entry:reception:${reception.id}`,
          source: 'comanda',
        };
        stockItemJobs.push({ dto: stockItemDto, receptionId: reception.id });
        this.logger.log(`📦 [SUPPLIERS SERVICE] Queued stock item: product_id=${clientStockProductId}, quantity=${netQuantity.toFixed(2)} (net), location_id=${locationId}, reception_id=${reception.id}`);
      }
      
      if (reception.returned_delta > 0) {
        quantities.returned += Number(reception.returned_delta);
        // If this approved reception represents a cancellation (reason includes 'Anulat'), collect for cancelled items
        if (reception.reason && String(reception.reason).toLowerCase().includes('anulat')) {
          cancelledPayload.push({
            itemId: reception.supplier_order_item_id,
            returnedQuantity: Number(reception.returned_delta),
            returnReason: reception.reason,
          });
        }
      }
    }

    // Actualizează received_quantity și returned_quantity în order items
    for (const [itemId, quantities] of updatedItemQuantities.entries()) {
      const orderItem = orderItemsMap.get(itemId);
      if (orderItem) {
        orderItem.received_quantity = quantities.received;
        orderItem.returned_quantity = quantities.returned;
        
        // Setează data recepției dacă există recepții aprobate
        if (quantities.received > 0) {
          orderItem.reception_date = new Date();
          orderItem.reception_user_id = order.created_by_user_id;
        }
        
        await this.orderItemRepo.save(orderItem);
      }
    }

    // Creează stock items pentru recepțiile aprobate
    let stockCreated = 0;
    if (stockItemJobs.length === 0) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Niciun stock item de creat: toate recepțiile aprobate au received_delta <= 0. Recepții: ${receptions.map(r => `id=${r.id} received_delta=${r.received_delta}`).join(', ')}`);
    }
    if (stockItemJobs.length > 0) {
      this.logger.log(`📦 [SUPPLIERS SERVICE] Creating ${stockItemJobs.length} stock items for approved receptions...`);
      const createdStockItems = await this.stockHttpService.createStockItems(stockItemJobs.map((j) => j.dto));
      stockCreated = createdStockItems.length;

      // stock_item_id stores entry_transaction_id for new records (legacy column name)
      for (let i = 0; i < stockItemJobs.length; i++) {
        const created = createdStockItems[i];
        const job = stockItemJobs[i];
        if (created && job) {
          const entryTxId = created.entry_transaction_id ?? null;
          if (entryTxId != null) {
            await this.orderItemReceptionRepo.update(job.receptionId, {
              stock_item_id: entryTxId,
            });
            this.logger.log(
              `✅ [SUPPLIERS SERVICE] Linked reception ${job.receptionId} → entry_transaction_id=${entryTxId}`,
            );
          } else {
            this.logger.warn(
              `⚠️ [SUPPLIERS SERVICE] Stock created for reception ${job.receptionId} but entry_transaction_id missing`,
            );
          }
        }
      }

      this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully created ${stockCreated} stock items`);
    }

    // Dacă există recepții aprobate care reprezintă anulări, înregistrăm item-urile anulate în tabelul dedicated
    if (cancelledPayload.length > 0) {
      try {
        this.logger.log(`🚫 [SUPPLIERS SERVICE] Creating cancelled items from approved receptions for order ${orderId}`);
        await this.cancelOrderItems({ orderId, items: cancelledPayload as any }, user);
        this.logger.log(`✅ [SUPPLIERS SERVICE] Cancelled items created from approved receptions for order ${orderId}`);
      } catch (e: any) {
        this.logger.error(`❌ [SUPPLIERS SERVICE] Failed to create cancelled items from approved receptions for order ${orderId}: ${e?.message || e}`, e?.stack);
      }
    }

    // Verifică dacă toate recepțiile comenzii sunt aprobate și actualizează statusul comenzii
    const allReceptions = await this.orderItemReceptionRepo.find({
      where: { supplier_order_id: orderId },
    });
    const hasPendingReceptions = allReceptions.some(r => r.status === ReceptionStatus.PENDING);
    
    if (!hasPendingReceptions && order.items) {
      // Verifică dacă toate itemele sunt complet recepționate (skip unavailable)
      const allItemsFullyReceived = order.items.every(item => {
        const itemAvail = (item as any).availability_status || 'available';
        if (itemAvail === 'unavailable') return true;
        const received = Number(item.received_quantity) || 0;
        const original = Number(item.quantity);
        return received >= original;
      });
      
      if (allItemsFullyReceived) {
        order.status = OrderStatus.DELIVERED;
        await this.orderRepo.update(order.id, { status: order.status });
      }
    }

    if (order.supplier_location_id != null) {
      const supplier = await this.supplierRepo.findOne({ where: { id: order.supplier_id } });
      await this.sendOrderNotification(
        'order_reception_approved',
        'Comandă aprobată',
        `Recepțiile pentru comanda ${orderId} (${supplier?.supplier_name ?? 'N/A'}) au fost aprobate`,
        order.supplier_location_id,
        orderId,
        { orderId, supplierName: supplier?.supplier_name },
        '/comenzi'
      );
    }

    // Documentul de intrare pleacă spre giurom 2.0 imediat ce recepția e aprobată.
    // Metoda nu aruncă niciodată — dacă App2 e indisponibil, plasa de siguranță îl reia.
    void this.entryDocumentsExportService.pushForOrderSafe(orderId);

    return {
      approved: receptions.length,
      stockCreated,
    };
  }

  /**
   * Respinge recepțiile pentru o comandă
   */
  async rejectReceptions(
    orderId: number,
    receptionIds: number[],
    reason?: string,
    user?: OrderRequesterUser,
  ): Promise<{ rejected: number }> {
    this.logger.log(`❌ [SUPPLIERS SERVICE] Rejecting ${receptionIds.length} receptions for order ${orderId}`);
    
    await this.findOrderForRequester(orderId, user);
    // Găsește recepțiile cu status PENDING
    const receptions = await this.orderItemReceptionRepo.find({
      where: {
        id: In(receptionIds),
        supplier_order_id: orderId,
        status: ReceptionStatus.PENDING,
      },
    });

    if (receptions.length === 0) {
      throw new BadRequestException('Nu s-au găsit recepții PENDING pentru respingere');
    }

    if (receptions.length !== receptionIds.length) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Only ${receptions.length} out of ${receptionIds.length} receptions found with PENDING status`);
    }

    // Actualizează statusul recepțiilor la REJECTED
    for (const reception of receptions) {
      reception.status = ReceptionStatus.REJECTED;
      if (reason) {
        reception.reason = reason;
      }
      await this.orderItemReceptionRepo.save(reception);
    }

    this.logger.log(`✅ [SUPPLIERS SERVICE] Rejected ${receptions.length} receptions`);

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (order?.supplier_location_id != null) {
      const supplier = await this.supplierRepo.findOne({ where: { id: order.supplier_id } });
      await this.sendOrderNotification(
        'order_reception_rejected',
        'Comandă respinsă',
        `Recepțiile pentru comanda ${orderId} (${supplier?.supplier_name ?? 'N/A'}) au fost respinse${reason ? `: ${reason}` : ''}`,
        order.supplier_location_id,
        orderId,
        { orderId, reason },
        '/comenzi'
      );
    }
    
    return {
      rejected: receptions.length,
    };
  }

  /**
   * Obține toate recepțiile pentru o comandă cu numele utilizatorilor
   */
  async getOrderCancelledItems(
    orderId: number,
    user?: OrderRequesterUser,
  ): Promise<SupplierOrderCancelledItem[]> {
    await this.findOrderForRequester(orderId, user);
    return this.cancelledItemRepo.find({
      where: { order_id: orderId },
      relations: ['orderItem'],
    });
  }

  /**
   * Batch: item-uri anulate pentru mai multe comenzi.
   * Folosit în rapoarte pentru a evita N+1 request-uri (o singură interogare pe cancelledItemRepo).
   */
  async getOrderCancelledItemsBatch(
    orderIds: number[],
    user?: OrderRequesterUser,
  ): Promise<SupplierOrderCancelledItem[]> {
    if (!orderIds || orderIds.length === 0) {
      return [];
    }

    const allowedOrderIds = await this.filterOrderIdsForRequester(orderIds, user);
    if (allowedOrderIds.length === 0) {
      return [];
    }

    return this.cancelledItemRepo.find({
      where: { order_id: In(allowedOrderIds) as any },
      relations: ['orderItem'],
    });
  }

  /**
   * Rezolvă actor id (JWT `sub` = employees.id în acest sistem, uneori users.id)
   * → nume afișat (first + last din employees).
   * 1) HTTP /employees/by-user/:userId (când id = auth.users.id)
   * 2) HTTP /employees/:id/name (când id = employees.id / JWT sub)
   * 3) Fallback cross-DB: users.id → id_employee → employees
   * 4) Fallback cross-DB: tratează id-ul direct ca employees.id
   */
  private async resolveAuthUserDisplayNames(
    userIds: number[],
  ): Promise<Map<number, string>> {
    const usersMap = new Map<number, string>();
    const uniqueIds = Array.from(
      new Set(
        userIds.filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
    if (uniqueIds.length === 0) {
      return usersMap;
    }

    const employeesServiceUrl = this.getEmployeesServiceUrl();
    const headers = this.internalServiceHeaders();
    const missingAfterHttp: number[] = [];

    await Promise.all(
      uniqueIds.map(async (actorId) => {
        try {
          const byUserResp: any = await firstValueFrom(
            this.httpService.get(
              `${employeesServiceUrl}/employees/by-user/${actorId}`,
              { headers, timeout: 4000 },
            ),
          );
          const data = byUserResp?.data?.data || byUserResp?.data || byUserResp;
          const firstName = data?.first_name || data?.firstName || '';
          const lastName = data?.last_name || data?.lastName || '';
          const fullName =
            data?.full_name ||
            `${firstName} ${lastName}`.trim() ||
            data?.email ||
            data?.name ||
            '';
          if (fullName) {
            usersMap.set(actorId, String(fullName).trim());
            return;
          }
        } catch {
          /* try employee-id path below */
        }

        try {
          const byEmpResp: any = await firstValueFrom(
            this.httpService.get(
              `${employeesServiceUrl}/employees/${actorId}/name`,
              { headers, timeout: 4000 },
            ),
          );
          const data = byEmpResp?.data?.data || byEmpResp?.data || byEmpResp;
          const firstName = data?.first_name || data?.firstName || '';
          const lastName = data?.last_name || data?.lastName || '';
          const fullName =
            data?.full_name || `${firstName} ${lastName}`.trim() || '';
          if (fullName) {
            usersMap.set(actorId, String(fullName).trim());
            return;
          }
        } catch {
          /* fallback SQL mai jos */
        }
        missingAfterHttp.push(actorId);
      }),
    );

    if (missingAfterHttp.length === 0) {
      return usersMap;
    }

    const authDbName = process.env.AUTH_DB_NAME || 'giurombitap_auth';
    const employeesDbName =
      process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';

    for (const actorId of missingAfterHttp) {
      try {
        let employeeId: number | null = null;

        const userById = await this.connection.query(
          `SELECT id_employee FROM ${authDbName}.users WHERE id = ?`,
          [actorId],
        );
        if (userById?.length && userById[0].id_employee != null) {
          employeeId = Number(userById[0].id_employee);
        }

        // JWT `sub` is employees.id in this codebase — resolve directly.
        if (employeeId == null || !Number.isFinite(employeeId)) {
          const userByEmployee = await this.connection.query(
            `SELECT id_employee FROM ${authDbName}.users WHERE id_employee = ? LIMIT 1`,
            [actorId],
          );
          if (userByEmployee?.length && userByEmployee[0].id_employee != null) {
            employeeId = Number(userByEmployee[0].id_employee);
          } else {
            employeeId = actorId;
          }
        }

        const employeeResult = await this.connection.query(
          `SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`,
          [employeeId],
        );
        if (employeeResult?.length) {
          const firstName = employeeResult[0].first_name || null;
          const lastName = employeeResult[0].last_name || null;
          const fullName =
            [firstName, lastName].filter(Boolean).join(' ').trim() || null;
          if (fullName) {
            usersMap.set(actorId, fullName);
            continue;
          }
        }
        usersMap.set(actorId, `User #${actorId}`);
      } catch (error: any) {
        this.logger.error(
          `❌ [SUPPLIERS SERVICE] Error resolving display name for actor ${actorId}:`,
          error?.message || error,
        );
        usersMap.set(actorId, `User #${actorId}`);
      }
    }

    return usersMap;
  }

  async getOrderReceptions(
    orderId: number,
    user?: OrderRequesterUser,
  ): Promise<Array<SupplierOrderItemReception & { user_name?: string }>> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching receptions for order ${orderId}`);
    
    await this.findOrderForRequester(orderId, user);
    const receptions = await this.orderItemReceptionRepo.find({
      where: { supplier_order_id: orderId },
      order: { created_at: 'DESC' },
    });

    const userIds = Array.from(new Set(
      receptions
        .map(r => r.user_id)
        .filter((id): id is number => id !== undefined && id !== null)
    ));

    const usersMap = await this.resolveAuthUserDisplayNames(userIds);

    return receptions.map(reception => ({
      ...reception,
      user_name: reception.user_id ? usersMap.get(reception.user_id) : undefined,
    })) as Array<SupplierOrderItemReception & { user_name?: string }>;
  }

  async getOrderReceptionsBatch(
    orderIds: number[],
    user?: OrderRequesterUser,
  ): Promise<Array<SupplierOrderItemReception & { user_name?: string }>> {
    if (!orderIds || orderIds.length === 0) {
      return [];
    }

    const allowedOrderIds = await this.filterOrderIdsForRequester(orderIds, user);
    if (allowedOrderIds.length === 0) {
      return [];
    }

    const uniqueOrderIds = Array.from(new Set(allowedOrderIds));
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching receptions batch for ${uniqueOrderIds.length} orders`);

    const receptions = await this.orderItemReceptionRepo.find({
      where: { supplier_order_id: In(uniqueOrderIds) },
      order: { created_at: 'DESC' },
    });

    this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${receptions.length} receptions for ${uniqueOrderIds.length} orders`);

    const userIds = Array.from(new Set(
      receptions
        .map(r => r.user_id)
        .filter((id): id is number => id !== undefined && id !== null)
    ));

    const usersMap = await this.resolveAuthUserDisplayNames(userIds);

    return receptions.map(reception => ({
      ...reception,
      user_name: reception.user_id ? usersMap.get(reception.user_id) : undefined,
    })) as Array<SupplierOrderItemReception & { user_name?: string }>;
  }

  private async prepareReceptionReportAccess(
    requester?: SupplierAccessRequester,
    locationId?: number,
    requestedCompanyId?: number | null,
  ): Promise<void> {
    assertOrderListCompanyIdNotEscalated(requester, requestedCompanyId);
    if (locationId != null && requester) {
      await this.assertLocationBelongsToRequesterCompany(locationId, requester);
    }
  }

  async getReceptionReport(
    startDate: string,
    endDate: string,
    locationId?: number,
    requester?: SupplierAccessRequester,
    requestedCompanyId?: number | null,
  ): Promise<any[]> {
    try {
      await this.prepareReceptionReportAccess(
        requester,
        locationId,
        requestedCompanyId,
      );
      return await this.getReceptionReportInternal(
        startDate,
        endDate,
        locationId,
        requester,
      );
    } catch (error: any) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(
        `❌ [SUPPLIERS SERVICE] getReceptionReport failed for ${startDate}..${endDate}${locationId != null ? `, location_id=${locationId}` : ''}: ${error?.message || error}`,
      );
      return [];
    }
  }

  private async getReceptionReportInternal(
    startDate: string,
    endDate: string,
    locationId?: number,
    requester?: SupplierAccessRequester,
  ): Promise<any[]> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Generating reception report from ${startDate} to ${endDate}${locationId != null ? `, location_id=${locationId}` : ''}`);
    
    const stockServiceUrl = this.configService.get<string>('STOCK_HTTP_URL') || 'http://localhost:3006';
    const serviceSecret = process.env.SERVICE_SECRET || '';
    const headers = {
      'x-internal-service': 'suppliers',
      'x-service-secret': serviceSecret
    };

    // Nou: dacă există evenimente în supplier_order_item_receptions pe interval, folosim direct acea sursă
    try {
      const qb = this.orderItemReceptionRepo
        .createQueryBuilder('ev')
        .select([
          'ev.supplier_order_id AS supplier_order_id',
          'ev.supplier_order_item_id AS supplier_order_item_id',
          'ev.product_id AS product_id',
          'COALESCE(ev.user_id, 0) AS user_id',
          'ev.received_delta AS received_delta',
          'ev.returned_delta AS returned_delta',
          'ev.reason AS reason',
          'ev.occurred_at AS occurred_at',
        ])
        .where('DATE(ev.occurred_at) BETWEEN :startDate AND :endDate', { startDate, endDate });
      applyReceptionEventsTenantScopeToQueryBuilder(
        qb,
        requester,
        'ev.supplier_order_id',
      );
      if (locationId != null) {
        qb.andWhere('ev.location_id = :locationId', { locationId });
      }
      const eventRows = await qb.getRawMany();
      
      if (locationId != null && eventRows.length === 0) {
        return [];
      }
      if (eventRows.length > 0) {
        this.logger.log(`📦 [SUPPLIERS SERVICE] Using receptions events table with ${eventRows.length} rows`);
        const aggregated = new Map<string, {
          supplier_order_id: number;
          product_id: number;
          user_id: number;
          total_received: number;
          total_returned: number;
          return_count: number;
          return_reasons: string[];
          reception_date?: Date | string;
        }>();
        
        for (const row of eventRows) {
          const orderId = Number(row.supplier_order_id);
          const productId = Number(row.product_id);
          const userId = Number(row.user_id) || 0;
          const receivedDelta = parseFloat(row.received_delta || '0');
          const returnedDelta = parseFloat(row.returned_delta || '0');
          const reason = row.reason as string | null;
          const occurredAt = row.occurred_at as Date | string;
          const key = `${orderId}:${productId}:${userId}`;
          
          if (!aggregated.has(key)) {
            aggregated.set(key, {
              supplier_order_id: orderId,
              product_id: productId,
              user_id: userId,
              total_received: 0,
              total_returned: 0,
              return_count: 0,
              return_reasons: [],
              reception_date: undefined,
            });
          }
          
          const agg = aggregated.get(key)!;
          if (receivedDelta > 0) {
            agg.total_received += receivedDelta;
          }
          if (returnedDelta > 0) {
            agg.total_returned += returnedDelta;
            agg.return_count += 1;
            if (reason && reason.trim()) {
              agg.return_reasons.push(reason.trim());
            }
          }
          
          // Salvează prima dată de recepție (cea mai veche) din evenimente
          if (occurredAt) {
            const occDate = new Date(occurredAt);
            if (!agg.reception_date) {
              agg.reception_date = occurredAt;
            } else {
              const existing = new Date(agg.reception_date);
              if (occDate < existing) {
                agg.reception_date = occurredAt;
              }
            }
          }
        }

        // Enrich supplier_name
        const orderIds = Array.from(new Set(Array.from(aggregated.values()).map(v => v.supplier_order_id)));
        const orders = orderIds.length > 0
          ? await this.orderRepo.find({ where: { id: In(orderIds) as any }, relations: ['supplier'] })
          : [];
        const orderToSupplierName = new Map<number, string>();
        for (const o of orders) {
          orderToSupplierName.set(o.id, o.supplier?.supplier_name || `Order #${o.id}`);
        }

        // Obține numele angajaților pentru user_id-urile din aggregated
        const userIds = Array.from(new Set(Array.from(aggregated.values()).map(v => v.user_id).filter(id => id > 0)));
        const usersMap = new Map<number, { first_name?: string; last_name?: string; employee_id?: number }>();
        const authDbName = process.env.AUTH_DB_NAME || 'restosoft_auth';
        const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
        
        for (const userId of userIds) {
          try {
            // Obține id_employee din users
            const userResult = await this.connection.query(
              `SELECT id_employee FROM ${authDbName}.users WHERE id = ?`,
              [userId]
            );
            
            if (userResult && userResult.length > 0 && userResult[0].id_employee) {
              const employeeId = Number(userResult[0].id_employee);
              
              // Obține first_name și last_name din employees
              const employeeResult = await this.connection.query(
                `SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`,
                [employeeId]
              );
              
              if (employeeResult && employeeResult.length > 0) {
                const firstName = employeeResult[0].first_name || null;
                const lastName = employeeResult[0].last_name || null;
                usersMap.set(userId, {
                  first_name: firstName,
                  last_name: lastName,
                  employee_id: employeeId
                });
              }
            }
          } catch (error: any) {
            this.logger.error(`❌ [SUPPLIERS SERVICE] Error fetching employee data for user ${userId}:`, error.message);
          }
        }

        // Normalizează listele de motive (unice) și atașează supplier_name și user_name
        const result = Array.from(aggregated.values()).map(item => {
          const user = usersMap.get(item.user_id);
          let userName: string;
          if (user && user.first_name && user.last_name) {
            userName = `${user.first_name} ${user.last_name}`.trim();
          } else if (user && user.employee_id) {
            userName = `ID: ${user.employee_id}`;
          } else {
            userName = item.user_id > 0 ? `User ID: ${item.user_id}` : 'Necunoscut';
          }
          
          return {
            ...item,
            supplier_name: orderToSupplierName.get(item.supplier_order_id) || 'Necunoscut',
            user_name: userName,
            return_reasons: Array.from(new Set(item.return_reasons)),
          };
        });
        return result;
      }
    } catch (e: any) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Failed to read receptions events table, falling back. Reason: ${e?.message || e}`);
    }

    // PASUL 1: Obține order items-urile cu recepții în perioada respectivă
    // Folosim reception_date (data efectivă a recepției) pentru filtrare precisă
    // IMPORTANT: Dacă reception_date este NULL, folosim entry_date din stock items (fallback)
    const receivedItems = await applyOrderListTenantScopeToQueryBuilder(
      this.orderItemRepo
        .createQueryBuilder('item')
        .leftJoin('item.order', 'order')
        .select([
          'item.id AS item_id',
          'item.product_id AS product_id',
          'item.received_quantity AS received_quantity',
          'item.reception_date AS reception_date',
          'item.reception_user_id AS reception_user_id',
          'order.created_by_user_id AS order_user_id',
        ])
        .where('item.received_quantity > 0')
        .andWhere(
          '(item.reception_date IS NOT NULL AND DATE(item.reception_date) BETWEEN :startDate AND :endDate)',
          {
            startDate,
            endDate,
          },
        ),
      requester,
      'order',
    ).getRawMany();

    this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${receivedItems.length} items with receptions in period`);
    
    // Dacă nu există reception_date setat (pentru datele vechi), folosim stock items ca fallback
    let stockItems: any[] = [];
    if (receivedItems.length === 0) {
      try {
        // Obține toate stock items-urile care au supplier_order_item_id (provin din recepții)
        const stockResponse = await firstValueFrom(
          this.httpService.get(`${stockServiceUrl}/stock/items`, { headers })
        );
        stockItems = (stockResponse.data || []).filter((item: any) => {
          // Filtrează după supplier_order_item_id (provin din recepții)
          if (!item.supplier_order_item_id) return false;
          
          // Filtrează după entry_date (data recepției) în perioada specificată
          const entryDate = new Date(item.entry_date);
          const start = new Date(startDate);
          const end = new Date(`${endDate} 23:59:59`);
          return entryDate >= start && entryDate <= end;
        });
        
        this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${stockItems.length} stock items from receptions in period (fallback)`);
      } catch (error: any) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Could not fetch stock items:`, error?.message);
      }
    }

    // PASUL 2: Obține order items-urile cu returnări în perioada respectivă
    // Folosim updated_at ca proxy pentru data returnării (când s-a actualizat cu returned_quantity > 0)
    // TODO: Dacă adăugăm return_date în viitor, folosiți acela
    const returnItems = await applyOrderListTenantScopeToQueryBuilder(
      this.orderItemRepo
        .createQueryBuilder('item')
        .leftJoin('item.order', 'order')
        .select([
          'item.id AS item_id',
          'item.product_id AS product_id',
          'item.returned_quantity AS returned_quantity',
          'item.return_reason AS return_reason',
          'item.updated_at AS updated_at',
        ])
        .where('item.returned_quantity > 0')
        .andWhere('DATE(item.updated_at) BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        }),
      requester,
      'order',
    ).getRawMany();

    this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${returnItems.length} items with returns in period`);

    // Agregăm datele pe product_id + user_id (pentru a identifica cine a făcut recepția)
    // Map key: "product_id:user_id" pentru a grupa pe produs și utilizator
    const aggregatedData = new Map<string, {
      product_id: number;
      user_id: number;
      total_received: number;
      total_returned: number;
      return_count: number;
      return_reasons: string[];
      reception_date?: Date | string; // Prima dată de recepție pentru acest grup
    }>();

    // Agregă recepțiile din order items (folosind reception_date - data exactă a recepției)
    for (const item of receivedItems) {
      const productId = item.product_id;
      const received = parseFloat(item.received_quantity || '0');
      
      // Obține user_id din reception_user_id (dacă există) sau din order.created_by_user_id
      const userId = item.reception_user_id || item.order_user_id || 0;
      
      const key = `${productId}:${userId}`;

      if (!aggregatedData.has(key)) {
        aggregatedData.set(key, {
          product_id: productId,
          user_id: userId,
          total_received: 0,
          total_returned: 0,
          return_count: 0,
          return_reasons: [],
          reception_date: item.reception_date || undefined
        });
      }

      const data = aggregatedData.get(key)!;
      data.total_received += received;
      
      // Salvează prima dată de recepție (cea mai veche) pentru acest grup
      if (item.reception_date) {
        const itemDate = new Date(item.reception_date);
        if (!data.reception_date) {
          data.reception_date = item.reception_date;
        } else {
          const existingDate = new Date(data.reception_date);
          if (itemDate < existingDate) {
            data.reception_date = item.reception_date;
          }
        }
      }
    }

    // Fallback: Dacă nu există reception_date (pentru datele vechi), folosim stock items
    // SAU dacă există receivedItems dar fără reception_date, le includem și pe acelea
    if (stockItems.length > 0) {
      const orderItemIds = stockItems.map((item: any) => item.supplier_order_item_id).filter(Boolean);
      let orderItemsMap = new Map<number, any>();
      if (orderItemIds.length > 0) {
        const orderItems = await applyOrderListTenantScopeToQueryBuilder(
          this.orderItemRepo
            .createQueryBuilder('item')
            .leftJoin('item.order', 'order')
            .where('item.id IN (:...ids)', { ids: orderItemIds }),
          requester,
          'order',
        ).getMany();
        
        orderItems.forEach(item => {
          orderItemsMap.set(item.id, item);
        });
      }

      // Agregă recepțiile din stock items (cu data corectă) - doar pentru date vechi
      for (const stockItem of stockItems) {
        const productId = stockItem.product_id;
        const received = parseFloat(stockItem.quantity || '0');
        const orderItemId = stockItem.supplier_order_item_id;
        
        // IMPORTANT: Folosește reception_user_id din order_item (dacă există) sau created_by_user_id din order
        let userId: number | null = null;
        if (orderItemId) {
          const orderItem = orderItemsMap.get(orderItemId);
          // Prioritate: reception_user_id > created_by_user_id
          if (orderItem?.reception_user_id) {
            userId = orderItem.reception_user_id;
          } else if (orderItem?.order?.created_by_user_id) {
            userId = orderItem.order.created_by_user_id;
          }
        }
        
        // Folosește userId sau 0 dacă nu există
        const key = `${productId}:${userId || 0}`;

        if (!aggregatedData.has(key)) {
          // Folosește entry_date din stock item ca reception_date pentru datele vechi
          const receptionDate = stockItem.entry_date || undefined;
          aggregatedData.set(key, {
            product_id: productId,
            user_id: userId || 0,
            total_received: 0,
            total_returned: 0,
            return_count: 0,
            return_reasons: [],
            reception_date: receptionDate
          });
        }

        const data = aggregatedData.get(key)!;
        data.total_received += received;
        
        // Salvează prima dată de recepție (cea mai veche) pentru acest grup
        if (stockItem.entry_date) {
          const entryDate = new Date(stockItem.entry_date);
          if (!data.reception_date) {
            data.reception_date = stockItem.entry_date;
          } else {
            const existingDate = new Date(data.reception_date);
            if (entryDate < existingDate) {
              data.reception_date = stockItem.entry_date;
            }
          }
        }
      }
    }
    
    // De asemenea, adaugă și receivedItems care au reception_date NULL sau lipsă
    // În acest caz, folosim entry_date din stock items (data efectivă a recepției) pentru filtrare
    // NU folosim updated_at direct pentru că nu reflectă data recepției
    const itemsWithoutReceptionDate = await applyOrderListTenantScopeToQueryBuilder(
      this.orderItemRepo
        .createQueryBuilder('item')
        .leftJoin('item.order', 'order')
        .select([
          'item.id AS item_id',
          'item.product_id AS product_id',
          'item.received_quantity AS received_quantity',
          'item.reception_date AS reception_date',
          'item.reception_user_id AS reception_user_id',
          'order.created_by_user_id AS order_user_id',
        ])
        .where('item.received_quantity > 0')
        .andWhere('item.reception_date IS NULL'),
      requester,
      'order',
    ).getRawMany();
    
    // Pentru items fără reception_date, folosim entry_date din stock items pentru filtrare după dată
    // Obține stock items pentru aceste order items (dacă nu există deja)
    const orderItemIdsWithoutDate = itemsWithoutReceptionDate.map((item: any) => item.item_id).filter(Boolean);
    if (orderItemIdsWithoutDate.length > 0) {
      try {
        // Obține toate stock items-urile care au supplier_order_item_id în lista noastră
        const stockResponse = await firstValueFrom(
          this.httpService.get(`${stockServiceUrl}/stock/items`, { headers })
        );
        const allStockItems = stockResponse.data || [];
        const additionalStockItems = allStockItems.filter((item: any) => {
          return orderItemIdsWithoutDate.includes(item.supplier_order_item_id);
        });
        // Adaugă la lista existentă de stock items
        stockItems = [...stockItems, ...additionalStockItems];
        this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${additionalStockItems.length} additional stock items for items without reception_date`);
      } catch (error: any) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Could not fetch stock items for filtering:`, error?.message);
      }
    }
    
    // Creează un map de order_item_id -> stock items pentru filtrare după entry_date
    const stockItemsByOrderItemId = new Map<number, any[]>();
    for (const stockItem of stockItems) {
      const orderItemId = stockItem.supplier_order_item_id;
      if (orderItemId) {
        if (!stockItemsByOrderItemId.has(orderItemId)) {
          stockItemsByOrderItemId.set(orderItemId, []);
        }
        stockItemsByOrderItemId.get(orderItemId)!.push(stockItem);
      }
    }
    
    // Agregă items fără reception_date, filtrând după entry_date din stock items
    for (const item of itemsWithoutReceptionDate) {
      const productId = item.product_id;
      const received = parseFloat(item.received_quantity || '0');
      const orderItemId = item.item_id;
      
      // Verifică dacă există stock items pentru acest order item
      const relatedStockItems = stockItemsByOrderItemId.get(orderItemId) || [];
      
      // Dacă există stock items, filtrează după entry_date
      if (relatedStockItems.length > 0) {
        let hasStockInPeriod = false;
        for (const stockItem of relatedStockItems) {
          const entryDate = new Date(stockItem.entry_date);
          const start = new Date(startDate);
          const end = new Date(`${endDate} 23:59:59`);
          if (entryDate >= start && entryDate <= end) {
            hasStockInPeriod = true;
            break;
          }
        }
        // Dacă nu există stock items în perioada specificată, skip
        if (!hasStockInPeriod) {
          continue;
        }
      } else {
        // Dacă nu există stock items, folosim updated_at ca fallback (nu ideal, dar mai bine decât nimic)
        // Dar să nu includem dacă updated_at este în viitor sau prea vechi comparativ cu perioada
        const itemUpdated = item.updated_at ? new Date(item.updated_at) : null;
        if (itemUpdated) {
          const start = new Date(startDate);
          const end = new Date(`${endDate} 23:59:59`);
          if (itemUpdated < start || itemUpdated > end) {
            continue;
          }
        }
      }
      
      // Prioritate: reception_user_id > order_user_id
      const userId = item.reception_user_id || item.order_user_id || 0;
      
      const key = `${productId}:${userId}`;

      // Găsește prima dată de recepție din stock items asociate
      let receptionDate: Date | string | undefined;
      if (relatedStockItems.length > 0) {
        const dates = relatedStockItems
          .map(si => new Date(si.entry_date))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());
        if (dates.length > 0) {
          receptionDate = relatedStockItems.find(si => 
            new Date(si.entry_date).getTime() === dates[0].getTime()
          )?.entry_date;
        }
      }

      if (!aggregatedData.has(key)) {
        aggregatedData.set(key, {
          product_id: productId,
          user_id: userId,
          total_received: 0,
          total_returned: 0,
          return_count: 0,
          return_reasons: [],
          reception_date: receptionDate
        });
      }

      const data = aggregatedData.get(key)!;
      data.total_received += received;
      
      // Salvează prima dată de recepție (cea mai veche) pentru acest grup
      if (receptionDate) {
        const itemDate = new Date(receptionDate);
        if (!data.reception_date) {
          data.reception_date = receptionDate;
        } else {
          const existingDate = new Date(data.reception_date);
          if (itemDate < existingDate) {
            data.reception_date = receptionDate;
          }
        }
      }
    }
    
    // Agregă returnările din order items (cu user_id din order)
    const returnItemIds = returnItems.map((item: any) => item.item_id).filter(Boolean);
    let returnOrderItemsMap = new Map<number, any>();
    if (returnItemIds.length > 0) {
      const returnOrderItems = await this.orderItemRepo
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.order', 'order')
        .where('item.id IN (:...ids)', { ids: returnItemIds })
        .getMany();
      
      returnOrderItems.forEach(item => {
        returnOrderItemsMap.set(item.id, item);
      });
    }

    for (const item of returnItems) {
      const productId = item.product_id;
      const returned = parseFloat(item.returned_quantity || '0');
      const orderItem = returnOrderItemsMap.get(item.item_id);
      const userId = orderItem?.order?.created_by_user_id || 0;
      
      const key = `${productId}:${userId}`;

      if (!aggregatedData.has(key)) {
        // Pentru return items, nu avem reception_date direct, dar ar trebui să existe deja un entry
        // Dacă nu există, creăm unul nou (nu ar trebui să se întâmple în mod normal)
        aggregatedData.set(key, {
          product_id: productId,
          user_id: userId,
          total_received: 0,
          total_returned: 0,
          return_count: 0,
          return_reasons: [],
          reception_date: undefined // Pentru return items, reception_date va fi null
        });
      }

      const data = aggregatedData.get(key)!;
      data.total_returned += returned;
      
      if (returned > 0) {
        data.return_count++;
        if (item.return_reason) {
          data.return_reasons.push(item.return_reason);
        }
      }
    }

    // PASUL 3: Obținem informații despre produse și useri
    const reportData: any[] = [];
    
    // Obține toate user_id-urile unice pentru a le încărca odată
    const userIds = [...new Set(Array.from(aggregatedData.values()).map(d => d.user_id).filter(id => id > 0))];
    const usersMap = new Map<number, { first_name?: string; last_name?: string; employee_id?: number }>();
    
    // Obține informații despre angajați din users -> id_employee -> employees
    // Similar cu ce am făcut pentru revenues în locations service
    const authDbName = process.env.AUTH_DB_NAME || 'restosoft_auth';
    const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
    
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching employee data for ${userIds.length} users via users -> employees`);
    
    for (const userId of userIds) {
      try {
        // Obține id_employee din users
        const userResult = await this.connection.query(
          `SELECT id_employee FROM ${authDbName}.users WHERE id = ?`,
          [userId]
        );
        
        if (userResult && userResult.length > 0 && userResult[0].id_employee) {
          const employeeId = Number(userResult[0].id_employee);
          
          // Obține first_name și last_name din employees
          const employeeResult = await this.connection.query(
            `SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`,
            [employeeId]
          );
          
          if (employeeResult && employeeResult.length > 0) {
            const firstName = employeeResult[0].first_name || null;
            const lastName = employeeResult[0].last_name || null;
            usersMap.set(userId, {
              first_name: firstName,
              last_name: lastName,
              employee_id: employeeId
            });
            const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || `ID: ${employeeId}`;
            this.logger.log(`✅ [SUPPLIERS SERVICE] Fetched employee data for user ${userId} (employee ${employeeId}): ${fullName}`);
          } else {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Employee ${employeeId} not found in employees table for user ${userId}`);
          }
        } else {
          this.logger.warn(`⚠️ [SUPPLIERS SERVICE] User ${userId} not found in users table or has no id_employee`);
        }
      } catch (error: any) {
        this.logger.error(`❌ [SUPPLIERS SERVICE] Error fetching employee data for user ${userId}:`, error.message);
      }
    }
    
    this.logger.log(`📊 [SUPPLIERS SERVICE] Loaded ${usersMap.size} users out of ${userIds.length} requested`);

    for (const [key, data] of aggregatedData.entries()) {
      try {
        const productId = data.product_id;
        
        // Obține produsul
        const productResponse = await firstValueFrom(
          this.httpService.get(`${stockServiceUrl}/stock/products/${productId}`, { headers })
        );
        const product = productResponse.data;

        // Obține informații despre user
        const user = usersMap.get(data.user_id);
        let userName: string;
        if (user && user.first_name && user.last_name) {
          // Folosește numele din employees (users -> id_employee -> employees)
          userName = `${user.first_name} ${user.last_name}`.trim();
        } else if (user && user.employee_id) {
          userName = `ID: ${user.employee_id}`;
        } else {
          userName = data.user_id > 0 ? `User ID: ${data.user_id}` : 'Necunoscut';
          this.logger.warn(`⚠️ [SUPPLIERS SERVICE] User ${data.user_id} not found in usersMap for product ${productId}`);
        }

        reportData.push({
          product_id: productId,
          product_name: product.name || `Produs ID: ${productId}`,
          user_id: data.user_id,
          user_name: userName,
          total_received: data.total_received,
          total_returned: data.total_returned,
          return_count: data.return_count,
          return_reasons: [...new Set(data.return_reasons)], // Elimină duplicatele
          reception_date: data.reception_date || null
        });
      } catch (error: any) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Could not fetch product ${data.product_id}:`, error?.message);
        
        // Obține informații despre user
        const user = usersMap.get(data.user_id);
        let userName: string;
        if (user && user.first_name && user.last_name) {
          // Folosește numele din employees (users -> id_employee -> employees)
          userName = `${user.first_name} ${user.last_name}`.trim();
        } else if (user && user.employee_id) {
          userName = `ID: ${user.employee_id}`;
        } else {
          userName = data.user_id > 0 ? `User ID: ${data.user_id}` : 'Necunoscut';
        }
        
        // Adaugă datele fără numele produsului
        reportData.push({
          product_id: data.product_id,
          product_name: `Produs ID: ${data.product_id}`,
          user_id: data.user_id,
          user_name: userName,
          total_received: data.total_received,
          total_returned: data.total_returned,
          return_count: data.return_count,
          return_reasons: [...new Set(data.return_reasons)],
          reception_date: data.reception_date || null
        });
      }
    }

    // Sortare după nume produs și apoi după nume user
    reportData.sort((a, b) => {
      if (a.product_name !== b.product_name) {
        return a.product_name.localeCompare(b.product_name);
      }
      return a.user_name.localeCompare(b.user_name);
    });

    return reportData;
  }

  async getReceptionEvents(
    startDate: string,
    endDate: string,
    orderId?: number,
    orderItemId?: number,
    productId?: number,
    userId?: number,
    requester?: SupplierAccessRequester,
    requestedCompanyId?: number | null,
  ): Promise<Array<{
    supplier_order_id: number;
    supplier_order_item_id: number;
    product_id: number;
    user_id: number | null;
    user_name?: string;
    supplier_name?: string;
    original_quantity?: number;
    running_received?: number;
    location_id: number | null;
    received_delta: number;
    returned_delta: number;
    reason: string | null;
    occurred_at: Date;
  }>> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching reception events from ${startDate} to ${endDate}`);
    assertOrderListCompanyIdNotEscalated(requester, requestedCompanyId);
    if (orderId !== undefined && requester) {
      await this.findOrderForRequester(orderId, requester);
    }

    const qb = this.orderItemReceptionRepo
      .createQueryBuilder('ev')
      .select([
        'ev.supplier_order_id AS supplier_order_id',
        'ev.supplier_order_item_id AS supplier_order_item_id',
        'ev.product_id AS product_id',
        'ev.user_id AS user_id',
        'ev.location_id AS location_id',
        'ev.received_delta AS received_delta',
        'ev.returned_delta AS returned_delta',
        'ev.reason AS reason',
        'ev.occurred_at AS occurred_at',
      ])
      .where('DATE(ev.occurred_at) BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('ev.occurred_at', 'ASC')
      .addOrderBy('ev.id', 'ASC');
    applyReceptionEventsTenantScopeToQueryBuilder(
      qb,
      requester,
      'ev.supplier_order_id',
    );

    if (orderId !== undefined) {
      qb.andWhere('ev.supplier_order_id = :orderId', { orderId });
    }
    if (orderItemId !== undefined) {
      qb.andWhere('ev.supplier_order_item_id = :orderItemId', { orderItemId });
    }
    if (productId !== undefined) {
      qb.andWhere('ev.product_id = :productId', { productId });
    }
    if (userId !== undefined) {
      qb.andWhere('ev.user_id = :userId', { userId });
    }

    const rows = await qb.getRawMany();
    
    // Enrich with user_name
    const userIds = Array.from(new Set(rows.map((r: any) => Number(r.user_id)).filter((id: number) => !!id && id > 0)));
    const usersMap = new Map<number, any>();
    const orderItemIds = Array.from(new Set(rows.map((r: any) => Number(r.supplier_order_item_id)).filter((id: number) => !!id && id > 0)));
    const orderIds = Array.from(new Set(rows.map((r: any) => Number(r.supplier_order_id)).filter((id: number) => !!id && id > 0)));
    const orderItemToOriginalQty = new Map<number, number>();
    const orderToSupplierName = new Map<number, string>();
    if (userIds.length > 0) {
      const serviceSecret = process.env.SERVICE_SECRET || '';
      const headers = { 'x-internal-service': 'suppliers', 'x-service-secret': serviceSecret };
      let employeesServiceUrl = this.getEmployeesServiceUrl();
      for (const uid of userIds) {
        try {
          const resp: any = await firstValueFrom(this.httpService.get(`${employeesServiceUrl}/employees/${uid}`, { headers }));
          const data = resp?.data?.data || resp?.data || resp;
          if (data) usersMap.set(uid, data);
        } catch {
          // ignore; fallback to ID
        }
      }
    }
    if (orderItemIds.length > 0) {
      const items = await this.orderItemRepo.find({ where: { id: In(orderItemIds) as any } });
      for (const it of items) {
        orderItemToOriginalQty.set(it.id, Number(it.quantity) || 0);
      }
    }
    if (orderIds.length > 0) {
      const orders = await this.orderRepo.find({ where: { id: In(orderIds) as any }, relations: ['supplier'] });
      for (const o of orders) {
        orderToSupplierName.set(o.id, o.supplier?.supplier_name || `Order #${o.id}`);
      }
    }
      
    // Compute running_received per order_item
    const runningMap = new Map<number, number>();
    return rows.map((r: any) => {
      const uid = r.user_id !== null ? Number(r.user_id) : null;
      let userName: string | undefined = undefined;
      if (uid && usersMap.has(uid)) {
        const user = usersMap.get(uid);
        const firstName = user.first_name || user.firstName || '';
        const lastName = user.last_name || user.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        userName = fullName || user.email || user.name || `User ID: ${uid}`;
      }
      const orderItemId = Number(r.supplier_order_item_id);
      const orderIdVal = Number(r.supplier_order_id);
      const prev = runningMap.get(orderItemId) || 0;
      const receivedDelta = parseFloat(r.received_delta || '0');
      const nextReceived = prev + (receivedDelta > 0 ? receivedDelta : 0);
      runningMap.set(orderItemId, nextReceived);
      const originalQty = orderItemToOriginalQty.get(orderItemId) || 0;
      return {
        supplier_order_id: Number(r.supplier_order_id),
        supplier_order_item_id: Number(r.supplier_order_item_id),
        product_id: Number(r.product_id),
        user_id: uid,
        user_name: userName,
        supplier_name: orderToSupplierName.get(orderIdVal),
        original_quantity: originalQty,
        running_received: nextReceived,
        location_id: r.location_id !== null ? Number(r.location_id) : null,
        received_delta: receivedDelta,
        returned_delta: parseFloat(r.returned_delta || '0'),
        reason: r.reason ?? null,
        occurred_at: new Date(r.occurred_at),
      };
    });
  }
  async getSupplierOrders(
    supplierId: number,
    locationId?: number,
    requester?: SupplierAccessRequester,
    requestedCompanyId?: number | null,
  ): Promise<SupplierOrder[]> {
    await this.prepareOrderListAccess([supplierId], requester, {
      locationId,
      requestedCompanyId,
    });

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.documents', 'documents')
      .leftJoinAndSelect('order.supplier', 'supplier')
      .leftJoinAndSelect('order.driverAssignments', 'driverAssignments')
      .where('order.supplier_id = :supplierId', { supplierId });

    applyOrderListTenantScopeToQueryBuilder(qb, requester);

    if (locationId !== undefined) {
      qb.andWhere(
        `(
          order.supplier_location_id = :locationId
          OR order.location_id = :locationId
          OR (
            order.supplier_location_id IS NULL
            AND order.location_id IS NULL
            AND order.supplier_id IN (
              SELECT sl.supplier_id FROM supplier_locations sl WHERE sl.id_location = :locationId
            )
          )
        )`,
        { locationId },
      );
    }

    qb.orderBy('order.created_at', 'DESC');
    const list = await qb.getMany();
    await this.attachOrderChangesArray(list);
    await this.attachHasSupplierAccountFlag(list);
    return list;
  }

  /**
   * Batch: toate comenzile pentru mai mulți furnizori, cu filtre opționale de perioadă și locație.
   * Folosit pentru rapoarte (evităm N+1 calls din frontend).
   * Folosește relationLoadStrategy: 'query' ca item-urile să nu se amestece la join-uri multiple.
   */
  async getSupplierOrdersBatch(
    supplierIds: number[],
    options?: {
      dateFrom?: string;
      dateTo?: string;
      locationId?: number;
      requester?: SupplierAccessRequester;
      requestedCompanyId?: number | null;
    },
  ): Promise<SupplierOrder[]> {
    if (!supplierIds || supplierIds.length === 0) {
      return [];
    }

    await this.prepareOrderListAccess(supplierIds, options?.requester, {
      locationId: options?.locationId,
      requestedCompanyId: options?.requestedCompanyId,
    });

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.documents', 'documents')
      .leftJoinAndSelect('order.supplier', 'supplier')
      .leftJoinAndSelect('order.driverAssignments', 'driverAssignments')
      .leftJoinAndSelect('order.assignments', 'assignments')
      .where('order.supplier_id IN (:...supplierIds)', { supplierIds });

    applyOrderListTenantScopeToQueryBuilder(qb, options?.requester);

    if (options?.locationId !== undefined) {
      qb.andWhere(
        `(
          order.supplier_location_id = :locationId
          OR order.location_id = :locationId
          OR (
            order.supplier_location_id IS NULL
            AND order.location_id IS NULL
            AND order.supplier_id IN (
              SELECT sl.supplier_id FROM supplier_locations sl WHERE sl.id_location = :locationId
            )
          )
        )`,
        { locationId: options.locationId },
      );
    }

    if (options?.dateFrom && options?.dateTo) {
      qb.andWhere('order.order_date BETWEEN :dateFrom AND :dateTo', {
        dateFrom: new Date(options.dateFrom),
        dateTo: new Date(options.dateTo),
      });
    }

    qb.orderBy('order.created_at', 'DESC');

    const batchList = await qb.getMany();
    await this.attachOrderChangesArray(batchList);
    await this.attachHasSupplierAccountFlag(batchList);
    return batchList;
  }

  /**
   * Batch paginat pentru dashboard furnizor și detaliu furnizor (max 20 / pagină).
   */
  async getSupplierOrdersBatchPaginated(
    supplierIds: number[],
    options?: {
      dateFrom?: string;
      dateTo?: string;
      locationId?: number;
      requester?: SupplierAccessRequester;
      requestedCompanyId?: number | null;
    },
    pageRaw?: string | number,
    limitRaw?: string | number,
  ): Promise<PaginatedOrdersResponse<SupplierOrder>> {
    const { page, limit } = normalizeOrdersPagination(pageRaw, limitRaw);
    if (!supplierIds?.length) {
      return buildOrdersPaginatedResponse([], page, limit, 0);
    }

    await this.prepareOrderListAccess(supplierIds, options?.requester, {
      locationId: options?.locationId,
      requestedCompanyId: options?.requestedCompanyId,
    });

    const applyFilters = (qb: SelectQueryBuilder<SupplierOrder>) => {
      qb.where('order.supplier_id IN (:...supplierIds)', { supplierIds });
      applyOrderListTenantScopeToQueryBuilder(qb, options?.requester);
      if (options?.locationId !== undefined) {
        qb.andWhere(
          `(
          order.supplier_location_id = :locationId
          OR order.location_id = :locationId
          OR (
            order.supplier_location_id IS NULL
            AND order.location_id IS NULL
            AND order.supplier_id IN (
              SELECT sl.supplier_id FROM supplier_locations sl WHERE sl.id_location = :locationId
            )
          )
        )`,
          { locationId: options.locationId },
        );
      }
      if (options?.dateFrom && options?.dateTo) {
        qb.andWhere('order.order_date BETWEEN :dateFrom AND :dateTo', {
          dateFrom: new Date(options.dateFrom),
          dateTo: new Date(options.dateTo),
        });
      }
      return qb;
    };

    const total = await applyFilters(
      this.orderRepo.createQueryBuilder('order'),
    ).getCount();

    const idRows = await applyFilters(
      this.orderRepo.createQueryBuilder('order'),
    )
      .select('order.id', 'id')
      .orderBy('order.created_at', 'DESC')
      .addOrderBy('order.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    const orderIds = idRows
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (orderIds.length === 0) {
      return buildOrdersPaginatedResponse([], page, limit, total);
    }

    const batchListUnsorted = await applyFilters(
      this.orderRepo.createQueryBuilder('order'),
    )
      .andWhere('order.id IN (:...orderIds)', { orderIds })
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.documents', 'documents')
      .leftJoinAndSelect('order.supplier', 'supplier')
      .leftJoinAndSelect('order.driverAssignments', 'driverAssignments')
      .leftJoinAndSelect('order.assignments', 'assignments')
      .getMany();

    const orderById = new Map(batchListUnsorted.map((o) => [o.id, o]));
    const batchList = orderIds
      .map((id) => orderById.get(id))
      .filter((o): o is SupplierOrder => !!o);

    await this.attachOrderChangesArray(batchList);
    await this.attachOrderDeliveryDetails(batchList);
    await this.attachHasSupplierAccountFlag(batchList);
    return buildOrdersPaginatedResponse(batchList, page, limit, total);
  }

  /**
   * Comenzi anulate – paginare (10 per pagină).
   * Aceeași logică de filtrare ca pe frontend: status cancelled sau toate item-urile acoperite de anulări.
   */
  async getCancelledOrdersPaginated(
    supplierIds: number[],
    locationId: number,
    page: number,
    limit: number,
    requester?: SupplierAccessRequester,
    requestedCompanyId?: number | null,
  ): Promise<PaginatedOrdersResponse<SupplierOrder>> {
    if (!supplierIds?.length) {
      return buildOrdersPaginatedResponse([], page, limit, 0);
    }
    const orders = await this.getSupplierOrdersBatch(supplierIds, {
      locationId,
      requester,
      requestedCompanyId,
    });
    const orderIds = orders.map((o) => o.id).filter((id) => Number.isFinite(id) && id > 0);
    if (orderIds.length === 0) {
      return buildOrdersPaginatedResponse([], page, limit, 0);
    }

    const cancelledItemsRaw = await this.getOrderCancelledItemsBatch(orderIds);
    const receptionsRaw = await this.getOrderReceptionsBatch(orderIds);

    const cancelledItemsMap = new Map<number, typeof cancelledItemsRaw>();
    for (const item of cancelledItemsRaw) {
      const oid = Number((item as any).order_id ?? (item as any).supplier_order_id);
      if (!Number.isFinite(oid)) continue;
      const arr = cancelledItemsMap.get(oid) ?? [];
      arr.push(item);
      cancelledItemsMap.set(oid, arr);
    }

    const pendingReceptionsMap = new Map<number, (typeof receptionsRaw)[number][]>();
    for (const r of receptionsRaw) {
      if (r.status !== ReceptionStatus.PENDING) continue;
      const oid = Number(r.supplier_order_id);
      if (!Number.isFinite(oid)) continue;
      const arr = pendingReceptionsMap.get(oid) ?? [];
      arr.push(r);
      pendingReceptionsMap.set(oid, arr);
    }

    const cancelledList = orders
      .filter((order) => {
        if (order.status === OrderStatus.CANCELLED) return true;
        const cancelledItemsForOrder = cancelledItemsMap.get(order.id) ?? [];
        const pendingReceptionsForOrder = pendingReceptionsMap.get(order.id) ?? [];
        const cancelledByItemId = new Map<number, number>();
        cancelledItemsForOrder.forEach((ci: any) => {
          const itemId = ci.supplier_order_item_id;
          const qty = Number(ci.returned_quantity ?? 0);
          cancelledByItemId.set(itemId, (cancelledByItemId.get(itemId) ?? 0) + qty);
        });
        if (order.items?.length) {
          const allProcessed = order.items.every((item: any) => {
            const itemAvail = item.availability_status || 'available';
            if (itemAvail === 'unavailable') return true;
            const ordered = Number(item.quantity) || 0;
            const receivedApproved = Number(item.received_quantity) || 0;
            const pendingForItem = pendingReceptionsForOrder
              .filter((r) => r.supplier_order_item_id === item.id)
              .reduce((acc, r) => acc + (Number(r.received_delta) || 0), 0);
            const totalReceived = receivedApproved + pendingForItem;
            const cancelledQty = cancelledByItemId.get(item.id) ?? 0;
            return totalReceived + cancelledQty >= ordered - 0.01;
          });
          return allProcessed && cancelledItemsForOrder.length > 0;
        }
        return false;
      })
      .map((order) => {
        if (order.cancelled_at) return order;
        const cancelledItemsForOrder = cancelledItemsMap.get(order.id) ?? [];
        if (cancelledItemsForOrder.length === 0) return order;
        const earliest = cancelledItemsForOrder.reduce((acc: any, cur: any) => {
          if (!acc) return cur;
          const accDate = new Date(acc.reception_date ?? acc.created_at).getTime();
          const curDate = new Date(cur.reception_date ?? cur.created_at).getTime();
          return curDate < accDate ? cur : acc;
        }, null);
        return {
          ...order,
          cancelled_at: earliest?.reception_date ?? earliest?.created_at ?? order.cancelled_at,
        } as SupplierOrder;
      });

    cancelledList.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
    const total = cancelledList.length;
    const start = (page - 1) * limit;
    const data = cancelledList.slice(start, start + limit);
    return buildOrdersPaginatedResponse(data, page, limit, total);
  }

  /**
   * Comenzi receptionate – paginare (10 per pagină).
   * Aceeași logică ca pe frontend: delivered, cu recepții PENDING sau cu received_quantity > 0.
   */
  async getReceivedOrdersPaginated(
    supplierIds: number[],
    locationId: number,
    page: number,
    limit: number,
    requester?: SupplierAccessRequester,
    requestedCompanyId?: number | null,
  ): Promise<PaginatedOrdersResponse<SupplierOrder>> {
    if (!supplierIds?.length) {
      return buildOrdersPaginatedResponse([], page, limit, 0);
    }
    const orders = await this.getSupplierOrdersBatch(supplierIds, {
      locationId,
      requester,
      requestedCompanyId,
    });
    const orderIds = orders.map((o) => o.id).filter((id) => Number.isFinite(id) && id > 0);
    if (orderIds.length === 0) {
      return buildOrdersPaginatedResponse([], page, limit, 0);
    }

    const receptionsRaw = await this.getOrderReceptionsBatch(orderIds);
    const pendingReceptionsMap = new Map<number, (typeof receptionsRaw)[number][]>();
    for (const r of receptionsRaw) {
      if (r.status !== ReceptionStatus.PENDING) continue;
      const oid = Number(r.supplier_order_id);
      if (!Number.isFinite(oid)) continue;
      const arr = pendingReceptionsMap.get(oid) ?? [];
      arr.push(r);
      pendingReceptionsMap.set(oid, arr);
    }

    const receivedList = orders.filter((order) => {
      if (order.status === OrderStatus.CANCELLED) {
        const hasApproved = order.items?.some((item: any) => (Number(item.received_quantity) || 0) > 0);
        const hasPending = pendingReceptionsMap.has(order.id);
        return !!(hasApproved || hasPending);
      }
      if (order.status === OrderStatus.DELIVERED) return true;
      if (pendingReceptionsMap.has(order.id)) return true;
      if (order.items?.some((item: any) => (Number(item.quantity) || 0) > 0 && (Number(item.received_quantity) || 0) > 0)) {
        return true;
      }
      return false;
    });

    // Mai întâi comenzi cu recepție neaprobată (PENDING), apoi restul după data comenzii (cele mai recente)
    receivedList.sort((a, b) => {
      const aPending = pendingReceptionsMap.has(a.id) ? 0 : 1;
      const bPending = pendingReceptionsMap.has(b.id) ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return new Date(b.order_date).getTime() - new Date(a.order_date).getTime();
    });
    const total = receivedList.length;
    const start = (page - 1) * limit;
    const data = receivedList.slice(start, start + limit);
    return buildOrdersPaginatedResponse(data, page, limit, total);
  }

  /**
   * Comenzi active – paginare (10 per pagină).
   * Aceeași logică ca pe frontend: status vizibil + cantitate rămasă de recepționat.
   */
  async getActiveOrdersPaginated(
    supplierIds: number[],
    locationId: number,
    page: number,
    limit: number,
    requester?: SupplierAccessRequester,
    requestedCompanyId?: number | null,
  ): Promise<PaginatedOrdersResponse<SupplierOrder>> {
    if (!supplierIds?.length) {
      return buildOrdersPaginatedResponse([], page, limit, 0);
    }

    const orders = await this.getSupplierOrdersBatch(supplierIds, {
      locationId,
      requester,
      requestedCompanyId,
    });
    const orderIds = orders.map((o) => o.id).filter((id) => Number.isFinite(id) && id > 0);
    if (orderIds.length === 0) {
      return buildOrdersPaginatedResponse([], page, limit, 0);
    }

    const receptionsRaw = await this.getOrderReceptionsBatch(orderIds);
    const pendingReceptionsMap = new Map<number, (typeof receptionsRaw)[number][]>();
    for (const r of receptionsRaw) {
      if (r.status !== ReceptionStatus.PENDING) continue;
      const oid = Number(r.supplier_order_id);
      if (!Number.isFinite(oid)) continue;
      const arr = pendingReceptionsMap.get(oid) ?? [];
      arr.push(r);
      pendingReceptionsMap.set(oid, arr);
    }

    const visibleStatuses = new Set<OrderStatus>([
      OrderStatus.SENT,
      OrderStatus.MAGAZIONER,
      OrderStatus.RETURNED_TO_SUPPLIER,
      OrderStatus.RETURNED_FROM_SUPPLIER,
      OrderStatus.CONFIRMED,
      OrderStatus.SOFER,
      OrderStatus.DELIVERED,
    ]);

    const activeList = orders.filter((order) => {
      const status = (order.status as OrderStatus) ?? OrderStatus.SENT;
      if (!visibleStatuses.has(status)) return false;

      const pendingReceptionsForOrder = pendingReceptionsMap.get(order.id) ?? [];

      if (order.items?.length) {
        const hasRemaining = order.items.some((item: any) => {
          if ((item.availability_status ?? 'available') === 'unavailable') return false;
          const ordered = Number(item.quantity) || 0;
          const receivedApproved = Number(item.received_quantity) || 0;
          const pendingForItem = pendingReceptionsForOrder
            .filter((r) => r.supplier_order_item_id === item.id)
            .reduce((sum, r) => {
              const received = Number(r.received_delta) || 0;
              const returned = Number(r.returned_delta) || 0;
              return sum + received - returned;
            }, 0);
          const totalReceived = receivedApproved + pendingForItem;
          return totalReceived < ordered;
        });
        return hasRemaining;
      }

      return true;
    });

    activeList.sort(
      (a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime(),
    );

    const total = activeList.length;
    const start = (page - 1) * limit;
    const data = activeList.slice(start, start + limit);
    return buildOrdersPaginatedResponse(data, page, limit, total);
  }

  async updateSupplierProduct(
    productId: number,
    supplierId: number,
    updateData: UpdateSupplierProductDto,
    userContext?: SupplierProductUserContext,
  ): Promise<SupplierProduct> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Updating supplier product ${productId} with data: ${JSON.stringify(updateData)}`);
    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }

    const { product: supplierProduct, clientManaged } =
      await this.resolveSupplierProductForMutation(
        productId,
        supplierId,
        userContext,
      );

    const {
      supplier_id: _ignoredSupplierId,
      company_id: _ignoredCompanyId,
      ...safeUpdate
    } = updateData as UpdateSupplierProductDto & {
      supplier_id?: number;
      company_id?: number;
    };

    Object.assign(supplierProduct, safeUpdate);
    if (
      safeUpdate.gross_quantity !== undefined ||
      safeUpdate.net_quantity !== undefined
    ) {
      const quantities = this.validateOptionalGrossNetQuantities(
        supplierProduct.gross_quantity,
        supplierProduct.net_quantity,
      );
      supplierProduct.gross_quantity = quantities.gross_quantity;
      supplierProduct.net_quantity = quantities.net_quantity;
    }
    if (safeUpdate.price_base_quantity !== undefined) {
      supplierProduct.price_base_quantity = normalizePriceBaseQuantity(
        safeUpdate.price_base_quantity,
      );
    }
    if (
      safeUpdate.price_base_unit !== undefined ||
      safeUpdate.price_base_quantity !== undefined ||
      safeUpdate.unit_of_measure !== undefined
    ) {
      if (supplierProduct.price_base_quantity == null) {
        supplierProduct.price_base_unit = null;
      } else {
        supplierProduct.price_base_unit = resolvePriceBaseUnit(
          supplierProduct.price_base_unit,
          supplierProduct.unit_of_measure,
        );
      }
    }
    if (safeUpdate.storage_location !== undefined) {
      const raw = safeUpdate.storage_location;
      if (raw == null) {
        supplierProduct.storage_location = null;
      } else {
        const trimmed = String(raw).trim();
        supplierProduct.storage_location =
          trimmed === '' ? null : trimmed.slice(0, 255);
      }
    }
    const updated = await this.supplierProductRepo.save(supplierProduct);
    if (clientManaged) {
      await this.bootstrapClientManagedProductRelations(
        clientManaged.supplier,
        clientManaged.clientCompanyId,
        Number(updated.id),
        normalizeSupplierProductIsActive(updated.is_active),
      );
    }
    this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier product updated successfully: ${JSON.stringify(updated)}`);
    return updated;
  }

  async removeSupplierProduct(
    productId: number,
    userContext?: SupplierProductUserContext,
    supplierId?: number,
  ): Promise<void> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Removing supplier product ${productId}`);
    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }

    const { product: supplierProduct } = await this.resolveSupplierProductForMutation(
      productId,
      supplierId,
      userContext,
    );
    await this.supplierProductRepo.remove(supplierProduct);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier product removed successfully`);
  }

  private async resolveSupplierProductForMutation(
    productId: number,
    supplierId: number | undefined,
    userContext: SupplierProductUserContext,
  ): Promise<{
    product: SupplierProduct;
    clientManaged?: { supplier: Supplier; clientCompanyId: number };
  }> {
    if (isFurnizorProductManager(userContext)) {
      const product = await this.findSupplierProductForUser(productId, userContext);
      return { product };
    }

    if (isClientAdminCatalogManager(userContext)) {
      const product = await this.supplierProductRepo.findOne({
        where: { id: productId },
      });
      if (!product) {
        throw new NotFoundException('Produsul furnizor nu a fost găsit');
      }
      const resolvedSupplierId =
        supplierId != null && Number.isFinite(Number(supplierId)) && Number(supplierId) > 0
          ? Number(supplierId)
          : Number(product.supplier_id);
      const { supplier, clientCompanyId } =
        await this.assertClientAdminCanManageClientManagedSupplier(
          resolvedSupplierId,
          userContext,
        );
      await this.assertClientAdminOwnsSupplierProduct(
        product,
        supplier,
        clientCompanyId,
      );
      return { product, clientManaged: { supplier, clientCompanyId } };
    }

    assertClientViewOnlyOnMutations(userContext);
    throw new ForbiddenException(
      'Doar conturile de tip furnizor pot gestiona nomenclatorul propriu de produse',
    );
  }

  // === MEASUREMENT VARIANTS METHODS ===

  async createVariant(
    dto: CreateSupplierProductMeasurementVariantDto,
    userContext?: SupplierProductUserContext,
  ): Promise<SupplierProductMeasurementVariant> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Creating measurement variant with data: ${JSON.stringify(dto)}`);

    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    const { product: supplierProduct } =
      await this.resolveSupplierProductForMutation(
        dto.supplier_product_id,
        undefined,
        userContext,
      );

    // Validate measurement_unit compatibility with supplier_products.unit_of_measure
    if (dto.measurement_unit && dto.measurement_unit !== supplierProduct.unit_of_measure) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Measurement unit mismatch - variant: ${dto.measurement_unit}, supplier product: ${supplierProduct.unit_of_measure}`);
      this.logger.log(`ℹ️ [SUPPLIERS SERVICE] Allowing mismatch for now (compatibility validation)`);
    }

    const variant = this.supplierProductMeasurementVariantRepo.create(dto);
    const savedVariant = await this.supplierProductMeasurementVariantRepo.save(variant);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Measurement variant created successfully: ${JSON.stringify(savedVariant)}`);
    return savedVariant;
  }

  async getVariants(
    supplierProductId: number,
    userContext?: SupplierProductUserContext,
  ): Promise<SupplierProductMeasurementVariant[]> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching variants for supplier product ${supplierProductId}`);
    if (userContext && isFurnizorProductManager(userContext)) {
      await this.findSupplierProductForUser(supplierProductId, userContext);
    }
    const variants = await this.supplierProductMeasurementVariantRepo.find({
      where: { supplier_product_id: supplierProductId },
      order: { created_at: 'DESC' },
    });
    this.logger.log(`✅ [SUPPLIERS SERVICE] Found ${variants.length} variants`);
    return variants;
  }

  async updateVariant(
    variantId: number,
    updateData: Partial<SupplierProductMeasurementVariant>,
    userContext?: SupplierProductUserContext,
  ): Promise<SupplierProductMeasurementVariant> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Updating measurement variant ${variantId} with data: ${JSON.stringify(updateData)}`);
    const variant = await this.supplierProductMeasurementVariantRepo.findOne({ where: { id: variantId } });
    if (!variant) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Measurement variant not found: ${variantId}`);
      throw new NotFoundException('Varianta de măsură nu a fost găsită');
    }

    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    await this.resolveSupplierProductForMutation(
      variant.supplier_product_id,
      undefined,
      userContext,
    );

    // If updating measurement_unit, validate against supplier product
    if (updateData.measurement_unit) {
      const supplierProduct = await this.supplierProductRepo.findOne({ where: { id: variant.supplier_product_id } });
      if (supplierProduct && updateData.measurement_unit !== supplierProduct.unit_of_measure) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Measurement unit mismatch - variant: ${updateData.measurement_unit}, supplier product: ${supplierProduct.unit_of_measure}`);
        this.logger.log(`ℹ️ [SUPPLIERS SERVICE] Allowing mismatch for now (compatibility validation)`);
      }
    }

    Object.assign(variant, updateData);
    const updated = await this.supplierProductMeasurementVariantRepo.save(variant);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Measurement variant updated successfully: ${JSON.stringify(updated)}`);
    return updated;
  }

  async deleteVariant(
    variantId: number,
    userContext?: SupplierProductUserContext,
  ): Promise<void> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Deleting measurement variant ${variantId}`);
    const variant = await this.supplierProductMeasurementVariantRepo.findOne({ where: { id: variantId } });
    if (!variant) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Measurement variant not found: ${variantId}`);
      throw new NotFoundException('Varianta de măsură nu a fost găsită');
    }

    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    await this.resolveSupplierProductForMutation(
      variant.supplier_product_id,
      undefined,
      userContext,
    );

    await this.supplierProductMeasurementVariantRepo.remove(variant);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Measurement variant deleted successfully`);
  }

  async addDocument(
    supplierId: number,
    documentData: { fileName: string; folderId?: number; folderName?: string; notes?: string; content?: string; file_content?: string; expire_date?: string },
  ) {
    try {
      this.logger.log(`📥 [addDocument] Starting document upload for supplier ${supplierId}`);
      this.logger.log(`📄 [addDocument] Document data:`, {
        fileName: documentData.fileName,
        folderId: documentData.folderId,
        folderName: documentData.folderName,
        hasContent: !!(documentData.content || documentData.file_content),
        notes: documentData.notes,
        expire_date: documentData.expire_date
      });

      const supplier = await this.findOne(supplierId);
      this.logger.log(`✅ [addDocument] Found supplier: ${supplier.supplier_name} (ID: ${supplier.id})`);

      // Get the supplier name simplified (needed for path and folder resolution)
      const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
      this.logger.log(`📝 [addDocument] Simplified supplier name: ${supplierNameSimplified}`);

      // Check if supplier is bound to any locations (compute basePath first, needed for find-or-create folder)
      let locationPath: string | null = null;
      let isBoundToLocation = false;

      try {
        this.logger.log(`🔍 [addDocument] Checking if supplier ${supplierId} is bound to any locations`);
        const supplierLocations = await this.supplierLocationsRepo.find({
          where: { supplier_id: supplierId }
        });
        this.logger.log(`📍 [addDocument] Found supplier locations:`, supplierLocations);

        if (supplierLocations && supplierLocations.length > 0) {
          this.logger.log(`📍 [addDocument] Supplier is bound to ${supplierLocations.length} locations`);
          const locationId = supplierLocations[0].id_location;
          this.logger.log(`📍 [addDocument] Checking details for location ID: ${locationId}`);
          
          try {
            const location = await this.fetchLocation(locationId);
            this.logger.log(`📍 [addDocument] Location details:`, location);
            
            if (location) {
              this.logger.log(`📍 [addDocument] Location data is valid`);
              let companyName = 'UnknownCompany';
              try {
                const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
                const serviceSecret = process.env.SERVICE_SECRET || '';
                this.logger.log(`🏢 [addDocument] Fetching company details from: ${companiesUrl}/companies/${location.company_id}`);

                const response = await firstValueFrom(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
                  headers: {
                    'x-internal-service': 'locations',
                    'x-service-secret': serviceSecret,
                    'Content-Type': 'application/json',
                  },
                  timeout: 3000,
                }));

                if (response.data && response.data.company_name) {
                  companyName = response.data.company_name;
                  this.logger.log(`🏢 [addDocument] Company name: ${companyName}`);
                } else {
                  this.logger.log(`🏢 [addDocument] Company response data:`, response.data);
                }
              } catch (error: any) {
                console.warn(`⚠️ [addDocument] Could not fetch company name for company ID ${location.company_id}:`, error?.message || error);
              }

              locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
              isBoundToLocation = true;
              this.logger.log(`📍 [addDocument] Location-specific path constructed: ${locationPath}`);
            } else {
              this.logger.log(`⚠️ [addDocument] Location details not found for location ID: ${locationId}`);
              locationPath = `/files/companies/UnknownCompany/Locații/UnknownLocation`;
              isBoundToLocation = true;
              this.logger.log(`📍 [addDocument] Using placeholder location-specific path: ${locationPath}`);
            }
          } catch (locationError) {
            console.error(`❌ [addDocument] Error fetching location details for location ID ${locationId}:`, locationError);
            locationPath = `/files/companies/UnknownCompany/Locații/UnknownLocation`;
            isBoundToLocation = true;
            this.logger.log(`📍 [addDocument] Using placeholder location-specific path due to error: ${locationPath}`);
          }
        } else {
          this.logger.log(`ℹ️ [addDocument] Supplier ${supplierId} is not bound to any locations`);
        }
      } catch (error) {
        console.warn(`⚠️ [addDocument] Error checking supplier location binding:`, error);
      }

      this.logger.log(`📍 [addDocument] Final location binding status - isBoundToLocation: ${isBoundToLocation}, locationPath: ${locationPath}`);

      // Rezolvă folder: după id, sau după nume (find-or-create pe server)
      let folder: SupplierFolder | null = null;
      if (documentData.folderId) {
        folder = await this.folderRepo.findOne({ where: { id: documentData.folderId, supplier_id: supplierId } });
        if (folder) undefined;
      }
      if (!folder) {
        const folderName = documentData.folderName
          || (documentData.notes?.match(/\|folder:([^|]+)\|/)?.[1]?.trim())
          || 'Alte documente';
        folder = await this.folderRepo.findOne({ where: { supplier_id: supplierId, description: folderName } });
        if (folder) {
          this.logger.log(`✅ [addDocument] Found folder by name: ${folder.description} (ID: ${folder.id})`);
        } else {
          // Creează folderul pe server (DB + path)
          const basePath = isBoundToLocation && locationPath
            ? `${locationPath}/Furnizori/${supplierNameSimplified}`
            : `/files/suppliers/${supplierNameSimplified}`;
          const folderPath = basePath.endsWith('/') ? basePath : `${basePath}/`;
          const newFolder = this.folderRepo.create({
            supplier_id: supplierId,
            description: folderName,
            folder_path: folderPath,
          });
          folder = await this.folderRepo.save(newFolder);
          this.logger.log(`✅ [addDocument] Created folder on server: ${folder.description} (ID: ${folder.id}), path: ${folderPath}`);
          if (!basePath.startsWith('/files/suppliers/')) {
            const repoRoot = this.getRepoRoot();
            const basePathRel = basePath.startsWith('/') ? basePath.slice(1) : basePath;
            const absoluteDir = path.join(repoRoot, basePathRel, folderName);
            if (!fs.existsSync(absoluteDir)) {
              fs.mkdirSync(absoluteDir, { recursive: true });
              this.logger.log(`📁 [addDocument] Created directory on disk: ${absoluteDir}`);
            }
          }
        }
      }
      if (!folder) {
        console.error(`❌ [addDocument] Could not resolve or create folder for supplier ${supplierId}`);
        throw new NotFoundException('Folderul nu a putut fi găsit sau creat.');
      }
      this.logger.log(`✅ [addDocument] Using folder: ${folder.description} (ID: ${folder.id})`);
      
      // If bound to location, verify the path can be constructed
      if (isBoundToLocation && locationPath) {
        const repoRoot = this.getRepoRoot();
        const locationPathRel = locationPath.startsWith('/') ? locationPath.slice(1) : locationPath;
        const absoluteLocationPath = path.join(repoRoot, locationPathRel);
        this.logger.log(`📁 [addDocument] Absolute location path: ${absoluteLocationPath}`);
        
        // Check if the location directory exists
        if (fs.existsSync(absoluteLocationPath)) {
          this.logger.log(`✅ [addDocument] Location directory exists`);
        } else {
          this.logger.log(`⚠️ [addDocument] Location directory does not exist, will be created during file save`);
        }
      }

      // Save physical file only under files/companies/... (locații); nu scriem nimic în files/suppliers
      const base64 = documentData.content || documentData.file_content;
      let folderPathToUse = folder.folder_path;
      if (isBoundToLocation && locationPath) {
        if (folder.folder_path.startsWith(locationPath)) {
          folderPathToUse = folder.folder_path;
        } else {
          const supplierBase = `/files/suppliers/${supplierNameSimplified}`;
          const rel = folder.folder_path.replace(supplierBase, '').replace(/^\/+/, '').replace(/\/+$/, '');
          folderPathToUse = rel ? `${locationPath}/Furnizori/${supplierNameSimplified}/${rel}` : `${locationPath}/Furnizori/${supplierNameSimplified}`;
        }
      } else if (!isBoundToLocation) {
        if (folder.folder_path.includes(`/suppliers/${supplierId}/`)) {
          folderPathToUse = `/files/suppliers/${supplierNameSimplified}/${folder.folder_path.split('/').slice(4).join('/')}`;
        } else if (folder.folder_path.startsWith(`/files/suppliers/`) && !folder.folder_path.includes(`/${supplierId}/`)) {
          folderPathToUse = folder.folder_path;
        }
      }

      const saveToDisk = base64 && folderPathToUse.startsWith('/files/companies/');
      if (saveToDisk) {
        const repoRoot = this.getRepoRoot();
        const subfolderPath = folderPathToUse.replace(/\/+$/, '') + (folderPathToUse.endsWith('/') ? '' : '/');
        const subfolderPathRel = subfolderPath.startsWith('/') ? subfolderPath.slice(1) : subfolderPath;
        const absoluteDir = path.join(repoRoot, subfolderPathRel);
        const absolutePath = path.join(absoluteDir, documentData.fileName);
        try {
          if (!fs.existsSync(absoluteDir)) {
            fs.mkdirSync(absoluteDir, { recursive: true });
          }
          if (isBoundToLocation && locationPath) {
            const locationPathRel = locationPath.startsWith('/') ? locationPath.slice(1) : locationPath;
            const supplierDir = path.join(repoRoot, locationPathRel, 'Furnizori', supplierNameSimplified);
            if (!fs.existsSync(supplierDir)) {
              fs.mkdirSync(supplierDir, { recursive: true });
            }
            const designatedFolder = documentData.notes?.match(/\|folder:([^|]+)\|/)?.[1] || 'Alte documente';
            const supplierSubfolders = ['Certificat de Înregistrare furnizor', 'Certificat Fiscal furnizor', 'Act Constitutiv furnizor', 'Contract furnizare / prestări servicii', 'Acte adiționale', 'Acord GDPR', 'Comenzi (PO)', 'Confirmări de comandă', 'Recepții totale', 'Recepții parțiale', 'Facturi', 'Dovezi de plată', 'Procese verbale neconformitate', 'Oferte comerciale', 'Corespondență', 'Alte documente'];
            const subfolderToCreate = supplierSubfolders.find(f => f === designatedFolder) || 'Alte documente';
            const subfolderPathAbs = path.join(supplierDir, subfolderToCreate);
            if (!fs.existsSync(subfolderPathAbs)) {
              fs.mkdirSync(subfolderPathAbs, { recursive: true });
            }
          }
          const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(absolutePath, buffer);
          this.logger.log(`✅ [addDocument] File written to: ${absolutePath}`);
        } catch (err: any) {
          console.error(`❌ [addDocument] Failed to write file:`, err?.message || err);
          throw new Error(`Failed to write file: ${err?.message || err}`);
        }
      }

      const filePathToUse = folderPathToUse.replace(/\/+$/, '');

      // Create the document record
      // Determine the correct subfolder based on notes for database record
      let subfolderForDb = '';
      if (documentData.notes) {
        // Extract folder name from notes if available (same logic as in locations service)
        const folderMatch = documentData.notes.match(/\|folder:([^|]+)\|/);
        if (folderMatch && folderMatch[1]) {
          subfolderForDb = folderMatch[1];
        }
      }
      
      // If no subfolder specified in notes, use default
      if (!subfolderForDb) {
        subfolderForDb = 'Alte documente';
      }
      
      const document = this.supplierDocumentRepo.create({
        folder_id: folder.id,
        document_type: DocumentType.OTHER,
        file_name: documentData.fileName,
        file_path: `${filePathToUse}/${subfolderForDb}/${documentData.fileName}`,
        expire_date: documentData.expire_date ? new Date(documentData.expire_date) : null,
        notes: documentData.notes,
      });
      
      this.logger.log(`💾 [addDocument] Creating document record in database`);
      const savedDocument = await this.supplierDocumentRepo.save(document);
      this.logger.log(`✅ [addDocument] Document saved to database with ID: ${savedDocument.id}`);
      return savedDocument;
    } catch (error) {
      console.error(`❌ [addDocument] Unexpected error during document upload:`, error);
      throw error;
    }
  }

  /**
   * Sincronizează documentele unui folder din disk în baza de date: citește fișierele din
   * folder_path + description și creează înregistrări în supplier_documents pentru fișierele
   * care nu există deja. Util când fișierele au fost puse pe disk de alt flux (ex. locații).
   */
  async syncFolderFromDisk(supplierId: number, folderId: number): Promise<{ folder: SupplierFolder; documents: SupplierDocument[] }> {
    const folder = await this.folderRepo.findOne({
      where: { id: folderId, supplier_id: supplierId },
      relations: ['documents'],
    });
    if (!folder) {
      throw new NotFoundException(`Folderul cu ID ${folderId} nu a fost găsit pentru furnizorul ${supplierId}`);
    }
    const repoRoot = this.getRepoRoot();
    const folderPathRel = (folder.folder_path || '').replace(/^\//, '').replace(/\/$/, '');
    const subfolderRel = folderPathRel ? `${folderPathRel}/${folder.description}` : folder.description;
    const absoluteDir = path.join(repoRoot, subfolderRel.split('/').join(path.sep));
    this.logger.log(`📂 [syncFolderFromDisk] Furnizor ${supplierId}, folder ${folderId} (${folder.description})`);
    this.logger.log(`📂 [syncFolderFromDisk] folder_path="${folder.folder_path}" → subfolderRel="${subfolderRel}"`);
    this.logger.log(`📂 [syncFolderFromDisk] absoluteDir="${absoluteDir}" exists=${fs.existsSync(absoluteDir)} repoRoot="${repoRoot}"`);
    const existingNames = new Set((folder.documents || []).map((d) => d.file_name));
    let created = 0;
    if (fs.existsSync(absoluteDir)) {
      const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
      this.logger.log(`📂 [syncFolderFromDisk] Fișiere pe disk: ${entries.filter((e) => e.isFile()).map((e) => e.name).join(', ') || '(niciunul)'}`);
      for (const ent of entries) {
        if (!ent.isFile()) continue;
        const fileName = ent.name;
        if (existingNames.has(fileName)) continue;
        const filePathForDb = subfolderRel.startsWith('files') ? `/${subfolderRel}/${fileName}` : `/files/${subfolderRel}/${fileName}`;
        const doc = this.supplierDocumentRepo.create({
          folder_id: folder.id,
          document_type: DocumentType.OTHER,
          file_name: fileName,
          file_path: filePathForDb,
          notes: `|folder:${folder.description}| Sincronizat de pe disk`,
        });
        await this.supplierDocumentRepo.save(doc);
        existingNames.add(fileName);
        created++;
        this.logger.log(`✅ [syncFolderFromDisk] Creat în DB: ${fileName} (folder ${folderId})`);
      }
    } else {
      this.logger.warn(`⚠️ [syncFolderFromDisk] Directorul nu există: ${absoluteDir}. Încerc path după locație...`);
      const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
      if (supplier) {
        const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
        const supplierLocations = await this.supplierLocationsRepo.find({ where: { supplier_id: supplierId } });
        for (const sl of supplierLocations || []) {
          try {
            const location = await this.fetchLocation(sl.id_location);
            if (!location) continue;
            let companyName = 'UnknownCompany';
            try {
              const companiesUrl = this.configService.get<string>('COMPANIES_HTTP_URL') || 'http://localhost:3003';
              const serviceSecret = this.configService.get<string>('SERVICE_SECRET') || '';
              const response = await firstValueFrom(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
                headers: { 'x-internal-service': 'locations', 'x-service-secret': serviceSecret, 'Content-Type': 'application/json' },
                timeout: 3000,
              }));
              if (response?.data?.company_name) companyName = response.data.company_name;
            } catch {
              // ignore
            }
            const locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
            const locationSubfolderRel = `${locationPath.replace(/^\//, '')}/Furnizori/${supplierNameSimplified}/${folder.description}`;
            const locationAbsoluteDir = path.join(repoRoot, locationSubfolderRel.split('/').join(path.sep));
            this.logger.log(`📂 [syncFolderFromDisk] Încerc path locație: ${locationAbsoluteDir} exists=${fs.existsSync(locationAbsoluteDir)}`);
            if (fs.existsSync(locationAbsoluteDir)) {
              const entries = fs.readdirSync(locationAbsoluteDir, { withFileTypes: true });
              this.logger.log(`📂 [syncFolderFromDisk] Fișiere pe disk (locație): ${entries.filter((e) => e.isFile()).map((e) => e.name).join(', ') || '(niciunul)'}`);
              for (const ent of entries) {
                if (!ent.isFile()) continue;
                const fileName = ent.name;
                if (existingNames.has(fileName)) continue;
                const filePathForDb = `/${locationSubfolderRel}/${fileName}`;
                const doc = this.supplierDocumentRepo.create({
                  folder_id: folder.id,
                  document_type: DocumentType.OTHER,
                  file_name: fileName,
                  file_path: filePathForDb,
                  notes: `|folder:${folder.description}| Sincronizat de pe disk`,
                });
                await this.supplierDocumentRepo.save(doc);
                existingNames.add(fileName);
                created++;
                this.logger.log(`✅ [syncFolderFromDisk] Creat în DB (locație): ${fileName} (folder ${folderId})`);
              }
              break;
            }
          } catch (locErr: any) {
            this.logger.warn(`⚠️ [syncFolderFromDisk] Eroare path locație: ${locErr?.message || locErr}`);
          }
        }
      }
    }
    const updatedFolder = await this.folderRepo.findOne({
      where: { id: folderId },
      relations: ['documents'],
    });
    const documents = updatedFolder?.documents ?? [];
    this.logger.log(`✅ [syncFolderFromDisk] Furnizor ${supplierId}, folder ${folderId}: ${documents.length} documente (${created} noi de pe disk)`);
    return { folder: updatedFolder || folder, documents };
  }

  /**
   * Creează un folder nou pentru un furnizor (în DB și pe disk).
   * @param supplierId ID furnizor
   * @param body { description: string, parent_id?: number } numele folderului și opțional părintele
   * @param locationId opțional – dacă e setat, se folosește path-ul specific locației
   */
  async createFolder(supplierId: number, body: { description: string; parent_id?: number }, locationId?: number): Promise<SupplierFolder> {
    const description = (body?.description || '').trim();
    if (!description) {
      throw new BadRequestException('description este obligatoriu');
    }
    const parentId = body?.parent_id ?? null;
    const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
    if (!supplier) {
      throw new NotFoundException(`Furnizorul cu ID ${supplierId} nu a fost găsit`);
    }
    const existing = await this.folderRepo.findOne({
      where: { supplier_id: supplierId, description, parent_id: parentId != null ? parentId : IsNull() },
    });
    if (existing) {
      this.logger.log(`[createFolder] Folder deja există: ${description} (ID: ${existing.id})`);
      return existing;
    }
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    let basePath: string;
    const repoRoot = this.getRepoRoot();

    let locationPath: string | null = null;
    let isBoundToLocation = false;
    if (locationId) {
      try {
        const location = await this.fetchLocation(locationId);
        if (location) {
          let companyName = 'UnknownCompany';
          try {
            const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
            const serviceSecret = process.env.SERVICE_SECRET || '';
            const response = await firstValueFrom(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
              headers: { 'x-internal-service': 'locations', 'x-service-secret': serviceSecret, 'Content-Type': 'application/json' },
              timeout: 3000,
            }));
            if (response?.data?.company_name) companyName = response.data.company_name;
          } catch {
            // ignore
          }
          locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
          isBoundToLocation = true;
        }
      } catch {
        // ignore
      }
    }
    if (!isBoundToLocation || !locationPath) {
      const supplierLocations = await this.supplierLocationsRepo.find({ where: { supplier_id: supplierId } });
      if (supplierLocations?.length > 0) {
        try {
          const location = await this.fetchLocation(supplierLocations[0].id_location);
          if (location) {
            let companyName = 'UnknownCompany';
            try {
              const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
              const serviceSecret = process.env.SERVICE_SECRET || '';
              const response = await firstValueFrom(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
                headers: { 'x-internal-service': 'locations', 'x-service-secret': serviceSecret, 'Content-Type': 'application/json' },
                timeout: 3000,
              }));
              if (response?.data?.company_name) companyName = response.data.company_name;
            } catch {
              // ignore
            }
            locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
            isBoundToLocation = true;
          }
        } catch {
          // ignore
        }
      }
    }
    if (isBoundToLocation && locationPath) {
      basePath = `${locationPath}/Furnizori/${supplierNameSimplified}`;
    } else {
      basePath = `/files/suppliers/${supplierNameSimplified}`;
    }

    let folderPath: string;
    if (parentId) {
      const parent = await this.folderRepo.findOne({ where: { id: parentId, supplier_id: supplierId } });
      if (!parent) {
        throw new NotFoundException(`Folderul părinte cu ID ${parentId} nu a fost găsit`);
      }
      const parentPath = (parent.folder_path || '').replace(/\/+$/, '');
      const parentDesc = (parent.description || '').trim();
      folderPath = parentPath ? `${parentPath}/${parentDesc}/` : `${basePath.replace(/\/+$/, '')}/${parentDesc}/`;
    } else {
      folderPath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    }

    const folder = this.folderRepo.create({
      supplier_id: supplierId,
      description,
      folder_path: folderPath,
      parent_id: parentId,
    });
    const saved = await this.folderRepo.save(folder);
    if (folderPath.startsWith('/files/companies/')) {
      const folderPathRel = folderPath.startsWith('/') ? folderPath.slice(1) : folderPath;
      const absoluteDir = path.join(repoRoot, folderPathRel.split('/').join(path.sep), description);
      if (!fs.existsSync(absoluteDir)) {
        fs.mkdirSync(absoluteDir, { recursive: true });
        this.logger.log(`[createFolder] Creat director pe disk: ${absoluteDir}`);
      }
    }
    this.logger.log(`[createFolder] Folder creat: ${description} (ID: ${saved.id}, parent_id: ${parentId ?? 'null'})`);
    return saved;
  }

  /**
   * Actualizează numele unui folder (în DB și pe disk).
   * Nu permite duplicate: dacă există deja un folder cu același nume pentru același furnizor, aruncă BadRequest.
   */
  async updateFolder(supplierId: number, folderId: number, body: { description: string }): Promise<SupplierFolder> {
    const newDescription = (body?.description || '').trim();
    if (!newDescription) {
      throw new BadRequestException('description este obligatoriu');
    }
    const folder = await this.folderRepo.findOne({ where: { id: folderId, supplier_id: supplierId } });
    if (!folder) {
      throw new NotFoundException(`Folderul cu ID ${folderId} nu a fost găsit pentru furnizorul ${supplierId}`);
    }
    if (folder.description === newDescription) {
      return folder;
    }
    const parentId = folder.parent_id ?? null;
    const existing = await this.folderRepo.findOne({
      where: { supplier_id: supplierId, description: newDescription, parent_id: parentId != null ? parentId : IsNull() },
    });
    if (existing && existing.id !== folderId) {
      throw new BadRequestException('Există deja un folder cu acest nume.');
    }
    const oldDescription = folder.description;
    folder.description = newDescription;
    const saved = await this.folderRepo.save(folder);
    if ((folder.folder_path || '').startsWith('/files/companies/')) {
      const repoRoot = this.getRepoRoot();
      const folderPathRel = (folder.folder_path || '').replace(/^\//, '').replace(/\/$/, '');
      const oldDir = path.join(repoRoot, folderPathRel.split('/').join(path.sep), oldDescription);
      const newDir = path.join(repoRoot, folderPathRel.split('/').join(path.sep), newDescription);
      if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
        try {
          fs.renameSync(oldDir, newDir);
          this.logger.log(`[updateFolder] Redenumit director pe disk: ${oldDir} -> ${newDir}`);
        } catch (err: any) {
          this.logger.warn(`[updateFolder] Nu s-a putut redenumi directorul: ${err?.message || err}`);
        }
      } else if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
        this.logger.log(`[updateFolder] Creat director pe disk: ${newDir}`);
      }
    }
    this.logger.log(`[updateFolder] Folder actualizat: ${oldDescription} -> ${newDescription} (ID: ${saved.id})`);
    return saved;
  }

  /**
   * Șterge un folder al furnizorului și toți descendenții (recursiv).
   */
  async removeFolder(supplierId: number, folderId: number): Promise<void> {
    const folder = await this.folderRepo.findOne({ where: { id: folderId, supplier_id: supplierId } });
    if (!folder) {
      throw new NotFoundException(`Folderul cu ID ${folderId} nu a fost găsit pentru furnizorul ${supplierId}`);
    }
    await this.removeFolderRecursive(supplierId, folderId);
    this.logger.log(`[removeFolder] Șters folder ${folderId} (${folder.description}) și descendenții pentru furnizor ${supplierId}`);
  }

  private async removeFolderRecursive(supplierId: number, folderId: number): Promise<void> {
    const children = await this.folderRepo.find({ where: { supplier_id: supplierId, parent_id: folderId } });
    for (const child of children) {
      await this.removeFolderRecursive(supplierId, child.id);
    }
    const folder = await this.folderRepo.findOne({ where: { id: folderId, supplier_id: supplierId } });
    if (folder) {
      const folderPathToDelete = folder.folder_path;
      await this.folderRepo.remove(folder);
      if ((folderPathToDelete || '').startsWith('/files/companies/')) {
        try {
          const repoRoot = this.getRepoRoot();
          const pathRel = (folderPathToDelete.startsWith('/files') ? folderPathToDelete : `/files${folderPathToDelete}`).replace(/^\//, '');
          const absolutePath = path.join(repoRoot, pathRel);
          if (fs.existsSync(absolutePath)) {
            fs.rmSync(absolutePath, { recursive: true, force: true });
            this.logger.log(`[removeFolder] Șters director pe disk: ${absolutePath}`);
          }
        } catch (e) {
          this.logger.warn(`[removeFolder] Nu s-a putut șterge directorul pe disk: ${folderPathToDelete}`, e);
        }
      }
    }
  }

  async removeDocument(documentId: number): Promise<void> {
    const document = await this.supplierDocumentRepo.findOne({ where: { id: documentId } });
    if (!document) {
      this.logger.warn(`Document with ID ${documentId} not found in database`);
      throw new NotFoundException('Documentul nu a fost găsit');
    }
    
    // Remove physical file if it exists
    try {
      const repoRoot = this.getRepoRoot();
      
      // Handle both old and new path structures
      let filePathToUse = document.file_path;
      this.logger.log(`📄 Removing document ID: ${documentId}, Name: ${document.file_name}, Path: ${document.file_path}`);
      
      if (document.file_path.includes('/suppliers/')) {
        // Extract supplier ID and name from the path
        const pathParts = document.file_path.split('/');
        const suppliersIndex = pathParts.indexOf('suppliers');
        if (suppliersIndex !== -1 && pathParts.length > suppliersIndex + 2) {
          // Check if the path follows the old structure (with ID)
          const possibleId = pathParts[suppliersIndex + 1];
          if (!isNaN(Number(possibleId))) {
            // This is the old structure with ID, we need to remove the ID part
            const supplierName = pathParts[suppliersIndex + 2];
            filePathToUse = `/files/suppliers/${supplierName}/${pathParts.slice(suppliersIndex + 3).join('/')}`;
            this.logger.log(`📄 Converting old path structure to new for removal: ${filePathToUse}`);
          }
        }
      }
      
      const filePathRel = (filePathToUse.startsWith('/files') ? filePathToUse : `/files${filePathToUse}`).replace(/^\//, '');
      const absolutePath = path.join(repoRoot, filePathRel);
      this.logger.log(`📄 Absolute file path for removal: ${absolutePath}`);
      
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        this.logger.log(`✅ Deleted physical file: ${absolutePath}`);
      } else {
        this.logger.warn(`⚠️ Physical file not found for removal: ${absolutePath}`);
      }
    } catch (error) {
      this.logger.warn(`⚠️ Failed to delete physical file for document ${documentId}:`, error);
    }
    
    await this.supplierDocumentRepo.remove(document);
    this.logger.log(`✅ Removed document record from database: ${documentId}`);
  }

  // Utility link generators used by micro controller
  generateEmailLink(supplierId: number, orderId: number): string {
    const subject = encodeURIComponent(`Comandă #${orderId}`);
    const body = encodeURIComponent(
      `Bună ziua,\n\nVă transmitem comanda #${orderId} pentru furnizor ${supplierId}.`,
    );
    return `mailto:?subject=${subject}&body=${body}`;
  }

  generateWhatsAppLink(supplierId: number, orderId: number, pdfUrl?: string): string {
    const text = `Comandă #${orderId} pentru furnizor ${supplierId}${pdfUrl ? ` PDF: ${pdfUrl}` : ''}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  // === SUPPLIER LOCATIONS METHODS ===

  /**
   * Assign generic (ex. AssignSupplierModal) — verifică ownership locație pentru non-admin.
   * Tenant: nu permite hijack pe Manual/Cont străin (trebuie acces deja valid).
   */
  async assignSupplierToLocationForRequester(
    supplierId: number,
    locationId: number,
    userContext: {
      company_id?: number | null;
      company_type?: string | null;
      isAdmin?: boolean;
      isSuperAdmin?: boolean;
      permissions?: string[];
      roles?: string[];
    },
  ): Promise<SupplierLocations> {
    const requester = buildSupplierAccessRequester({
      ...userContext,
      userId: undefined,
    });
    if (isTenantScopedSupplierRequester(requester)) {
      await this.assertLocationBelongsToRequesterCompany(locationId, requester);
      const supplier = await this.supplierRepo.findOne({
        where: { id: supplierId },
        relations: ['locations'],
      });
      if (!supplier) {
        throw new NotFoundException(`Furnizorul cu ID ${supplierId} nu a fost găsit`);
      }
      await this.assertSupplierAccessibleToRequester(supplier, requester);
    }
    return this.assignSupplierToLocation(supplierId, locationId);
  }

  async assignSupplierToLocation(supplierId: number, locationId: number): Promise<SupplierLocations> {
    // Verify supplier exists (fără verificare location_id pentru că încă nu este asignat)
    const supplier = await this.findOne(supplierId, undefined);
    
    if (!supplier) {
      throw new NotFoundException(`Furnizorul cu ID ${supplierId} nu a fost găsit`);
    }
    
    // Check if assignment already exists (idempotent)
    const existingAssignment = await this.supplierLocationsRepo.findOne({
      where: { supplier_id: supplierId, id_location: locationId }
    });
    
    if (existingAssignment) {
      return existingAssignment;
    }
    
    const assignment = this.supplierLocationsRepo.create({
      supplier_id: supplierId,
      id_location: locationId,
    });
    
    const savedAssignment = await this.supplierLocationsRepo.save(assignment);
    
    // Update folder paths to use location-specific structure (în background, nu blochează asignarea)
    this.updateFolderPathsForLocationBoundSupplier(supplierId, locationId).catch((error) => {
      this.logger.error(`❌ [assignSupplierToLocation] Eroare la actualizarea path-urilor pentru furnizor ${supplierId}:`, error);
      // Nu aruncăm eroarea - asignarea a fost deja făcută cu succes
    });
    
    return savedAssignment;
  }
  
  private async updateFolderPathsForLocationBoundSupplier(supplierId: number, locationId: number): Promise<void> {
    try {
      this.logger.log(`📍 [updateFolderPathsForLocationBoundSupplier] Updating folder paths for supplier ${supplierId} bound to location ${locationId}`);
      
      // Get the supplier (fără verificare location_id pentru că încă nu este asignat)
      const supplier = await this.findOne(supplierId, undefined);
      const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
      
      // Get location details
      const location = await this.fetchLocation(locationId);
      if (!location) {
        this.logger.warn(`⚠️ [updateFolderPathsForLocationBoundSupplier] Location ${locationId} not found`);
        return;
      }
      
      // Get company name for the location
      let companyName = 'UnknownCompany';
      try {
        const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
        const serviceSecret = process.env.SERVICE_SECRET || '';
        this.logger.log(`🏢 [updateFolderPathsForLocationBoundSupplier] Fetching company details from: ${companiesUrl}/companies/${location.company_id}`);
        
        const response = await firstValueFrom(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
          headers: {
            'x-internal-service': 'locations',
            'x-service-secret': serviceSecret,
            'Content-Type': 'application/json',
          },
          timeout: 3000,
        }));
        
        if (response.data && response.data.company_name) {
          companyName = response.data.company_name;
          this.logger.log(`🏢 [updateFolderPathsForLocationBoundSupplier] Company name: ${companyName}`);
        }
      } catch (error: any) {
        this.logger.warn(`⚠️ [updateFolderPathsForLocationBoundSupplier] Could not fetch company name for company ID ${location.company_id}:`, error?.message || error);
      }
      
      // Create location-specific path
      const locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
      const newBasePath = `${locationPath}/Furnizori/${supplierNameSimplified}`;
      
      this.logger.log(`📍 [updateFolderPathsForLocationBoundSupplier] New base path: ${newBasePath}`);
      
      // Update all folder records for this supplier to use the location-specific path
      const folders = await this.folderRepo.find({ where: { supplier_id: supplierId } });
      
      for (const folder of folders) {
        // Update folder path to location-specific structure
        const oldPath = folder.folder_path;
        folder.folder_path = `${newBasePath}/`;
        
        this.logger.log(`📁 [updateFolderPathsForLocationBoundSupplier] Updating folder ${folder.id} path from '${oldPath}' to '${folder.folder_path}'`);
        
        await this.folderRepo.save(folder);
      }
      
      this.logger.log(`✅ [updateFolderPathsForLocationBoundSupplier] Successfully updated ${folders.length} folder paths for supplier ${supplierId}`);
      
      // Also update document records to use the new folder path structure
      // Get all documents for this supplier
      const documents = await this.supplierDocumentRepo
        .createQueryBuilder('document')
        .leftJoinAndSelect('document.folder', 'folder')
        .where('folder.supplier_id = :supplierId', { supplierId })
        .getMany();
      
      this.logger.log(`📄 [updateFolderPathsForLocationBoundSupplier] Found ${documents.length} documents to update`);
      
      // Update each document's file_path to use the new location-specific structure
      for (const document of documents) {
        // Extract the subfolder and filename from the current file_path
        const currentPath = document.file_path;
        const pathParts = currentPath.split('/');
        if (pathParts.length >= 2) {
          // Get the subfolder (second to last part) and filename (last part)
          const subfolder = pathParts[pathParts.length - 2];
          const filename = pathParts[pathParts.length - 1];
          
          // Create the new path using the location-specific structure
          const newDocumentPath = `${newBasePath}/${subfolder}/${filename}`;
          
          // Update the document record
          const oldPath = document.file_path;
          document.file_path = newDocumentPath;
          
          this.logger.log(`📄 [updateFolderPathsForLocationBoundSupplier] Updating document ${document.id} path from '${oldPath}' to '${document.file_path}'`);
          
          await this.supplierDocumentRepo.save(document);
        }
      }
      
      this.logger.log(`✅ [updateFolderPathsForLocationBoundSupplier] Successfully updated ${documents.length} document paths for supplier ${supplierId}`);
    } catch (error) {
      this.logger.error(`❌ [updateFolderPathsForLocationBoundSupplier] Error updating folder paths for supplier ${supplierId}:`, error);
    }
  }

  async findSupplierLocations(supplierId: number): Promise<any[]> {
    await this.findOne(supplierId, undefined); // Nu verificăm location_id pentru această operație
    const rows = await this.supplierLocationsRepo.find({
      where: { supplier_id: supplierId },
      relations: ['supplier'],
    });
    return await this.enrichWithLocations(rows);
  }

  async findLocationSuppliers(locationId: number): Promise<any[]> {
    const rows = await this.supplierLocationsRepo.find({
      where: { id_location: locationId },
      relations: ['supplier'],
    });
    return await this.enrichWithLocations(rows);
  }

  /**
   * Ca fetchLocation, dar distinge o locație inexistentă (404 → { location: null, failed: false })
   * de un eșec de rețea/auth către locations-ms (→ { location: null, failed: true }), astfel încât
   * apelanții care fac verificări de autorizare pe baza company_id să nu confunde „nu am putut verifica"
   * cu „nu este asociat".
   */
  private async fetchLocationOrFail(
    locationId: number,
  ): Promise<{ location: any | null; failed: boolean }> {
    try {
      const resp = await firstValueFrom(this.httpService.get(`${this.locationsServiceUrl}/locations/${locationId}`, {
        headers: this.internalServiceHeaders(),
        timeout: 5000,
      }));
      return { location: resp.data, failed: false };
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return { location: null, failed: false };
      }
      this.logger.error(
        `❌ [fetchLocationOrFail] Nu am putut contacta locations-ms pentru locația ${locationId}: ${error?.message || error}`,
      );
      return { location: null, failed: true };
    }
  }

  private async fetchLocation(locationId: number): Promise<any | null> {
    try {
      this.logger.log(`📍 [fetchLocation] Fetching location ${locationId} from ${this.locationsServiceUrl}/locations/${locationId}`);
      const resp = await firstValueFrom(this.httpService.get(`${this.locationsServiceUrl}/locations/${locationId}`, {
        headers: this.internalServiceHeaders(),
        timeout: 5000,
      }));
      this.logger.log(`✅ [fetchLocation] Location response received for ${locationId}`);
      return resp.data;
    } catch (error: any) {
      this.logger.warn(`⚠️ [fetchLocation] Nu am putut încărca locația ${locationId}: ${error?.message || error}`);
      return null;
    }
  }

  private async enrichWithLocations(rows: SupplierLocations[]): Promise<any[]> {
    const results = await Promise.all(rows.map(async (row) => {
      const location = await this.fetchLocation(row.id_location);
      return { ...row, workLocation: location };
    }));
    return results;
  }

  async removeSupplierFromLocation(supplierId: number, locationId: number): Promise<void> {
    const assignment = await this.supplierLocationsRepo.findOne({
      where: { supplier_id: supplierId, id_location: locationId }
    });
    
    if (!assignment) {
      throw new NotFoundException('Asocierea nu a fost găsită');
    }
    
    await this.supplierLocationsRepo.remove(assignment);
  }

  // Find documents expiring on a specific date
  async findExpiringDocuments(targetDate: string): Promise<SupplierDocument[]> {
    this.logger.log(`[SUPPLIERS SERVICE] Finding documents expiring on ${targetDate}`);
    // Format the date to match the database format (YYYY-MM-DD)
    const formattedDate = new Date(targetDate);
    formattedDate.setHours(0, 0, 0, 0);
    
    const documents = await this.supplierDocumentRepo
      .createQueryBuilder('document')
      .where('DATE(document.expire_date) = :targetDate', { targetDate })
      .leftJoinAndSelect('document.folder', 'folder')
      .leftJoinAndSelect('folder.supplier', 'supplier')
      .getMany();
    
    this.logger.log(`[SUPPLIERS SERVICE] Found ${documents.length} documents expiring on ${targetDate}`);
    return documents;
  }

  // Find documents that have already expired
  async findExpiredDocuments(): Promise<SupplierDocument[]> {
    this.logger.log(`[SUPPLIERS SERVICE] Finding expired documents`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const documents = await this.supplierDocumentRepo
      .createQueryBuilder('document')
      .where('document.expire_date < :today', { today })
      .andWhere('document.expire_date IS NOT NULL')
      .leftJoinAndSelect('document.folder', 'folder')
      .leftJoinAndSelect('folder.supplier', 'supplier')
      .getMany();
    
    this.logger.log(`[SUPPLIERS SERVICE] Found ${documents.length} expired documents`);
    return documents;
  }

  
}

/** Normalizează CUI: acceptă RO/spații/cratime; returnează doar cifrele sau null. */
function normalizeSupplierCuiDigits(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const cleaned = String(raw)
    .trim()
    .toUpperCase()
    .replace(/^RO/, '')
    .replace(/[\s.\-_/]/g, '');
  if (!/^\d{2,10}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}
