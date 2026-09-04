import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Company } from './entity/company.entity';
import {
  CompanySubscriptionView,
  SubscriptionService,
} from './subscription.service';
import {
  daysLeftUntil,
  emptyPartnerSubscription,
  PartnerAccountInfo,
  PartnerEntry,
  PartnerSubscriptionInfo,
  PartnerSubscriptionResponse,
} from './partner-link.types';

/**
 * Abonamentul „celeilalte aplicații" (giurom 2.0 / RestoSoft), pe legăturile de locație.
 *
 * Legătura însăși e ținută în App2 — acolo se revendică codul generat din ecranul de
 * locație de aici — deci App1 nu poate ști singur ce firmă App2 îi corespunde. Ambele
 * direcții trec prin HTTP, cu cheia partajată de sincronizare:
 *
 *  - App2 întreabă „ce abonament are firma X la voi?" → `describeOwnSideForCompany`
 *  - Ecranul de abonament de aici întreabă „ce e pe partea App2?" → `fetchApp2SideForCompany`
 */
@Injectable()
export class PartnerLinkService {
  private readonly logger = new Logger(PartnerLinkService.name);
  private readonly authUrl: string;
  private readonly serviceSecret: string;

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly subscriptionService: SubscriptionService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.authUrl = (
      this.configService.get<string>('AUTH_SERVICE_URL') ||
      process.env.AUTH_SERVICE_URL ||
      'http://localhost:3021'
    ).replace(/\/+$/, '');
    this.serviceSecret =
      this.configService.get<string>('SERVICE_SECRET') ||
      process.env.SERVICE_SECRET ||
      '';
  }

  // ---------------------------------------------------------------------------
  // Partea App1, servită către App2
  // ---------------------------------------------------------------------------

  /**
   * Abonamentul și contul firmei din App1, pentru ecranul de abonament din App2.
   *
   * `locations` rămâne gol intenționat: abonamentul de aici e al firmei, nu al locației,
   * iar App2 știe deja ce locații are legate — el completează lista.
   */
  async describeOwnSideForCompany(
    companyId: number,
  ): Promise<PartnerSubscriptionResponse> {
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return { source: 'giurom-nou', partners: [], warning: null };
    }

    const company = await this.companyRepo.findOne({
      where: { id: companyId },
      select: ['id', 'company_name', 'email', 'status', 'company_type'],
    });
    if (!company) {
      return { source: 'giurom-nou', partners: [], warning: null };
    }

    const [account, subscription] = await Promise.all([
      this.describeAccount(company),
      this.describeSubscription(companyId),
    ]);

    return {
      source: 'giurom-nou',
      partners: [{ company_id: companyId, account, subscription, locations: [] }],
      warning: null,
    };
  }

  /**
   * Firma + contul cu care se loghează.
   *
   * `exists` = firma există în App1 (rândul din `companies`). Contul de autentificare
   * (email / admin) e opțional — o firmă legată doar pe locații tot e „cont existent"
   * ca firmă, chiar dacă nimeni nu s-a logat încă pe client-admin.
   */
  private async describeAccount(company: Company): Promise<PartnerAccountInfo> {
    const tenantAccount = await this.fetchTenantAccount(company.id);
    const companyEmail = (company.email || '').trim() || null;

    return {
      exists: true,
      name: (company.company_name || '').trim() || null,
      email: tenantAccount?.email || companyEmail,
      login: tenantAccount?.email || null,
      admin_name: tenantAccount?.name || null,
      status: (company.status || '').trim() || null,
    };
  }

  private async fetchTenantAccount(companyId: number): Promise<{
    exists: boolean;
    email: string | null;
    name: string | null;
  } | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.authUrl}/users/internal/company/${companyId}/tenant-account`,
          {
            headers: {
              'x-internal-service': 'company',
              'x-service-secret': this.serviceSecret,
            },
            timeout: 10000,
          },
        ),
      );
      const data = response?.data?.data ?? response?.data;
      if (!data) return null;
      return {
        exists: data.exists === true,
        email: data.email ?? null,
        name: data.name ?? null,
      };
    } catch (error) {
      this.logger.warn(
        `[PartnerLink] Nu am putut citi contul de tenant pentru firma ${companyId}: ${
          (error as Error).message
        }`,
      );
      return null;
    }
  }

  /** Abonamentul firmei, redus la contractul comun celor două aplicații. */
  private async describeSubscription(
    companyId: number,
  ): Promise<PartnerSubscriptionInfo> {
    let view: CompanySubscriptionView;
    try {
      view = await this.subscriptionService.getSubscriptionForCompany(companyId);
    } catch (error) {
      // Firmele furnizor n-au abonament client — nu e o eroare pentru apelant.
      this.logger.warn(
        `[PartnerLink] Fără abonament pentru firma ${companyId}: ${
          (error as Error).message
        }`,
      );
      return emptyPartnerSubscription();
    }

    const periodEnd = view.current_period_end ?? view.ends_at ?? null;
    // Planurile fără facturare (free) n-au dată de sfârșit — nu expiră niciodată, deci
    // nici nu au zile rămase de arătat.
    const expired = periodEnd ? new Date(periodEnd).getTime() <= Date.now() : false;

    return {
      exists: true,
      status: view.status ?? null,
      plan_code: view.plan?.code ?? null,
      plan_name: view.plan?.name ?? null,
      price: view.billing?.price ?? null,
      currency: view.billing?.currency ?? null,
      current_period_start: view.current_period_start ?? null,
      current_period_end: periodEnd,
      paid_until: periodEnd,
      days_left: view.period?.days_remaining ?? daysLeftUntil(periodEnd),
      expired,
    };
  }

  // ---------------------------------------------------------------------------
  // Partea App2, citită de ecranul de abonament din App1
  // ---------------------------------------------------------------------------

  /**
   * Abonamentul App2 al locațiilor legate ale firmei.
   *
   * `companyId` vine din JWT (vezi controller) — nu din query: altfel un tenant ar
   * putea citi abonamentul App2 al altuia. App2 răspunde doar dacă există legături
   * de locație pentru acel `company_id`; fără legătură lista e goală, fără date.
   *
   * Când App2 nu răspunde întoarcem un `warning`, nu o eroare: ecranul de abonament al
   * firmei nu trebuie să pice fiindcă cealaltă aplicație e jos.
   */
  async fetchApp2SideForCompany(
    companyId: number,
  ): Promise<PartnerSubscriptionResponse> {
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return { source: 'giurom2', partners: [], warning: null };
    }

    const base = this.app2PartnerUrl();
    if (!base) {
      return {
        source: 'giurom2',
        partners: [],
        warning:
          'Legătura cu aplicația 2 nu e configurată pe server (GIUROM2_PARTNER_SUBSCRIPTION_URL).',
      };
    }

    const apiKey = (
      this.configService.get<string>('GIUROM2_STOCK_SYNC_API_KEY') ||
      process.env.GIUROM2_STOCK_SYNC_API_KEY ||
      ''
    ).trim();
    if (!apiKey) {
      return {
        source: 'giurom2',
        partners: [],
        warning:
          'Legătura cu aplicația 2 nu e configurată pe server (GIUROM2_STOCK_SYNC_API_KEY).',
      };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(base, {
          headers: { 'X-Stock-Sync-Key': apiKey },
          params: { company_id: companyId },
          timeout: 10000,
        }),
      );
      const body = response?.data as Partial<PartnerSubscriptionResponse> | null;
      // Nu afișăm ce vine „în plus": App2 trebuie să răspundă doar pentru company_id-ul
      // cerut; filtrăm local ca o greșeală sau un răspuns compromis să nu scurgă altceva.
      const partners = (
        Array.isArray(body?.partners) ? (body.partners as PartnerEntry[]) : []
      ).filter((p) => Number(p?.company_id) === companyId);

      return {
        source: 'giurom2',
        partners,
        warning: body?.warning ?? null,
      };
    } catch (error) {
      this.logger.warn(
        `[PartnerLink] App2 indisponibil pentru firma ${companyId}: ${
          (error as Error).message
        }`,
      );
      return {
        source: 'giurom2',
        partners: [],
        warning: 'Aplicația 2 nu a răspuns — abonamentul de acolo nu poate fi afișat.',
      };
    }
  }

  /**
   * URL-ul endpoint-ului de abonament din App2.
   *
   * Dacă lipsește variabila dedicată, îl derivăm din celelalte URL-uri App2
   * (aceeași origine: restosoft.ro). Path-ul public e sub `/api/integrations/...`.
   */
  private app2PartnerUrl(): string {
    const explicit = (
      this.configService.get<string>('GIUROM2_PARTNER_SUBSCRIPTION_URL') ||
      process.env.GIUROM2_PARTNER_SUBSCRIPTION_URL ||
      ''
    ).trim();
    if (explicit) return explicit;

    const siblings = [
      'GIUROM2_STOCK_SYNC_URL',
      'GIUROM2_WASTE_SYNC_URL',
    ];
    for (const key of siblings) {
      const raw = (
        this.configService.get<string>(key) ||
        process.env[key] ||
        ''
      ).trim();
      if (!raw) continue;
      try {
        const origin = new URL(raw).origin;
        return `${origin}/api/integrations/partner-link/subscription`;
      } catch {
        /* URL invalid — încercăm următorul */
      }
    }
    return '';
  }
}
