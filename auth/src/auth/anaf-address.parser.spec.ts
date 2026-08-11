import { describe, expect, it } from '@jest/globals';
import {
  buildAnafAddressDetails,
  extractAddressDetailComponents,
  parseAnafFreeformAddress,
} from './anaf-address.parser';

describe('extractAddressDetailComponents', () => {
  it('extrage Bl/Sc/Et/Ap din format liber cu cod poștal', () => {
    expect(
      extractAddressDetailComponents(
        'Șos. Iancului 11 Bl. 108 Sc. A Et. 5 Ap. 19 Cod 021713',
      ),
    ).toEqual(['Bl. 108', 'Sc. A', 'Et. 5', 'Ap. 19']);
  });

  it('extrage componente din format ANAF comma-separated', () => {
    expect(
      extractAddressDetailComponents(
        'MUNICIPIUL BUCUREȘTI, SECTOR 2, SOS. IANCULUI, NR.11, BL.108, SC.A, ET.5, AP.19',
      ),
    ).toEqual(['Bl. 108', 'Sc. A', 'Et. 5', 'Ap. 19']);
  });

  it('acceptă variante fără punct și cu virgule', () => {
    expect(extractAddressDetailComponents('Bloc 108, Scara A, Etaj 5, Apartament 19')).toEqual([
      'Bl. 108',
      'Sc. A',
      'Et. 5',
      'Ap. 19',
    ]);
  });

  it('normalizează ap. 3', () => {
    expect(extractAddressDetailComponents('ap. 3')).toEqual(['Ap. 3']);
  });
});

describe('buildAnafAddressDetails', () => {
  it('folosește date_generale.adresa când sdetalii_Adresa este gol', () => {
    expect(
      buildAnafAddressDetails({
        explicitDetails: '',
        generalAddress:
          'MUNICIPIUL BUCUREȘTI, SECTOR 2, SOS. IANCULUI, NR.11, BL.108, SC.A, ET.5, AP.19',
        street: 'Șos. Iancului',
        number: '11',
      }),
    ).toBe('Bl. 108, Sc. A, Et. 5, Ap. 19');
  });

  it('prioritizează sdetalii_Adresa când este completat', () => {
    expect(
      buildAnafAddressDetails({
        explicitDetails: 'Bl. 2, Sc. B',
        generalAddress: 'BL.108, SC.A, ET.5, AP.19',
      }),
    ).toBe('Bl. 2, Sc. B, Bl. 108, Sc. A, Et. 5, Ap. 19');
  });
});

describe('parseAnafFreeformAddress', () => {
  it('parsează exemplul CUI 348855', () => {
    expect(
      parseAnafFreeformAddress(
        'Șos. Iancului 11 Bl. 108 Sc. A Et. 5 Ap. 19 Cod 021713',
      ),
    ).toEqual({
      street: 'Șos. Iancului',
      number: '11',
      postalCode: '021713',
      details: 'Bl. 108, Sc. A, Et. 5, Ap. 19',
    });
  });
});
