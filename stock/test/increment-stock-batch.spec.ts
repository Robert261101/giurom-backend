import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StockService } from '../src/stock/stock.service';
import { Stock, StockStatus } from '../src/stock/entities/stock.entity';
import { StockLotStatus, StockSource, TransactionType } from '../src/stock/entities/stock.enums';

describe('StockService.incrementStockBatch', () => {
  let service: StockService;
  let stockRows: Array<Partial<Stock> & { id: number; product_id: number; location_key: number; quantity: number }>;
  let txRows: any[];
  let productRows: Array<{ id: number; name: string; unit: string; min_stock_level?: number }>;
  let nextStockId: number;
  let nextTxId: number;
  let queryCalls: Array<{ sql: string; params: any[] }>;
  let committed: boolean;
  let rolledBack: boolean;

  const locationId = 13;
  const locationKey = 13;

  function createQueryRunnerMock() {
    const stockRepo = {
      findOne: jest.fn(async ({ where, lock }: any) => {
        void lock;
        return (
          stockRows.find(
            (row) =>
              (where.id != null && row.id === where.id) ||
              (where.product_id != null &&
                row.product_id === where.product_id &&
                row.location_key === where.location_key),
          ) || null
        );
      }),
      create: jest.fn((partial: any) => ({ ...partial })),
      save: jest.fn(async (entity: any) => {
        if (!entity.id) {
          entity.id = nextStockId++;
          stockRows.push(entity);
        } else {
          const idx = stockRows.findIndex((r) => r.id === entity.id);
          if (idx >= 0) stockRows[idx] = { ...stockRows[idx], ...entity };
        }
        return entity;
      }),
      createQueryBuilder: jest.fn(),
    };

    const txRepo = {
      create: jest.fn((partial: any) => ({ ...partial })),
      save: jest.fn(async (entity: any) => {
        if (!entity.id) entity.id = nextTxId++;
        txRows.push(entity);
        return entity;
      }),
    };

    return {
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => {
        committed = true;
      }),
      rollbackTransaction: jest.fn(async () => {
        rolledBack = true;
      }),
      release: jest.fn(async () => undefined),
      manager: {
        getRepository: jest.fn((entity: any) => {
          if (entity?.name === 'Stock' || entity === Stock) return stockRepo;
          return txRepo;
        }),
        query: jest.fn(async (sql: string, params: any[]) => {
          queryCalls.push({ sql, params });
          if (sql.includes('UPDATE stock SET quantity = quantity +')) {
            const [qty, id] = params;
            const row = stockRows.find((r) => r.id === id);
            if (row) {
              row.quantity = Number((Number(row.quantity) + Number(qty)).toFixed(2));
            }
          }
          return undefined;
        }),
      },
    };
  }

  beforeEach(() => {
    stockRows = [
      {
        id: 1,
        product_id: 40,
        location_id: locationId,
        location_key: locationKey,
        quantity: 10,
        status: StockStatus.VALID,
      },
      {
        id: 2,
        product_id: 41,
        location_id: locationId,
        location_key: locationKey,
        quantity: 6,
        status: StockStatus.VALID,
      },
    ];
    txRows = [];
    productRows = [
      { id: 40, name: 'Zahăr', unit: 'kg' },
      { id: 41, name: 'Lapte', unit: 'L' },
    ];
    nextStockId = 100;
    nextTxId = 1000;
    queryCalls = [];
    committed = false;
    rolledBack = false;

    const productRepo = {
      find: jest.fn(async ({ where }: any) => {
        const ids: number[] = where?.id?.value ?? where?.id ?? [];
        const list = Array.isArray(ids) ? ids : [ids];
        return productRows.filter((p) => list.includes(p.id));
      }),
      findOne: jest.fn(async ({ where }: any) =>
        productRows.find((p) => p.id === where.id) || null,
      ),
      manager: {
        connection: {
          createQueryRunner: jest.fn(() => createQueryRunnerMock()),
        },
      },
    };

    const stockRepo = {
      createQueryBuilder: jest.fn(() => {
        const qb: any = {
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getRawMany: jest.fn(async () =>
            stockRows.map((r) => ({ product_id: r.product_id })),
          ),
        };
        return qb;
      }),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      manager: {
        connection: {
          createQueryRunner: jest.fn(() => createQueryRunnerMock()),
        },
      },
    };

    service = new StockService(
      productRepo as any,
      stockRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { emit: jest.fn(), send: jest.fn() } as any,
      {
        get: jest.fn(() => ({
          toPromise: undefined,
        })),
      } as any,
      {
        get: jest.fn((key: string) => {
          if (key === 'LOCATIONS_HTTP_URL') return 'http://localhost:3004';
          if (key === 'SERVICE_SECRET') return 'test-secret';
          return undefined;
        }),
      } as any,
    );

    jest.spyOn(service, 'getProductIdsAtLocation').mockImplementation(async (lid: number) => {
      if (lid !== locationId) return [];
      return stockRows.map((r) => r.product_id);
    });

    jest.spyOn(service, 'assertLocationInCompany').mockResolvedValue(undefined);
  });

  it('increments a single product: 10 + 5 = 15 and creates ENTRY journal', async () => {
    const result = await service.incrementStockBatch(
      {
        location_id: locationId,
        items: [{ product_id: 40, quantity: 5 }],
      },
      { companyId: 1, employeeId: 99 },
    );

    expect(result.success).toBe(true);
    expect(result.updated).toEqual([
      { product_id: 40, quantity_added: 5, new_quantity: 15 },
    ]);
    expect(stockRows.find((r) => r.product_id === 40)?.quantity).toBe(15);
    expect(txRows).toHaveLength(1);
    expect(txRows[0].type).toBe(TransactionType.ENTRY);
    expect(txRows[0].reference_type).toBe('manual_entry');
    expect(txRows[0].source).toBe(StockSource.MANUAL);
    expect(txRows[0].quantity).toBe(5);
    expect(queryCalls.some((c) => c.sql.includes('quantity = quantity +'))).toBe(true);
    expect(committed).toBe(true);
    expect(rolledBack).toBe(false);
  });

  it('increments multiple products in one batch', async () => {
    const result = await service.incrementStockBatch(
      {
        location_id: locationId,
        items: [
          { product_id: 40, quantity: 5 },
          { product_id: 41, quantity: 2.5 },
        ],
      },
      { companyId: 1 },
    );

    expect(result.updated).toHaveLength(2);
    expect(result.updated[0]).toEqual({
      product_id: 40,
      quantity_added: 5,
      new_quantity: 15,
    });
    expect(result.updated[1]).toEqual({
      product_id: 41,
      quantity_added: 2.5,
      new_quantity: 8.5,
    });
    expect(txRows).toHaveLength(2);
  });

  it('supports decimal quantities: 1.25 + 2.50 path via existing stock', async () => {
    stockRows[0].quantity = 1.25;
    const result = await service.incrementStockBatch(
      {
        location_id: locationId,
        items: [{ product_id: 40, quantity: 2.5 }],
      },
      { companyId: 1 },
    );
    expect(result.updated[0].new_quantity).toBe(3.75);
  });

  it('rejects quantity <= 0', async () => {
    await expect(
      service.incrementStockBatch(
        { location_id: locationId, items: [{ product_id: 40, quantity: 0 }] },
        { companyId: 1 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects negative quantity', async () => {
    await expect(
      service.incrementStockBatch(
        { location_id: locationId, items: [{ product_id: 40, quantity: -1 }] },
        { companyId: 1 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects NaN / Infinity', async () => {
    await expect(
      service.incrementStockBatch(
        { location_id: locationId, items: [{ product_id: 40, quantity: Number.NaN }] },
        { companyId: 1 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.incrementStockBatch(
        {
          location_id: locationId,
          items: [{ product_id: 40, quantity: Number.POSITIVE_INFINITY }],
        },
        { companyId: 1 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects more than two decimal places', async () => {
    await expect(
      service.incrementStockBatch(
        { location_id: locationId, items: [{ product_id: 40, quantity: 1.234 }] },
        { companyId: 1 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects quantity above decimal(10,2) max', async () => {
    await expect(
      service.incrementStockBatch(
        { location_id: locationId, items: [{ product_id: 40, quantity: 100000000 }] },
        { companyId: 1 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty items', async () => {
    await expect(
      service.incrementStockBatch(
        { location_id: locationId, items: [] },
        { companyId: 1 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate product_id', async () => {
    await expect(
      service.incrementStockBatch(
        {
          location_id: locationId,
          items: [
            { product_id: 40, quantity: 1 },
            { product_id: 40, quantity: 2 },
          ],
        },
        { companyId: 1 },
      ),
    ).rejects.toThrow(/apare de mai multe ori/);
  });

  it('rejects product not in location catalog', async () => {
    await expect(
      service.incrementStockBatch(
        { location_id: locationId, items: [{ product_id: 999, quantity: 1 }] },
        { companyId: 1 },
      ),
    ).rejects.toThrow(/nu este disponibil în locația selectată/);
  });

  it('rejects invalid location_id', async () => {
    await expect(
      service.incrementStockBatch(
        { location_id: 0, items: [{ product_id: 40, quantity: 1 }] },
        { companyId: 1 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces location ownership when not bypassed', async () => {
    (service.assertLocationInCompany as jest.Mock).mockRejectedValue(
      new ForbiddenException('Locația nu aparține companiei utilizatorului autentificat'),
    );

    await expect(
      service.incrementStockBatch(
        { location_id: locationId, items: [{ product_id: 40, quantity: 1 }] },
        { companyId: 2, bypassLocationOwnership: false },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('skips ownership check for internal service calls', async () => {
    const result = await service.incrementStockBatch(
      { location_id: locationId, items: [{ product_id: 40, quantity: 1 }] },
      { bypassLocationOwnership: true, callerService: 'suppliers-ms' },
    );
    expect(result.success).toBe(true);
    expect(service.assertLocationInCompany).not.toHaveBeenCalled();
  });

  it('rolls back when a later item fails after lock/setup', async () => {
    jest.spyOn(service, 'getProductIdsAtLocation').mockResolvedValue([40, 41]);
    productRows = [{ id: 40, name: 'Zahăr', unit: 'kg' }]; // 41 missing → fail after validation of catalog

    await expect(
      service.incrementStockBatch(
        {
          location_id: locationId,
          items: [
            { product_id: 40, quantity: 1 },
            { product_id: 41, quantity: 1 },
          ],
        },
        { companyId: 1 },
      ),
    ).rejects.toThrow(/nu există/);

    // Failure happens before transaction starts (product existence check)
    expect(committed).toBe(false);
  });

  it('rolls back transaction if SQL update path throws', async () => {
    const runner = createQueryRunnerMock();
    runner.manager.query = jest.fn(async () => {
      throw new Error('db failure');
    });
    (service as any).stockRepo.manager.connection.createQueryRunner = jest.fn(
      () => runner,
    );

    await expect(
      service.incrementStockBatch(
        { location_id: locationId, items: [{ product_id: 40, quantity: 1 }] },
        { companyId: 1 },
      ),
    ).rejects.toThrow('db failure');

    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
  });
});
