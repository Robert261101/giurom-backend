import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { SupplierOrder, OrderStatus } from './entities/supplier-order.entity';
import { StockHttpService } from './stock-http.service';

interface SupplierOrderExportItem {
  product_id: number;
  product_name: string;
  sku: string | null;
  unit: string | null;
  quantity: number;
  price_per_unit: number;
  subtotal: number;
  received_quantity: number;
  /**
   * Gestiunea aleasă în App1 (`storage_zones.id` din giurom 2.0). Aici e doar **intenția** —
   * se vede în App2 înainte de recepție. Cantitatea ajunge pe gestiune abia prin documentul
   * de intrare, care poartă aceeași etichetă.
   */
  zone_ref: number | null;
}

interface SupplierOrderExportRow {
  source_order_id: number;
  company_id: number;
  location_id: number;
  supplier_name: string;
  order_date: string;
  delivery_date: string | null;
  status: string;
  total_amount: number;
  total_amount_with_vat: number | null;
  notes: string | null;
  items: SupplierOrderExportItem[];
}

@Injectable()
export class SuppliersExportService {
  private readonly logger = new Logger(SuppliersExportService.name);
  private static readonly MANUAL_EXPORT_COOLDOWN_MS = 60 * 1000;
  private lastManualExportAt = 0;

  private static readonly TERMINAL_STATUSES = new Set<string>([
    OrderStatus.DELIVERED,
    OrderStatus.RECEIVED,
    OrderStatus.CANCELLED,
    OrderStatus.RETURNED_TO_SUPPLIER,
    OrderStatus.RETURNED_FROM_SUPPLIER,
  ]);

  constructor(
    @InjectRepository(SupplierOrder)
    private readonly orderRepo: Repository<SupplierOrder>,
    private readonly stockHttpService: StockHttpService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async runManualExport(): Promise<{
    sent: number;
    exported_orders: number;
    skipped_without_mapping_fields: number;
    response?: unknown;
  }> {
    const now = Date.now();
    const elapsed = now - this.lastManualExportAt;
    if (elapsed < SuppliersExportService.MANUAL_EXPORT_COOLDOWN_MS) {
      const waitSeconds = Math.ceil(
        (SuppliersExportService.MANUAL_EXPORT_COOLDOWN_MS - elapsed) / 1000,
      );
      throw new BadRequestException(
        `Exportul manual a rulat recent — mai așteaptă ${waitSeconds}s.`,
      );
    }
    this.lastManualExportAt = now;

    const orders = await this.loadRecentAndActiveOrders();
    if (orders.length === 0) {
      this.logger.log('📤 [SuppliersExport] Nicio comandă recentă/activă de exportat.');
      return { sent: 0, exported_orders: 0, skipped_without_mapping_fields: 0 };
    }

    const payload = await this.buildExportPayload(orders);
    if (payload.rows.length === 0) {
      this.logger.warn(
        '⚠️ [SuppliersExport] Toate comenzile eligibile au fost omise (company_id/location_id lipsă).',
      );
      return {
        sent: 0,
        exported_orders: 0,
        skipped_without_mapping_fields: payload.skippedWithoutMappingFields,
      };
    }

    const targetUrl = this.configService.get<string>('GIUROM2_SUPPLIER_ORDER_SYNC_URL');
    if (!targetUrl) {
      this.logger.warn(
        '⚠️ [SuppliersExport] GIUROM2_SUPPLIER_ORDER_SYNC_URL nu este setat, exportul nu a fost trimis.',
      );
      return {
        sent: 0,
        exported_orders: payload.rows.length,
        skipped_without_mapping_fields: payload.skippedWithoutMappingFields,
      };
    }

    const apiKey = this.configService.get<string>('GIUROM2_STOCK_SYNC_API_KEY') || '';
    const response = await firstValueFrom(
      this.httpService.post(
        targetUrl,
        { orders: payload.rows },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Stock-Sync-Key': apiKey,
          },
        },
      ),
    );

    this.logger.log(
      `✅ [SuppliersExport] Export trimis: ${payload.rows.length} comenzi, ${payload.totalItems} linii.`,
    );
    return {
      sent: payload.totalItems,
      exported_orders: payload.rows.length,
      skipped_without_mapping_fields: payload.skippedWithoutMappingFields,
      response: response?.data,
    };
  }

  /**
   * Platform export job (manual trigger via `POST /suppliers/export/run-manual`).
   * Intentionally cross-tenant: pushes recent/active orders to Giurom 2.0 sync URL.
   * Each payload row carries its own `company_id` / `location_id`; the external
   * consumer is responsible for routing per tenant. Not invoked from tenant UI flows.
   */
  private async loadRecentAndActiveOrders(): Promise<SupplierOrder[]> {
    const threshold = new Date();
    threshold.setMonth(threshold.getMonth() - 3);
    const terminalStatuses = [...SuppliersExportService.TERMINAL_STATUSES];

    return this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('o.supplier', 'supplier')
      .where(
        '(o.order_date >= :threshold OR o.status NOT IN (:...terminalStatuses))',
        { threshold, terminalStatuses },
      )
      .orderBy('o.order_date', 'DESC')
      .getMany();
  }

  private async buildExportPayload(orders: SupplierOrder[]): Promise<{
    rows: SupplierOrderExportRow[];
    totalItems: number;
    skippedWithoutMappingFields: number;
  }> {
    const productIds = orders.flatMap((order) =>
      (order.items || []).map((item) => Number(item.product_id)),
    );
    const productMap = await this.stockHttpService.getProductsByIds(productIds);

    let totalItems = 0;
    let skippedWithoutMappingFields = 0;

    const rows: SupplierOrderExportRow[] = [];
    for (const order of orders) {
      if (!order.company_id || !order.location_id) {
        skippedWithoutMappingFields += 1;
        continue;
      }

      const items = (order.items || []).map((item) => {
        const productInfo = productMap.get(Number(item.product_id));
        totalItems += 1;
        return {
          product_id: Number(item.product_id),
          product_name: productInfo?.name || `Produs ${item.product_id}`,
          sku: productInfo?.sku ?? null,
          unit: productInfo?.unit ?? null,
          quantity: Number(item.quantity) || 0,
          price_per_unit: Number(item.price_per_unit) || 0,
          subtotal: Number(item.subtotal) || 0,
          received_quantity: Number(item.received_quantity) || 0,
          zone_ref: item.giurom2_zone_id ?? null,
        };
      });

      rows.push({
        source_order_id: Number(order.id),
        company_id: Number(order.company_id),
        location_id: Number(order.location_id),
        supplier_name: order.supplier?.supplier_name || `Furnizor #${order.supplier_id}`,
        order_date: this.toIso(order.order_date),
        delivery_date: order.delivery_date ? this.toIso(order.delivery_date) : null,
        status: String(order.status),
        total_amount: Number(order.total_amount) || 0,
        total_amount_with_vat:
          order.total_amount_with_vat != null
            ? Number(order.total_amount_with_vat) || 0
            : null,
        notes: order.notes ?? null,
        items,
      });
    }

    return { rows, totalItems, skippedWithoutMappingFields };
  }

  private toIso(value: Date | string): string {
    const parsed = value instanceof Date ? value : new Date(value);
    return parsed.toISOString();
  }
}
