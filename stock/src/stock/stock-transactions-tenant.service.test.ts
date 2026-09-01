/**
 * Jest: npm test -- src/stock/stock-transactions-tenant.service.test.ts
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StockService } from './stock.service';

function buildTransactionTenantService() {
  const txRows = [
    { id: 1, product_id: 100, location_key: 1, stock_id: 10, type: 'entry' },
    { id: 2, product_id: 100, location_key: 2, stock_id: 20, type: 'exit' },
  ];

  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => txRows.filter((r) => r.location_key === 1)),
  };

  const txRepo = {
    createQueryBuilder: jest.fn(() => qb),
  };
  const stockRepo = {
    findOne: jest.fn(async (opts: any) => {
      const id = Number(opts?.where?.id);
      if (id === 10) return { id: 10, product_id: 100, location_id: 1 };
      if (id === 20) return { id: 20, product_id: 100, location_id: 2 };
      return null;
    }),
  };

  const service = Object.create(StockService.prototype) as StockService;
  (service as any).txRepo = txRepo;
  (service as any).stockRepo = stockRepo;
  (service as any).locationKey = (id: number) => id;
  (service as any).assertLocationInCompany = jest.fn(async () => undefined);

  return { service, qb, stockRepo };
}

const clientA = { company_id: 10, permissions: ['stock.read'] };
const tenantAdminA = {
  company_id: 10,
  permissions: ['assignment.read_all'],
  isAdmin: true,
};
const platform = { permissions: ['assignment.read_all'] };

describe('StockService transaction tenant isolation', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('tenant without location_id is denied', async () => {
    const { service } = buildTransactionTenantService();
    await expect(
      service.findAllTransactions({ product_id: 100 }, clientA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tenant with own location sees scoped query', async () => {
    const { service, qb } = buildTransactionTenantService();
    await service.findAllTransactions(
      { product_id: 100, location_id: 1 },
      clientA,
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'tx.location_key = :locationKey',
      { locationKey: 1 },
    );
  });

  it('tenant admin still requires location_id', async () => {
    const { service } = buildTransactionTenantService();
    await expect(
      service.findAllTransactions({ product_id: 100 }, tenantAdminA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tenant with stock_id from other location is denied when location mismatch', async () => {
    const { service } = buildTransactionTenantService();
    await expect(
      service.findAllTransactions(
        { stock_id: 20, location_id: 1 },
        clientA,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('platform may query without location_id', async () => {
    const { service } = buildTransactionTenantService();
    await expect(
      service.findAllTransactions({ product_id: 100 }, platform),
    ).resolves.toBeDefined();
  });

  it('unknown stock_id throws not found', async () => {
    const { service } = buildTransactionTenantService();
    await expect(
      service.findAllTransactions({ stock_id: 999 }, clientA),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
