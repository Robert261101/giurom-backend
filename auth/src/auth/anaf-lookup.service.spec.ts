import { describe, expect, it } from '@jest/globals';
import {
  mapAnafV9ResponseToSnapshot,
  normalizeCuiDigits,
  ANAF_LOOKUP_USER_MESSAGES,
} from './anaf-lookup.service';
import { formatDefaultLocationName } from './location-name.util';

describe('normalizeCuiDigits', () => {
  it('acceptă CUI numeric simplu', () => {
    expect(normalizeCuiDigits('12345678')).toBe('12345678');
  });

  it('elimină prefixul RO (case-insensitive)', () => {
    expect(normalizeCuiDigits('RO12345678')).toBe('12345678');
    expect(normalizeCuiDigits('ro12345678')).toBe('12345678');
    expect(normalizeCuiDigits('Ro12345678')).toBe('12345678');
  });

  it('elimină spații, puncte și cratime', () => {
    expect(normalizeCuiDigits('12 345 678')).toBe('12345678');
    expect(normalizeCuiDigits('RO 12-345.678')).toBe('12345678');
    expect(normalizeCuiDigits('  12345678  ')).toBe('12345678');
  });

  it('respinge valori non-numerice sau cu lungime nerezonabilă', () => {
    expect(normalizeCuiDigits('ABC123')).toBeNull();
    expect(normalizeCuiDigits('1')).toBeNull();
    expect(normalizeCuiDigits('12345678901')).toBeNull();
    expect(normalizeCuiDigits('')).toBeNull();
    expect(normalizeCuiDigits('   ')).toBeNull();
    expect(normalizeCuiDigits(null)).toBeNull();
    expect(normalizeCuiDigits(undefined)).toBeNull();
    expect(normalizeCuiDigits('RO12E45678')).toBeNull();
  });
});

describe('mapAnafV9ResponseToSnapshot', () => {
  const foundResponse = {
    cod: 200,
    message: 'SUCCESS',
    found: [
      {
        date_generale: {
          cui: 12345678,
          denumire: 'SC EXEMPLU SRL',
          nrRegCom: 'J35/123/2020',
          telefon: '0256123456',
          codPostal: '300001',
          stare_inregistrare: 'INREGISTRAT',
          data_inregistrare: '2020-03-15',
          cod_CAEN: '6201',
          forma_juridica: 'SOCIETATE CU RASPUNDERE LIMITATA',
        },
        inregistrare_scop_Tva: { scpTVA: true },
        stare_inactiv: { statusInactivi: false },
        adresa_sediu_social: {
          sdenumire_Strada: 'Strada Exemplu',
          snumar_Strada: '10',
          sdenumire_Localitate: 'Timisoara',
          sdenumire_Judet: 'Timis',
          scod_Postal: '300001',
          sdetalii_Adresa: 'ap. 3',
        },
        adresa_domiciliu_fiscal: {
          ddenumire_Strada: 'Strada Fiscala',
          dnumar_Strada: '99',
        },
      },
    ],
    notFound: [],
  };

  it('mapează un răspuns found în snapshotul intern', () => {
    const snapshot = mapAnafV9ResponseToSnapshot(foundResponse, '12345678');
    expect(snapshot).toEqual({
      cui: '12345678',
      name: 'SC EXEMPLU SRL',
      registrationNumber: 'J35/123/2020',
      phone: '0256123456',
      caenCode: '6201',
      legalForm: 'SOCIETATE CU RASPUNDERE LIMITATA',
      incorporationDate: '2020-03-15',
      registrationStatus: 'INREGISTRAT',
      vatRegistered: true,
      inactive: false,
      address: {
        street: 'Strada Exemplu',
        number: '10',
        city: 'Timisoara',
        county: 'Timis',
        postalCode: '300001',
        country: 'Romania',
        details: 'ap. 3',
      },
    });
  });

  it('folosește adresa de domiciliu fiscal ca fallback pentru sediu', () => {
    const withoutSediu = {
      ...foundResponse,
      found: [
        {
          ...foundResponse.found[0],
          adresa_sediu_social: {},
        },
      ],
    };
    const snapshot = mapAnafV9ResponseToSnapshot(withoutSediu, '12345678');
    expect(snapshot?.address.street).toBe('Strada Fiscala');
    expect(snapshot?.address.number).toBe('99');
  });

  it('returnează null pentru CUI negăsit', () => {
    expect(
      mapAnafV9ResponseToSnapshot(
        { cod: 200, found: [], notFound: [12345678] },
        '12345678',
      ),
    ).toBeNull();
  });

  it('aruncă pentru răspuns invalid', () => {
    expect(() => mapAnafV9ResponseToSnapshot(null, '1')).toThrow();
    expect(() => mapAnafV9ResponseToSnapshot('html error page', '1')).toThrow();
    expect(() => mapAnafV9ResponseToSnapshot({ cod: 500 }, '1')).toThrow();
  });

  it('nu inventează date lipsă (câmpuri absente devin null)', () => {
    const minimal = {
      cod: 200,
      found: [{ date_generale: { denumire: 'FIRMA X' } }],
      notFound: [],
    };
    const snapshot = mapAnafV9ResponseToSnapshot(minimal, '999999');
    expect(snapshot?.name).toBe('FIRMA X');
    expect(snapshot?.registrationNumber).toBeNull();
    expect(snapshot?.phone).toBeNull();
    expect(snapshot?.caenCode).toBeNull();
    expect(snapshot?.address.street).toBeNull();
    expect(snapshot?.vatRegistered).toBe(false);
  });
});

describe('formatDefaultLocationName', () => {
  it('prefixează localitatea cu Loc., fără denumire companie', () => {
    expect(formatDefaultLocationName('Eforie Nord Oraș Eforie')).toBe(
      'Loc. Eforie Nord Oraș Eforie',
    );
    expect(formatDefaultLocationName('Constanța')).toBe('Loc. Constanța');
  });

  it('nu dublează prefixul dacă localitatea îl are deja', () => {
    expect(formatDefaultLocationName('Loc. Timișoara')).toBe('Loc. Timișoara');
    expect(formatDefaultLocationName('Mun. București')).toBe('Mun. București');
  });

  it('fallback generic când lipsește localitatea', () => {
    expect(formatDefaultLocationName('')).toBe('Locație');
    expect(formatDefaultLocationName(null)).toBe('Locație');
  });
});

describe('ANAF_LOOKUP_USER_MESSAGES', () => {
  it('oferă mesaje distincte pentru CUI negăsit vs indisponibilitate ANAF', () => {
    expect(ANAF_LOOKUP_USER_MESSAGES.not_found).toContain('nu a fost găsit');
    expect(ANAF_LOOKUP_USER_MESSAGES.not_found).not.toBe(
      ANAF_LOOKUP_USER_MESSAGES.anaf_unavailable,
    );
    expect(ANAF_LOOKUP_USER_MESSAGES.not_found).not.toBe(
      ANAF_LOOKUP_USER_MESSAGES.invalid_response,
    );
  });
});
