/**
 * Framework-agnostic error for tenant scope violations.
 * Microservices map this to HTTP 403 in PR-1.1+.
 */
export class TenantScopeViolationError extends Error {
  readonly code = 'TENANT_SCOPE_VIOLATION';

  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeViolationError';
  }
}
