/**
 * Rulare:
 *   npx tsx --test src/suppliers/giurom2-zones-url.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { zonesCatalogUrlFromKnown } from './giurom2-zones-url';

test('păstrează prefixul /api din URL-ul de stoc', () => {
  assert.equal(
    zonesCatalogUrlFromKnown('https://restosoft.ro/api/integrations/stock-sync'),
    'https://restosoft.ro/api/integrations/stock-sync/zones',
  );
});

test('din URL-ul de NIR deduce același catalog, cu /api', () => {
  assert.equal(
    zonesCatalogUrlFromKnown('https://restosoft.ro/api/integrations/nir-sync'),
    'https://restosoft.ro/api/integrations/stock-sync/zones',
  );
});

test('fără /api rămâne fără /api', () => {
  assert.equal(
    zonesCatalogUrlFromKnown('https://restosoft.ro/integrations/stock-sync'),
    'https://restosoft.ro/integrations/stock-sync/zones',
  );
});
