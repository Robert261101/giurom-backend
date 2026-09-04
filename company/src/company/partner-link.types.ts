/**
 * Contractul comun al celor două aplicații pentru „ce abonament are cealaltă parte".
 *
 * Perechea acestui fișier trăiește în giurom 2.0, la
 * `backend/src/modules/partner-link/partner-link.types.ts`. Sunt duplicate deliberat:
 * cele două aplicații sunt repo-uri separate, deployate separat, iar contractul e HTTP —
 * de aceea câmpurile sunt `snake_case` și orice adăugire trebuie făcută în ambele fișiere.
 */

/** Contul cu care se face login în aplicația parteneră. */
export interface PartnerAccountInfo {
  /** `false` = legătura există, dar nu există (încă) un cont de firmă de partea cealaltă. */
  exists: boolean;
  /** Denumirea firmei din aplicația parteneră. */
  name: string | null;
  /** Emailul contului, când aplicația parteneră ține unul. */
  email: string | null;
  /** Identificatorul de login, dacă diferă de email (ex. slug-ul firmei în App2). */
  login: string | null;
  /** Numele persoanei care administrează contul, dacă e cunoscut. */
  admin_name: string | null;
  /** Statusul contului în aplicația parteneră. */
  status: string | null;
}

export interface PartnerSubscriptionInfo {
  /** `false` = firma există, dar n-are niciun abonament înregistrat. */
  exists: boolean;
  status: string | null;
  plan_code: string | null;
  plan_name: string | null;
  price: number | null;
  currency: string | null;
  current_period_start: string | null;
  /** Data expirării — ce se întreabă de fapt. `null` pe planurile fără facturare. */
  current_period_end: string | null;
  paid_until: string | null;
  /** Zile întregi rămase; 0 după expirare, niciodată negativ. */
  days_left: number;
  /** `true` = abonamentul e expirat / contul e blocat până la plată. */
  expired: boolean;
}

/** O locație prin care cele două aplicații sunt legate. */
export interface PartnerLinkLocation {
  /** Locația din App1 (giurom-nou) — capătul stabil al legăturii. */
  location_id: number;
  location_name: string | null;
  /** Punctul de lucru corespondent din App2, când legătura e completă. */
  partner_location_name: string | null;
}

/** Un cont partener, cu abonamentul lui și locațiile prin care se leagă. */
export interface PartnerEntry {
  /** Firma din App1 implicată în legătură — cheia comună celor două aplicații. */
  company_id: number;
  account: PartnerAccountInfo;
  subscription: PartnerSubscriptionInfo;
  locations: PartnerLinkLocation[];
}

export interface PartnerSubscriptionResponse {
  /** Aplicația descrisă de răspuns: `giurom-nou` (App1) sau `giurom2` (App2). */
  source: 'giurom-nou' | 'giurom2';
  partners: PartnerEntry[];
  /**
   * Mesaj de afișat când datele sunt incomplete — ex. aplicația parteneră nu răspunde.
   * `null` = totul e în regulă. Lista goală fără warning înseamnă „nicio locație legată".
   */
  warning: string | null;
}

export function emptyPartnerAccount(): PartnerAccountInfo {
  return {
    exists: false,
    name: null,
    email: null,
    login: null,
    admin_name: null,
    status: null,
  };
}

export function emptyPartnerSubscription(): PartnerSubscriptionInfo {
  return {
    exists: false,
    status: null,
    plan_code: null,
    plan_name: null,
    price: null,
    currency: null,
    current_period_start: null,
    current_period_end: null,
    paid_until: null,
    days_left: 0,
    expired: true,
  };
}

/** Zile întregi rămase până la `end`, niciodată negativ. */
export function daysLeftUntil(
  end: string | Date | null | undefined,
  now: number = Date.now(),
): number {
  if (!end) return 0;
  const ms = new Date(end).getTime() - now;
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 86_400_000) : 0;
}
