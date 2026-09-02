import { describe, expect, it } from '@jest/globals';
import { getJwtCompanyId, isGlobalStockAdmin } from './stock-access';

describe('stock-access', () => {
  it('tenant admin with company_id is not global stock admin', () => {
    expect(
      isGlobalStockAdmin({
        roles: ['admin'],
        company_id: 15,
      }),
    ).toBe(false);
  });

  it('tenant assignment.read_all with company_id is not global', () => {
    expect(
      isGlobalStockAdmin({
        permissions: ['assignment.read_all'],
        company_id: 15,
      }),
    ).toBe(false);
  });

  it('platform operator without company_id is global', () => {
    expect(
      isGlobalStockAdmin({
        permissions: ['assignment.read_all'],
      }),
    ).toBe(true);
    expect(isGlobalStockAdmin({ roles: ['admin'] })).toBe(true);
  });

  it('getJwtCompanyId resolves company_id and companyId', () => {
    expect(getJwtCompanyId({ company_id: 3 })).toBe(3);
    expect(getJwtCompanyId({ companyId: 8 })).toBe(8);
  });
});
