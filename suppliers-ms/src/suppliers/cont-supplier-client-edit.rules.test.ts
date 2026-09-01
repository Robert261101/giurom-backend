import {
  listPresentSupplierMasterFields,
  shouldBlockClientMasterUpdateOnContSupplier,
  SUPPLIER_MASTER_UPDATE_FIELDS,
} from './cont-supplier-client-edit.rules';

describe('cont-supplier-client-edit.rules', () => {
  it('lists present master fields from dto', () => {
    expect(
      listPresentSupplierMasterFields({
        vat_number: 'RO1',
        email: 'a@b.c',
        ignored: true,
      }),
    ).toEqual(['vat_number', 'email']);
  });

  it('blocks client Cont when any master field present', () => {
    expect(
      shouldBlockClientMasterUpdateOnContSupplier({
        isTenantScopedClient: true,
        hasRealSupplierLoginAccount: true,
        dto: { is_active: false },
      }),
    ).toBe(true);
  });

  it('allows Manual client update', () => {
    expect(
      shouldBlockClientMasterUpdateOnContSupplier({
        isTenantScopedClient: true,
        hasRealSupplierLoginAccount: false,
        dto: { email: 'x@y.z', is_active: true },
      }),
    ).toBe(false);
  });

  it('allows furnizor / platform Cont update', () => {
    expect(
      shouldBlockClientMasterUpdateOnContSupplier({
        isTenantScopedClient: false,
        hasRealSupplierLoginAccount: true,
        dto: { supplier_name: 'X' },
      }),
    ).toBe(false);
  });

  it('covers expected master field set', () => {
    expect(SUPPLIER_MASTER_UPDATE_FIELDS).toContain('vat_number');
    expect(SUPPLIER_MASTER_UPDATE_FIELDS).toContain('is_active');
    expect(SUPPLIER_MASTER_UPDATE_FIELDS).toContain('bank_account_number');
  });
});
