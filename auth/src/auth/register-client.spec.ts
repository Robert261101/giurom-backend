import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { of, throwError } from 'rxjs';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CLIENT_ADMIN_ROLE_NAME } from '../users/client-role-assignment.util';

function sampleDto(overrides: Record<string, unknown> = {}) {
  return {
    company: {
      cui: 'RO12345678',
      company_name: 'Client Test SRL',
      trade_register_number: 'J40/1/2024',
      ...(overrides.company as object),
    },
    location: {
      street: 'Strada Test',
      number: '1',
      city: 'Bucuresti',
      county: 'Bucuresti',
      postal_code: '010101',
      ...(overrides.location as object),
    },
    employee: {
      first_name: 'Ion',
      last_name: 'Popescu',
      email: 'ion.client@example.com',
      phone: '+40712345678',
      personal_number: '1900101123456',
      birth_date: '1990-01-01',
      gender: 'male',
      nationality: 'Română',
      address: 'Centru',
      ...(overrides.employee as object),
    },
    password: 'secret12',
    confirm_password: 'secret12',
    ...overrides,
  };
}

describe('AuthService.registerClient', () => {
  let service: AuthService;
  let httpPost: ReturnType<typeof jest.fn>;
  let httpGet: ReturnType<typeof jest.fn>;
  let httpDelete: ReturnType<typeof jest.fn>;
  let usersService: {
    findRoleByName: ReturnType<typeof jest.fn>;
    create: ReturnType<typeof jest.fn>;
    createUserRole: ReturnType<typeof jest.fn>;
    remove: ReturnType<typeof jest.fn>;
  };
  let anafLookupService: {
    lookupCompany: ReturnType<typeof jest.fn>;
    verifyAnafToken: ReturnType<typeof jest.fn>;
  };

  beforeEach(() => {
    httpPost = jest.fn();
    httpGet = jest.fn();
    httpDelete = jest.fn();
    (httpDelete as any).mockReturnValue(of({ data: {} }));

    (httpGet as any).mockReturnValue(
      throwError(() => ({ response: { status: 404 } })),
    );

    usersService = {
      findRoleByName: jest.fn(),
      create: jest.fn(),
      createUserRole: jest.fn(),
      remove: jest.fn(),
    };
    (usersService.findRoleByName as any).mockResolvedValue({
      id: 99,
      name: CLIENT_ADMIN_ROLE_NAME,
    });
    (usersService.create as any).mockResolvedValue({ id: 501 });
    (usersService.createUserRole as any).mockResolvedValue({ id: 1 });
    (usersService.remove as any).mockResolvedValue(undefined);

    anafLookupService = {
      lookupCompany: jest.fn(),
      verifyAnafToken: jest.fn(),
    };
    (anafLookupService.verifyAnafToken as any).mockResolvedValue(null);

    const httpService = {
      post: httpPost,
      get: httpGet,
      delete: httpDelete,
    };

    service = new AuthService(
      usersService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      httpService as any,
      anafLookupService as any,
    );
  });

  function mockHappyPath() {
    (httpPost as any)
      .mockReturnValueOnce(of({ data: { id: 10 } }))
      .mockReturnValueOnce(of({ data: { id: 20 } }))
      .mockReturnValueOnce(of({ data: { id: 30 } }));
  }

  it('register client valid → company_type client, location, employee, user, client-admin', async () => {
    mockHappyPath();
    const result = await service.registerClient(sampleDto() as any);

    expect(result.message).toMatch(/client/i);
    expect(result.company_id).toBe(10);
    expect(result.employee_id).toBe(30);

    const companyCall = httpPost.mock.calls[0] as unknown as [string, { company_type: string }];
    expect(companyCall[0]).toContain('/companies');
    expect(companyCall[1].company_type).toBe('client');

    expect(String(httpPost.mock.calls[1][0])).toContain('/locations');
    expect(String(httpPost.mock.calls[2][0])).toContain(
      '/employees/internal/supplier-registration',
    );
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ id_employee: 30 }),
    );
    expect(usersService.createUserRole).toHaveBeenCalledWith({
      userId: 501,
      roleId: 99,
    });
  });

  it('register client → NU creează supplier (nu apelează suppliers-ms)', async () => {
    mockHappyPath();
    const result = await service.registerClient(sampleDto() as any);
    const urls = httpPost.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/suppliers'))).toBe(false);
    expect((result as { supplier_id?: number }).supplier_id).toBeUndefined();
    expect(result.company_id).toBe(10);
  });

  it('CUI duplicat → registration respins', async () => {
    (httpGet as any).mockReturnValue(of({ data: { id: 1, cui: 'RO12345678' } }));
    await expect(service.registerClient(sampleDto() as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(httpPost).not.toHaveBeenCalled();
  });

  it('email duplicat → registration respins + rollback company/location', async () => {
    (httpPost as any)
      .mockReturnValueOnce(of({ data: { id: 10 } }))
      .mockReturnValueOnce(of({ data: { id: 20 } }))
      .mockReturnValueOnce(
        throwError(() => ({
          response: { data: { message: 'Email există deja' } },
        })),
      );

    await expect(service.registerClient(sampleDto() as any)).rejects.toBeInstanceOf(
      ConflictException,
    );

    const deleteUrls = httpDelete.mock.calls.map((c) => String(c[0]));
    expect(deleteUrls.some((u) => u.includes('/locations/20'))).toBe(true);
    expect(deleteUrls.some((u) => u.includes('/companies/10'))).toBe(true);
  });

  it('failure location → company rollback', async () => {
    (httpPost as any)
      .mockReturnValueOnce(of({ data: { id: 10 } }))
      .mockReturnValueOnce(
        throwError(() => ({
          response: { data: { message: 'locatie invalida' } },
        })),
      );

    await expect(service.registerClient(sampleDto() as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(
      httpDelete.mock.calls.some((c) => String(c[0]).includes('/companies/10')),
    ).toBe(true);
  });

  it('failure employee → location + company rollback', async () => {
    (httpPost as any)
      .mockReturnValueOnce(of({ data: { id: 10 } }))
      .mockReturnValueOnce(of({ data: { id: 20 } }))
      .mockReturnValueOnce(
        throwError(() => ({
          response: { data: { message: 'employee fail' } },
        })),
      );

    await expect(service.registerClient(sampleDto() as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const deleteUrls = httpDelete.mock.calls.map((c) => String(c[0]));
    expect(deleteUrls.some((u) => u.includes('/locations/20'))).toBe(true);
    expect(deleteUrls.some((u) => u.includes('/companies/10'))).toBe(true);
  });

  it('failure user → employee + location + company rollback', async () => {
    mockHappyPath();
    (usersService.create as any).mockRejectedValue(
      new ConflictException('Există deja un cont pentru acest angajat'),
    );

    await expect(service.registerClient(sampleDto() as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(usersService.remove).not.toHaveBeenCalled();
    const deleteUrls = httpDelete.mock.calls.map((c) => String(c[0]));
    expect(deleteUrls.some((u) => u.includes('/employees/30'))).toBe(true);
    expect(deleteUrls.some((u) => u.includes('/locations/20'))).toBe(true);
    expect(deleteUrls.some((u) => u.includes('/companies/10'))).toBe(true);
  });

  it('failure client-admin assignment → rollback complet', async () => {
    mockHappyPath();
    (usersService.createUserRole as any).mockRejectedValue(new Error('role fail'));

    await expect(service.registerClient(sampleDto() as any)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(usersService.remove).toHaveBeenCalledWith(30);
    const deleteUrls = httpDelete.mock.calls.map((c) => String(c[0]));
    expect(deleteUrls.some((u) => u.includes('/employees/30'))).toBe(true);
    expect(deleteUrls.some((u) => u.includes('/locations/20'))).toBe(true);
    expect(deleteUrls.some((u) => u.includes('/companies/10'))).toBe(true);
  });

  it('lookupRegisterClientCompany reuses ANAF service', async () => {
    (anafLookupService.lookupCompany as any).mockResolvedValue({
      company: { name: 'X' },
      anaf_token: 't',
    });
    const r = await service.lookupRegisterClientCompany('12345678');
    expect(anafLookupService.lookupCompany).toHaveBeenCalledWith('12345678');
    expect(r).toEqual({ company: { name: 'X' }, anaf_token: 't' });
  });
});
