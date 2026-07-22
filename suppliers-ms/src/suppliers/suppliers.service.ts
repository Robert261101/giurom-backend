import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Logger, Inject, NotImplementedException } from '@nestjs/common';
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
import { Supplier } from './entities/supplier.entity';
import { SupplierFolder } from './entities/supplier-folder.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SupplierProductMeasurementVariant } from './entities/supplier-product-measurement-variant.entity';
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
import { SupplierProductClientMapping } from './entities/supplier-product-client-mapping.entity';
import { buildSupplierProductImageFields } from './supplier-product-image.helper';
import { EmployeeSupplier } from './entities/employee-supplier.entity';
import {
  SupplierOrderAssignment,
  SupplierOrderAssignmentStatus,
} from './entities/supplier-order-assignment.entity';
import {
  SupplierOrderDriverAssignment,
  SupplierOrderDriverAssignmentStatus,
} from './entities/supplier-order-driver-assignment.entity';
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
import { CreateSupplierOrderAssignmentDto } from './dto/create-supplier-order-assignment.dto';
import { CreateSupplierOrderDriverAssignmentDto } from './dto/create-supplier-order-driver-assignment.dto';
import { UpdateOrderDeliveryDateDto } from './dto/update-order-delivery-date.dto';
import { PartialReceptionDto } from './dto/partial-reception.dto';
import { CancelOrderItemsDto } from './dto/cancel-order-items.dto';
import { SendBackToMagazionerDto } from './dto/send-back-to-magazioner.dto';
import { StockHttpService, CreateStockItemDto } from './stock-http.service';
import {
  assertClientViewOnlyOnMutations,
  assertFurnizorProductManager,
  isAdminOrSuperAdminFromPermissions,
  canManageSupplierProductClientMapping,
  isFurnizorProductManager,
  resolveCompanyTypeFromAuth,
  type SupplierProductUserContext,
} from './supplier-product-access';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildOrdersPaginatedResponse,
  normalizeOrdersPagination,
  PaginatedOrdersResponse,
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
    @InjectRepository(SupplierProductClientMapping)
    private readonly supplierProductClientMappingRepo: Repository<SupplierProductClientMapping>,
    @InjectRepository(EmployeeSupplier) private readonly employeeSupplierRepo: Repository<EmployeeSupplier>,
    @InjectRepository(SupplierOrderAssignment)
    private readonly orderAssignmentRepo: Repository<SupplierOrderAssignment>,
    @InjectConnection() private readonly connection: Connection,
    private readonly stockHttpService: StockHttpService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {
    this.locationsServiceUrl =
      this.configService.get<string>('LOCATIONS_HTTP_URL') ||
      'http://localhost:3004';
    this.serviceSecret =
      this.configService.get<string>('SERVICE_SECRET') ||
      process.env.SERVICE_SECRET || '';
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
      
      this.logger.log(`📤 Sending notification data: ${JSON.stringify(notificationData, null, 2)}`);
      
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

  async create(dto: CreateSupplierDto, location_id?: number): Promise<Supplier> {
    const existingSupplier = await this.supplierRepo.findOne({
      where: [
        { registration_number: dto.registration_number },
        { vat_number: dto.vat_number },
      ],
    });
    if (existingSupplier) {
      throw new BadRequestException('Furnizor duplicat (registration_number sau vat_number)');
    }
    
    const supplier = this.supplierRepo.create(dto);
    const savedSupplier = (await this.supplierRepo.save(supplier as any)) as Supplier;
    await this.createSupplierFolders(savedSupplier);
    
    // Asignează automat furnizorul la locația utilizatorului dacă este furnizată
    if (location_id) {
      try {
        await this.assignSupplierToLocation(savedSupplier.id, location_id);
      } catch (error: any) {
        // Dacă există deja, nu e problemă (ar trebui să fie imposibil, dar să fie safe)
        // Eroarea este logată în assignSupplierToLocation
      }
    }
    
    return savedSupplier;
  }

  async createWithDocuments(dto: CreateSupplierWithDocumentsDto, location_id?: number): Promise<Supplier> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Creating supplier with documents: ${JSON.stringify(dto, null, 2)}`);
    
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
    
    // Separate special fields from supplier data
    const supplierData = { ...dto } as any;
    delete supplierData.folderName;
    delete supplierData.documents;
    
    const supplier = this.supplierRepo.create(supplierData);
    const savedSupplier = (await this.supplierRepo.save(supplier as any)) as Supplier;
    this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier saved with ID: ${savedSupplier.id}`);
    
    await this.createSupplierFoldersWithCustomName(savedSupplier, dto.folderName, dto.documents, location_id);
    
    // Asignează automat furnizorul la locația utilizatorului dacă este furnizată
    if (location_id) {
      try {
        this.logger.log(`📍 [SUPPLIERS SERVICE] Assigning supplier ${savedSupplier.id} to location ${location_id}`);
        await this.assignSupplierToLocation(savedSupplier.id, location_id);
      } catch (error: any) {
        // Log the error but don't fail the supplier creation
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Failed to assign supplier ${savedSupplier.id} to location ${location_id}:`, error?.message || error);
      }
    }

    // Send notification for new supplier
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new supplier ${savedSupplier.id}`);
    await this.sendSupplierNotification(
      'supplier_created',
      'Furnizor nou creat',
      `A fost creat un nou furnizor: ${savedSupplier.supplier_name}`,
      savedSupplier.id,
      { supplierName: savedSupplier.supplier_name },
      `/furnizori/${savedSupplier.id}`,
      location_id,
    );
    
    return savedSupplier;
  }

  /** Names for magazioneri/șoferi — callers with order.read (incl. furnizor tenant). */
  private getEmployeesServiceUrl(): string {
    let employeesServiceUrl =
      this.configService.get<string>('EMPLOYEES_HTTP_URL') ||
      process.env.EMPLOYEES_HTTP_URL ||
      'http://localhost:3011';
    if (
      employeesServiceUrl.includes('bitap.ro') ||
      employeesServiceUrl.includes('89.46.6.45')
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
      this.logger.log(
        `[STAFF-ENRICH] HTTP batch returned ${employeeRows.length} row(s): ${JSON.stringify(
          employeeRows.map((r) => ({
            id: r.id,
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.email,
          })),
        )}`,
      );
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

  async sendOrderBackToMagazioner(orderId: number, dto: SendBackToMagazionerDto): Promise<SupplierOrder> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'supplier'],
    });
    if (!order) {
      throw new NotFoundException('Comanda nu a fost găsită');
    }

    order.status = OrderStatus.MAGAZIONER;
    if (dto.notes) {
      order.notes = dto.notes;
    }
    await this.orderRepo.save(order);

    if (order.supplier_location_id != null) {
      await this.sendOrderNotification(
        'order_returned_to_magazioner',
        'Comandă retrimisă la magazioner',
        `Comanda ${orderId} (${order.supplier?.supplier_name ?? 'N/A'}) a fost retrimisă la magazioner`,
        order.supplier_location_id,
        orderId,
        { orderId, supplierName: order.supplier?.supplier_name, notes: dto.notes },
        '/magazioner/dashboard',
      );
    }

    return order;
  }

  async toggleItemAvailability(itemId: number): Promise<SupplierOrderItem> {
    const item = await this.orderItemRepo.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException(`Item-ul ${itemId} nu a fost găsit`);
    }
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

  async warehouseReview(orderId: number, dto: WarehouseReviewDto): Promise<SupplierOrder> {
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
      ): Promise<{ subtotal: number; total: number }> => {
        const sp = await em.findOne(SupplierProduct, {
          where: { supplier_id: supplierId, product_id: productId },
        });
        const vat = Number(sp?.vat) || 0;
        const subtotal = qty * pricePerUnit;
        const total = subtotal + (subtotal * vat) / 100;
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
        const { subtotal, total } = await computeLineMoney(
          manager,
          order.supplier_id,
          added.productId,
          pricePerUnit,
          quantityToSave,
        );

        const itemInsert = await manager.insert(SupplierOrderItem, {
          order_id: orderId,
          product_id: added.productId,
          quantity: quantityToSave,
          price_per_unit: pricePerUnit,
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

  async createOrderAssignment(
    supplierOrderId: number,
    dto: CreateSupplierOrderAssignmentDto,
    createdByUserId?: number,
  ): Promise<SupplierOrderAssignment> {
    return this.connection.transaction(async (manager) => {
      const order = await manager.findOne(SupplierOrder, {
        where: { id: supplierOrderId },
      });
      if (!order) {
        throw new NotFoundException('Comanda nu a fost găsită');
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
  ): Promise<SupplierOrderDriverAssignment> {
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
        throw new BadRequestException('Data/ora programării nu este validă');
      }

      const deliveryPriority = Number(dto.delivery_priority);
      if (!Number.isInteger(deliveryPriority) || deliveryPriority < 1) {
        throw new BadRequestException('Prioritatea de livrare trebuie să fie un număr întreg pozitiv');
      }

      const deliveryDate = this.deriveDeliveryDateFromScheduledAt(scheduledAt);

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
  ): Promise<{ driver_id: number; delivery_date: string; used_priorities: number[] }> {
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

  async getDriverAssignments(driverId: number, locationId?: number): Promise<SupplierOrderDriverAssignment[]> {
    const { rows } = await this.queryDriverAssignmentsForDashboard(
      driverId,
      locationId,
    );
    return rows;
  }

  async getDriverAssignmentsPaginated(
    driverId: number,
    locationId: number | undefined,
    pageRaw?: string | number,
    limitRaw?: string | number,
  ): Promise<PaginatedOrdersResponse<SupplierOrderDriverAssignment>> {
    const { page, limit } = normalizeOrdersPagination(pageRaw, limitRaw);
    const { rows, total } = await this.queryDriverAssignmentsForDashboard(
      driverId,
      locationId,
      page,
      limit,
    );
    return buildOrdersPaginatedResponse(rows, page, limit, total);
  }

  private async queryDriverAssignmentsForDashboard(
    driverId: number,
    locationId?: number,
    page?: number,
    limit?: number,
  ): Promise<{ rows: SupplierOrderDriverAssignment[]; total: number }> {
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
        .leftJoinAndSelect('order.items', 'items'),
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

  private deriveDeliveryDateFromScheduledAt(scheduledAt: Date): string {
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

  async completeDriverAssignment(assignmentId: number): Promise<SupplierOrderDriverAssignment> {
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

  async getStorekeeperAssignments(
    employeeId: number,
    locationId?: number,
  ): Promise<SupplierOrderAssignment[]> {
    const { rows } = await this.queryStorekeeperAssignmentsForDashboard(
      employeeId,
      locationId,
    );
    return rows;
  }

  async getStorekeeperAssignmentsPaginated(
    employeeId: number,
    locationId: number | undefined,
    pageRaw?: string | number,
    limitRaw?: string | number,
  ): Promise<PaginatedOrdersResponse<SupplierOrderAssignment>> {
    const { page, limit } = normalizeOrdersPagination(pageRaw, limitRaw);
    const { rows, total } = await this.queryStorekeeperAssignmentsForDashboard(
      employeeId,
      locationId,
      page,
      limit,
    );
    return buildOrdersPaginatedResponse(rows, page, limit, total);
  }

  private async queryStorekeeperAssignmentsForDashboard(
    employeeId: number,
    locationId?: number,
    page?: number,
    limit?: number,
  ): Promise<{ rows: SupplierOrderAssignment[]; total: number }> {
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
        .leftJoinAndSelect('order.items', 'items'),
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

  async updateOrderDeliveryDate(orderId: number, dto: UpdateOrderDeliveryDateDto): Promise<SupplierOrder> {
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

  async findAll(locationId: number): Promise<Supplier[]> {
    this.logger.log(`[SUPPLIERS SERVICE] findAll called with locationId=${locationId}`);
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

  async findForOrders(locationId?: number): Promise<{ id: number; supplier_name: string }[]> {
    if (locationId !== undefined) {
      const suppliers = await this.supplierRepo
        .createQueryBuilder('supplier')
        .select(['supplier.id', 'supplier.supplier_name'])
        .innerJoin('supplier_locations', 'sl', 'sl.supplier_id = supplier.id')
        .where('sl.id_location = :locationId', { locationId })
        .orderBy('supplier.supplier_name', 'ASC')
        .getMany();
      
      return suppliers.map(s => ({ id: s.id, supplier_name: s.supplier_name }));
    }
    
    const suppliers = await this.supplierRepo.find({
      select: ['id', 'supplier_name'],
      order: { supplier_name: 'ASC' }
    });
    
    return suppliers.map(s => ({ id: s.id, supplier_name: s.supplier_name }));
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

    const companyLocationMap = new Map<number, unknown[]>();
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
      if (!companyLocationMap.has(clientCompanyId)) {
        companyLocationMap.set(clientCompanyId, []);
      }
      companyLocationMap.get(clientCompanyId)!.push(loc);
    }

    const companiesUrl =
      this.configService.get<string>('COMPANIES_HTTP_URL') ||
      process.env.COMPANIES_HTTP_URL ||
      'http://localhost:3003';

    const clients: Array<ReturnType<SuppliersService['mapSupplierClientCompany']>> =
      [];

    for (const [clientCompanyId] of companyLocationMap) {
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

  async findOne(id: number, location_id?: number): Promise<Supplier> {
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

    const folders = (supplier as any).folders || [];
    this.logger.log(`📂 [findOne] Furnizor ${id}: ${folders.length} foldere returnate`);
    folders.forEach((f: any, i: number) => {
      const docs = f.documents || [];
      this.logger.log(`📂 [findOne]   folder[${i}] id=${f.id} description="${f.description}" folder_path="${f.folder_path}" documents=${docs.length}`);
    });

    return supplier;
  }

  async update(id: number, dto: UpdateSupplierDto, selectedWorkLocationId?: number): Promise<Supplier> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Updating supplier ${id} with data: ${JSON.stringify(dto, null, 2)}`);
    
    const supplier = await this.findOne(id, undefined); // Nu verificăm location_id la update
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
    Object.assign(supplier, dto);
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

    return updatedSupplier;
  }

  async remove(id: number, selectedWorkLocationId?: number): Promise<void> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Removing supplier ${id}`);
    
    const supplier = await this.findOne(id);
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

  async addProduct(
    dto: CreateSupplierProductDto,
    userContext?: SupplierProductUserContext,
  ): Promise<SupplierProduct> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Adding product to supplier with data: ${JSON.stringify(dto, null, 2)}`);

    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
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

    const existingProduct = await this.supplierProductRepo.findOne({
      where: { supplier_id: supplierId, product_id: dto.product_id },
    });
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
      ...productFields
    } = dto;

    const supplierProduct = this.supplierProductRepo.create({
      ...productFields,
      supplier_id: supplierId,
      company_id: companyId,
      gross_quantity: quantities.gross_quantity,
      net_quantity: quantities.net_quantity,
    });
    this.logger.log(`📦 [SUPPLIERS SERVICE] Created supplier product object: ${JSON.stringify(supplierProduct, null, 2)}`);

    const savedProduct = await this.supplierProductRepo.save(supplierProduct);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Product added to supplier successfully with ID: ${savedProduct.id}`);
    this.logger.log(`📊 [SUPPLIERS SERVICE] Saved product data: ${JSON.stringify(savedProduct, null, 2)}`);
    this.logger.log(`💾 [SUPPLIERS SERVICE] Persisted fields - net_quantity: ${savedProduct.net_quantity}, gross_quantity: ${savedProduct.gross_quantity}, unit_of_measure: ${savedProduct.unit_of_measure}`);
    
    // Send notification for new product
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new product ${savedProduct.id}`);
    await this.sendSupplierNotification(
      'supplier_product_added',
      'Produs adaugat furnizor',
      `A fost adaugat un produs la furnizorul ${supplier.supplier_name}`,
      supplier.id,
      { 
        productId: savedProduct.id,
        supplierName: supplier.supplier_name,
        productData: dto
      },
      `/furnizori/${supplier.id}`  // Add target_url
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
    const rows = await this.supplierLocationsRepo.find({
      where: { supplier_id: supplierId },
    });
    for (const row of rows) {
      const location = await this.fetchLocation(row.id_location);
      const locCompanyId = Number(
        location?.company_id ?? location?.companyId ?? 0,
      );
      if (locCompanyId === clientCompanyId) {
        return;
      }
    }
    throw new ForbiddenException(
      'Furnizorul nu este asociat companiei client autentificate',
    );
  }

  private async assertClientStockProductInCompanyNomenclator(
    clientStockProductId: number,
    clientCompanyId: number,
    locationId?: number | null,
  ): Promise<void> {
    let locationIdsToCheck: number[] = [];

    if (locationId != null && Number.isFinite(locationId) && locationId > 0) {
      const location = await this.fetchLocation(locationId);
      if (!location) {
        throw new BadRequestException('Locația selectată nu a fost găsită');
      }
      const locCompanyId = Number(location.company_id);
      if (!Number.isFinite(locCompanyId) || locCompanyId !== clientCompanyId) {
        throw new BadRequestException(
          'Locația selectată nu aparține companiei autentificate',
        );
      }
      locationIdsToCheck = [locationId];
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

  async getClientProductMappingsForSupplier(
    supplierId: number,
    userContext?: SupplierProductUserContext,
  ): Promise<
    Array<
      SupplierProductClientMapping & {
        client_stock_product_name?: string | null;
      }
    >
  > {
    const clientCompanyId = this.resolveClientCompanyIdFromContext(userContext);
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
      .andWhere('sp.supplier_id = :supplierId', { supplierId })
      .orderBy('mappings.supplier_product_id', 'ASC')
      .getMany();

    const stockUrl =
      this.configService.get<string>('STOCK_HTTP_URL') ||
      process.env.STOCK_HTTP_URL ||
      'http://localhost:3006';
    const nameCache = new Map<number, string>();

    return Promise.all(
      rows.map(async (row) => {
        let client_stock_product_name: string | null = null;
        if (!nameCache.has(row.client_stock_product_id)) {
          try {
            const resp = await firstValueFrom(
              this.httpService.get(
                `${stockUrl}/stock/products/${row.client_stock_product_id}`,
                {
                  headers: this.internalServiceHeaders(),
                  timeout: 3000,
                },
              ),
            );
            const name = resp.data?.name ?? resp.data?.product_name ?? null;
            if (name) {
              nameCache.set(row.client_stock_product_id, String(name));
            }
          } catch {
            /* optional label */
          }
        }
        client_stock_product_name =
          nameCache.get(row.client_stock_product_id) ?? null;
        return { ...row, client_stock_product_name };
      }),
    );
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

    await this.assertSupplierLinkedToClientCompany(supplierId, clientCompanyId);

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
      selectedWorkLocationId,
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
          supplier_product_id: supplierProductId,
        },
      });

      if (mapping) {
        mapping.client_stock_product_id = clientStockProductId;
      } else {
        mapping = mappingRepo.create({
          client_company_id: clientCompanyId,
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
    return this.stockHttpService.listProductsByLocation(locationId);
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
      if (status === 409 || message.includes('există deja')) {
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
    const { locationId } = await this.assertProductInMySupplierNomenclator(
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

  async getSupplierProducts(
    supplierId: number,
    includeInactive = true,
    userContext?: SupplierProductUserContext,
    locationId?: number,
  ): Promise<Array<SupplierProduct & {
    linked_product_photo: string | null;
    resolved_image_url: string | null;
  }>> {
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

    if (!includeInactive) {
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
    if (resolvedLocationId != null) {
      const productIdsAtLocation =
        await this.stockHttpService.getProductIdsAtLocation(resolvedLocationId);
      const catalogProductIdsAtLocation = new Set(productIdsAtLocation);
      filteredProducts = products.filter((sp) =>
        catalogProductIdsAtLocation.has(Number(sp.product_id)),
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

    return filteredProducts.map((sp) => {
      const linkedPhoto = linkedPhotoMap.get(Number(sp.product_id)) ?? null;
      const imageFields = buildSupplierProductImageFields(
        sp.image_url,
        linkedPhoto,
      );
      return Object.assign(sp, {
        linked_product_photo: imageFields.linked_product_photo,
        resolved_image_url: imageFields.resolved_image_url,
      });
    });
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

    if (!Number.isFinite(Number(itemDto.product_id)) || Number(itemDto.product_id) <= 0) {
      throw new BadRequestException('product_id (produs stoc intern) este obligatoriu');
    }

    return { supplierProduct, variantId };
  }

  async createOrder(dto: CreateSupplierOrderDto): Promise<SupplierOrder> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Creating order with data: ${JSON.stringify(dto, null, 2)}`);
    
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

    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
    if (!supplier) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for order creation: ${dto.supplier_id}`);
      throw new NotFoundException('Furnizorul nu a fost găsit');
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

    let totalAmountWithoutVat = 0;
    let totalAmountWithVat = 0;
    for (const itemDto of dto.items) {
      const { supplierProduct, variantId } = await this.resolveSupplierProductForNewOrderItem(
        dto.supplier_id,
        itemDto,
      );

      const pricePerUnit =
        Number(itemDto.price_per_unit) > 0
          ? Number(itemDto.price_per_unit)
          : Number(supplierProduct.price_per_unit) || 0;
      const subtotal = itemDto.quantity * pricePerUnit;
      totalAmountWithoutVat += subtotal;

      const vat = Number(supplierProduct.vat) || 0;
      const vatAmount = (subtotal * vat) / 100;
      const total = subtotal + vatAmount;
      totalAmountWithVat += total;

      const orderItem = this.orderItemRepo.create({
        order_id: savedOrder.id,
        product_id: Number(itemDto.product_id),
        supplier_product_id: supplierProduct.id,
        ...(variantId != null ? { variant_id: variantId } : {}),
        quantity: itemDto.quantity,
        price_per_unit: pricePerUnit,
        subtotal,
        total,
      });
      await this.orderItemRepo.save(orderItem);
    }
    savedOrder.total_amount = totalAmountWithoutVat;
    savedOrder.total_amount_with_vat = totalAmountWithVat;
    await this.orderRepo.save(savedOrder);

    // Regula finală brut/net (timing stoc): la crearea/plasarea comenzii de client NU se
    // scade stocul furnizorului. Scăderea se face la confirmarea furnizorului
    // (vezi updateOrderStatus → tranziția în `confirmed`).

    await this.generateOrderPDF(savedOrder, supplier);

    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new order ${savedOrder.id}`);
    await this.sendSupplierNotification(
      'supplier_order_created',
      'Comanda furnizor noua',
      `A fost creata o comanda noua pentru furnizorul ${supplier.supplier_name}`,
      supplier.id,
      {
        orderId: savedOrder.id,
        supplierName: supplier.supplier_name,
        orderDate: savedOrder.order_date.toISOString(),
      },
      `/furnizori/${supplier.id}`,
      dto.supplier_location_id ?? undefined,
    );

    return (await this.orderRepo.findOne({
      where: { id: savedOrder.id },
      relations: ['items', 'documents'],
    })) as SupplierOrder;
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

  async markOrderAsDelivered(orderId: number): Promise<SupplierOrder> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Marking order ${orderId} as delivered`);
    
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

  async markOrderAsPartiallyReceived(dto: PartialReceptionDto): Promise<SupplierOrder> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Processing partial reception for order ${dto.orderId}`);
    
    const order = await this.orderRepo.findOne({ 
      where: { id: dto.orderId }, 
      relations: ['items', 'supplier'] 
    });
    
    if (!order) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order not found: ${dto.orderId}`);
      throw new NotFoundException('Comanda nu a fost găsită');
    }
    
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
          where: {
            supplier_order_id: order.id,
            status: SupplierOrderDriverAssignmentStatus.DONE,
          },
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

      if (newlyReceivedQty > 0) {
        await this.orderItemReceptionRepo.save({
          supplier_order_id: order.id,
          supplier_order_item_id: orderItem.id,
          product_id: orderItem.product_id,
          received_delta: newlyReceivedQty,
          returned_delta: 0,
          reason: undefined,
          user_id: userId,
          location_id: locationId || undefined,
          occurred_at: occurredAt,
          stock_item_id: undefined,
          status: ReceptionStatus.PENDING, // Status pending pentru aprobare
        });
        this.logger.log(`📝 [SUPPLIERS SERVICE] Created PENDING reception for item ${orderItem.id} with quantity ${newlyReceivedQty}`);
      }
      if (newlyReturnedQty > 0) {
        await this.orderItemReceptionRepo.save({
          supplier_order_id: order.id,
          supplier_order_item_id: orderItem.id,
          product_id: orderItem.product_id,
          received_delta: 0,
          returned_delta: newlyReturnedQty,
          reason: receptionItem.returnReason || undefined,
          user_id: userId,
          location_id: locationId || undefined,
          occurred_at: occurredAt,
          stock_item_id: undefined,
          status: ReceptionStatus.PENDING, // Status pending pentru aprobare
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

  async updateOrderStatus(
    orderId: number,
    status: string,
  ): Promise<SupplierOrder> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Comanda nu a fost găsită');

    const previousStatus = order.status;
    const newStatus = status as OrderStatus;

    this.logger.log(
      `🧪 [DEBUG cancel] updateOrderStatus CALLED orderId=${orderId} previousStatus=${previousStatus} newStatus=${newStatus} rawStatusArg=${status}`,
    );

    // Scădere stoc furnizor la confirmarea furnizorului — la tranziția în `confirmed`.
    // NU folosim aici setul SUPPLIER_STOCK_DEDUCTED_STATUSES: `magazioner` e inclus acolo
    // (pentru restore), dar fluxul normal este sent → magazioner → confirmed, deci la
    // confirmare previousStatus este de regulă `magazioner` și deduct-ul TREBUIE să ruleze.
    // Dubla-scădere (ex. re-confirm după send-back) e prevenită idempotent în stock-ms
    // prin target-ul `supplier-order-confirm:*`.
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
    const updated = await this.orderRepo.findOne({ where: { id: order.id } });
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
    return updated;
  }

  /**
   * Anulează item-uri dintr-o comandă
   * Creează înregistrări în supplier_order_cancelled_items pentru item-urile anulate
   */
  async cancelOrderItems(dto: { orderId: number; items: Array<{ itemId: number; returnedQuantity: number; returnReason?: string }> }): Promise<SupplierOrder> {
    this.logger.log(`🚫 [SUPPLIERS SERVICE] Cancelling items for order ${dto.orderId}`);
    
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
  async cancelRemainingQuantity(orderId: number, reason?: string): Promise<SupplierOrder> {
    this.logger.log(
      `🧪 [DEBUG cancel] cancelRemainingQuantity CALLED orderId=${orderId} reason=${reason ?? 'null'}`,
    );
    this.logger.log(`🚫 [SUPPLIERS SERVICE] Cancelling remaining quantity for order ${orderId}`);
    
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

    const updatedOrder = await this.markOrderAsPartiallyReceived(partialReceptionDto);
    // Persist cancelled items entries so they appear in cancelled-items view
    if (cancelItems.length > 0) {
      try {
        // Debug logs: show the payloads that will be used to create cancelled items
        try {
          const safeReception = JSON.stringify(receptionItems, (_k, v) => (typeof v === 'number' || typeof v === 'string' ? v : v), 2);
          const safeCancel = JSON.stringify(cancelItems, (_k, v) => (typeof v === 'number' || typeof v === 'string' ? v : v), 2);
          this.logger.log(`🧪 [DEBUG] receptionItems(${receptionItems.length}): ${safeReception}`);
          this.logger.log(`🧪 [DEBUG] cancelItems(${cancelItems.length}): ${safeCancel}`);
        } catch (e: any) {
          this.logger.log(`🧪 [DEBUG] Could not stringify debug payloads: ${e?.message || e}`);
        }

        this.logger.log(`🚫 [SUPPLIERS SERVICE] Creating cancelled items records for order ${orderId}`);
        await this.cancelOrderItems({ orderId: order.id, items: cancelItems as any });
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
      await this.approveReceptions(orderId, receptionIds);
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
  async approveReceptions(orderId: number, receptionIds: number[]): Promise<{ approved: number; stockCreated: number }> {
    this.logger.log(`✅ [SUPPLIERS SERVICE] Approving ${receptionIds.length} receptions for order ${orderId}`);
    
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
        await this.orderItemReceptionRepo.save(reception);
        continue;
      }

      // Actualizează statusul recepției la APPROVED
      reception.status = ReceptionStatus.APPROVED;
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
                `📦 [SUPPLIERS SERVICE] Converting quantity for product ${reception.product_id}: ` +
                `gross=${receivedDelta.toFixed(2)} → net=${netQuantity.toFixed(2)} ` +
                `(ratio: ${productNetQuantity}/${productGrossQuantity})`
              );
            }
          }
        } catch (err) {
          this.logger.warn(
            `⚠️ [SUPPLIERS SERVICE] Could not fetch supplier product for conversion ` +
            `(supplier=${order.supplier_id}, product=${reception.product_id}):`,
            err
          );
        }

        const locationId = reception.location_id ?? order.supplier_location_id ?? undefined;
        const stockItemDto: CreateStockItemDto = {
          product_id: reception.product_id,
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
        this.logger.log(`📦 [SUPPLIERS SERVICE] Queued stock item: product_id=${reception.product_id}, quantity=${netQuantity.toFixed(2)} (net), location_id=${locationId}, reception_id=${reception.id}`);
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
        await this.cancelOrderItems({ orderId, items: cancelledPayload as any });
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

    return {
      approved: receptions.length,
      stockCreated,
    };
  }

  /**
   * Respinge recepțiile pentru o comandă
   */
  async rejectReceptions(orderId: number, receptionIds: number[], reason?: string): Promise<{ rejected: number }> {
    this.logger.log(`❌ [SUPPLIERS SERVICE] Rejecting ${receptionIds.length} receptions for order ${orderId}`);
    
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
  async getOrderCancelledItems(orderId: number): Promise<SupplierOrderCancelledItem[]> {
    return this.cancelledItemRepo.find({
      where: { order_id: orderId },
      relations: ['orderItem'],
    });
  }

  /**
   * Batch: item-uri anulate pentru mai multe comenzi.
   * Folosit în rapoarte pentru a evita N+1 request-uri (o singură interogare pe cancelledItemRepo).
   */
  async getOrderCancelledItemsBatch(orderIds: number[]): Promise<SupplierOrderCancelledItem[]> {
    if (!orderIds || orderIds.length === 0) {
      return [];
    }

    return this.cancelledItemRepo.find({
      where: { order_id: In(orderIds) as any },
      relations: ['orderItem'],
    });
  }

  async getOrderReceptions(orderId: number): Promise<Array<SupplierOrderItemReception & { user_name?: string }>> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching receptions for order ${orderId}`);
    
    const receptions = await this.orderItemReceptionRepo.find({
      where: { supplier_order_id: orderId },
      order: { created_at: 'DESC' },
    });

    // Obține numele utilizatorilor pentru recepții
    const userIds = Array.from(new Set(
      receptions
        .map(r => r.user_id)
        .filter((id): id is number => id !== undefined && id !== null)
    ));

    const usersMap = new Map<number, string>();
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
            const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || `User #${userId}`;
            usersMap.set(userId, fullName);
            this.logger.log(`✅ [SUPPLIERS SERVICE] Fetched employee name for user ${userId} (employee ${employeeId}): ${fullName}`);
          } else {
            usersMap.set(userId, `User #${userId}`);
          }
        } else {
          usersMap.set(userId, `User #${userId}`);
        }
      } catch (error: any) {
        this.logger.error(`❌ [SUPPLIERS SERVICE] Error fetching employee data for user ${userId}:`, error.message);
        usersMap.set(userId, `User #${userId}`);
      }
    }

    // Adaugă numele utilizatorilor la recepții
    return receptions.map(reception => ({
      ...reception,
      user_name: reception.user_id ? usersMap.get(reception.user_id) : undefined,
    })) as Array<SupplierOrderItemReception & { user_name?: string }>;
  }

  async getOrderReceptionsBatch(orderIds: number[]): Promise<Array<SupplierOrderItemReception & { user_name?: string }>> {
    if (!orderIds || orderIds.length === 0) {
      return [];
    }

    const uniqueOrderIds = Array.from(new Set(orderIds));
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching receptions batch for ${uniqueOrderIds.length} orders`);

    // Obține toate recepțiile pentru comenzile specificate într-un singur query
    const receptions = await this.orderItemReceptionRepo.find({
      where: { supplier_order_id: In(uniqueOrderIds) },
      order: { created_at: 'DESC' },
    });

    this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${receptions.length} receptions for ${uniqueOrderIds.length} orders`);

    // Obține toate user IDs unice
    const userIds = Array.from(new Set(
      receptions
        .map(r => r.user_id)
        .filter((id): id is number => id !== undefined && id !== null)
    ));

    const usersMap = new Map<number, string>();
    const authDbName = process.env.AUTH_DB_NAME || 'restosoft_auth';
    const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';

    if (userIds.length > 0) {
      try {
        // Obține toate id_employee pentru user IDs într-un singur query
        const userIdsPlaceholder = userIds.map(() => '?').join(',');
        const userResult = await this.connection.query(
          `SELECT id, id_employee FROM ${authDbName}.users WHERE id IN (${userIdsPlaceholder})`,
          userIds
        );

        // Creează un map de user_id -> employee_id
        const userToEmployeeMap = new Map<number, number>();
        if (userResult && userResult.length > 0) {
          for (const row of userResult) {
            if (row.id && row.id_employee) {
              userToEmployeeMap.set(Number(row.id), Number(row.id_employee));
            }
          }
        }

        // Obține toate employee IDs
        const employeeIds = Array.from(userToEmployeeMap.values());
        if (employeeIds.length > 0) {
          const employeeIdsPlaceholder = employeeIds.map(() => '?').join(',');
          const employeeResult = await this.connection.query(
            `SELECT id, first_name, last_name FROM ${employeesDbName}.employees WHERE id IN (${employeeIdsPlaceholder})`,
            employeeIds
          );

          // Creează un map de employee_id -> full_name
          const employeeToNameMap = new Map<number, string>();
          if (employeeResult && employeeResult.length > 0) {
            for (const row of employeeResult) {
              const firstName = row.first_name || null;
              const lastName = row.last_name || null;
              const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || `Employee #${row.id}`;
              employeeToNameMap.set(Number(row.id), fullName);
            }
          }

          // Creează map-ul final user_id -> user_name
          for (const [userId, employeeId] of userToEmployeeMap.entries()) {
            const fullName = employeeToNameMap.get(employeeId);
            if (fullName) {
              usersMap.set(userId, fullName);
            } else {
              usersMap.set(userId, `User #${userId}`);
            }
          }
        }

        // Pentru user IDs care nu au employee asociat
        for (const userId of userIds) {
          if (!usersMap.has(userId)) {
            usersMap.set(userId, `User #${userId}`);
          }
        }
      } catch (error: any) {
        this.logger.error(`❌ [SUPPLIERS SERVICE] Error fetching employee data batch:`, error.message);
        // Setează default pentru toți userii în caz de eroare
        for (const userId of userIds) {
          usersMap.set(userId, `User #${userId}`);
        }
      }
    }

    // Adaugă numele utilizatorilor la recepții
    return receptions.map(reception => ({
      ...reception,
      user_name: reception.user_id ? usersMap.get(reception.user_id) : undefined,
    })) as Array<SupplierOrderItemReception & { user_name?: string }>;
  }

  async getReceptionReport(startDate: string, endDate: string, locationId?: number): Promise<any[]> {
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
    const receivedItems = await this.orderItemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.order', 'order')
      .select([
        'item.id AS item_id',
        'item.product_id AS product_id',
        'item.received_quantity AS received_quantity',
        'item.reception_date AS reception_date',
        'item.reception_user_id AS reception_user_id',
        'order.created_by_user_id AS order_user_id'
      ])
      .where('item.received_quantity > 0')
      .andWhere('(item.reception_date IS NOT NULL AND DATE(item.reception_date) BETWEEN :startDate AND :endDate)', {
        startDate,
        endDate
      })
      .getRawMany();

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
    const returnItems = await this.orderItemRepo
      .createQueryBuilder('item')
      .leftJoin('item.order', 'order')
      .select([
        'item.id AS item_id',
        'item.product_id AS product_id',
        'item.returned_quantity AS returned_quantity',
        'item.return_reason AS return_reason',
        'item.updated_at AS updated_at'
      ])
      .where('item.returned_quantity > 0')
      .andWhere('DATE(item.updated_at) BETWEEN :startDate AND :endDate', {
        startDate,
        endDate
      })
      .getRawMany();

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
        const orderItems = await this.orderItemRepo
          .createQueryBuilder('item')
          .leftJoinAndSelect('item.order', 'order')
          .where('item.id IN (:...ids)', { ids: orderItemIds })
          .getMany();
        
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
    const itemsWithoutReceptionDate = await this.orderItemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.order', 'order')
      .select([
        'item.id AS item_id',
        'item.product_id AS product_id',
        'item.received_quantity AS received_quantity',
        'item.reception_date AS reception_date',
        'item.reception_user_id AS reception_user_id',
        'order.created_by_user_id AS order_user_id'
      ])
      .where('item.received_quantity > 0')
      .andWhere('item.reception_date IS NULL')
      .getRawMany();
    
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
  async getSupplierOrders(supplierId: number, locationId?: number): Promise<SupplierOrder[]> {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.documents', 'documents')
      .leftJoinAndSelect('order.supplier', 'supplier')
      .leftJoinAndSelect('order.driverAssignments', 'driverAssignments')
      .where('order.supplier_id = :supplierId', { supplierId });

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
    },
  ): Promise<SupplierOrder[]> {
    if (!supplierIds || supplierIds.length === 0) {
      return [];
    }

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.documents', 'documents')
      .leftJoinAndSelect('order.supplier', 'supplier')
      .leftJoinAndSelect('order.driverAssignments', 'driverAssignments')
      .leftJoinAndSelect('order.assignments', 'assignments')
      .where('order.supplier_id IN (:...supplierIds)', { supplierIds });

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
    },
    pageRaw?: string | number,
    limitRaw?: string | number,
  ): Promise<PaginatedOrdersResponse<SupplierOrder>> {
    const { page, limit } = normalizeOrdersPagination(pageRaw, limitRaw);
    if (!supplierIds?.length) {
      return buildOrdersPaginatedResponse([], page, limit, 0);
    }

    const applyFilters = (qb: SelectQueryBuilder<SupplierOrder>) => {
      qb.where('order.supplier_id IN (:...supplierIds)', { supplierIds });
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
  ): Promise<PaginatedOrdersResponse<SupplierOrder>> {
    if (!supplierIds?.length) {
      return buildOrdersPaginatedResponse([], page, limit, 0);
    }
    const orders = await this.getSupplierOrdersBatch(supplierIds, { locationId });
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
  ): Promise<PaginatedOrdersResponse<SupplierOrder>> {
    if (!supplierIds?.length) {
      return buildOrdersPaginatedResponse([], page, limit, 0);
    }
    const orders = await this.getSupplierOrdersBatch(supplierIds, { locationId });
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
  ): Promise<PaginatedOrdersResponse<SupplierOrder>> {
    if (!supplierIds?.length) {
      return buildOrdersPaginatedResponse([], page, limit, 0);
    }

    const orders = await this.getSupplierOrdersBatch(supplierIds, { locationId });
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
    _supplierId: number,
    updateData: UpdateSupplierProductDto,
    userContext?: SupplierProductUserContext,
  ): Promise<SupplierProduct> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Updating supplier product ${productId} with data: ${JSON.stringify(updateData, null, 2)}`);
    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    if (!isFurnizorProductManager(userContext)) {
      assertClientViewOnlyOnMutations(userContext);
    }
    assertFurnizorProductManager(userContext);

    const supplierProduct = await this.findSupplierProductForUser(
      productId,
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
    const updated = await this.supplierProductRepo.save(supplierProduct);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier product updated successfully: ${JSON.stringify(updated, null, 2)}`);
    return updated;
  }

  async removeSupplierProduct(
    productId: number,
    userContext?: SupplierProductUserContext,
  ): Promise<void> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Removing supplier product ${productId}`);
    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    if (!isFurnizorProductManager(userContext)) {
      assertClientViewOnlyOnMutations(userContext);
    }
    assertFurnizorProductManager(userContext);

    const supplierProduct = await this.findSupplierProductForUser(
      productId,
      userContext,
    );
    await this.supplierProductRepo.remove(supplierProduct);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier product removed successfully`);
  }

  // === MEASUREMENT VARIANTS METHODS ===

  async createVariant(
    dto: CreateSupplierProductMeasurementVariantDto,
    userContext?: SupplierProductUserContext,
  ): Promise<SupplierProductMeasurementVariant> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Creating measurement variant with data: ${JSON.stringify(dto, null, 2)}`);

    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    if (!isFurnizorProductManager(userContext)) {
      assertClientViewOnlyOnMutations(userContext);
    }
    assertFurnizorProductManager(userContext);

    const supplierProduct = await this.findSupplierProductForUser(
      dto.supplier_product_id,
      userContext,
    );

    // Validate measurement_unit compatibility with supplier_products.unit_of_measure
    if (dto.measurement_unit && dto.measurement_unit !== supplierProduct.unit_of_measure) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Measurement unit mismatch - variant: ${dto.measurement_unit}, supplier product: ${supplierProduct.unit_of_measure}`);
      this.logger.log(`ℹ️ [SUPPLIERS SERVICE] Allowing mismatch for now (compatibility validation)`);
    }

    const variant = this.supplierProductMeasurementVariantRepo.create(dto);
    const savedVariant = await this.supplierProductMeasurementVariantRepo.save(variant);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Measurement variant created successfully: ${JSON.stringify(savedVariant, null, 2)}`);
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
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Updating measurement variant ${variantId} with data: ${JSON.stringify(updateData, null, 2)}`);
    const variant = await this.supplierProductMeasurementVariantRepo.findOne({ where: { id: variantId } });
    if (!variant) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Measurement variant not found: ${variantId}`);
      throw new NotFoundException('Varianta de măsură nu a fost găsită');
    }

    if (!userContext) {
      throw new ForbiddenException('Contextul utilizatorului lipsește');
    }
    if (!isFurnizorProductManager(userContext)) {
      assertClientViewOnlyOnMutations(userContext);
    }
    assertFurnizorProductManager(userContext);
    await this.findSupplierProductForUser(variant.supplier_product_id, userContext);

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
    this.logger.log(`✅ [SUPPLIERS SERVICE] Measurement variant updated successfully: ${JSON.stringify(updated, null, 2)}`);
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
    if (!isFurnizorProductManager(userContext)) {
      assertClientViewOnlyOnMutations(userContext);
    }
    assertFurnizorProductManager(userContext);
    await this.findSupplierProductForUser(variant.supplier_product_id, userContext);

    await this.supplierProductMeasurementVariantRepo.remove(variant);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Measurement variant deleted successfully`);
  }

  async addDocument(
    supplierId: number,
    documentData: { fileName: string; folderId?: number; folderName?: string; notes?: string; content?: string; file_content?: string; expire_date?: string },
  ) {
    try {
      console.log(`📥 [addDocument] Starting document upload for supplier ${supplierId}`);
      console.log(`📄 [addDocument] Document data:`, {
        fileName: documentData.fileName,
        folderId: documentData.folderId,
        folderName: documentData.folderName,
        hasContent: !!(documentData.content || documentData.file_content),
        notes: documentData.notes,
        expire_date: documentData.expire_date
      });

      const supplier = await this.findOne(supplierId);
      console.log(`✅ [addDocument] Found supplier: ${supplier.supplier_name} (ID: ${supplier.id})`);

      // Get the supplier name simplified (needed for path and folder resolution)
      const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
      console.log(`📝 [addDocument] Simplified supplier name: ${supplierNameSimplified}`);

      // Check if supplier is bound to any locations (compute basePath first, needed for find-or-create folder)
      let locationPath: string | null = null;
      let isBoundToLocation = false;

      try {
        console.log(`🔍 [addDocument] Checking if supplier ${supplierId} is bound to any locations`);
        const supplierLocations = await this.supplierLocationsRepo.find({
          where: { supplier_id: supplierId }
        });
        console.log(`📍 [addDocument] Found supplier locations:`, supplierLocations);

        if (supplierLocations && supplierLocations.length > 0) {
          console.log(`📍 [addDocument] Supplier is bound to ${supplierLocations.length} locations`);
          const locationId = supplierLocations[0].id_location;
          console.log(`📍 [addDocument] Checking details for location ID: ${locationId}`);
          
          try {
            const location = await this.fetchLocation(locationId);
            console.log(`📍 [addDocument] Location details:`, location);
            
            if (location) {
              console.log(`📍 [addDocument] Location data is valid`);
              let companyName = 'UnknownCompany';
              try {
                const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
                const serviceSecret = process.env.SERVICE_SECRET || '';
                console.log(`🏢 [addDocument] Fetching company details from: ${companiesUrl}/companies/${location.company_id}`);

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
                  console.log(`🏢 [addDocument] Company name: ${companyName}`);
                } else {
                  console.log(`🏢 [addDocument] Company response data:`, response.data);
                }
              } catch (error: any) {
                console.warn(`⚠️ [addDocument] Could not fetch company name for company ID ${location.company_id}:`, error?.message || error);
              }

              locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
              isBoundToLocation = true;
              console.log(`📍 [addDocument] Location-specific path constructed: ${locationPath}`);
            } else {
              console.log(`⚠️ [addDocument] Location details not found for location ID: ${locationId}`);
              locationPath = `/files/companies/UnknownCompany/Locații/UnknownLocation`;
              isBoundToLocation = true;
              console.log(`📍 [addDocument] Using placeholder location-specific path: ${locationPath}`);
            }
          } catch (locationError) {
            console.error(`❌ [addDocument] Error fetching location details for location ID ${locationId}:`, locationError);
            locationPath = `/files/companies/UnknownCompany/Locații/UnknownLocation`;
            isBoundToLocation = true;
            console.log(`📍 [addDocument] Using placeholder location-specific path due to error: ${locationPath}`);
          }
        } else {
          console.log(`ℹ️ [addDocument] Supplier ${supplierId} is not bound to any locations`);
        }
      } catch (error) {
        console.warn(`⚠️ [addDocument] Error checking supplier location binding:`, error);
      }

      console.log(`📍 [addDocument] Final location binding status - isBoundToLocation: ${isBoundToLocation}, locationPath: ${locationPath}`);

      // Rezolvă folder: după id, sau după nume (find-or-create pe server)
      let folder: SupplierFolder | null = null;
      if (documentData.folderId) {
        folder = await this.folderRepo.findOne({ where: { id: documentData.folderId, supplier_id: supplierId } });
        if (folder) console.log(`✅ [addDocument] Found folder by ID: ${folder.description} (ID: ${folder.id})`);
      }
      if (!folder) {
        const folderName = documentData.folderName
          || (documentData.notes?.match(/\|folder:([^|]+)\|/)?.[1]?.trim())
          || 'Alte documente';
        folder = await this.folderRepo.findOne({ where: { supplier_id: supplierId, description: folderName } });
        if (folder) {
          console.log(`✅ [addDocument] Found folder by name: ${folder.description} (ID: ${folder.id})`);
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
          console.log(`✅ [addDocument] Created folder on server: ${folder.description} (ID: ${folder.id}), path: ${folderPath}`);
          if (!basePath.startsWith('/files/suppliers/')) {
            const repoRoot = this.getRepoRoot();
            const basePathRel = basePath.startsWith('/') ? basePath.slice(1) : basePath;
            const absoluteDir = path.join(repoRoot, basePathRel, folderName);
            if (!fs.existsSync(absoluteDir)) {
              fs.mkdirSync(absoluteDir, { recursive: true });
              console.log(`📁 [addDocument] Created directory on disk: ${absoluteDir}`);
            }
          }
        }
      }
      if (!folder) {
        console.error(`❌ [addDocument] Could not resolve or create folder for supplier ${supplierId}`);
        throw new NotFoundException('Folderul nu a putut fi găsit sau creat.');
      }
      console.log(`✅ [addDocument] Using folder: ${folder.description} (ID: ${folder.id})`);
      
      // If bound to location, verify the path can be constructed
      if (isBoundToLocation && locationPath) {
        const repoRoot = this.getRepoRoot();
        const locationPathRel = locationPath.startsWith('/') ? locationPath.slice(1) : locationPath;
        const absoluteLocationPath = path.join(repoRoot, locationPathRel);
        console.log(`📁 [addDocument] Absolute location path: ${absoluteLocationPath}`);
        
        // Check if the location directory exists
        if (fs.existsSync(absoluteLocationPath)) {
          console.log(`✅ [addDocument] Location directory exists`);
        } else {
          console.log(`⚠️ [addDocument] Location directory does not exist, will be created during file save`);
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
          console.log(`✅ [addDocument] File written to: ${absolutePath}`);
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
      
      console.log(`💾 [addDocument] Creating document record in database`);
      const savedDocument = await this.supplierDocumentRepo.save(document);
      console.log(`✅ [addDocument] Document saved to database with ID: ${savedDocument.id}`);
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
  async assignSupplierToLocation(supplierId: number, locationId: number): Promise<SupplierLocations> {
    // Verify supplier exists (fără verificare location_id pentru că încă nu este asignat)
    const supplier = await this.findOne(supplierId, undefined);
    
    if (!supplier) {
      throw new NotFoundException(`Furnizorul cu ID ${supplierId} nu a fost găsit`);
    }
    
    // Check if assignment already exists
    const existingAssignment = await this.supplierLocationsRepo.findOne({
      where: { supplier_id: supplierId, id_location: locationId }
    });
    
    if (existingAssignment) {
      throw new BadRequestException('Furnizorul este deja atribuit la această locație');
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


