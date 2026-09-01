/**
 * Jest: npx jest src/suppliers/val3-location-mapping.service.test.ts
 *
 * Service-level VAL 3: per-location supplier product → client stock mapping.
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SupplierProductClientMapping } from './entities/supplier-product-client-mapping.entity';
import { SupplierProduct } from './entities/supplier-product.entity';

const CLIENT_A = 1;
const CLIENT_B = 2;
const SUPPLIER_ID = 10;
const SUPPLIER_PRODUCT_X = 501;
const LOCATION_10 = 10;
const LOCATION_11 = 11;
const LOCATION_20 = 20;
const STOCK_PRODUCT_100 = 100;
const STOCK_PRODUCT_200 = 200;
const STOCK_PRODUCT_300 = 300;

type MappingRow = {
  id: number;
  client_company_id: number;
  client_location_id: number | null;
  supplier_product_id: number;
  client_stock_product_id: number;
};

function mappingKey(
  clientCompanyId: number,
  locationId: number | null,
  supplierProductId: number,
): string {
  return `${clientCompanyId}:${locationId}:${supplierProductId}`;
}

function buildVal3MappingService(initialMappings: MappingRow[] = []) {
  const mappings = new Map<string, MappingRow>();
  let nextId = 1;
  for (const row of initialMappings) {
    mappings.set(
      mappingKey(row.client_company_id, row.client_location_id, row.supplier_product_id),
      { ...row, id: row.id ?? nextId++ },
    );
  }

  const stockCatalogByLocation = new Map<number, Array<{ id: number }>>([
    [LOCATION_10, [{ id: STOCK_PRODUCT_100 }, { id: 999 }]],
    [LOCATION_11, [{ id: STOCK_PRODUCT_200 }, { id: 998 }]],
    [LOCATION_20, [{ id: STOCK_PRODUCT_300 }, { id: 997 }]],
  ]);

  const supplierProductClientMappingRepo = {
    findOne: jest.fn(async (opts: any) => {
      const where = opts?.where ?? {};
      const key = mappingKey(
        Number(where.client_company_id),
        where.client_location_id ?? null,
        Number(where.supplier_product_id),
      );
      return mappings.get(key) ?? null;
    }),
    createQueryBuilder: jest.fn(() => {
      const state = {
        supplierId: 0,
        clientCompanyId: 0,
        locationId: 0,
      };
      const builder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn(function (this: typeof builder, _sql: string, params: any) {
          state.clientCompanyId = Number(params?.clientCompanyId);
          return builder;
        }),
        andWhere: jest.fn(function (this: typeof builder, _sql: string, params: any) {
          if (params?.locationId != null) {
            state.locationId = Number(params.locationId);
          }
          if (params?.supplierId != null) {
            state.supplierId = Number(params.supplierId);
          }
          return builder;
        }),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () =>
          [...mappings.values()].filter(
            (row) =>
              row.client_company_id === state.clientCompanyId &&
              row.client_location_id === state.locationId,
          ),
        ),
      };
      return builder;
    }),
    create: jest.fn((row: MappingRow) => ({ ...row, id: nextId++ })),
    save: jest.fn(async (row: MappingRow) => {
      const key = mappingKey(
        row.client_company_id,
        row.client_location_id,
        row.supplier_product_id,
      );
      const saved = { ...row, id: row.id ?? nextId++ };
      mappings.set(key, saved);
      return saved;
    }),
  };

  const supplierRepo = {
    findOne: jest.fn(async () => ({
      id: SUPPLIER_ID,
      supplier_name: 'Test Supplier',
    })),
  };

  const supplierProductRepo = {
    findOne: jest.fn(async (opts: any) => {
      if (
        Number(opts?.where?.id) === SUPPLIER_PRODUCT_X &&
        Number(opts?.where?.supplier_id) === SUPPLIER_ID
      ) {
        return {
          id: SUPPLIER_PRODUCT_X,
          supplier_id: SUPPLIER_ID,
          gross_quantity: null,
          net_quantity: null,
        };
      }
      return null;
    }),
    save: jest.fn(async (row: any) => row),
  };

  const queryRunner = {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    manager: {
      getRepository: jest.fn((entity: any) => {
        const name = typeof entity === 'function' ? entity.name : String(entity);
        if (name === SupplierProductClientMapping.name) {
          return supplierProductClientMappingRepo;
        }
        if (name === SupplierProduct.name) {
          return supplierProductRepo;
        }
        return supplierProductClientMappingRepo;
      }),
    },
  };

  const connection = {
    createQueryRunner: jest.fn(() => queryRunner),
  };

  const service = Object.create(SuppliersService.prototype) as SuppliersService;
  (service as any).supplierProductClientMappingRepo = supplierProductClientMappingRepo;
  (service as any).supplierRepo = supplierRepo;
  (service as any).supplierProductRepo = supplierProductRepo;
  (service as any).connection = connection;
  (service as any).configService = { get: jest.fn(() => undefined) };
  (service as any).httpService = { get: jest.fn() };
  (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  (service as any).fetchLocationOrFail = jest.fn(async (locationId: number) => ({
    location: {
      company_id:
        locationId === LOCATION_20
          ? CLIENT_B
          : locationId === LOCATION_10 || locationId === LOCATION_11
            ? CLIENT_A
            : null,
    },
    failed: false,
  }));
  (service as any).fetchCompanyLocationIds = jest.fn(async (companyId: number) =>
    companyId === CLIENT_A ? [LOCATION_10, LOCATION_11] : [LOCATION_20],
  );
  (service as any).stockHttpService = {
    listProductsByLocation: jest.fn(async (locationId: number) =>
      stockCatalogByLocation.get(locationId) ?? [],
    ),
  };
  (service as any).assertSupplierLinkedToClientCompany = jest.fn(async () => undefined);
  (service as any).ensureSupplierLinkedToClientCompany = jest.fn(async () => undefined);
  (service as any).validateOptionalGrossNetQuantities = jest.fn(() => ({
    gross_quantity: null,
    net_quantity: null,
  }));
  (service as any).internalServiceHeaders = jest.fn(() => ({}));

  return {
    service,
    mappings,
    supplierProductClientMappingRepo,
    stockCatalogByLocation,
  };
}

const adminUserContext = {
  companyId: CLIENT_A,
  companyType: 'client',
  permissions: ['assignment.read_company'],
  isAdmin: true,
  isSuperAdmin: false,
};

describe('VAL 3 per-location mapping (service)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveClientStockProductForOrder', () => {
    it('location 10 → stock product 100, location 11 → stock product 200', async () => {
      const { service } = buildVal3MappingService([
        {
          id: 1,
          client_company_id: CLIENT_A,
          client_location_id: LOCATION_10,
          supplier_product_id: SUPPLIER_PRODUCT_X,
          client_stock_product_id: STOCK_PRODUCT_100,
        },
        {
          id: 2,
          client_company_id: CLIENT_A,
          client_location_id: LOCATION_11,
          supplier_product_id: SUPPLIER_PRODUCT_X,
          client_stock_product_id: STOCK_PRODUCT_200,
        },
      ]);

      const resolve = (service as any).resolveClientStockProductForOrder.bind(service);

      await expect(
        resolve(CLIENT_A, SUPPLIER_PRODUCT_X, LOCATION_10),
      ).resolves.toBe(STOCK_PRODUCT_100);
      await expect(
        resolve(CLIENT_A, SUPPLIER_PRODUCT_X, LOCATION_11),
      ).resolves.toBe(STOCK_PRODUCT_200);
    });

    it('cross-location isolation: mapping only at 10 fails for order at 11', async () => {
      const { service } = buildVal3MappingService([
        {
          id: 1,
          client_company_id: CLIENT_A,
          client_location_id: LOCATION_10,
          supplier_product_id: SUPPLIER_PRODUCT_X,
          client_stock_product_id: STOCK_PRODUCT_100,
        },
      ]);

      const resolve = (service as any).resolveClientStockProductForOrder.bind(service);

      await expect(
        resolve(CLIENT_A, SUPPLIER_PRODUCT_X, LOCATION_11),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cross-client isolation: each client resolves only its own mapping', async () => {
      const { service } = buildVal3MappingService([
        {
          id: 1,
          client_company_id: CLIENT_A,
          client_location_id: LOCATION_10,
          supplier_product_id: SUPPLIER_PRODUCT_X,
          client_stock_product_id: STOCK_PRODUCT_100,
        },
        {
          id: 2,
          client_company_id: CLIENT_B,
          client_location_id: LOCATION_20,
          supplier_product_id: SUPPLIER_PRODUCT_X,
          client_stock_product_id: STOCK_PRODUCT_300,
        },
      ]);

      const resolve = (service as any).resolveClientStockProductForOrder.bind(service);

      await expect(
        resolve(CLIENT_B, SUPPLIER_PRODUCT_X, LOCATION_20),
      ).resolves.toBe(STOCK_PRODUCT_300);
      await expect(
        resolve(CLIENT_A, SUPPLIER_PRODUCT_X, LOCATION_10),
      ).resolves.toBe(STOCK_PRODUCT_100);
      await expect(
        resolve(CLIENT_A, SUPPLIER_PRODUCT_X, LOCATION_20),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getClientProductMappingsForSupplier', () => {
    it('returns mappings only for requested location', async () => {
      const { service } = buildVal3MappingService([
        {
          id: 1,
          client_company_id: CLIENT_A,
          client_location_id: LOCATION_10,
          supplier_product_id: SUPPLIER_PRODUCT_X,
          client_stock_product_id: STOCK_PRODUCT_100,
        },
        {
          id: 2,
          client_company_id: CLIENT_A,
          client_location_id: LOCATION_11,
          supplier_product_id: SUPPLIER_PRODUCT_X,
          client_stock_product_id: STOCK_PRODUCT_200,
        },
      ]);

      const rows10 = await service.getClientProductMappingsForSupplier(
        SUPPLIER_ID,
        adminUserContext,
        LOCATION_10,
      );
      expect(rows10).toHaveLength(1);
      expect(rows10[0].client_location_id).toBe(LOCATION_10);
      expect(rows10[0].client_stock_product_id).toBe(STOCK_PRODUCT_100);

      const rows11 = await service.getClientProductMappingsForSupplier(
        SUPPLIER_ID,
        adminUserContext,
        LOCATION_11,
      );
      expect(rows11).toHaveLength(1);
      expect(rows11[0].client_stock_product_id).toBe(STOCK_PRODUCT_200);
    });
  });

  describe('upsertSupplierProductClientConfig', () => {
    it('save at location 10 does not change mapping at location 11', async () => {
      const { service, mappings } = buildVal3MappingService([
        {
          id: 1,
          client_company_id: CLIENT_A,
          client_location_id: LOCATION_10,
          supplier_product_id: SUPPLIER_PRODUCT_X,
          client_stock_product_id: STOCK_PRODUCT_100,
        },
        {
          id: 2,
          client_company_id: CLIENT_A,
          client_location_id: LOCATION_11,
          supplier_product_id: SUPPLIER_PRODUCT_X,
          client_stock_product_id: STOCK_PRODUCT_200,
        },
      ]);

      await service.upsertSupplierProductClientConfig(
        SUPPLIER_ID,
        SUPPLIER_PRODUCT_X,
        { client_stock_product_id: STOCK_PRODUCT_100 },
        adminUserContext,
        LOCATION_10,
      );

      expect(
        mappings.get(mappingKey(CLIENT_A, LOCATION_11, SUPPLIER_PRODUCT_X))
          ?.client_stock_product_id,
      ).toBe(STOCK_PRODUCT_200);
      expect(
        mappings.get(mappingKey(CLIENT_A, LOCATION_10, SUPPLIER_PRODUCT_X))
          ?.client_stock_product_id,
      ).toBe(STOCK_PRODUCT_100);
    });
  });
});
