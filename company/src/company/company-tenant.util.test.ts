/**
 * Jest: npm test -- src/company/company-tenant.util.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import { shouldBlockCompanyTypeChange } from './company-tenant.util';

describe('company-tenant.util', () => {
  it('update same-tenant type unchanged is allowed (no block)', () => {
    expect(shouldBlockCompanyTypeChange(false, 'client', 'client')).toBe(false);
  });

  it('non-platform changing company_type client → furnizor is blocked', () => {
    expect(shouldBlockCompanyTypeChange(false, 'client', 'furnizor')).toBe(
      true,
    );
  });

  it('platform admin may change company_type', () => {
    expect(shouldBlockCompanyTypeChange(true, 'client', 'furnizor')).toBe(
      false,
    );
  });

  it('omitted company_type is not blocked', () => {
    expect(shouldBlockCompanyTypeChange(false, 'client', undefined)).toBe(
      false,
    );
  });
});
