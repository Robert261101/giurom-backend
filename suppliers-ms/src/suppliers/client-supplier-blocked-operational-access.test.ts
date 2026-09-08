/**
 * Jest: npm test -- src/suppliers/client-supplier-blocked-operational-access.test.ts
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SupplierQuotaLifecycleService } from './supplier-quota-lifecycle.service';
import { SUPPLIER_QUOTA_STATUS } from './supplier-quota-status';
import { ClientManualSupplierState } from './entities/client-manual-supplier-state.entity';
import { CLIENT_SUPPLIER_OPERATIONAL_ACCESS_REQUIREMENTS } from './client-supplier-operational-access';

const SUPPLIER_ID = 10;
const CLIENT_A = 1;
const CLIENT_B = 2;

type LinkRow = {
  is_active: boolean;
  quota_status: string;
};

function buildContService(linkByClient: Map<number, LinkRow>) {
  const supplier = {
    id: SUPPLIER_ID,
    owner_company_id: 99,
    is_active: true,
    supplier_name: 'Cont Shared',
    locations: [] as Array<{ id_location: number }>,
  };

  const clientSupplierLinkRepo = {
    findOne: jest.fn(async (opts: any) => {
      const cid = Number(opts?.where?.client_company_id);
      const sid = Number(opts?.where?.supplier_id);
      if (sid !== SUPPLIER_ID) return null;
      const row = linkByClient.get(cid);
      if (!row) return null;
      return {
        id: cid,
        client_company_id: cid,
        supplier_id: SUPPLIER_ID,
        is_active: row.is_active,
        quota_status: row.quota_status,
      };
    }),
    find: jest.fn(async () => []),
  };

  const manualStateRepo = {
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => x),
    remove: jest.fn(async () => undefined),
  };

  const supplierRepo = {
    findOne: jest.fn(async () => supplier),
    find: jest.fn(async () => [supplier]),
  };

  const supplierLocationsRepo = {
    find: jest.fn(async () => []),
  };

  const supplierProductRepo = {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
  };

  const connection = {
    getRepository: jest.fn((entity: any) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === ClientManualSupplierState.name) {
        return manualStateRepo;
      }
      return manualStateRepo;
    }),
  };

  const supplierQuotaLifecycleService = new SupplierQuotaLifecycleService(
    clientSupplierLinkRepo as any,
    manualStateRepo as any,
    supplierRepo as any,
    supplierLocationsRepo as any,
    { createQueryBuilder: jest.fn() } as any,
    { query: jest.fn() } as any,
    {
      withCompanySupplierQuotaLock: jest.fn(
        async (_cid: number, fn: () => Promise<unknown>) => fn(),
      ),
      getSupplierLimits: jest.fn(async () => ({
        limits: { account_max: 3, manual_max: 7 },
      })),
      assertCanConnectAccountSupplier: jest.fn(async () => ({})),
      assertCanCreateManualSupplier: jest.fn(async () => ({})),
    } as any,
  );

  const service = Object.create(SuppliersService.prototype) as SuppliersService;
  (service as any).supplierRepo = supplierRepo;
  (service as any).clientSupplierLinkRepo = clientSupplierLinkRepo;
  (service as any).supplierLocationsRepo = supplierLocationsRepo;
  (service as any).supplierProductRepo = supplierProductRepo;
  (service as any).connection = connection;
  (service as any).supplierQuotaLifecycleService = supplierQuotaLifecycleService;
  (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  (service as any).hasSupplierLoginAccount = jest.fn(async () => true);
  (service as any).fetchCompanyLocationIds = jest.fn(async () => [101]);
  (service as any).resolveSupplierStockLocationId = jest.fn(async () => 500);
  (service as any).stockHttpService = {
    getQuantitiesAtLocation: jest.fn(async () => []),
    getProductPhotosByIds: jest.fn(async () => new Map()),
    getProductIdsAtLocation: jest.fn(async () => []),
  };
  (service as any).filterProductsByClientVisibility = jest.fn(
    async (products: unknown[]) => products,
  );

  return { service, supplier, linkByClient, clientSupplierLinkRepo };
}

const clientAUser = {
  company_id: CLIENT_A,
  company_type: 'client',
  roles: ['admin'],
  permissions: ['suppliers.read', 'order.read'],
  sub: 11,
};

const clientBUser = {
  company_id: CLIENT_B,
  company_type: 'client',
  roles: ['admin'],
  permissions: ['suppliers.read', 'order.read'],
  sub: 22,
};

describe('Client supplier blocked operational access', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('active supplier → operational read allowed', async () => {
    const linkByClient = new Map<number, LinkRow>([
      [CLIENT_A, { is_active: true, quota_status: 'active' }],
    ]);
    const { service } = buildContService(linkByClient);

    await expect(
      service.assertClientSupplierRelationship(
        CLIENT_A,
        SUPPLIER_ID,
        CLIENT_SUPPLIER_OPERATIONAL_ACCESS_REQUIREMENTS,
      ),
    ).resolves.toBeDefined();
  });

  it('blocked supplier → operational read (products) denied with 403', async () => {
    const linkByClient = new Map<number, LinkRow>([
      [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED }],
    ]);
    const { service } = buildContService(linkByClient);

    await expect(
      service.getSupplierProducts(
        SUPPLIER_ID,
        false,
        { companyId: CLIENT_A, companyType: 'client', permissions: ['suppliers.read'] },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SUPPLIER_QUOTA_BLOCKED' }),
    });
  });

  it('inactive association → operational read denied', async () => {
    const linkByClient = new Map<number, LinkRow>([
      [CLIENT_A, { is_active: false, quota_status: 'active' }],
    ]);
    const { service } = buildContService(linkByClient);

    await expect(
      service.getSupplierProducts(
        SUPPLIER_ID,
        false,
        { companyId: CLIENT_A, companyType: 'client', permissions: ['suppliers.read'] },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CLIENT_SUPPLIER_INACTIVE' }),
    });
  });

  it('blocked supplier → stock availability read denied', async () => {
    const linkByClient = new Map<number, LinkRow>([
      [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED }],
    ]);
    const { service } = buildContService(linkByClient);

    await expect(
      service.getSupplierStockAvailabilityForOrdering(
        SUPPLIER_ID,
        undefined,
        { companyId: CLIENT_A, companyType: 'client', permissions: ['order.read'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocked supplier → client product mappings read denied', async () => {
    const linkByClient = new Map<number, LinkRow>([
      [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED }],
    ]);
    const { service } = buildContService(linkByClient);
    (service as any).resolveClientCompanyIdFromContext = jest.fn(() => CLIENT_A);
    (service as any).resolveClientLocationIdForMapping = jest.fn(() => 101);
    (service as any).assertClientLocationBelongsToCompany = jest.fn(async () => undefined);
    (service as any).supplierProductClientMappingRepo = {
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => []),
      })),
    };

    await expect(
      service.getClientProductMappingsForSupplier(
        SUPPLIER_ID,
        { companyId: CLIENT_A, companyType: 'client', permissions: ['suppliers.read'] },
        101,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('same supplier active for another client → operational read allowed', async () => {
    const linkByClient = new Map<number, LinkRow>([
      [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED }],
      [CLIENT_B, { is_active: true, quota_status: 'active' }],
    ]);
    const { service } = buildContService(linkByClient);

    await expect(
      service.assertClientSupplierRelationship(
        CLIENT_B,
        SUPPLIER_ID,
        CLIENT_SUPPLIER_OPERATIONAL_ACCESS_REQUIREMENTS,
      ),
    ).resolves.toBeDefined();
  });

  it('removed supplier → operational read denied as not found', async () => {
    const linkByClient = new Map<number, LinkRow>([
      [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.REMOVED }],
    ]);
    const { service } = buildContService(linkByClient);

    await expect(
      service.getSupplierProducts(
        SUPPLIER_ID,
        false,
        { companyId: CLIENT_A, companyType: 'client', permissions: ['suppliers.read'] },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('after unblock (active quota) → operational read allowed again', async () => {
    const linkByClient = new Map<number, LinkRow>([
      [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED }],
    ]);
    const { service, linkByClient: map } = buildContService(linkByClient);

    await expect(
      service.getSupplierProducts(
        SUPPLIER_ID,
        false,
        { companyId: CLIENT_A, companyType: 'client', permissions: ['suppliers.read'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    map.set(CLIENT_A, { is_active: true, quota_status: 'active' });

    await expect(
      service.assertClientSupplierRelationship(
        CLIENT_A,
        SUPPLIER_ID,
        CLIENT_SUPPLIER_OPERATIONAL_ACCESS_REQUIREMENTS,
      ),
    ).resolves.toBeDefined();
  });

  it('findOrderForRequester allows client when supplier is blocked (legacy finish/cancel)', async () => {
    const linkByClient = new Map<number, LinkRow>([
      [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED }],
    ]);
    const { service } = buildContService(linkByClient);
    (service as any).orderRepo = {
      findOne: jest.fn(async () => ({
        id: 1,
        supplier_id: SUPPLIER_ID,
        company_id: CLIENT_A,
        items: [],
        supplier: { id: SUPPLIER_ID },
      })),
    };

    await expect(
      service.findOrderForRequester(1, clientAUser),
    ).resolves.toMatchObject({ id: 1, supplier_id: SUPPLIER_ID });
  });

  it('assertClientSupplierRelationship operational preset matches service gate', async () => {
    const linkByClient = new Map<number, LinkRow>([
      [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED }],
    ]);
    const { service } = buildContService(linkByClient);

    await expect(
      service.assertClientSupplierRelationship(
        CLIENT_A,
        SUPPLIER_ID,
        CLIENT_SUPPLIER_OPERATIONAL_ACCESS_REQUIREMENTS,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
