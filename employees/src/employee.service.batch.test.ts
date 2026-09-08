/**
 * Jest: npm test -- src/employee.service.batch.test.ts
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { EmployeeService } from './employee.service';
import { Employee } from './entities/employee.entity';
import { EmployeeFiles } from './entities/employee-files.entity';
import { GeneratedDocuments } from './entities/generated-documents.entity';
import { EmployeeWorkLocationHistory } from './entities/employee-work-location-history.entity';
import { EmployeeLocation } from './entities/employee-location.entity';
import { EmployeeFolder } from './entities/employee-folder.entity';
import { EmployeeStaffQuotaService } from './employee-staff-quota.service';

describe('EmployeeService batch tenant scope', () => {
  let service: EmployeeService;
  let getMany: jest.Mock<() => Promise<Employee[]>>;
  let queryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    getMany = jest.fn<() => Promise<Employee[]>>();
    queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      getMany,
    };

    const employeeRepository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      find: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: getRepositoryToken(Employee), useValue: employeeRepository },
        { provide: getRepositoryToken(EmployeeFiles), useValue: {} },
        { provide: getRepositoryToken(GeneratedDocuments), useValue: {} },
        {
          provide: getRepositoryToken(EmployeeWorkLocationHistory),
          useValue: {},
        },
        { provide: getRepositoryToken(EmployeeLocation), useValue: {} },
        { provide: getRepositoryToken(EmployeeFolder), useValue: {} },
        { provide: 'NOTIFICATIONS_RMQ', useValue: { emit: jest.fn() } },
        { provide: HttpService, useValue: { get: jest.fn() } },
        {
          provide: EmployeeStaffQuotaService,
          useValue: {
            resolveCompanyId: jest.fn(() => 1),
            assertStaffQuota: jest.fn(async () => undefined),
            removeStaffLinks: jest.fn(async () => undefined),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(EmployeeService);
    jest
      .spyOn(service as any, 'fetchCompanyLocationIds')
      .mockResolvedValue([100, 101]);
  });

  it('tenant A requests [A1, A2] → returns both when in company locations', async () => {
    getMany.mockResolvedValue([
      {
        id: 1,
        first_name: 'Ana',
        last_name: 'A',
        email: 'a1@test',
        is_active: true,
        work_location_default_id: 100,
      },
      {
        id: 2,
        first_name: 'Andrei',
        last_name: 'A',
        email: 'a2@test',
        is_active: true,
        work_location_default_id: 101,
      },
    ] as Employee[]);

    const rows = await service.findByIdsBasicForCompany([1, 2], 10);

    expect(rows).toHaveLength(2);
    expect(queryBuilder.where).toHaveBeenCalledWith('employee.id IN (:...ids)', {
      ids: [1, 2],
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(employee.work_location_default_id IN (:...locIds) OR el.idLocation IN (:...locIds))',
      { locIds: [100, 101] },
    );
  });

  it('mixed IDs [A1, B1, A2] → DB scope excludes B1 (only accessible rows returned)', async () => {
    getMany.mockResolvedValue([
      {
        id: 1,
        first_name: 'Ana',
        last_name: 'A',
        email: 'a1@test',
        is_active: true,
        work_location_default_id: 100,
      },
      {
        id: 2,
        first_name: 'Andrei',
        last_name: 'A',
        email: 'a2@test',
        is_active: true,
        work_location_default_id: 101,
      },
    ] as Employee[]);

    const rows = await service.findByIdsBasicForCompany([1, 99, 2], 10);

    expect(rows.map((r) => r.id)).toEqual([1, 2]);
    expect(rows.some((r) => r.id === 99)).toBe(false);
    expect(queryBuilder.where).toHaveBeenCalledWith('employee.id IN (:...ids)', {
      ids: [1, 99, 2],
    });
  });

  it('empty ids → [] without query', async () => {
    const rows = await service.findByIdsBasicForCompany([], 10);
    expect(rows).toEqual([]);
    expect(getMany).not.toHaveBeenCalled();
  });

  it('unknown ids with no matches → []', async () => {
    getMany.mockResolvedValue([]);
    const rows = await service.findByIdsBasicForCompany([9999], 10);
    expect(rows).toEqual([]);
  });

  it('company without locations → []', async () => {
    jest.spyOn(service as any, 'fetchCompanyLocationIds').mockResolvedValue([]);
    const rows = await service.findByIdsBasicForCompany([1, 2], 10);
    expect(rows).toEqual([]);
    expect(getMany).not.toHaveBeenCalled();
  });
});
