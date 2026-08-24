/**
 * Rulare:
 *   npx tsx --test src/suppliers/giurom2-zone-ref.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOrderLineZoneId, resolveEntryDocumentZoneRef } from './giurom2-zone-ref';

const allowed = new Set([7, 11, 12]);

test('gestiunea din setul locației se păstrează', () => {
  assert.equal(resolveOrderLineZoneId(11, allowed), 11);
  assert.equal(resolveOrderLineZoneId('11' as unknown as number, allowed), 11);
});

test('linia fără gestiune rămâne fără gestiune', () => {
  assert.equal(resolveOrderLineZoneId(null, allowed), null);
  assert.equal(resolveOrderLineZoneId(undefined, allowed), null);
});

test('gestiunea altei locații se ignoră, comanda nu eșuează', () => {
  assert.equal(resolveOrderLineZoneId(99, allowed), null);
});

test('valorile absurde nu ajung în DB', () => {
  assert.equal(resolveOrderLineZoneId(0, allowed), null);
  assert.equal(resolveOrderLineZoneId(-3, allowed), null);
  assert.equal(resolveOrderLineZoneId(Number.NaN, allowed), null);
});

test('locație nelegată: setul gol respinge orice gestiune', () => {
  assert.equal(resolveOrderLineZoneId(7, new Set()), null);
});

test('pe document, recepția bate comanda', () => {
  assert.equal(resolveEntryDocumentZoneRef(12, 7), 12);
});

test('recepțiile de dinaintea migrării cad pe gestiunea de pe comandă', () => {
  assert.equal(resolveEntryDocumentZoneRef(null, 7), 7);
  assert.equal(resolveEntryDocumentZoneRef(undefined, 7), 7);
});

test('fără gestiune nicăieri, documentul pleacă fără etichetă', () => {
  assert.equal(resolveEntryDocumentZoneRef(null, null), null);
  assert.equal(resolveEntryDocumentZoneRef(undefined, undefined), null);
});
