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
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Employee } from './entities/employee.entity';

interface EmployeeSyncItem {
  company_id: number;
  location_id: number;
  location_name: string | null;
  source_employee_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  hire_date: string | null;
  is_active: boolean;
  /** Sumă puncte sarcini pe luna curentă (per locație), din veziv-tasks. */
  month_points?: number | null;
  /** Eficiență sarcini 0–100 pe luna curentă; null dacă tasks e indisponibil. */
  kpi_efficiency?: number | null;
}

interface LocationMeta {
  companyId: number;
  locationName: string | null;
}

export interface EmployeesExportResult {
  sent: number;
  updated?: number;
  pending?: number;
  deactivated?: number;
  unmapped_locations?: unknown[];
}

/**
 * Exportă angajații către giurom 2.0, grupați pe locație.
 *
 * Ce NU pleacă de aici, deliberat: CNP (`personal_number`), adresa, data nașterii, parolele.
 * App2 are nevoie doar de cine e persoana și dacă mai lucrează — restul rămâne în evidența HR
 * de aici, iar trimiterea lor ar lărgi degeaba amprenta de date personale.
 *
 * Snapshot complet, ca la stocuri: un batch pierdut nu strică nimic, următorul repară.
 * Nu e nevoie de outbox — identitatea are un singur scriitor (aici), iar App2 doar oglindește.
 */
