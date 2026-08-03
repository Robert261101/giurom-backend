import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { In, IsNull, Not, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import {
  SupplierOrderItemReception,
  ReceptionStatus,
} from './entities/supplier-order-item-reception.entity';
import { SupplierOrder } from './entities/supplier-order.entity';
import { SupplierOrderItem } from './entities/supplier-order-item.entity';
import { StockHttpService } from './stock-http.service';

interface EntryDocumentItem {
  source_reception_id: number;
  product_id: number;
  product_name: string;
  sku: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
}

interface EntryDocumentRow {
  source_batch_id: string;
  source_order_id: number;
  company_id: number;
  location_id: number;
  supplier_source_id: number | null;
  supplier_name: string;
  reception_date: string;
  approved_at: string;
  notes: string | null;
  items: EntryDocumentItem[];
}

export interface EntryDocumentsExportResult {
  documents: number;
  lines: number;
  skipped_without_mapping_fields: number;
  response?: unknown;
}

/**
 * Exportă documentele de intrare (recepții aprobate) către giurom 2.0, unde devin NIR-uri
 * read-only.
 *
 * Un document = rândurile de recepție aprobate împreună, adică aceeași pereche
 * (reception_batch_id, approved_at). Rândurile istorice au batch-ul NULL și sunt tratate ca
 * documente de un singur rând, ca să rămână exportabile fără backfill.
 *
 * Cantitatea trimisă este cea netă, salvată pe recepție la aprobare — aceeași care a intrat
 * efectiv în stoc.
 */
@Injectable()
export class EntryDocumentsExportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EntryDocumentsExportService.name);
  private static readonly MANUAL_EXPORT_COOLDOWN_MS = 60 * 1000;
  /** Fereastra re-trimisă de plasa de siguranță — upsert-ul din App2 e idempotent. */
  private static readonly SAFETY_NET_LOOKBACK_DAYS = 7;
  private static readonly SAFETY_NET_INTERVAL_MS = 15 * 60 * 1000;
  private lastManualExportAt = 0;
  private safetyNetTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(SupplierOrderItemReception)
    private readonly receptionRepo: Repository<SupplierOrderItemReception>,
    @InjectRepository(SupplierOrder)
    private readonly orderRepo: Repository<SupplierOrder>,
    @InjectRepository(SupplierOrderItem)
    private readonly orderItemRepo: Repository<SupplierOrderItem>,
    private readonly stockHttpService: StockHttpService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Împinge documentele unei comenzi imediat după aprobarea recepției.
   * Nu aruncă niciodată: aprobarea recepției nu trebuie să eșueze fiindcă App2 e indisponibil
   * — cron-ul de siguranță reia documentul la următoarea rulare.
   */
  async pushForOrderSafe(orderId: number): Promise<void> {
    try {
      const receptions = await this.receptionRepo.find({
        where: {
          supplier_order_id: orderId,
          status: ReceptionStatus.APPROVED,
          approved_at: Not(IsNull()),
        },
      });
      const result = await this.exportReceptions(receptions);
      if (result.documents > 0) {
        this.logger.log(
          `📄 [EntryDocs] Comanda ${orderId}: ${result.documents} documente (${result.lines} linii) trimise către giurom 2.0.`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `⚠️ [EntryDocs] Push imediat eșuat pentru comanda ${orderId}: ${(e as Error).message}. ` +
          'Documentul va fi reluat de cron-ul de siguranță.',
      );
    }
  }

  /**
   * Plasa de siguranță rulează pe interval, nu pe `@Cron`: suppliers-ms nu are
   * `@nestjs/schedule` instalat, iar adăugarea unei dependențe noi într-un serviciu deja
   * deployat nu se justifică pentru un singur job periodic.
   */
  onModuleInit(): void {
    this.safetyNetTimer = setInterval(() => {
      void this.handleSafetyNetExport();
    }, EntryDocumentsExportService.SAFETY_NET_INTERVAL_MS);
    // Nu ține procesul în viață doar pentru acest timer.
    this.safetyNetTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.safetyNetTimer) clearInterval(this.safetyNetTimer);
  }

  /** Re-trimite documentele aprobate recent. Upsert idempotent în App2. */
  async handleSafetyNetExport(): Promise<void> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - EntryDocumentsExportService.SAFETY_NET_LOOKBACK_DAYS);
      const receptions = await this.receptionRepo
        .createQueryBuilder('r')
        .where('r.status = :status', { status: ReceptionStatus.APPROVED })
        .andWhere('r.approved_at IS NOT NULL')
        .andWhere('r.approved_at >= :since', { since })
        .getMany();

      const result = await this.exportReceptions(receptions);
      if (result.documents > 0) {
        this.logger.log(
          `📄 [EntryDocs] Plasă de siguranță: ${result.documents} documente (${result.lines} linii) re-trimise.`,
        );
      }
    } catch (e) {
      this.logger.error(`❌ [EntryDocs] Export periodic eșuat: ${(e as Error).message}`);
    }
  }

  /** Export manual din UI, cu limitare de frecvență ca să nu poată fi folosit ca vector de abuz. */
  async runManualExport(): Promise<EntryDocumentsExportResult> {
    const now = Date.now();
    const elapsed = now - this.lastManualExportAt;
    if (elapsed < EntryDocumentsExportService.MANUAL_EXPORT_COOLDOWN_MS) {
      const waitSeconds = Math.ceil(
        (EntryDocumentsExportService.MANUAL_EXPORT_COOLDOWN_MS - elapsed) / 1000,
      );
      throw new BadRequestException(
        `Exportul manual a rulat recent — mai așteaptă ${waitSeconds}s.`,
      );
    }
    this.lastManualExportAt = now;

    const since = new Date();
    since.setDate(since.getDate() - EntryDocumentsExportService.SAFETY_NET_LOOKBACK_DAYS);
    const receptions = await this.receptionRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: ReceptionStatus.APPROVED })
      .andWhere('r.approved_at IS NOT NULL')
      .andWhere('r.approved_at >= :since', { since })
      .getMany();

    return this.exportReceptions(receptions);
  }

  private async exportReceptions(
    receptions: SupplierOrderItemReception[],
  ): Promise<EntryDocumentsExportResult> {
    // Doar intrările efective: rândurile de retur/anulare nu produc document de intrare.
    const entries = receptions.filter((r) => Number(r.received_delta) > 0);
    if (entries.length === 0) {
      return { documents: 0, lines: 0, skipped_without_mapping_fields: 0 };
    }

    const built = await this.buildDocuments(entries);
    if (built.rows.length === 0) {
      return {
        documents: 0,
        lines: 0,
        skipped_without_mapping_fields: built.skippedWithoutMappingFields,
      };
    }

    const targetUrl = this.configService.get<string>('GIUROM2_ENTRY_DOCUMENTS_SYNC_URL');
    if (!targetUrl) {
      this.logger.warn(
        '⚠️ [EntryDocs] GIUROM2_ENTRY_DOCUMENTS_SYNC_URL nu este setat — documentele nu au fost trimise.',
      );
      return {
        documents: built.rows.length,
        lines: built.totalItems,
        skipped_without_mapping_fields: built.skippedWithoutMappingFields,
      };
    }

    const apiKey = this.configService.get<string>('GIUROM2_STOCK_SYNC_API_KEY') || '';
    const response = await firstValueFrom(
      this.httpService.post(
        targetUrl,
        { documents: built.rows },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Stock-Sync-Key': apiKey,
          },
        },
      ),
    );

    return {
      documents: built.rows.length,
      lines: built.totalItems,
      skipped_without_mapping_fields: built.skippedWithoutMappingFields,
      response: response?.data,
    };
  }

  private async buildDocuments(entries: SupplierOrderItemReception[]): Promise<{
    rows: EntryDocumentRow[];
    totalItems: number;
    skippedWithoutMappingFields: number;
  }> {
    const orderIds = [...new Set(entries.map((r) => Number(r.supplier_order_id)))];
    const orders = await this.orderRepo.find({
      where: { id: In(orderIds) },
      relations: ['supplier'],
    });
    const orderById = new Map(orders.map((o) => [Number(o.id), o]));

    const orderItemIds = [...new Set(entries.map((r) => Number(r.supplier_order_item_id)))];
    const orderItems = orderItemIds.length
      ? await this.orderItemRepo.find({ where: { id: In(orderItemIds) } })
      : [];
    const orderItemById = new Map(orderItems.map((i) => [Number(i.id), i]));

    const productIds = [...new Set(entries.map((r) => Number(r.product_id)))];
    const productMap = await this.stockHttpService.getProductsByIds(productIds);

    // Grupare pe document: rândurile aprobate împreună din același lot de recepție.
    const groups = new Map<string, SupplierOrderItemReception[]>();
    for (const reception of entries) {
      const key = this.documentKey(reception);
      const bucket = groups.get(key);
      if (bucket) bucket.push(reception);
      else groups.set(key, [reception]);
    }

    let totalItems = 0;
    let skippedWithoutMappingFields = 0;
    const rows: EntryDocumentRow[] = [];

    for (const [sourceBatchId, group] of groups) {
      const first = group[0];
      const order = orderById.get(Number(first.supplier_order_id));
      // Fără (company_id, location_id) App2 nu poate rezolva tenant-ul și zona.
      if (!order?.company_id || !order?.location_id) {
        skippedWithoutMappingFields += 1;
        continue;
      }

      const items: EntryDocumentItem[] = group.map((reception) => {
        const productInfo = productMap.get(Number(reception.product_id));
        const orderItem = orderItemById.get(Number(reception.supplier_order_item_id));
        totalItems += 1;
        return {
          source_reception_id: Number(reception.id),
          product_id: Number(reception.product_id),
          product_name: productInfo?.name || `Produs ${reception.product_id}`,
          sku: productInfo?.sku ?? null,
          unit: productInfo?.unit ?? null,
          // net_quantity lipsește doar pe recepțiile aprobate înainte de această versiune;
          // acolo cantitatea brută este cea mai bună aproximare disponibilă.
          quantity:
            reception.net_quantity != null
              ? Number(reception.net_quantity)
              : Number(reception.received_delta) || 0,
          unit_price: Number(orderItem?.price_per_unit) || 0,
        };
      });

      rows.push({
        source_batch_id: sourceBatchId,
        source_order_id: Number(order.id),
        company_id: Number(order.company_id),
        location_id: Number(order.location_id),
        supplier_source_id: order.supplier_id != null ? Number(order.supplier_id) : null,
        supplier_name: order.supplier?.supplier_name || `Furnizor #${order.supplier_id}`,
        reception_date: this.toIso(first.occurred_at),
        approved_at: this.toIso(first.approved_at ?? first.occurred_at),
        notes: order.notes ?? null,
        items,
      });
    }

    return { rows, totalItems, skippedWithoutMappingFields };
  }

  /**
   * Cheia documentului, stabilă între rulări ca upsert-ul din App2 să nu dubleze nimic.
   * Include `approved_at` fiindcă un lot de recepție poate fi aprobat în tranșe, fiecare
   * tranșă fiind un document de intrare distinct.
   */
  private documentKey(reception: SupplierOrderItemReception): string {
    const approvedAt = reception.approved_at
      ? new Date(reception.approved_at).getTime()
      : new Date(reception.occurred_at).getTime();
    const batch = reception.reception_batch_id?.trim();
    return batch ? `${batch}:${approvedAt}` : `legacy-reception-${reception.id}`;
  }

  private toIso(value: Date | string): string {
    const parsed = value instanceof Date ? value : new Date(value);
    return parsed.toISOString();
  }
}
