import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockService } from '../src/stock/stock.service';
import { Product } from '../src/stock/entities/product.entity';
import { Stock } from '../src/stock/entities/stock.entity';
import { StockTransaction, TransactionType } from '../src/stock/entities/stock-transaction.entity';
import { WasteRecord } from '../src/stock/entities/waste-record.entity';

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
    count: jest.fn(async ({ where }: any) => data.filter((row) => Object.keys(where || {}).every((k) => (row as any)[k] === (where as any)[k])).length),
  } as unknown as jest.Mocked<Repository<T>> & { _data: T[] };
}

describe('StockService (unit)', () => {
  let service: StockService;
  const productRepo = createRepoMock<Product>();
  const stockRepo = createRepoMock<Stock>();
  const txRepo = createRepoMock<StockTransaction>();
  const wasteRepo = createRepoMock<WasteRecord>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(Stock), useValue: stockRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: txRepo },
        { provide: getRepositoryToken(WasteRecord), useValue: wasteRepo },
      ],
    }).compile();
    service = moduleRef.get(StockService);
  });

  it('creates product and prevents duplicate names', async () => {
    const p1 = await service.createProduct({ name: 'Flour', unit: 'kg' } as any);
    expect(p1.id).toBeDefined();
    await expect(service.createProduct({ name: 'Flour', unit: 'kg' } as any)).rejects.toThrow('Produsul există deja');
  });

  it('creates stock for existing product', async () => {
    const flour = await productRepo.findOne({ where: { name: 'Flour' } } as any);
    const s = await service.createStock({ product_id: flour!.id, quantity: 10, price: 5, entry_date: new Date().toISOString() } as any);
    expect(s.id).toBeDefined();
    const all = await service.findAllStocks();
    expect(all.length).toBeGreaterThan(0);
  });

  it('consumes FIFO by expiration and creates EXIT txs', async () => {
    const flour = await productRepo.findOne({ where: { name: 'Flour' } } as any);
    // Add multiple stocks with different expirations
    await service.createStock({ product_id: flour!.id, quantity: 5, price: 5, entry_date: new Date().toISOString(), expiration_date: new Date(Date.now() + 86400000).toISOString(), status: 'valid' } as any);
    await service.createStock({ product_id: flour!.id, quantity: 7, price: 5, entry_date: new Date().toISOString(), expiration_date: new Date(Date.now() + 2*86400000).toISOString(), status: 'valid' } as any);
    await service.consumeProduct(flour!.id, 8, 'test');
    const txs = await txRepo.find({} as any);
    expect(txs.filter(t => (t as any).type === TransactionType.EXIT).length).toBeGreaterThan(0);
  });

  it('creates and fetches waste records', async () => {
    const flour = await productRepo.findOne({ where: { name: 'Flour' } } as any);
    const wr = await service.createWasteRecord({ product_id: flour!.id, quantity: 1, unit: 'kg', reason: 'test' });
    expect(wr.id).toBeDefined();
    const all = await service.findAllWasteRecords();
    expect(all.length).toBeGreaterThan(0);
  });
});


