import { LocationsService } from '../src/locations/locations.service';

type Generic = Record<string, any>;

function createRepo<T extends { id?: number }>() {
  const data: T[] = [] as any;
  let nextId = 1;
  return {
    _data: data,
    create(partial: Partial<T>): T {
      return { ...(partial as any) } as T;
    },
    async save(entityOrArray: T | T[]): Promise<T | T[]> {
      const list = Array.isArray(entityOrArray) ? entityOrArray : [entityOrArray];
      const saved = list.map((entity) => {
        if (!entity.id) {
          (entity as any).id = nextId++;
          data.push({ ...(entity as any) });
        } else {
          const idx = data.findIndex((row) => (row as any).id === (entity as any).id);
          if (idx >= 0) data[idx] = { ...(data[idx] as any), ...(entity as any) } as T;
          else data.push({ ...(entity as any) });
        }
        return entity;
      });
      return Array.isArray(entityOrArray) ? (saved as T[]) : (saved[0] as T);
    },
    async findOne(opts: { where: Generic }): Promise<T | null> {
      const where = opts?.where || {};
      return (
        data.find((row) => Object.keys(where).every((k) => (row as any)[k] === (where as any)[k])) || null
      );
    },
    async delete(where: Generic) {
      const keys = Object.keys(where || {});
      for (let i = data.length - 1; i >= 0; i--) {
        if (keys.every((k) => (data[i] as any)[k] === (where as any)[k])) data.splice(i, 1);
      }
      return { affected: 1 } as any;
    },
    async find(opts: { where?: Generic; order?: Generic }): Promise<T[]> {
      const where = opts?.where || {};
      let rows = data.filter((row) => Object.keys(where).every((k) => (row as any)[k] === (where as any)[k]));
      if (opts?.order) {
        const [key, dir] = Object.entries(opts.order)[0] as [string, any];
        rows = rows.sort((a: any, b: any) => (a[key] > b[key] ? (dir === 'ASC' ? 1 : -1) : dir === 'ASC' ? -1 : 1));
      }
      return rows as T[];
    },
  };
}

describe('Revenue Points per Work Location (unit)', () => {
  let service: LocationsService;
  const workLocationRepository = createRepo<any>();
  const taskTemplateRepository = createRepo<any>();
  const revenueRepository = createRepo<any>();
  const revenuePointsRepository = createRepo<any>();
  const managerConfigRepository = createRepo<any>();

  beforeAll(async () => {
    service = new (LocationsService as any)(
      workLocationRepository,
      taskTemplateRepository,
      revenueRepository,
      revenuePointsRepository,
      managerConfigRepository,
    );
    await workLocationRepository.save(
      workLocationRepository.create({ id: 1, company_id: 1, location_name: 'Test', address: 'Addr', city: 'City', county: 'County', postal_code: '000', country: 'Romania' }),
    );
  });

  it('calculates points using intervals when revenue introduced', async () => {
    await service.setRevenueIntervals(1, [
      { min: 0, max: 1000, points: 10 },
      { min: 1000, max: 2000, points: 5 },
      { min: 2000, max: null, points: 2 },
    ]);
    await service.setManagerPercent(1, 10);
    await service.recordRevenue(1, '2025-08-20', 1500);
    const res = await service.getManagerPointsForDate(1, '2025-08-20');
    // 1500 / 5 = 300 total points; manager 10% -> 30
    expect(res.managerPoints).toBeCloseTo(30, 5);
  });

  it('no revenue → manager points = 0', async () => {
    await service.setRevenueIntervals(1, [
      { min: 0, max: 100, points: 2 },
      { min: 100, max: null, points: 1 },
    ]);
    await service.setManagerPercent(1, 20);
    const res = await service.getManagerPointsForDate(1, '2025-08-21');
    expect(res.managerPoints).toBe(0);
  });

  it('multiple revenues same day → last saved used for calculation (simplified)', async () => {
    await service.setRevenueIntervals(1, [
      { min: 0, max: 1000, points: 10 },
      { min: 1000, max: null, points: 5 },
    ]);
    await service.setManagerPercent(1, 10);
    await service.recordRevenue(1, '2025-08-22', 800);
    await service.recordRevenue(1, '2025-08-22', 1200);
    const res = await service.getManagerPointsForDate(1, '2025-08-22');
    expect(res.managerPoints).toBeCloseTo(24, 5);
  });
});

