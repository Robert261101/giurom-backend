import {
  Injectable,
  NotFoundException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { WasteRecord } from './entities/waste-record.entity';
import {
  WasteRecordsJwtUser,
  getJwtCompanyId,
  getJwtWorkLocationId,
  isGlobalWasteAdmin,
  assertRecordLocationAllowed,
} from '../waste-records-access';

export interface CreateWasteRecordDto {
  product_id?: number;
  recipe_id?: number;
  recipe_preparation_id?: number;
  location_id?: number;
  quantity: number;
  unit: string;
  reason?: string;
}

export interface UpdateWasteRecordDto extends Partial<CreateWasteRecordDto> {}

@Injectable()
export class WasteRecordsService {
  private locationIdsByCompanyCache = new Map<
    number,
    { ids: number[]; timestamp: number }
  >();
  private readonly LOCATION_CACHE_TTL_MS = 60_000;

  constructor(
    @InjectRepository(WasteRecord) private readonly repo: Repository<WasteRecord>,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
    private readonly httpService: HttpService,
  ) {}

  private internalHeaders(): Record<string, string> {
    return {
      'x-internal-service': 'waste-records-ms',
      'x-service-secret': process.env.SERVICE_SECRET || '',
    };
  }

  async resolvePermittedLocationIds(
    user?: WasteRecordsJwtUser,
  ): Promise<number[]> {
    if (!user || isGlobalWasteAdmin(user)) {
      return [];
    }

    const companyId = getJwtCompanyId(user);
    if (companyId != null) {
      const cached = this.locationIdsByCompanyCache.get(companyId);
      if (
        cached &&
        Date.now() - cached.timestamp < this.LOCATION_CACHE_TTL_MS
      ) {
        return cached.ids;
      }

      const locationsUrl =
        process.env.LOCATIONS_HTTP_URL || 'http://localhost:3004';
      try {
        const response = await firstValueFrom(
          this.httpService.get<{ data?: unknown } | unknown[]>(
            `${locationsUrl}/locations/company/${companyId}`,
            { headers: this.internalHeaders(), timeout: 8000 },
          ),
        );
        const payload = response.data as { data?: unknown } | unknown[];
        const data =
          payload &&
          typeof payload === 'object' &&
          !Array.isArray(payload) &&
          'data' in payload
            ? (payload as { data?: unknown }).data
            : payload;
        const list = Array.isArray(data) ? data : [];
        const ids = list
          .map((row: { id?: number }) => Number(row?.id))
          .filter((id: number) => Number.isFinite(id) && id > 0);
        this.locationIdsByCompanyCache.set(companyId, {
          ids,
          timestamp: Date.now(),
        });
        if (ids.length > 0) {
          return ids;
        }
      } catch {
        // fallback la locația din JWT
      }
    }

    const workLocationId = getJwtWorkLocationId(user);
    return workLocationId != null ? [workLocationId] : [];
  }

  private async assertCanAccessRecord(
    user: WasteRecordsJwtUser | undefined,
    record: WasteRecord,
  ): Promise<void> {
    if (!user) {
      throw new ForbiddenException('Utilizator neautentificat');
    }
    if (isGlobalWasteAdmin(user)) {
      return;
    }
    const permitted = await this.resolvePermittedLocationIds(user);
    if (permitted.length === 0) {
      throw new ForbiddenException(
        'Locația/compania nu este determinată pentru utilizator',
      );
    }
    assertRecordLocationAllowed(user, record.location_id, permitted);
  }

  private async resolveWriteLocationId(
    user: WasteRecordsJwtUser | undefined,
    dtoLocationId?: number,
  ): Promise<number> {
    if (!user) {
      throw new ForbiddenException('Utilizator neautentificat');
    }
    if (isGlobalWasteAdmin(user)) {
      const explicit = Number(dtoLocationId);
      if (Number.isFinite(explicit) && explicit > 0) {
        return explicit;
      }
      const fallback = getJwtWorkLocationId(user);
      if (fallback != null) {
        return fallback;
      }
      throw new ForbiddenException('location_id este obligatoriu');
    }

    const permitted = await this.resolvePermittedLocationIds(user);
    if (permitted.length === 0) {
      throw new ForbiddenException(
        'Locația/compania nu este determinată pentru utilizator',
      );
    }

    const explicit = Number(dtoLocationId);
    if (Number.isFinite(explicit) && explicit > 0) {
      if (!permitted.includes(explicit)) {
        throw new ForbiddenException(
          'Nu poți înregistra deșeuri pentru o locație din altă companie',
        );
      }
      return explicit;
    }

    if (permitted.length === 1) {
      return permitted[0];
    }

    const jwtLoc = getJwtWorkLocationId(user);
    if (jwtLoc != null && permitted.includes(jwtLoc)) {
      return jwtLoc;
    }

    throw new ForbiddenException('location_id este obligatoriu');
  }

  async create(dto: CreateWasteRecordDto, user?: WasteRecordsJwtUser) {
    const locationId = await this.resolveWriteLocationId(user, dto.location_id);
    const entity = this.repo.create({
      product_id: dto.product_id ?? null,
      recipe_id: dto.recipe_id ?? null,
      location_id: locationId,
      quantity: dto.quantity as any,
      unit: dto.unit,
      reason: dto.reason ?? null,
    } as any);
    const saved = await this.repo.save(entity);

    try {
      const savedEntity = Array.isArray(saved) ? saved[0] : saved;

      this.notificationsClient.emit({ cmd: 'waste-records.notification' }, {
        type: 'waste_record_created',
        title: 'Inregistrare deseu noua',
        description: `S-a inregistrat un deseu: ${dto.quantity} ${dto.unit}${dto.reason ? ` - ${dto.reason}` : ''}`,
        entity_id: savedEntity.id,
        entity_type: 'waste_record',
        metadata: {
          wasteRecordId: savedEntity.id,
          ...dto,
          location_id: locationId,
          work_location_id: locationId,
        },
        priority: 'medium',
        target_url: '/stoc',
      });
    } catch (error) {
      console.error('Failed to send waste record notification:', error);
    }

    return saved;
  }

  async findAll(user?: WasteRecordsJwtUser) {
    if (!user || isGlobalWasteAdmin(user)) {
      return this.repo.find({ order: { created_at: 'DESC' } as any });
    }

    const permitted = await this.resolvePermittedLocationIds(user);
    if (permitted.length === 0) {
      return [];
    }

    return this.repo.find({
      where: { location_id: In(permitted) } as any,
      order: { created_at: 'DESC' } as any,
    });
  }

  async findOne(id: number, user?: WasteRecordsJwtUser) {
    const found = await this.repo.findOne({ where: { id } as any });
    if (!found) throw new NotFoundException('Waste record not found');
    await this.assertCanAccessRecord(user, found);
    return found;
  }

  async update(id: number, dto: UpdateWasteRecordDto, user?: WasteRecordsJwtUser) {
    const found = await this.findOne(id, user);
    if (dto.location_id !== undefined && user) {
      found.location_id = await this.resolveWriteLocationId(
        user,
        dto.location_id,
      );
    }
    const { location_id: _ignored, ...rest } = dto;
    Object.assign(found, rest);
    return this.repo.save(found);
  }

  async remove(id: number, user?: WasteRecordsJwtUser) {
    const found = await this.findOne(id, user);
    await this.repo.remove(found);
    return { id };
  }
}
