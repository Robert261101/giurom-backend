/**
 * Jest: npx jest src/suppliers/client-supplier-relationship.service.test.ts
 *
 * Service-level A/B regression for VAL 2 relationship isolation.
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SupplierQuotaLifecycleService } from './supplier-quota-lifecycle.service';
import { SUPPLIER_QUOTA_STATUS } from './supplier-quota-status';
import { ClientManualSupplierState } from './entities/client-manual-supplier-state.entity';

const SUPPLIER_ID = 10;
const CLIENT_A = 1;
const CLIENT_B = 2;

type LinkRow = {
  is_active: boolean;
  quota_status: string;
};

function buildSharedContService(linkByClient: Map<number, LinkRow>) {
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
    find: jest.fn(async (opts: any) => {
      if (Number(opts?.where?.supplier_id) !== SUPPLIER_ID) return [];
      return [...linkByClient.entries()].map(([clientCompanyId, row]) => ({
        client_company_id: clientCompanyId,
        supplier_id: SUPPLIER_ID,
        is_active: row.is_active,
        quota_status: row.quota_status,
      }));
    }),
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

  const supplierProductClientActivationRepo = {
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => x),
  };

  const supplierProductRepo = {
    find: jest.fn(async () => [] as any[]),
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
  (service as any).supplierProductClientActivationRepo =
    supplierProductClientActivationRepo;
  (service as any).connection = connection;
  (service as any).supplierQuotaLifecycleService = supplierQuotaLifecycleService;
  (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  (service as any).hasSupplierLoginAccount = jest.fn(async () => true);
  (service as any).fetchCompanyLocationIds = jest.fn(async () => [101]);
  (service as any).fetchLocationOrFail = jest.fn(async () => ({
    location: { company_id: CLIENT_A },
    failed: false,
  }));

  return {
    service,
    supplier,
    clientSupplierLinkRepo,
    supplierProductClientActivationRepo,
    supplierProductRepo,
  };
}

const userA = {
  company_id: CLIENT_A,
  company_type: 'client',
  roles: ['admin'],
  permissions: ['orders.create'],
  sub: 11,
};

const userB = {
  company_id: CLIENT_B,
  company_type: 'client',
  roles: ['admin'],
  permissions: ['orders.create'],
  sub: 22,
};

const requesterA = {
  company_id: CLIENT_A,
  company_type: 'client',
  roles: ['admin'],
  permissions: ['suppliers.read'],
};

const requesterB = {
  company_id: CLIENT_B,
  company_type: 'client',
  roles: ['admin'],
  permissions: ['suppliers.read'],
};

const orderDtoBase = {
  supplier_id: SUPPLIER_ID,
  location_id: 101,
  order_date: '2026-08-31',
  delivery_date: '2026-09-01',
  created_by_user_id: 1,
  items: [{ supplier_product_id: 1, quantity: 1, product_id: 50 }],
} as any;

describe('SuppliersService client-supplier relationship A/B', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('createOrder', () => {
    it('A inactive / B active: A deny, B passes relationship gate', async () => {
      const linkByClient = new Map<number, LinkRow>([
        [CLIENT_A, { is_active: false, quota_status: 'active' }],
        [CLIENT_B, { is_active: true, quota_status: 'active' }],
      ]);
      const { service } = buildSharedContService(linkByClient);
      (service as any).resolveSupplierProductForNewOrderItem = jest.fn(
        async () => {
          throw new Error('RELATIONSHIP_PASSED');
        },
      );

      await expect(
        service.createOrder({ ...orderDtoBase, company_id: CLIENT_A }, userA),
      ).rejects.toBeInstanceOf(ForbiddenException);

      await expect(
        service.createOrder({ ...orderDtoBase, company_id: CLIENT_B }, userB),
      ).rejects.toThrow('RELATIONSHIP_PASSED');
    });

    it('A blocked / B active: A deny, B passes relationship gate', async () => {
      const linkByClient = new Map<number, LinkRow>([
        [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED }],
        [CLIENT_B, { is_active: true, quota_status: 'active' }],
      ]);
      const { service } = buildSharedContService(linkByClient);
      (service as any).resolveSupplierProductForNewOrderItem = jest.fn(
        async () => {
          throw new Error('RELATIONSHIP_PASSED');
        },
      );

      await expect(
        service.createOrder({ ...orderDtoBase, company_id: CLIENT_A }, userA),
      ).rejects.toBeInstanceOf(NotFoundException);

      await expect(
        service.createOrder({ ...orderDtoBase, company_id: CLIENT_B }, userB),
      ).rejects.toThrow('RELATIONSHIP_PASSED');
    });

    it('A removed / B active: A deny, B passes relationship gate', async () => {
      const linkByClient = new Map<number, LinkRow>([
        [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.REMOVED }],
        [CLIENT_B, { is_active: true, quota_status: 'active' }],
      ]);
      const { service } = buildSharedContService(linkByClient);
      (service as any).resolveSupplierProductForNewOrderItem = jest.fn(
        async () => {
          throw new Error('RELATIONSHIP_PASSED');
        },
      );

      await expect(
        service.createOrder({ ...orderDtoBase, company_id: CLIENT_A }, userA),
      ).rejects.toBeInstanceOf(NotFoundException);

      await expect(
        service.createOrder({ ...orderDtoBase, company_id: CLIENT_B }, userB),
      ).rejects.toThrow('RELATIONSHIP_PASSED');
    });
  });

  describe('findForOrders', () => {
    it('respects per-client inactive vs active eligibility', async () => {
      const linkByClient = new Map<number, LinkRow>([
        [CLIENT_A, { is_active: false, quota_status: 'active' }],
        [CLIENT_B, { is_active: true, quota_status: 'active' }],
      ]);
      const { service } = buildSharedContService(linkByClient);

      const catalogRow = {
        id: SUPPLIER_ID,
        supplier_name: 'Cont Shared',
        phone: '0700',
        registration_number: 'RO1',
        vat_number: 'RO1',
        address: 'a',
        city: 'c',
        region: 'r',
        country: 'ro',
        postal_code: '0',
        email: 'e@e.e',
        contact_person: 'cp',
        is_active: true,
        owner_company_id: 99,
        has_supplier_account: true as boolean,
        client_association_is_active: true as boolean | null,
        quota_status: 'active' as string | null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      jest
        .spyOn(service, 'findCatalog')
        .mockImplementation(async (_opts, requester) => {
          const cid = Number(requester?.company_id);
          const link = linkByClient.get(cid);
          if (!link || link.quota_status === SUPPLIER_QUOTA_STATUS.REMOVED) {
            return [];
          }
          return [
            {
              ...catalogRow,
              client_association_is_active: link.is_active !== false,
              quota_status: link.quota_status,
            },
          ];
        });

      const rowsA = await service.findForOrders(undefined, requesterA);
      const rowsB = await service.findForOrders(undefined, requesterB);

      expect(rowsA).toHaveLength(0);
      expect(rowsB).toHaveLength(1);
      expect(rowsB[0].id).toBe(SUPPLIER_ID);
    });

    it('includeBlocked keeps blocked suppliers for existing-order listing', async () => {
      const linkByClient = new Map<number, LinkRow>([
        [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED }],
      ]);
      const { service } = buildSharedContService(linkByClient);

      jest.spyOn(service, 'findCatalog').mockResolvedValue([
        {
          id: SUPPLIER_ID,
          supplier_name: 'Blocked Cont',
          phone: '0700',
          registration_number: 'RO1',
          vat_number: 'RO1',
          address: 'a',
          city: 'c',
          region: 'r',
          country: 'ro',
          postal_code: '0',
          email: 'e@e.e',
          contact_person: 'cp',
          is_active: true,
          owner_company_id: 99,
          has_supplier_account: true,
          client_association_is_active: true,
          quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ] as any);

      const without = await service.findForOrders(undefined, requesterA);
      const withBlocked = await service.findForOrders(undefined, requesterA, {
        includeBlocked: true,
      });

      expect(without).toHaveLength(0);
      expect(withBlocked).toHaveLength(1);
      expect(withBlocked[0].id).toBe(SUPPLIER_ID);
    });

    it('includeBlocked still excludes removed suppliers', async () => {
      const { service } = buildSharedContService(
        new Map([
          [CLIENT_A, { is_active: true, quota_status: SUPPLIER_QUOTA_STATUS.REMOVED }],
        ]),
      );

      jest.spyOn(service, 'findCatalog').mockResolvedValue([
        {
          id: SUPPLIER_ID,
          supplier_name: 'Removed Cont',
          phone: null,
          registration_number: 'RO1',
          vat_number: 'RO1',
          address: 'a',
          city: 'c',
          region: 'r',
          country: 'ro',
          postal_code: '0',
          email: 'e@e.e',
          contact_person: 'cp',
          is_active: true,
          owner_company_id: 99,
          has_supplier_account: true,
          client_association_is_active: true,
          quota_status: SUPPLIER_QUOTA_STATUS.REMOVED,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ] as any);

      const rows = await service.findForOrders(undefined, requesterA, {
        includeBlocked: true,
      });
      expect(rows).toHaveLength(0);
    });
  });

  describe('getSupplierProducts', () => {
    it('denies without relationship and allows with relationship', async () => {
      const linkByClient = new Map<number, LinkRow>([
        [CLIENT_B, { is_active: true, quota_status: 'active' }],
      ]);
      const { service, supplierProductRepo } = buildSharedContService(linkByClient);
      (service as any).stockHttpService = {
        getProductPhotosByIds: jest.fn(async () => new Map()),
      };
      (service as any).attachEffectivePricesForClientCompany = jest.fn(
        async (rows: unknown[]) => rows,
      );
      (service as any).attachResolvedIsActiveForClientCompany = jest.fn(
        async (rows: unknown[]) => rows,
      );
      (service as any).shouldApplyClientProductVisibilityFilter = jest.fn(
        () => false,
      );

      await expect(
        service.getSupplierProducts(SUPPLIER_ID, true, {
          companyId: CLIENT_A,
          companyType: 'client',
          permissions: ['suppliers.read'],
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);

      (supplierProductRepo.find as jest.Mock<any>).mockResolvedValueOnce([
        { id: 1, supplier_id: SUPPLIER_ID, product_id: 5, is_active: true },
      ]);

      const rows = await service.getSupplierProducts(SUPPLIER_ID, true, {
        companyId: CLIENT_B,
        companyType: 'client',
        permissions: ['suppliers.read'],
      } as any);
      expect(rows).toHaveLength(1);
    });
  });

  describe('bootstrapClientActivationForNewProduct', () => {
    it('creates separate activation rows for Cont link-only clients A and B', async () => {
      const linkByClient = new Map<number, LinkRow>([
        [CLIENT_A, { is_active: true, quota_status: 'active' }],
        [CLIENT_B, { is_active: true, quota_status: 'active' }],
      ]);
      const { service, supplierProductClientActivationRepo } =
        buildSharedContService(linkByClient);

      await (service as any).bootstrapClientActivationForNewProduct(
        SUPPLIER_ID,
        99,
        500,
        true,
      );

      expect(supplierProductClientActivationRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            client_company_id: CLIENT_A,
            supplier_product_id: 500,
            is_active: true,
          }),
          expect.objectContaining({
            client_company_id: CLIENT_B,
            supplier_product_id: 500,
            is_active: true,
          }),
        ]),
      );
      const savedRows = supplierProductClientActivationRepo.save.mock.calls[0][0];
      expect(savedRows).toHaveLength(2);
      expect(new Set(savedRows.map((r: any) => r.client_company_id)).size).toBe(
        2,
      );
    });
  });
});
