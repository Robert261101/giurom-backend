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
  skipped_channel?: number;
  skipped_no_zone?: number;
  unmapped_locations?: unknown[];
  /** Diagnostice pentru UI / log — de ce a trimis 0. */
  diagnostics?: WasteExportDiagnostics;
}

export interface WasteExportDiagnostics {
  pendingInDb: number;
  recentInDb: number;
  candidates: number;
  withLocation: number;
  locationsResolved: number;
  locationsFailed: number;
  rowsBuilt: number;
  targetUrlConfigured: boolean;
  targetUrlHost: string | null;
  pushError: string | null;
  cooldown: boolean;
  waitSeconds: number;
  codeVersion: string;
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
  /** Marker clar în loguri — dacă lipsește după deploy, rulează încă build-ul vechi. */
  private static readonly CODE_VERSION = 'waste-export-pending-all-v3';
  private static readonly MANUAL_EXPORT_COOLDOWN_MS = 15 * 1000;
  private static readonly SAFETY_NET_INTERVAL_MS = 5 * 60 * 1000;
  /** Fereastra retrimisă pentru approved/rejected — pending-urile merg oricum, orice vechime. */
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
    const targetUrl = this.configService.get<string>('GIUROM2_WASTE_SYNC_URL')?.trim() || '';
    this.logger.log(
      `🗑️ [WasteExport] Pornit ${WasteExportService.CODE_VERSION} — ` +
        `GIUROM2_WASTE_SYNC_URL=${targetUrl ? this.hostOf(targetUrl) : 'LIPSĂ'}`,
    );
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
      } else {
        this.logger.warn(
          `⚠️ [WasteExport] Cererea ${requestId} NU a fost trimisă — ` +
            JSON.stringify(result.diagnostics ?? {}),
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
      this.logger.log(`🗑️ [WasteExport] Plasă de siguranță pornită (${WasteExportService.CODE_VERSION})`);
      const { requests, pendingInDb, recentInDb } = await this.loadExportCandidates();
      const result = await this.exportRequests(requests, { pendingInDb, recentInDb });
      this.logger.log(
        `🗑️ [WasteExport] Plasă de siguranță gata: sent=${result.sent} ` +
          `pendingInDb=${pendingInDb} diag=${JSON.stringify(result.diagnostics ?? {})}`,
      );
    } catch (e) {
      this.logger.error(`❌ [WasteExport] Export periodic eșuat: ${(e as Error).message}`);
    }
  }

  async runManualExport(): Promise<WasteExportResult> {
    this.logger.log(
      `🔔 [WasteExport] REFRESH manual primit de la giurom 2.0 (${WasteExportService.CODE_VERSION})`,
    );

    const now = Date.now();
    const elapsed = now - this.lastManualExportAt;
    if (elapsed < WasteExportService.MANUAL_EXPORT_COOLDOWN_MS) {
      const waitSeconds = Math.ceil(
        (WasteExportService.MANUAL_EXPORT_COOLDOWN_MS - elapsed) / 1000,
      );
      const pendingInDb = await this.wasteRequestRepo.count({
        where: { status: 'pending' },
      });
      this.logger.warn(
        `⏳ [WasteExport] Cooldown ${waitSeconds}s — pe DB sunt ${pendingInDb} pending. ` +
          `Nu re-trimit acum; reîncearcă după cooldown.`,
      );
      // Nu aruncăm 400 opace: App2 poate arăta câte pending există pe .eu.
      return {
        sent: 0,
        diagnostics: {
          pendingInDb,
          recentInDb: 0,
          candidates: 0,
          withLocation: 0,
          locationsResolved: 0,
          locationsFailed: 0,
          rowsBuilt: 0,
          targetUrlConfigured: Boolean(
            this.configService.get<string>('GIUROM2_WASTE_SYNC_URL')?.trim(),
          ),
          targetUrlHost: this.hostOf(
            this.configService.get<string>('GIUROM2_WASTE_SYNC_URL')?.trim() || '',
          ),
          pushError: null,
          cooldown: true,
          waitSeconds,
          codeVersion: WasteExportService.CODE_VERSION,
        },
      };
    }
    this.lastManualExportAt = now;

    const { requests, pendingInDb, recentInDb } = await this.loadExportCandidates();
    this.logger.log(
      `🗑️ [WasteExport] Candidați: ${requests.length} (pending=${pendingInDb}, recent=${recentInDb})`,
    );

    const result = await this.exportRequests(requests, { pendingInDb, recentInDb });
    this.logger.log(
      `✅ [WasteExport] Export manual gata: sent=${result.sent} — ` +
        `imported=${result.imported ?? '?'}, updated=${result.updated ?? '?'}, ` +
        `unmapped=${result.unmapped_locations?.length ?? 0}, ` +
        `diag=${JSON.stringify(result.diagnostics ?? {})}`,
    );
    return result;
  }

  /**
   * Pending-urile pot sta luni în așteptare — fereastra de 14 zile le sărea pe toate
   * (ex. 260 cereri din iunie, refresh în august → sent=0). Le includem mereu.
   * Pentru istoric (approved/rejected) rămâne lookback-ul scurt.
   */
  private async loadExportCandidates(): Promise<{
    requests: WasteRequest[];
    pendingInDb: number;
    recentInDb: number;
  }> {
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
    return {
      requests: [...byId.values()],
      pendingInDb: pending.length,
      recentInDb: recent.length,
    };
  }

  private async exportRequests(
    requests: WasteRequest[],
    counts?: { pendingInDb: number; recentInDb: number },
  ): Promise<WasteExportResult> {
    const pendingInDb = counts?.pendingInDb ?? 0;
    const recentInDb = counts?.recentInDb ?? 0;
    const targetUrl = this.configService.get<string>('GIUROM2_WASTE_SYNC_URL')?.trim() || '';
    const baseDiag: WasteExportDiagnostics = {
      pendingInDb,
      recentInDb,
      candidates: requests.length,
      withLocation: 0,
      locationsResolved: 0,
      locationsFailed: 0,
      rowsBuilt: 0,
      targetUrlConfigured: Boolean(targetUrl),
      targetUrlHost: this.hostOf(targetUrl),
      pushError: null,
      cooldown: false,
      waitSeconds: 0,
      codeVersion: WasteExportService.CODE_VERSION,
    };

    const withLocation = requests.filter((r) => r.location_id != null);
    baseDiag.withLocation = withLocation.length;
    if (withLocation.length === 0) {
      this.logger.warn(
        `⚠️ [WasteExport] 0 cereri cu location_id (candidates=${requests.length}, pendingInDb=${pendingInDb})`,
      );
      return { sent: 0, diagnostics: baseDiag };
    }

    const distinctLocationIds = [
      ...new Set(withLocation.map((r) => Number(r.location_id))),
    ];
    const metaByLocation = await this.resolveLocationMeta(distinctLocationIds);
    baseDiag.locationsResolved = metaByLocation.size;
    baseDiag.locationsFailed = distinctLocationIds.length - metaByLocation.size;
    if (baseDiag.locationsFailed > 0) {
      this.logger.warn(
        `⚠️ [WasteExport] Locații nerezolvate: ${baseDiag.locationsFailed}/${distinctLocationIds.length} ` +
          `(ids: ${distinctLocationIds.filter((id) => !metaByLocation.has(id)).join(',')})`,
      );
    }

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

    baseDiag.rowsBuilt = rows.length;
    if (rows.length === 0) {
      this.logger.warn(
        `⚠️ [WasteExport] 0 rows după rezolvare locații (withLocation=${withLocation.length})`,
      );
      return { sent: 0, diagnostics: baseDiag };
    }

    if (!targetUrl) {
      this.logger.error(
        '❌ [WasteExport] GIUROM2_WASTE_SYNC_URL nu e setat pe stock-ms — cererile NU pleacă spre App2.',
      );
      baseDiag.pushError = 'GIUROM2_WASTE_SYNC_URL lipsă';
      return { sent: 0, diagnostics: baseDiag };
    }

    const apiKey = this.configService.get<string>('GIUROM2_STOCK_SYNC_API_KEY') || '';
    this.logger.log(
      `🗑️ [WasteExport] POST ${rows.length} cereri → ${this.hostOf(targetUrl)} ` +
        `(apiKey=${apiKey ? 'set' : 'LIPSĂ'})`,
    );

    try {
      const response: any = await firstValueFrom(
        this.httpService.post(
          targetUrl,
          { requests: rows },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Stock-Sync-Key': apiKey,
            },
            timeout: 120_000,
          },
        ),
      );

      const data = (response?.data || {}) as WasteExportResult;
      this.logger.log(
        `🗑️ [WasteExport] App2 a răspuns OK: imported=${data.imported ?? '?'}, ` +
          `updated=${data.updated ?? '?'}, skipped_channel=${data.skipped_channel ?? '?'}, ` +
          `skipped_no_zone=${data.skipped_no_zone ?? '?'}, ` +
          `unmapped=${Array.isArray(data.unmapped_locations) ? data.unmapped_locations.length : 0}`,
      );
      return { ...data, sent: rows.length, diagnostics: baseDiag };
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      const msg =
        (typeof body?.message === 'string' && body.message) ||
        err?.message ||
        'push failed';
      baseDiag.pushError = `HTTP ${status ?? '?'}: ${msg}`;
      this.logger.error(
        `❌ [WasteExport] Push către App2 a eșuat: ${baseDiag.pushError} ` +
          `body=${typeof body === 'object' ? JSON.stringify(body).slice(0, 500) : String(body ?? '')}`,
      );
      // Nu ascundem eșecul în spatele lui sent=0 — App2 trebuie să vadă cauza.
      throw new BadRequestException(
        `Nu am putut trimite cererile către giurom 2.0: ${baseDiag.pushError}`,
      );
    }
  }

  private hostOf(url: string): string | null {
    if (!url) return null;
    try {
      return new URL(url).host;
    } catch {
      return url.slice(0, 80);
    }
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
        if (companyId == null) {
          this.logger.warn(
            `⚠️ [WasteExport] Locația ${locationId} fără company_id în locations-ms`,
          );
          continue;
        }
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
