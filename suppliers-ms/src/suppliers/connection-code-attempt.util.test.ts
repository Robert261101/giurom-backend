/**
 * Jest: npm test -- src/suppliers/connection-code-attempt.util.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  CONNECTION_CODE_MAX_FAILED_ATTEMPTS,
  connectionCodeAttemptsRemaining,
  connectionCodeSecondsRemaining,
  formatConnectionCodeInvalidMessage,
  formatConnectionCodeLockMessage,
  shouldWarnConnectionCodeAttempts,
} from './connection-code-attempt.util';

describe('connection-code-attempt.util', () => {
  it('attempts remaining follows max 5 consecutive failures', () => {
    expect(CONNECTION_CODE_MAX_FAILED_ATTEMPTS).toBe(5);
    expect(connectionCodeAttemptsRemaining(0)).toBe(5);
    expect(connectionCodeAttemptsRemaining(1)).toBe(4);
    expect(connectionCodeAttemptsRemaining(2)).toBe(3);
    expect(connectionCodeAttemptsRemaining(3)).toBe(2);
    expect(connectionCodeAttemptsRemaining(4)).toBe(1);
    expect(connectionCodeAttemptsRemaining(5)).toBe(0);
  });

  it('warns only when 3/2/1 remaining', () => {
    expect(shouldWarnConnectionCodeAttempts(4)).toBe(false);
    expect(shouldWarnConnectionCodeAttempts(3)).toBe(true);
    expect(shouldWarnConnectionCodeAttempts(2)).toBe(true);
    expect(shouldWarnConnectionCodeAttempts(1)).toBe(true);
    expect(shouldWarnConnectionCodeAttempts(0)).toBe(false);
  });

  it('formats invalid messages for warning band', () => {
    expect(formatConnectionCodeInvalidMessage(4)).toBe(
      'Codul introdus nu este valid.',
    );
    expect(formatConnectionCodeInvalidMessage(3)).toContain('3 încercări');
    expect(formatConnectionCodeInvalidMessage(2)).toContain('2 încercări');
    expect(formatConnectionCodeInvalidMessage(1)).toContain('o singură încercare');
  });

  it('formats lock message from seconds', () => {
    expect(formatConnectionCodeLockMessage(30)).toContain('1 minut');
    expect(formatConnectionCodeLockMessage(600)).toContain('10 minute');
  });

  it('seconds remaining is zero when unlocked or expired', () => {
    expect(connectionCodeSecondsRemaining(null)).toBe(0);
    expect(
      connectionCodeSecondsRemaining(new Date(Date.now() - 1000)),
    ).toBe(0);
    expect(
      connectionCodeSecondsRemaining(new Date(Date.now() + 2500)),
    ).toBeGreaterThanOrEqual(2);
  });
});
