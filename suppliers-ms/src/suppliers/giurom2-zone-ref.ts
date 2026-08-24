/**
 * Regulile după care eticheta de gestiune giurom 2.0 ajunge de pe linia de comandă pe
 * documentul de intrare.
 *
 * Sunt funcții pure, separate de serviciu, ca să poată fi testate: ambele decid tăcut
 * (fără excepții), deci un caz greșit s-ar vedea abia în App2, pe stoc.
 *
 * Nimic de aici nu atinge stocul App1 — marfa intră în continuare general pe locație.
 */

/**
 * Gestiunea cerută pe o linie de comandă → valoarea salvată efectiv.
 *
 * O gestiune care nu aparține locației comenzii e o eroare de UI (catalog învechit, locația
 * schimbată după alegere), nu vina operatorului, și n-are voie să facă o comandă să eșueze:
 * întoarcem `null`, iar în App2 linia cade pe gestiunea implicită a legăturii.
 */
export function resolveOrderLineZoneId(
  requested: number | null | undefined,
  allowedZoneIds: Set<number>,
): number | null {
  if (requested == null) return null;
  const zoneId = Number(requested);
  if (!Number.isFinite(zoneId) || zoneId <= 0) return null;
  return allowedZoneIds.has(zoneId) ? zoneId : null;
}

/**
 * Gestiunea trimisă pe linia documentului de intrare.
 *
 * Recepția bate comanda: tranșele aceleiași linii pot merge în gestiuni diferite, iar cea
 * de pe recepție e alegerea cea mai recentă. Fallback-ul pe comandă acoperă rândurile
 * create înainte de migrare, unde coloana de pe recepție e `NULL`.
 */
export function resolveEntryDocumentZoneRef(
  receptionZoneId: number | null | undefined,
  orderItemZoneId: number | null | undefined,
): number | null {
  const fromReception = Number(receptionZoneId);
  if (receptionZoneId != null && Number.isFinite(fromReception) && fromReception > 0) {
    return fromReception;
  }
  const fromOrder = Number(orderItemZoneId);
  if (orderItemZoneId != null && Number.isFinite(fromOrder) && fromOrder > 0) {
    return fromOrder;
  }
  return null;
}
