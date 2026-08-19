/**
 * Rulare:
 *   npx tsx --test src/suppliers/supplier-product-access.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedClientManagedProductCompany } from './supplier-product-access';

test('legacy null company_id is allowed for client-managed products', () => {
  assert.equal(isAllowedClientManagedProductCompany(null, 10, null), true);
  assert.equal(isAllowedClientManagedProductCompany(undefined, 10, 99), true);
  assert.equal(isAllowedClientManagedProductCompany(0, 10, null), true);
});

test('product tagged with administering client company is allowed', () => {
  assert.equal(isAllowedClientManagedProductCompany(10, 10, null), true);
});

test('product tagged with supplier owner_company_id is allowed', () => {
  assert.equal(isAllowedClientManagedProductCompany(77, 10, 77), true);
});

test('product tagged with another tenant is rejected', () => {
  assert.equal(isAllowedClientManagedProductCompany(5, 10, 77), false);
  assert.equal(isAllowedClientManagedProductCompany(5, 10, null), false);
});
