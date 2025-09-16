import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WasteRecordsService } from '../src/waste-records/waste-records.service';
import { WasteRecord } from '../src/waste-records/entities/waste-record.entity';

function createRepoMock<T extends { id?: number }>() {
  const data: T[] = [] as any;
  let nextId = 1;
  return {
    _data: data,
    create: jest.fn((partial: Partial<T>) => ({ ...(partial as any) } as T)),
    save: jest.fn(async (entityOrArray: T | T[]) => {
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
    }),
    find: jest.fn(async () => data as T[]),
    findOne: jest.fn(async ({ where }: any) => data.find((row) => Object.keys(where || {}).every((k) => (row as any)[k] === (where as any)[k])) || null),
    remove: jest.fn(async (entity: any) => {
      const id = (entity as any)?.id ?? entity;
      const idx = data.findIndex((row) => (row as any).id === id);
      if (idx >= 0) data.splice(idx, 1);
    }),
  } as unknown as jest.Mocked<Repository<T>> & { _data: T[] };
}

describe('WasteRecordsService (unit)', () => {
  let service: WasteRecordsService;
  const repo = createRepoMock<WasteRecord>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WasteRecordsService,
        { provide: getRepositoryToken(WasteRecord), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(WasteRecordsService);
  });

  it('creates and retrieves waste records', async () => {
    const created = await service.create({ quantity: 2, unit: 'kg', reason: 'spillage' });
    expect(created.id).toBeDefined();
    const list = await service.findAll();
    expect(list.length).toBe(1);
  });

  it('updates a waste record', async () => {
    const first = (repo._data[0] as any);
    const updated = await service.update(first.id, { quantity: 3 });
    expect(Number(updated.quantity)).toBe(3);
  });

  it('removes a waste record', async () => {
    const first = (repo._data[0] as any);
    const res = await service.remove(first.id);
    expect(res).toHaveProperty('id', first.id);
    const list = await service.findAll();
    expect(list.length).toBe(0);
  });
});


