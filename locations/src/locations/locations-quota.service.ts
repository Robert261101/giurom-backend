/**
 * locations.max quota (FREEZE-CREATE + downgrade soft-block).
 * Usage = COUNT(work_location WHERE company_id = X AND is_active = 1).
 * Downgrade may set is_active=0; upgrade does NOT auto-reactivate.
 * Applies to the TARGET company of the create (HTTP and micro paths).
 */
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PLAN_LIMIT_KEYS } from '@giurom/tenant-access';
import { WorkLocation } from './entity/work-location.entity';
import { PlanAccessService } from '../plan-access/plan-access.nest';

export const LOCATIONS_LIMIT_CODE = 'LOCATIONS_LIMIT_REACHED';

export type LocationDowngradeItem = {
  id: number;
  name: string;
};

export type LocationDowngradeBucket = {
  limit: number;
  used: number;
  minimum_to_block: number;
  items: LocationDowngradeItem[];
};

export type LocationDowngradePreview = {
  requires_blocks: boolean;
  locations: LocationDowngradeBucket;
};

export type LocationDowngradeRollbackItem = {
  location_id: number;
  previous_is_active: boolean;
};

@Injectable()
export class LocationsQuotaService {
  private readonly logger = new Logger(LocationsQuotaService.name);

  constructor(
    @InjectRepository(WorkLocation)
    private readonly workLocationRepository: Repository<WorkLocation>,
    @Inject(DataSource) private readonly dataSource: DataSource,
    private readonly planAccess: PlanAccessService,
  ) {}

  /** MySQL named lock per company — serializes creates that consume the quota. */
  async withCompanyLocationsQuotaLock<T>(
    companyId: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cid = Number(companyId);
    if (!Number.isFinite(cid) || cid <= 0) return fn();
    const lockName = `giurom_locations_quota_${cid}`;
    // Dedicated session so GET_LOCK and RELEASE_LOCK hit the same connection.
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      const rows: Array<{ acquired: number | string }> = await runner.query(
        'SELECT GET_LOCK(?, 10) AS acquired',
        [lockName],
      );
      if (Number(rows?.[0]?.acquired) !== 1) {
        throw new ServiceUnavailableException(
          'Nu s-a putut verifica limita de locații. Reîncearcă.',
        );
      }
      try {
        return await fn();
      } finally {
        try {
          await runner.query('SELECT RELEASE_LOCK(?)', [lockName]);
        } catch (error: any) {
          this.logger.warn(
            `RELEASE_LOCK(${lockName}) failed: ${error?.message || error}`,
          );
        }
      }
    } finally {
      await runner.release();
    }
  }

  async countCompanyLocations(companyId: number): Promise<number> {
    const cid = Number(companyId);
    if (!Number.isFinite(cid) || cid <= 0) return 0;
    return this.workLocationRepository.count({
      where: { company_id: cid, is_active: true },
    });
  }

  async listActiveLocationsForCompany(
    companyId: number,
  ): Promise<LocationDowngradeItem[]> {
    const cid = Number(companyId);
    if (!Number.isFinite(cid) || cid <= 0) return [];
    const rows = await this.workLocationRepository.find({
      where: { company_id: cid, is_active: true },
      select: ['id', 'location_name'],
      order: { location_name: 'ASC' },
    });
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.location_name || ''),
    }));
  }

  buildDowngradePreview(
    locationLimit: number,
    items: LocationDowngradeItem[],
  ): LocationDowngradePreview {
    const used = items.length;
    const limit = Math.max(0, Number(locationLimit) || 0);
    const minimum_to_block = Math.max(0, used - limit);
    return {
      requires_blocks: minimum_to_block > 0,
      locations: { limit, used, minimum_to_block, items },
    };
  }

  async getDowngradePreview(
    companyId: number,
    locationLimit: number,
  ): Promise<LocationDowngradePreview> {
    const items = await this.listActiveLocationsForCompany(companyId);
    return this.buildDowngradePreview(locationLimit, items);
  }

  async applyDowngradeBlocks(
    companyId: number,
    blockLocationIds: number[],
    locationLimit: number,
  ): Promise<LocationDowngradeRollbackItem[]> {
    const cid = Number(companyId);
    return this.withCompanyLocationsQuotaLock(cid, async () => {
      const preview = await this.getDowngradePreview(cid, locationLimit);
      const selectable = new Set(preview.locations.items.map((i) => i.id));
      const ids = [
        ...new Set(
          (blockLocationIds || [])
            .map(Number)
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ];
      for (const id of ids) {
        if (!selectable.has(id)) {
          throw new BadRequestException(
            `Locația ${id} nu poate fi blocată pentru această companie`,
          );
        }
      }
      const remaining = preview.locations.used - ids.length;
      if (remaining > preview.locations.limit) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'DOWNGRADE_INSUFFICIENT_LOCATION_BLOCKS',
          message: `Trebuie blocate cel puțin ${preview.locations.minimum_to_block} locații.`,
          details: {
            minimum_to_block: preview.locations.minimum_to_block,
            selected: ids.length,
          },
        });
      }

      const rollback: LocationDowngradeRollbackItem[] = [];
      if (!ids.length) return rollback;

      const rows = await this.workLocationRepository.find({
        where: { company_id: cid, id: In(ids) },
      });
      for (const row of rows) {
        if (row.is_active === false) continue;
        rollback.push({
          location_id: Number(row.id),
          previous_is_active: true,
        });
        row.is_active = false;
        await this.workLocationRepository.save(row);
      }
      return rollback;
    });
  }

  async rollbackDowngradeBlocks(
    companyId: number,
    items: LocationDowngradeRollbackItem[],
  ): Promise<void> {
    if (!items?.length) return;
    const cid = Number(companyId);
    for (const item of items) {
      const loc = await this.workLocationRepository.findOne({
        where: { id: Number(item.location_id), company_id: cid },
      });
      if (!loc) continue;
      loc.is_active = item.previous_is_active !== false;
      await this.workLocationRepository.save(loc);
    }
  }

  /** Throws 403 LOCATIONS_LIMIT_REACHED when used >= locations.max. */
  async assertCanCreateLocation(companyId: number): Promise<void> {
    await this.planAccess.assertLimitForCompany(
      companyId,
      PLAN_LIMIT_KEYS.LOCATIONS_MAX,
      () => this.countCompanyLocations(companyId),
      {
        code: LOCATIONS_LIMIT_CODE,
        message:
          'Ai atins limita de locații pentru planul actual de abonament.',
      },
    );
  }

  /** Manual reactivate of a soft-blocked location — checks quota first. */
  async reactivateLocation(companyId: number, locationId: number): Promise<void> {
    const cid = Number(companyId);
    const lid = Number(locationId);
    if (!Number.isFinite(cid) || cid <= 0 || !Number.isFinite(lid) || lid <= 0) {
      throw new BadRequestException('Parametri invalizi');
    }
    await this.withCompanyLocationsQuotaLock(cid, async () => {
      const loc = await this.workLocationRepository.findOne({
        where: { id: lid, company_id: cid },
      });
      if (!loc) {
        throw new NotFoundException(`Locația ${lid} nu a fost găsită`);
      }
      if (loc.is_active !== false) {
        return;
      }
      await this.assertCanCreateLocation(cid);
      loc.is_active = true;
      await this.workLocationRepository.save(loc);
    });
  }
}