@Injectable()
export class EmployeesExportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmployeesExportService.name);
  private static readonly MANUAL_EXPORT_COOLDOWN_MS = 60 * 1000;
  private static readonly SNAPSHOT_INTERVAL_MS = 15 * 60 * 1000;
  private lastManualExportAt = 0;
  private snapshotTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Snapshot periodic pe `setInterval`, nu pe `@Cron`: `@nestjs/schedule` nu e instalat în
   * acest microserviciu, iar o dependență nouă într-un serviciu deja deployat nu se
   * justifică pentru un singur job periodic (același tipar ca la documentele de intrare).
   */
  onModuleInit(): void {
    this.snapshotTimer = setInterval(() => {
      void this.runSnapshotSafe();
    }, EmployeesExportService.SNAPSHOT_INTERVAL_MS);
    // Nu ține procesul în viață doar pentru acest timer.
    this.snapshotTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
  }

  private async runSnapshotSafe(): Promise<void> {
    try {
      const result = await this.runExport();
      if (result.sent > 0) {
        this.logSummary(result);
      }
    } catch (e) {
      this.logger.error(`❌ [EmployeesExport] Snapshot eșuat: ${(e as Error).message}`);
    }
  }

  /**
   * Împinge un singur angajat imediat după create/update/toggle-active.
   * Nu aruncă niciodată: acțiunea de HR nu trebuie să eșueze fiindcă App2 e indisponibil —
   * snapshot-ul de la 15 minute îl reia oricum.
   */
  async pushEmployeeSafe(employeeId: number): Promise<void> {
    try {
      const employee = await this.employeeRepository.findOne({
        where: { id: employeeId },
        relations: ['employeeLocations'],
      });
      if (!employee) return;
      const result = await this.exportEmployees([employee]);
      if (result.sent > 0) {
        this.logger.log(
          `👤 [EmployeesExport] Angajat ${employeeId} trimis către giurom 2.0 ` +
            `(${result.sent} locații).`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `⚠️ [EmployeesExport] Push imediat eșuat pentru angajatul ${employeeId}: ` +
          `${(e as Error).message}. Va fi reluat de snapshot.`,
      );
    }
  }

  /** Export manual din UI, limitat ca frecvență ca să nu poată fi folosit ca vector de abuz. */
  async runManualExport(): Promise<EmployeesExportResult> {
    const now = Date.now();
    const elapsed = now - this.lastManualExportAt;
    if (elapsed < EmployeesExportService.MANUAL_EXPORT_COOLDOWN_MS) {
      const waitSeconds = Math.ceil(
        (EmployeesExportService.MANUAL_EXPORT_COOLDOWN_MS - elapsed) / 1000,
      );
      throw new BadRequestException(
        `Exportul manual a rulat recent — mai așteaptă ${waitSeconds}s.`,
      );
    }
    this.lastManualExportAt = now;

    this.logger.log('🔧 [EmployeesExport] Export manual...');
    const result = await this.runExport();
    this.logSummary(result);
    return result;
  }

  private logSummary(result: EmployeesExportResult): void {
    this.logger.log(
      `✅ [EmployeesExport] Trimise ${result.sent} rânduri — actualizați: ${result.updated ?? '?'}, ` +
        `de asociat: ${result.pending ?? '?'}, dezactivați: ${result.deactivated ?? 0}, ` +
        `locații nemapate: ${result.unmapped_locations?.length ?? 0}`,
    );
  }

  private async runExport(): Promise<EmployeesExportResult> {
    const employees = await this.employeeRepository.find({
      relations: ['employeeLocations'],
    });
    return this.exportEmployees(employees);
  }

  private async exportEmployees(
    employees: Employee[],
  ): Promise<EmployeesExportResult> {
    if (employees.length === 0) return { sent: 0 };

    // Un angajat poate fi pe mai multe locații (employees_locations e N:M, plus locația
    // implicită). Trimitem o linie per (angajat, locație) și lăsăm App2 să deduplice —
    // el e cel care știe care locații sunt legate de un tenant.
    const pairs: Array<{ employee: Employee; locationId: number }> = [];
    for (const employee of employees) {
      for (const locationId of this.locationIdsOf(employee)) {
        pairs.push({ employee, locationId });
      }
    }
    if (pairs.length === 0) {
      this.logger.log('👥 [EmployeesExport] Niciun angajat cu locație de trimis.');
      return { sent: 0 };
    }

    const distinctLocationIds = [...new Set(pairs.map((p) => p.locationId))];
    const metaByLocation = await this.resolveLocationMeta(distinctLocationIds);
    const { startDate, endDate } = this.currentMonthRange();
    const pointsByLocation = await this.fetchMonthPointsByLocation(
      distinctLocationIds,
      startDate,
      endDate,
    );
    const distinctEmployeeIds = [
      ...new Set(pairs.map((p) => Number(p.employee.id)).filter((id) => id > 0)),
    ];
    const efficiencyByEmployee = await this.fetchEfficiencyByEmployee(
      distinctEmployeeIds,
      startDate,
      endDate,
    );

    const items: EmployeeSyncItem[] = [];
    for (const { employee, locationId } of pairs) {
      const meta = metaByLocation.get(locationId);
      if (meta == null) {
        // Fără company_id, App2 nu poate rezolva tenantul — linia n-ar avea unde ateriza.
        continue;
      }
      const employeeId = Number(employee.id);
      const locationPoints = pointsByLocation.get(locationId);
      const monthPoints = locationPoints?.get(employeeId);
      items.push({
        company_id: meta.companyId,
        location_id: locationId,
        location_name: meta.locationName,
        source_employee_id: employeeId,
        first_name: (employee.first_name || '').trim(),
        last_name: (employee.last_name || '').trim(),
        email: this.orNull(employee.email),
        phone: this.orNull(employee.phone),
        hire_date: this.toIsoDate(employee.hire_date),
        // Un angajat cu dată de încetare în trecut e inactiv, chiar dacă flagul a rămas pe
        // true — altfel contul din App2 ar rămâne deschis după plecarea omului.
        is_active: this.isActive(employee),
        month_points: monthPoints ?? 0,
        kpi_efficiency: efficiencyByEmployee.get(employeeId) ?? null,
      });
    }

    if (items.length === 0) {
      this.logger.log('👥 [EmployeesExport] Nicio locație rezolvată, nimic de trimis.');
      return { sent: 0 };
    }

    const targetUrl = this.configService.get<string>('GIUROM2_EMPLOYEE_SYNC_URL');
    if (!targetUrl) {
      this.logger.warn(
        '⚠️ [EmployeesExport] GIUROM2_EMPLOYEE_SYNC_URL nu e setat — exportul nu a fost trimis.',
      );
      return { sent: 0 };
    }
    const apiKey = this.configService.get<string>('GIUROM2_STOCK_SYNC_API_KEY') || '';

    const response: any = await firstValueFrom(
      this.httpService.post(
        targetUrl,
        { items },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Stock-Sync-Key': apiKey,
          },
        },
      ),
    );

    return { sent: items.length, ...(response?.data || {}) };
  }

  /** Locația implicită + toate asocierile din `employees_locations`, fără duplicate. */
  private locationIdsOf(employee: Employee): number[] {
    const ids = new Set<number>();
    const fallback = Number(employee.work_location_default_id);
    if (Number.isFinite(fallback) && fallback > 0) ids.add(fallback);
    for (const link of employee.employeeLocations ?? []) {
      const id = Number(link?.idLocation);
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
    return [...ids];
  }

  private isActive(employee: Employee): boolean {
    if (employee.is_active === false) return false;
    if (!employee.termination_date) return true;
    const termination = new Date(employee.termination_date);
    if (Number.isNaN(termination.getTime())) return true;
    return termination.getTime() > Date.now();
  }

  private orNull(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed || null;
  }

  private toIsoDate(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  /** Rezolvă company_id + nume pentru fiecare location_id (același tipar ca la stock-sync). */
  private async resolveLocationMeta(
    locationIds: number[],
  ): Promise<Map<number, LocationMeta>> {
    const locationsBaseUrl =
      this.configService.get<string>('LOCATIONS_HTTP_URL') || 'http://localhost:3004';
    const headers = {
      'Content-Type': 'application/json',
      'x-internal-service': 'employees',
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
            `⚠️ [EmployeesExport] locația ${locationId} nu are company_id în răspuns`,
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
          `⚠️ [EmployeesExport] Nu am putut rezolva locația ${locationId}: ${err?.message}`,
        );
      }
    }
    return map;
  }

  private currentMonthRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDate = `${y}-${pad(m + 1)}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const endDate = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
    return { startDate, endDate };
  }

  private tasksBaseUrl(): string {
    // veziv-tasks are setGlobalPrefix('tasks') → rutele reale sunt /tasks/executions/...
    const raw = (
      this.configService.get<string>('TASKS_HTTP_URL') ||
      this.configService.get<string>('TASKS_API_BASE') ||
      process.env.TASKS_HTTP_URL ||
      process.env.TASKS_API_BASE ||
      'http://localhost:3008'
    ).replace(/\/+$/, '');
    return raw.endsWith('/tasks') ? raw : `${raw}/tasks`;
  }

  private internalHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-internal-service': 'employees',
      'x-service-secret': process.env.SERVICE_SECRET || '',
    };
  }

  /**
   * Puncte pe angajat per locație (luna curentă). Fail-soft: locație eșuată → map gol.
   * Env: TASKS_HTTP_URL (sau TASKS_API_BASE) către veziv-tasks, ex. http://localhost:3008
   */
  private async fetchMonthPointsByLocation(
    locationIds: number[],
    startDate: string,
    endDate: string,
  ): Promise<Map<number, Map<number, number>>> {
    const result = new Map<number, Map<number, number>>();
    const base = this.tasksBaseUrl();
    const headers = this.internalHeaders();

    await Promise.all(
      locationIds.map(async (locationId) => {
        const byEmployee = new Map<number, number>();
        try {
          const res: any = await firstValueFrom(
            this.httpService.get(`${base}/executions/location-employee-points`, {
              headers,
              params: {
                location_id: locationId,
                startDate,
                endDate,
              },
            }),
          );
          const rows = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.data?.data)
              ? res.data.data
              : [];
          for (const row of rows) {
            const employeeId = Number(row.employee_id);
            const points = Number(row.total_points ?? 0);
            if (Number.isFinite(employeeId) && employeeId > 0) {
              byEmployee.set(employeeId, Number.isFinite(points) ? points : 0);
            }
          }
        } catch (err: any) {
          this.logger.warn(
            `⚠️ [EmployeesExport] Puncte locație ${locationId} indisponibile: ${err?.message}`,
          );
        }
        result.set(locationId, byEmployee);
      }),
    );

    return result;
  }

  /** Eficiență per angajat (luna curentă), cu concurență limitată. Fail-soft → lipsește din map. */
  private async fetchEfficiencyByEmployee(
    employeeIds: number[],
    startDate: string,
    endDate: string,
  ): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    if (employeeIds.length === 0) return result;

    const base = this.tasksBaseUrl();
    const headers = this.internalHeaders();
    const concurrency = 8;
    let index = 0;

    const workers = Array.from({ length: Math.min(concurrency, employeeIds.length) }, async () => {
      while (index < employeeIds.length) {
        const employeeId = employeeIds[index++];
        try {
          const res: any = await firstValueFrom(
            this.httpService.get(`${base}/assignments/stats/efficiency`, {
              headers,
              params: {
                employee_id: employeeId,
                startDate,
                endDate,
              },
            }),
          );
          const pct = Number(res?.data?.percentage);
          if (Number.isFinite(pct)) {
            result.set(employeeId, Math.max(0, Math.min(100, pct)));
          }
        } catch (err: any) {
          this.logger.warn(
            `⚠️ [EmployeesExport] KPI angajat ${employeeId} indisponibil: ${err?.message}`,
          );
        }
      }
    });

    await Promise.all(workers);
    return result;
  }
}
