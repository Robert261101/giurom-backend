import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { In, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Giurom2Zone } from './entities/giurom2-zone.entity';
import { zonesCatalogUrlFromKnown } from './giurom2-zones-url';

interface RemoteZone {
  id: number;
  name: string;
  code: string | null;
  is_default: boolean;
}

interface RemoteZonesResponse {
  company_id: number;
  location_id: number;
  default_zone_id: number | null;
  multi_zone_receiving: boolean;
  zones: RemoteZone[];
}

/**
 * Catalogul de gestiuni din giurom 2.0, pentru locațiile legate.
 *
 * App1 nu învață conceptul de gestiune: gestiunea e o etichetă opacă, aleasă pe linia de
 * comandă și cărată până la documentul de intrare. Stocul App1 rămâne general pe locație.
 *
 * Împrospătarea e **leneșă**: prima cerere după expirarea cache-ului aduce lista, iar orice
 * eșec de rețea lasă în urmă catalogul vechi în loc să rupă formularul de comandă. O locație
 * nelegată primește 404 de la App2 — atunci golim cache-ul ei, ca selectorul să dispară.
 */
@Injectable()
export class Giurom2ZonesService {
  private readonly logger = new Logger(Giurom2ZonesService.name);
  /** Cât timp e considerat proaspăt catalogul unei locații. */
  private static readonly CACHE_TTL_MS = 10 * 60 * 1000;
  /** Împrospătări în curs, ca zece cereri simultane să nu cheme App2 de zece ori. */
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(Giurom2Zone)
    private readonly zoneRepo: Repository<Giurom2Zone>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Gestiunile pe care le poate alege operatorul pentru o locație.
   * Listă goală = locație nelegată (sau canal oprit) — apelantul ascunde selectorul.
   */
  async listForLocation(companyId: number, locationId: number): Promise<Giurom2Zone[]> {
    if (!Number.isFinite(companyId) || !Number.isFinite(locationId)) return [];

    const cached = await this.readCache(companyId, locationId);
    const fresh =
      cached.length > 0 &&
      Date.now() - new Date(cached[0].synced_at).getTime() <
        Giurom2ZonesService.CACHE_TTL_MS;
    if (fresh) return cached;

    await this.refresh(companyId, locationId);
    return this.readCache(companyId, locationId);
  }

  /**
   * Gestiunile valide pentru o locație, ca set de id-uri. Folosit la validarea liniilor de
   * comandă: o gestiune din altă locație n-ar ajunge niciodată acolo fizic.
   */
  async allowedZoneIds(companyId: number, locationId: number): Promise<Set<number>> {
    const zones = await this.listForLocation(companyId, locationId);
    return new Set(zones.map((z) => Number(z.external_zone_id)));
  }

  /** Împrospătare forțată (buton din UI / după legarea unei locații). */
  async refresh(companyId: number, locationId: number): Promise<void> {
    const key = `${companyId}:${locationId}`;
    const running = this.inFlight.get(key);
    if (running) return running;

    const task = this.fetchAndStore(companyId, locationId).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, task);
    return task;
  }

  private readCache(companyId: number, locationId: number): Promise<Giurom2Zone[]> {
    return this.zoneRepo.find({
      where: { company_id: companyId, location_id: locationId },
      order: { is_default: 'DESC', name: 'ASC' },
    });
  }

  private async fetchAndStore(companyId: number, locationId: number): Promise<void> {
    const baseUrl = this.resolveZonesUrl();
    if (!baseUrl) {
      this.logger.warn(
        '[Giurom2Zones] Fără GIUROM2_ZONES_URL / GIUROM2_ENTRY_DOCUMENTS_SYNC_URL / GIUROM2_SUPPLIER_ORDER_SYNC_URL — catalogul nu se împrospătează.',
      );
      return;
    }

    const apiKey = this.configService.get<string>('GIUROM2_STOCK_SYNC_API_KEY') || '';
    let payload: RemoteZonesResponse;
    try {
      const response = await firstValueFrom(
        this.httpService.get<RemoteZonesResponse>(baseUrl, {
          params: { company_id: companyId, location_id: locationId },
          headers: { 'X-Stock-Sync-Key': apiKey },
        }),
      );
      payload = response.data;
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        // Locația nu (mai) e legată sau canalul de comenzi e oprit: catalogul ei nu mai are
        // sens, iar un selector rămas pe ecran ar promite o rutare care nu se întâmplă.
        await this.zoneRepo.delete({ company_id: companyId, location_id: locationId });
        return;
      }
      this.logger.warn(
        `⚠️ [Giurom2Zones] Nu am putut împrospăta gestiunile pentru locația ${locationId}: ` +
          `${(e as Error).message}. Rămâne catalogul din cache.`,
      );
      return;
    }

    const zones = Array.isArray(payload?.zones) ? payload.zones : [];
    const syncedAt = new Date();

    for (const zone of zones) {
      const externalId = Number(zone.id);
      if (!Number.isFinite(externalId)) continue;
      const existing = await this.zoneRepo.findOne({
        where: {
          company_id: companyId,
          location_id: locationId,
          external_zone_id: externalId,
        },
      });
      const row =
        existing ??
        this.zoneRepo.create({
          company_id: companyId,
          location_id: locationId,
          external_zone_id: externalId,
        });
      row.name = (zone.name || `Gestiune ${externalId}`).slice(0, 150);
      row.code = zone.code ?? null;
      row.is_default = zone.is_default ? 1 : 0;
      row.synced_at = syncedAt;
      await this.zoneRepo.save(row);
    }

    // Gestiunile dispărute din catalog se scot: altfel ar rămâne alegibile după ce App2 le-a
    // scos din setul locației, iar liniile ar cădea tăcut pe gestiunea implicită.
    const keep = zones.map((z) => Number(z.id)).filter((id) => Number.isFinite(id));
    const stale = await this.zoneRepo.find({
      where: { company_id: companyId, location_id: locationId },
    });
    const toRemove = stale.filter((row) => !keep.includes(Number(row.external_zone_id)));
    if (toRemove.length > 0) {
      await this.zoneRepo.delete({ id: In(toRemove.map((r) => r.id)) });
    }
  }

  /**
   * URL-ul catalogului. `GIUROM2_ZONES_URL` are prioritate; altfel îl deducem din URL-urile
   * deja setate (documente / comenzi). Păstrăm prefixul `/api` — fără el, stocul merge
   * (URL complet) iar selectorul de gestiune nu (404 pe `/integrations/...`).
   */
  private resolveZonesUrl(): string | null {
    const explicit = this.configService.get<string>('GIUROM2_ZONES_URL')?.trim();
    if (explicit) return explicit;

    const known =
      this.configService.get<string>('GIUROM2_ENTRY_DOCUMENTS_SYNC_URL')?.trim() ||
      this.configService.get<string>('GIUROM2_SUPPLIER_ORDER_SYNC_URL')?.trim();
    if (!known) return null;
    return zonesCatalogUrlFromKnown(known);
  }
}
