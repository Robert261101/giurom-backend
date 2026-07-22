import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Stock } from '../entities/stock.entity';

interface StockSyncItem {
  company_id: number;
  location_id: number;
  product_id: number;
  product_name: string;
  sku: string | null;
  unit: string;
  quantity: number;
}

export interface StockSyncResult {
  sent: number;
  synced?: number;
  unmapped_locations?: unknown[];
  unmapped_products?: unknown[];
}

@Injectable()
export class StockSyncCronService {
  private readonly logger = new Logger(StockSyncCronService.name);
  private static readonly MANUAL_SYNC_COOLDOWN_MS = 60 * 1000;
  private lastManualSyncAt = 0;

  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 */15 * * * *') // la fiecare 15 minute
  async handleStockSync() {
    this.logger.log(
      '📦 [StockSync] Starting scheduled stock sync to giurom 2.0...',
    );
    try {
      const result = await this.runSync();
      this.logSummary(result);
    } catch (error: any) {
      this.logger.error(
        `❌ [StockSync] Sync job failed: ${error?.message}`,
        error?.stack,
      );
    }
  }

  /**
   * Rulare manuală, pentru testare fără să aștepți cron-ul. Sincronizează stocul TUTUROR
   * companiilor (aceeași operație ca job-ul programat) — orice cont cu `stock.create` o poate
   * declanșa, deci limităm frecvența ca să nu poată fi folosită ca vector de abuz/DoS.
   */
  async runManualStockSync(): Promise<StockSyncResult> {
    const now = Date.now();
    const elapsed = now - this.lastManualSyncAt;
    if (elapsed < StockSyncCronService.MANUAL_SYNC_COOLDOWN_MS) {
      const waitSeconds = Math.ceil(
        (StockSyncCronService.MANUAL_SYNC_COOLDOWN_MS - elapsed) / 1000,
      );
      throw new BadRequestException(
        `Sincronizarea manuală a rulat recent — mai așteaptă ${waitSeconds}s.`,
      );
    }
    this.lastManualSyncAt = now;

    this.logger.log('🔧 [StockSync] Running manual stock sync...');
    const result = await this.runSync();
    this.logSummary(result);
    return result;
  }

  private logSummary(result: StockSyncResult) {
    this.logger.log(
      `✅ [StockSync] Sent ${result.sent} items — synced: ${result.synced ?? '?'}, ` +
        `unmapped locations: ${result.unmapped_locations?.length ?? 0}, ` +
        `unmapped products: ${result.unmapped_products?.length ?? 0}`,
    );
  }

  private async runSync(): Promise<StockSyncResult> {
    const rows = await this.stockRepository.find({ relations: ['product'] });
    const rowsWithLocation = rows.filter((r) => r.location_id != null);

    if (rowsWithLocation.length === 0) {
      this.logger.log('📦 [StockSync] No stock rows with a location to sync.');
      return { sent: 0 };
    }

    const distinctLocationIds = [
      ...new Set(rowsWithLocation.map((r) => r.location_id as number)),
    ];
    const companyIdByLocation =
      await this.resolveCompanyIds(distinctLocationIds);

    const items: StockSyncItem[] = [];
    for (const row of rowsWithLocation) {
      const locationId = row.location_id as number;
      const companyId = companyIdByLocation.get(locationId);
      if (companyId == null) {
        this.logger.warn(
          `⚠️ [StockSync] Skipping stock row ${row.id} — could not resolve company_id for location ${locationId}`,
        );
        continue;
      }
      items.push({
        company_id: companyId,
        location_id: locationId,
        product_id: row.product_id,
        product_name: row.product?.name || `Produs ${row.product_id}`,
        sku: row.product?.sku ?? null,
        unit: row.product?.unit || '',
        quantity: Number(row.quantity) || 0,
      });
    }

    if (items.length === 0) {
      this.logger.log('📦 [StockSync] No items resolved, nothing to send.');
      return { sent: 0 };
    }

    const targetUrl = this.configService.get<string>('GIUROM2_STOCK_SYNC_URL');
    if (!targetUrl) {
      this.logger.warn(
        '⚠️ [StockSync] GIUROM2_STOCK_SYNC_URL not set — skipping sync.',
      );
      return { sent: 0 };
    }
    const apiKey = this.configService.get<string>(
      'GIUROM2_STOCK_SYNC_API_KEY',
    );

    const response: any = await firstValueFrom(
      this.httpService.post(
        targetUrl,
        { items },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Stock-Sync-Key': apiKey || '',
          },
        },
      ),
    );

    const result = response?.data || {};
    return { sent: items.length, ...result };
  }

  /** Rezolvă company_id pentru fiecare location_id, apelând microserviciul `locations`. */
  private async resolveCompanyIds(
    locationIds: number[],
  ): Promise<Map<number, number>> {
    const locationsBaseUrl =
      this.configService.get<string>('LOCATIONS_HTTP_URL') ||
      'http://localhost:3004';
    const serviceSecret = process.env.SERVICE_SECRET || '';
    const headers = {
      'Content-Type': 'application/json',
      'x-internal-service': 'stock',
      'x-service-secret': serviceSecret,
    };

    const map = new Map<number, number>();
    for (const locationId of locationIds) {
      try {
        const res: any = await firstValueFrom(
          this.httpService.get(`${locationsBaseUrl}/locations/${locationId}`, {
            headers,
          }),
        );
        const companyId = res?.data?.company_id;
        if (companyId != null) {
          map.set(locationId, companyId);
        } else {
          this.logger.warn(
            `⚠️ [StockSync] location ${locationId} response has no company_id`,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `⚠️ [StockSync] Could not resolve company_id for location ${locationId}: ${err?.message}`,
        );
      }
    }
    return map;
  }
}
