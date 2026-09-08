/**
 * Jest: npm test -- locations-active-list  (from locations/)
 * Default list paths exclude is_active=0; includeInactive includes them.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { LocationsService } from './locations.service';

function mockQb(rows: any[]) {
  const qb: any = {
    leftJoinAndSelect: jest.fn(() => qb),
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    getManyAndCount: jest.fn(async () => [rows, rows.length]),
  };
  return qb;
}

function buildService(opts?: { findResult?: any[]; qbRows?: any[] }) {
  const qb = mockQb(opts?.qbRows ?? [{ id: 1, is_active: true }]);
  const workLocationRepository = {
    createQueryBuilder: jest.fn(() => qb),
    find: jest.fn(async () => opts?.findResult ?? []),
    findOne: jest.fn(async () => null),
  };
  const svc = Object.create(LocationsService.prototype) as LocationsService;
  (svc as any).workLocationRepository = workLocationRepository;
  return { svc, workLocationRepository, qb };
}

describe('LocationsService active-only lists', () => {
  it('findWorkLocationsByCompany defaults to is_active=true', async () => {
    const { svc, workLocationRepository } = buildService({
      findResult: [{ id: 1, is_active: true }],
    });
    await svc.findWorkLocationsByCompany(9);
    expect(workLocationRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { company_id: 9, is_active: true },
      }),
    );
  });

  it('findWorkLocationsByCompany includeInactive skips active filter', async () => {
    const { svc, workLocationRepository } = buildService({
      findResult: [
        { id: 1, is_active: true },
        { id: 2, is_active: false },
      ],
    });
    await svc.findWorkLocationsByCompany(9, undefined, true);
    expect(workLocationRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { company_id: 9 },
      }),
    );
    const callArg = (workLocationRepository.find as jest.Mock).mock
      .calls[0][0] as { where: Record<string, unknown> };
    expect(callArg.where.is_active).toBeUndefined();
  });

  it('findWorkLocationsByIds defaults to is_active=true for platform-wide user', async () => {
    const { svc, workLocationRepository } = buildService({
      findResult: [{ id: 1 }],
    });
    const user = {
      permissions: ['locations.read', 'assignment.read_all'],
    };
    await svc.findWorkLocationsByIds([1, 2], user);
    expect(workLocationRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ is_active: true }),
      }),
    );
  });

  it('findAllWorkLocations adds is_active filter by default', async () => {
    const { svc, qb } = buildService();
    const user = {
      permissions: ['locations.read', 'assignment.read_all'],
      company_id: 9,
    };
    await svc.findAllWorkLocations(1, 10, 9, undefined, undefined, user);
    expect(qb.andWhere).toHaveBeenCalledWith(
      'location.is_active = :isActive',
      { isActive: true },
    );
  });

  it('findAllWorkLocations includeInactive skips is_active filter', async () => {
    const { svc, qb } = buildService();
    const user = {
      permissions: ['locations.read', 'assignment.read_all'],
      company_id: 9,
    };
    await svc.findAllWorkLocations(1, 10, 9, undefined, undefined, user, true);
    const activeCalls = (qb.andWhere as jest.Mock).mock.calls.filter((c) =>
      String(c[0]).includes('is_active'),
    );
    expect(activeCalls).toHaveLength(0);
  });
});
