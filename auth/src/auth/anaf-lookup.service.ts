import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';

/**
 * Snapshot intern normalizat al datelor unei firme preluate din ANAF.
 * Aplicația NU depinde de structura brută a răspunsului ANAF — dacă ANAF
 * își schimbă formatul, doar adaptorul din acest fișier trebuie actualizat.
 */
export interface AnafCompanySnapshot {
  cui: string;
  name: string | null;
  registrationNumber: string | null;
  phone: string | null;
  caenCode: string | null;
  legalForm: string | null;
  incorporationDate: string | null;
  registrationStatus: string | null;
  vatRegistered: boolean;
  inactive: boolean;
  address: {
    street: string | null;
    number: string | null;
    city: string | null;
    county: string | null;
    postalCode: string | null;
    country: string;
    details: string | null;
  };
}

export type AnafLookupErrorCode =
  | 'invalid_cui'
  | 'not_found'
  | 'anaf_unavailable'
  | 'timeout'
  | 'invalid_response';

export const ANAF_LOOKUP_USER_MESSAGES: Record<AnafLookupErrorCode, string> = {
  invalid_cui: 'CUI-ul introdus nu este valid. Verifică valoarea introdusă.',
  not_found:
    'CUI-ul introdus nu a fost găsit în baza de date ANAF. Verifică dacă este corect și încearcă din nou.',
  anaf_unavailable:
    'Serviciul ANAF este momentan indisponibil. Poți completa datele manual.',
  timeout:
    'ANAF nu a răspuns la timp. Încearcă din nou sau completează datele manual.',
  invalid_response:
    'Răspunsul ANAF nu a putut fi interpretat. Poți completa datele manual.',
};

export interface AnafLookupResult {
  found: boolean;
  error?: AnafLookupErrorCode;
  /** Mesaj clar pentru utilizator, diferențiat pe tip de eroare. */
  message?: string;
  company?: AnafCompanySnapshot;
  verified_at?: string;
  /** Token semnat server-side; dovedește la submit că lookup-ul a fost real. */
  anaf_token?: string;
}

interface AnafTokenPayload {
  typ: string;
  cui: string;
  verified_at: string;
  snapshot: AnafCompanySnapshot;
}

const ANAF_TOKEN_TYPE = 'anaf-company-lookup';
const ANAF_TOKEN_TTL = '2h';
const ANAF_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Normalizează un CUI românesc: trim, elimină prefixul RO (case-insensitive),
 * elimină spații/puncte/cratime, validează că rămân doar cifre (2–10).
 * Returnează null dacă valoarea nu este un CUI valid.
 */
