/**
 * Denumire implicită locație când utilizatorul nu completează manual câmpul.
 * Folosește doar localitatea (fără denumirea companiei).
 */
export function formatDefaultLocationName(
  city: string | null | undefined,
): string {
  const trimmed = String(city ?? '').trim();
  if (!trimmed) {
    return 'Locație';
  }
  if (/^(loc|mun|ora[sșş]|com|sat)\.?\s/i.test(trimmed)) {
    return trimmed;
  }
  return `Loc. ${trimmed}`;
}
