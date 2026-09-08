/**
 * Jest: npm test -- src/suppliers/supplier-connection-code-attempt.service.test.ts
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { SupplierConnectionCodeAttemptService } from './supplier-connection-code-attempt.service';
import {
  CONNECTION_CODE_LOCKED_ERROR,
  CONNECTION_CODE_MAX_FAILED_ATTEMPTS,
} from './connection-code-attempt.util';

function buildService(initial?: {
  failed_count?: number;
  locked_until?: Date | null;
}) {
  const row = {
    client_company_id: 42,
    failed_count: initial?.failed_count ?? 0,
    locked_until: initial?.locked_until ?? null,
    last_failed_at: null as Date | null,
    updated_by_user_id: null as number | null,
    updated_at: new Date(),
  };

  const attemptRepo = {
    findOne: jest.fn(async () => ({ ...row })),
    create: jest.fn((x) => x),
    save: jest.fn(async (x: typeof row) => {
      Object.assign(row, x);
      return { ...row };
    }),
  };

  const connection = {
    query: jest.fn(async (sql: string) => {
      if (String(sql).includes('GET_LOCK')) return [{ acquired: 1 }];
      return [{ released: 1 }];
    }),
  };

  const service = new SupplierConnectionCodeAttemptService(
    attemptRepo as any,
    connection as any,
  );

  return { service, attemptRepo, connection, row };
}

describe('SupplierConnectionCodeAttemptService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('1st invalid -> failed_count=1', async () => {
    const { service, row } = buildService();
    await expect(service.recordInvalidAttempt(42, 9)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(row.failed_count).toBe(1);
  });

  it('2nd invalid -> failed_count=2', async () => {
    const { service, row } = buildService({ failed_count: 1 });
    await expect(service.recordInvalidAttempt(42)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(row.failed_count).toBe(2);
  });

  it('3rd invalid -> attempts_remaining=2 (warning band)', async () => {
    const { service } = buildService({ failed_count: 2 });
    try {
      await service.recordInvalidAttempt(42);
      throw new Error('expected throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(NotFoundException);
      const body = err.getResponse();
      expect(body.attempts_remaining).toBe(2);
      expect(body.failed_count).toBe(3);
      expect(String(body.message)).toContain('2 încercări');
    }
  });

  it('4th invalid -> attempts_remaining=1', async () => {
    const { service } = buildService({ failed_count: 3 });
    try {
      await service.recordInvalidAttempt(42);
      throw new Error('expected throw');
    } catch (err: any) {
      const body = err.getResponse();
      expect(body.attempts_remaining).toBe(1);
    }
  });

  it('5th invalid -> lock 10 minutes (429)', async () => {
    const { service, row } = buildService({ failed_count: 4 });
    const before = Date.now();
    try {
      await service.recordInvalidAttempt(42);
      throw new Error('expected throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const body = err.getResponse();
      expect(body.code).toBe(CONNECTION_CODE_LOCKED_ERROR);
      expect(body.seconds_remaining).toBeGreaterThan(0);
      expect(row.failed_count).toBe(CONNECTION_CODE_MAX_FAILED_ATTEMPTS);
      expect(row.locked_until).toBeTruthy();
      expect(new Date(row.locked_until!).getTime()).toBeGreaterThanOrEqual(
        before + 9 * 60 * 1000,
      );
    }
  });

  it('while locked assertNotLocked throws 429 without needing code check', async () => {
    const lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
    const { service } = buildService({
      failed_count: 5,
      locked_until: lockedUntil,
    });
    await expect(service.assertNotLocked(42)).rejects.toBeInstanceOf(
      HttpException,
    );
    try {
      await service.assertNotLocked(42);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('after lock expiry clearExpiredLock resets and allows retry', async () => {
    const { service, row } = buildService({
      failed_count: 5,
      locked_until: new Date(Date.now() - 1000),
    });
    const status = await service.getStatus(42);
    expect(status.locked).toBe(false);
    expect(status.failed_count).toBe(0);
    expect(row.failed_count).toBe(0);
    expect(row.locked_until).toBeNull();
  });

  it('resetAttempts clears counter and lock', async () => {
    const { service, row } = buildService({
      failed_count: 3,
      locked_until: new Date(Date.now() + 60_000),
    });
    await service.resetAttempts(42, 11);
    expect(row.failed_count).toBe(0);
    expect(row.locked_until).toBeNull();
    expect(row.updated_by_user_id).toBe(11);
  });

  it('company A failures do not mutate company B row', async () => {
    const rows: Record<number, any> = {
      1: {
        client_company_id: 1,
        failed_count: 0,
        locked_until: null,
        last_failed_at: null,
        updated_by_user_id: null,
      },
      2: {
        client_company_id: 2,
        failed_count: 0,
        locked_until: null,
        last_failed_at: null,
        updated_by_user_id: null,
      },
    };
    const attemptRepo = {
      findOne: jest.fn(async ({ where }: any) => ({
        ...rows[where.client_company_id],
      })),
      create: jest.fn((x) => x),
      save: jest.fn(async (x: any) => {
        rows[x.client_company_id] = { ...x };
        return { ...x };
      }),
    };
    const service = new SupplierConnectionCodeAttemptService(
      attemptRepo as any,
      { query: jest.fn(async () => [{ acquired: 1 }]) } as any,
    );
    await expect(service.recordInvalidAttempt(1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(rows[1].failed_count).toBe(1);
    expect(rows[2].failed_count).toBe(0);
  });

  it('uses MySQL GET_LOCK per company for concurrency', async () => {
    const { service, connection } = buildService();
    await service.withCompanyAttemptLock(7, async () => true);
    await service.withCompanyAttemptLock(7, async () => true);
    expect(
      connection.query.mock.calls.filter((c: any[]) =>
        String(c[0]).includes('GET_LOCK'),
      ).length,
    ).toBe(2);
    expect(
      connection.query.mock.calls.filter((c: any[]) =>
        String(c[0]).includes('RELEASE_LOCK'),
      ).length,
    ).toBe(2);
  });
});
