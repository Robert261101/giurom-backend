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
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { WasteRequest } from './entities/waste-request.entity';
import { Product } from './entities/product.entity';

interface WasteRequestRow {
  source_request_id: number;
  company_id: number;
  location_id: number;
  location_name: string | null;
  product_id: number | null;
  product_name: string | null;
  recipe_preparation_id: number | null;
  quantity: number;
  unit: string;
  reason: string | null;
  photos: string[];
  status: 'pending' | 'approved' | 'rejected';
  requested_by: number | null;
  created_at: string;
}

interface LocationMeta {
  companyId: number;
  locationName: string | null;
}

export interface WasteExportResult {
  sent: number;
  imported?: number;
  updated?: number;
  unmapped_locations?: unknown[];
}

/**
 * Exportă cererile de aruncare către giurom 2.0, unde managerul le acceptă sau le respinge.
 *
 * Decizia se ia acolo, dar se **execută aici** (vezi app2-waste.controller.ts): aprobarea
 * consumă stocul, iar cantitatea se întoarce în giurom 2.0 prin snapshot-ul de stoc, ca
 * orice altă mișcare. Așa rămâne un singur scriitor pe cantitate.
 *
 * Trimitem cererile în toate stările, nu doar `pending`: giurom 2.0 trebuie să vadă și
 * istoricul, și rezolvările făcute direct de aici — altfel o cerere aprobată în RestoSoft.eu
 * ar rămâne veșnic „de acceptat" acolo.
 */
