export const CONNECTION_CODE_MAX_FAILED_ATTEMPTS = 5;
export const CONNECTION_CODE_LOCK_DURATION_MS = 10 * 60 * 1000;
/** Warning in UI when remaining attempts are at or below this value. */
export const CONNECTION_CODE_WARNING_REMAINING_THRESHOLD = 3;

export const CONNECTION_CODE_LOCKED_ERROR = 'SUPPLIER_CONNECTION_CODE_LOCKED';
export const CONNECTION_CODE_INVALID_ERROR = 'SUPPLIER_CONNECTION_CODE_INVALID';

export function connectionCodeAttemptsRemaining(failedCount: number): number {
  const failed = Math.max(0, Number(failedCount) || 0);
  return Math.max(0, CONNECTION_CODE_MAX_FAILED_ATTEMPTS - failed);
}

export function connectionCodeSecondsRemaining(
  lockedUntil: Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!lockedUntil) return 0;
  const ms = new Date(lockedUntil).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 1000);
}

export function shouldWarnConnectionCodeAttempts(remaining: number): boolean {
  return (
    remaining > 0 &&
    remaining <= CONNECTION_CODE_WARNING_REMAINING_THRESHOLD
  );
}

export function formatConnectionCodeLockMessage(secondsRemaining: number): string {
  const seconds = Math.max(0, Math.ceil(Number(secondsRemaining) || 0));
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes === 1) {
    return 'Ai depășit numărul maxim de încercări. Poți încerca din nou peste 1 minut.';
  }
  return `Ai depășit numărul maxim de încercări. Poți încerca din nou peste ${minutes} minute.`;
}

export function formatConnectionCodeInvalidMessage(
  attemptsRemaining: number,
): string {
  const remaining = Math.max(0, Number(attemptsRemaining) || 0);
  if (remaining === 3) {
    return 'Cod incorect. Mai ai 3 încercări înainte de blocarea temporară.';
  }
  if (remaining === 2) {
    return 'Cod incorect. Mai ai 2 încercări înainte de blocarea temporară.';
  }
  if (remaining === 1) {
    return 'Cod incorect. Mai ai o singură încercare înainte de blocarea temporară.';
  }
  return 'Codul introdus nu este valid.';
}
