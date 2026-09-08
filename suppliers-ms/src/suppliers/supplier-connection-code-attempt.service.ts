/**
 * Persistent per-company lockout for POST /suppliers/connect wrong codes.
 */
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { ClientSupplierConnectionAttempt } from './entities/client-supplier-connection-attempt.entity';
import {
  CONNECTION_CODE_INVALID_ERROR,
  CONNECTION_CODE_LOCK_DURATION_MS,
  CONNECTION_CODE_LOCKED_ERROR,
  CONNECTION_CODE_MAX_FAILED_ATTEMPTS,
  connectionCodeAttemptsRemaining,
  connectionCodeSecondsRemaining,
  formatConnectionCodeInvalidMessage,
  formatConnectionCodeLockMessage,
} from './connection-code-attempt.util';

export type ConnectionAttemptStatusView = {
  failed_count: number;
  attempts_remaining: number;
  locked: boolean;
  locked_until: string | null;
  seconds_remaining: number;
  max_attempts: number;
};

@Injectable()
export class SupplierConnectionCodeAttemptService {
  private readonly logger = new Logger(SupplierConnectionCodeAttemptService.name);

  constructor(
    @InjectRepository(ClientSupplierConnectionAttempt)
    private readonly attemptRepo: Repository<ClientSupplierConnectionAttempt>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async withCompanyAttemptLock<T>(
    companyId: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cid = Number(companyId);
    if (!Number.isFinite(cid) || cid <= 0) {
      return fn();
    }
    const lockName = `giurom_connect_code_attempts_${cid}`;
    const acquiredRows: Array<{ acquired: number | string }> =
      await this.connection.query('SELECT GET_LOCK(?, 10) AS acquired', [
        lockName,
      ]);
    const acquired = Number(acquiredRows?.[0]?.acquired);
    if (acquired !== 1) {
      throw new ServiceUnavailableException(
        'Nu s-a putut verifica limita de încercări. Reîncearcă.',
      );
    }
    try {
      return await fn();
    } finally {
      try {
        await this.connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch (error: any) {
        this.logger.warn(
          `RELEASE_LOCK(${lockName}) failed: ${error?.message || error}`,
        );
      }
    }
  }

  async getStatus(companyId: number): Promise<ConnectionAttemptStatusView> {
    const cid = Number(companyId);
    const row = await this.ensureRow(cid);
    const cleared = await this.clearExpiredLock(row);
    return this.toStatusView(cleared);
  }

  /**
   * Throws 429 if company is currently locked. Clears expired locks.
   * Must run inside withCompanyAttemptLock.
   */
  async assertNotLocked(companyId: number): Promise<ClientSupplierConnectionAttempt> {
    const row = await this.ensureRow(Number(companyId));
    const cleared = await this.clearExpiredLock(row);
    const seconds = connectionCodeSecondsRemaining(cleared.locked_until);
    if (seconds > 0) {
      this.throwLocked(cleared.locked_until!, seconds);
    }
    return cleared;
  }

  /**
   * Increment failed_count; lock after MAX. Must run inside withCompanyAttemptLock.
   */
  async recordInvalidAttempt(
    companyId: number,
    userId?: number | null,
  ): Promise<ConnectionAttemptStatusView> {
    const row = await this.ensureRow(Number(companyId));
    await this.clearExpiredLock(row);

    const nextFailed = Math.min(
      CONNECTION_CODE_MAX_FAILED_ATTEMPTS,
      Number(row.failed_count || 0) + 1,
    );
    row.failed_count = nextFailed;
    row.last_failed_at = new Date();
    if (userId != null && Number.isFinite(Number(userId))) {
      row.updated_by_user_id = Number(userId);
    }

    if (nextFailed >= CONNECTION_CODE_MAX_FAILED_ATTEMPTS) {
      row.locked_until = new Date(Date.now() + CONNECTION_CODE_LOCK_DURATION_MS);
      await this.attemptRepo.save(row);
      const seconds = connectionCodeSecondsRemaining(row.locked_until);
      this.throwLocked(row.locked_until, seconds);
    }

    await this.attemptRepo.save(row);
    const status = this.toStatusView(row);
    throw new NotFoundException({
      statusCode: HttpStatus.NOT_FOUND,
      code: CONNECTION_CODE_INVALID_ERROR,
      message: formatConnectionCodeInvalidMessage(status.attempts_remaining),
      attempts_remaining: status.attempts_remaining,
      failed_count: status.failed_count,
      max_attempts: CONNECTION_CODE_MAX_FAILED_ATTEMPTS,
    });
  }

  /** Reset after a cryptographically/lookup-valid connection code. */
  async resetAttempts(
    companyId: number,
    userId?: number | null,
  ): Promise<void> {
    const row = await this.ensureRow(Number(companyId));
    row.failed_count = 0;
    row.locked_until = null;
    row.last_failed_at = null;
    if (userId != null && Number.isFinite(Number(userId))) {
      row.updated_by_user_id = Number(userId);
    }
    await this.attemptRepo.save(row);
  }

  private async ensureRow(
    companyId: number,
  ): Promise<ClientSupplierConnectionAttempt> {
    const cid = Number(companyId);
    let row = await this.attemptRepo.findOne({
      where: { client_company_id: cid },
    });
    if (row) return row;
    row = this.attemptRepo.create({
      client_company_id: cid,
      failed_count: 0,
      locked_until: null,
      last_failed_at: null,
      updated_by_user_id: null,
    });
    try {
      return await this.attemptRepo.save(row);
    } catch (error: any) {
      const msg = String(error?.message || error || '');
      if (/Duplicate|ER_DUP_ENTRY/i.test(msg)) {
        const again = await this.attemptRepo.findOne({
          where: { client_company_id: cid },
        });
        if (again) return again;
      }
      throw error;
    }
  }

  private async clearExpiredLock(
    row: ClientSupplierConnectionAttempt,
  ): Promise<ClientSupplierConnectionAttempt> {
    if (!row.locked_until) {
      return row;
    }
    if (connectionCodeSecondsRemaining(row.locked_until) > 0) {
      return row;
    }
    row.locked_until = null;
    row.failed_count = 0;
    row.last_failed_at = null;
    return this.attemptRepo.save(row);
  }

  private toStatusView(
    row: ClientSupplierConnectionAttempt,
  ): ConnectionAttemptStatusView {
    const seconds = connectionCodeSecondsRemaining(row.locked_until);
    return {
      failed_count: Number(row.failed_count) || 0,
      attempts_remaining: connectionCodeAttemptsRemaining(row.failed_count),
      locked: seconds > 0,
      locked_until:
        seconds > 0 && row.locked_until
          ? new Date(row.locked_until).toISOString()
          : null,
      seconds_remaining: seconds,
      max_attempts: CONNECTION_CODE_MAX_FAILED_ATTEMPTS,
    };
  }

  private throwLocked(lockedUntil: Date, secondsRemaining: number): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: CONNECTION_CODE_LOCKED_ERROR,
        message: formatConnectionCodeLockMessage(secondsRemaining),
        locked_until: new Date(lockedUntil).toISOString(),
        seconds_remaining: secondsRemaining,
        attempts_remaining: 0,
        failed_count: CONNECTION_CODE_MAX_FAILED_ATTEMPTS,
        max_attempts: CONNECTION_CODE_MAX_FAILED_ATTEMPTS,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