export function normalizeCuiDigits(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  let value = raw.trim();
  if (!value) return null;
  value = value.replace(/^ro/i, '');
  value = value.replace(/[\s.\-]/g, '');
  if (!/^\d{2,10}$/.test(value)) return null;
  return value;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Adaptor pur (testabil): transformă răspunsul brut ANAF v9 în snapshotul
 * intern stabil. Returnează null pentru CUI negăsit; aruncă pentru structuri
 * complet neașteptate.
 */
export function mapAnafV9ResponseToSnapshot(
  data: unknown,
  cuiDigits: string,
): AnafCompanySnapshot | null {
  if (!data || typeof data !== 'object') {
    throw new Error('Răspuns ANAF gol sau non-obiect');
  }
  const body = data as { found?: unknown; notFound?: unknown };
  const foundList = Array.isArray(body.found) ? body.found : [];
  if (foundList.length === 0) {
    if (!Array.isArray(body.found) && !Array.isArray(body.notFound)) {
      throw new Error('Răspuns ANAF fără listele found/notFound');
    }
    return null;
  }

  const entry = foundList[0] as {
    date_generale?: Record<string, unknown>;
    adresa_sediu_social?: Record<string, unknown>;
    adresa_domiciliu_fiscal?: Record<string, unknown>;
    inregistrare_scop_Tva?: Record<string, unknown>;
    stare_inactiv?: Record<string, unknown>;
  };
  const general = entry.date_generale ?? {};
  const sediu = entry.adresa_sediu_social ?? {};
  const fiscal = entry.adresa_domiciliu_fiscal ?? {};

  const street =
    asTrimmedString(sediu['sdenumire_Strada']) ??
    asTrimmedString(fiscal['ddenumire_Strada']);
  const number =
    asTrimmedString(sediu['snumar_Strada']) ??
    asTrimmedString(fiscal['dnumar_Strada']);
  const city =
    asTrimmedString(sediu['sdenumire_Localitate']) ??
    asTrimmedString(fiscal['ddenumire_Localitate']);
  const county =
    asTrimmedString(sediu['sdenumire_Judet']) ??
    asTrimmedString(fiscal['ddenumire_Judet']);
  const postalCode =
    asTrimmedString(sediu['scod_Postal']) ??
    asTrimmedString(fiscal['dcod_Postal']) ??
    asTrimmedString(general['codPostal']);
  const details =
    asTrimmedString(sediu['sdetalii_Adresa']) ??
    asTrimmedString(fiscal['ddetalii_Adresa']);

  const incorporationRaw = asTrimmedString(general['data_inregistrare']);
  const incorporationDate =
    incorporationRaw && /^\d{4}-\d{2}-\d{2}/.test(incorporationRaw)
      ? incorporationRaw.slice(0, 10)
      : null;

  const vatRegistered =
    (entry.inregistrare_scop_Tva as { scpTVA?: unknown } | undefined)
      ?.scpTVA === true;
  const inactive =
    (entry.stare_inactiv as { statusInactivi?: unknown } | undefined)
      ?.statusInactivi === true;

  return {
    cui: cuiDigits,
    name: asTrimmedString(general['denumire']),
    registrationNumber: asTrimmedString(general['nrRegCom']),
    phone: asTrimmedString(general['telefon']),
    caenCode: asTrimmedString(general['cod_CAEN']),
    legalForm: asTrimmedString(general['forma_juridica']),
    incorporationDate,
    registrationStatus: asTrimmedString(general['stare_inregistrare']),
    vatRegistered,
    inactive,
    address: {
      street,
      number,
      city,
      county,
      postalCode,
      country: 'Romania',
      details,
    },
  };
}

function anafLookupFailure(
  error: AnafLookupErrorCode,
): AnafLookupResult {
  return {
    found: false,
    error,
    message: ANAF_LOOKUP_USER_MESSAGES[error],
  };
}

@Injectable()
export class AnafLookupService {
  private readonly logger = new Logger(AnafLookupService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  private anafUrl(): string {
    return (
      this.configService.get<string>('ANAF_COMPANY_LOOKUP_URL') ||
      'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva'
    );
  }

  /**
   * Caută firma la ANAF după CUI. Nu salvează nimic în DB.
   * Rezultatul include un token semnat, folosit la submit pentru a dovedi
   * că datele marcate `anaf` provin dintr-un lookup real (anti-falsificare).
   */
  async lookupCompany(rawCui: string): Promise<AnafLookupResult> {
    const cuiDigits = normalizeCuiDigits(rawCui);
    if (!cuiDigits) {
      return anafLookupFailure('invalid_cui');
    }

    const today = new Date().toISOString().slice(0, 10);
    let responseData: unknown;
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.anafUrl(),
          [{ cui: Number(cuiDigits), data: today }],
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: ANAF_REQUEST_TIMEOUT_MS,
          },
        ),
      );
      responseData = response.data;
    } catch (error: any) {
      if (
        error?.code === 'ECONNABORTED' ||
        /timeout/i.test(String(error?.message ?? ''))
      ) {
        this.logger.warn(`ANAF lookup timeout pentru CUI ${cuiDigits}`);
        return anafLookupFailure('timeout');
      }
      const status = error?.response?.status;
      this.logger.warn(
        `ANAF lookup indisponibil pentru CUI ${cuiDigits}: status=${status ?? 'N/A'} message=${error?.message}`,
      );
      return anafLookupFailure('anaf_unavailable');
    }

    let snapshot: AnafCompanySnapshot | null;
    try {
      snapshot = mapAnafV9ResponseToSnapshot(responseData, cuiDigits);
    } catch (error: any) {
      this.logger.warn(
        `Răspuns ANAF invalid pentru CUI ${cuiDigits}: ${error?.message}`,
      );
      return anafLookupFailure('invalid_response');
    }

    if (!snapshot) {
      return anafLookupFailure('not_found');
    }

    const verifiedAt = new Date().toISOString();
    const tokenPayload: AnafTokenPayload = {
      typ: ANAF_TOKEN_TYPE,
      cui: cuiDigits,
      verified_at: verifiedAt,
      snapshot,
    };
    const anafToken = await this.jwtService.signAsync(tokenPayload, {
      expiresIn: ANAF_TOKEN_TTL,
    });

    return {
      found: true,
      company: snapshot,
      verified_at: verifiedAt,
      anaf_token: anafToken,
    };
  }

  /**
   * Verifică tokenul ANAF primit la submit. Returnează snapshotul + momentul
   * verificării doar dacă tokenul e valid, semnat de noi și pentru același CUI.
   */
  async verifyAnafToken(
    token: string,
    expectedCuiDigits: string,
  ): Promise<{ snapshot: AnafCompanySnapshot; verified_at: string } | null> {
    try {
      const payload = await this.jwtService.verifyAsync<AnafTokenPayload>(token);
      if (payload?.typ !== ANAF_TOKEN_TYPE) return null;
      if (payload?.cui !== expectedCuiDigits) return null;
      if (!payload?.snapshot || typeof payload.snapshot !== 'object') {
        return null;
      }
      return {
        snapshot: payload.snapshot,
        verified_at: payload.verified_at || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

}