@Injectable()
export class WasteExportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WasteExportService.name);
  private static readonly MANUAL_EXPORT_COOLDOWN_MS = 60 * 1000;
  private static readonly SAFETY_NET_INTERVAL_MS = 5 * 60 * 1000;
  /** Fereastra retrimisă periodic — upsert-ul din App2 e idempotent pe `source_request_id`. */
  private static readonly SAFETY_NET_LOOKBACK_DAYS = 14;
  private lastManualExportAt = 0;
  private safetyNetTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(WasteRequest)
    private readonly wasteRequestRepo: Repository<WasteRequest>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.safetyNetTimer = setInterval(() => {
      void this.handleSafetyNetExport();
    }, WasteExportService.SAFETY_NET_INTERVAL_MS);
    this.safetyNetTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.safetyNetTimer) clearInterval(this.safetyNetTimer);
  }

  /**
   * Împinge o cerere imediat după creare sau după o decizie luată aici.
   * Nu aruncă: crearea cererii nu trebuie să eșueze fiindcă giurom 2.0 e indisponibil.
   */
  async pushRequestSafe(requestId: number): Promise<void> {
    try {
      const request = await this.wasteRequestRepo.findOne({ where: { id: requestId } });
      if (!request) return;
      const result = await this.exportRequests([request]);
      if (result.sent > 0) {
        this.logger.log(
          `🗑️ [WasteExport] Cererea ${requestId} trimisă către giurom 2.0.`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `⚠️ [WasteExport] Push imediat eșuat pentru cererea ${requestId}: ` +
          `${(e as Error).message}. Va fi reluată de plasa de siguranță.`,
      );
    }
  }

  /** Retrimite pending-urile (orice vechime) + cererile recente pe toate stările. */
  async handleSafetyNetExport(): Promise<void> {
    try {
      const requests = await this.loadExportCandidates();
      const result = await this.exportRequests(requests);
      if (result.sent > 0) {
        this.logger.log(
          `🗑️ [WasteExport] Plasă de siguranță: ${result.sent} cereri retrimise.`,
        );
      }
    } catch (e) {
      this.logger.error(`❌ [WasteExport] Export periodic eșuat: ${(e as Error).message}`);
    }
  }

  async runManualExport(): Promise<WasteExportResult> {
    const now = Date.now();
    const elapsed = now - this.lastManualExportAt;
    if (elapsed < WasteExportService.MANUAL_EXPORT_COOLDOWN_MS) {
      const waitSeconds = Math.ceil(
        (WasteExportService.MANUAL_EXPORT_COOLDOWN_MS - elapsed) / 1000,
      );
      throw new BadRequestException(
        `Exportul manual a rulat recent — mai așteaptă ${waitSeconds}s.`,
      );
    }
    this.lastManualExportAt = now;

    const requests = await this.loadExportCandidates();
    const result = await this.exportRequests(requests);
    this.logger.log(
      `✅ [WasteExport] Export manual: ${result.sent} trimise — noi: ${result.imported ?? '?'}, ` +
        `actualizate: ${result.updated ?? '?'}, locații nemapate: ${result.unmapped_locations?.length ?? 0}`,
    );
    return result;
  }

  /**
   * Pending-urile pot sta luni în așteptare — fereastra de 14 zile le sărea pe toate
   * (ex. 260 cereri din iunie, refresh în august → sent=0). Le includem mereu.
   * Pentru istoric (approved/rejected) rămâne lookback-ul scurt.
   */
  private async loadExportCandidates(): Promise<WasteRequest[]> {
    const pending = await this.wasteRequestRepo.find({
      where: { status: 'pending' },
    });

    const since = new Date();
    since.setDate(since.getDate() - WasteExportService.SAFETY_NET_LOOKBACK_DAYS);
    const recent = await this.wasteRequestRepo.find({
      where: { created_at: MoreThanOrEqual(since) },
    });

    const byId = new Map<number, WasteRequest>();
    for (const row of [...pending, ...recent]) {
      byId.set(Number(row.id), row);
    }
    return [...byId.values()];
  }

  private async exportRequests(requests: WasteRequest[]): Promise<WasteExportResult> {
    const withLocation = requests.filter((r) => r.location_id != null);
    if (withLocation.length === 0) return { sent: 0 };

    const distinctLocationIds = [
      ...new Set(withLocation.map((r) => Number(r.location_id))),
    ];
    const metaByLocation = await this.resolveLocationMeta(distinctLocationIds);

    const productIds = [
      ...new Set(
        withLocation
          .map((r) => Number(r.product_id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    const products = productIds.length
      ? await this.productRepo.find({ where: { id: In(productIds) } })
      : [];
    const productById = new Map(products.map((p) => [Number(p.id), p]));

    const rows: WasteRequestRow[] = [];
    for (const request of withLocation) {
      const locationId = Number(request.location_id);
      const meta = metaByLocation.get(locationId);
      if (meta == null) continue;

      const product =
        request.product_id != null ? productById.get(Number(request.product_id)) : undefined;

      rows.push({
        source_request_id: Number(request.id),
        company_id: meta.companyId,
        location_id: locationId,
        location_name: meta.locationName,
        product_id: request.product_id != null ? Number(request.product_id) : null,
        product_name:
          product?.name ??
          (request.recipe_preparation_id != null
            ? `Preparat #${request.recipe_preparation_id}`
            : null),
        recipe_preparation_id:
          request.recipe_preparation_id != null ? Number(request.recipe_preparation_id) : null,
        quantity: Number(request.quantity) || 0,
        unit: (request.unit || product?.unit || 'buc').trim(),
        reason: request.reason ?? null,
        photos: Array.isArray(request.photos) ? request.photos : [],
        status: request.status,
        requested_by: request.created_by != null ? Number(request.created_by) : null,
        created_at: this.toIso(request.created_at),
      });
    }

    if (rows.length === 0) return { sent: 0 };

    const targetUrl = this.configService.get<string>('GIUROM2_WASTE_SYNC_URL');
    if (!targetUrl) {
      this.logger.warn(
        '⚠️ [WasteExport] GIUROM2_WASTE_SYNC_URL nu e setat — cererile nu au fost trimise.',
      );
      return { sent: 0 };
    }
    const apiKey = this.configService.get<string>('GIUROM2_STOCK_SYNC_API_KEY') || '';

    const response: any = await firstValueFrom(
      this.httpService.post(
        targetUrl,
        { requests: rows },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Stock-Sync-Key': apiKey,
          },
        },
      ),
    );

    return { sent: rows.length, ...(response?.data || {}) };
  }

  private toIso(value: Date | string): string {
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime())
      ? new Date().toISOString()
      : parsed.toISOString();
  }

  /** Rezolvă company_id + nume pentru fiecare location_id (același tipar ca la stock-sync). */
  private async resolveLocationMeta(
    locationIds: number[],
  ): Promise<Map<number, LocationMeta>> {
    const locationsBaseUrl =
      this.configService.get<string>('LOCATIONS_HTTP_URL') || 'http://localhost:3004';
    const headers = {
      'Content-Type': 'application/json',
      'x-internal-service': 'stock',
      'x-service-secret': process.env.SERVICE_SECRET || '',
    };

    const map = new Map<number, LocationMeta>();
    for (const locationId of locationIds) {
      try {
        const res: any = await firstValueFrom(
          this.httpService.get(`${locationsBaseUrl}/locations/${locationId}`, { headers }),
        );
        const data = res?.data;
        const companyId = data?.company_id;
        if (companyId == null) continue;
        const rawName = data?.location_name ?? data?.locationName ?? data?.name ?? null;
        map.set(locationId, {
          companyId: Number(companyId),
          locationName:
            typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null,
        });
      } catch (err: any) {
        this.logger.warn(
          `⚠️ [WasteExport] Nu am putut rezolva locația ${locationId}: ${err?.message}`,
        );
      }
    }
    return map;
  }
}
