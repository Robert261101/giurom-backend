/**
 * `https://host/api/integrations/nir-sync` → `https://host/api/integrations/stock-sync/zones`
 *
 * Păstrăm prefixul `/api`: fără el, stocul merge (URL complet) iar catalogul de gestiuni
 * lovește 404 pe `/integrations/...` și selectorul din App1 rămâne gol.
 */
export function zonesCatalogUrlFromKnown(known: string): string | null {
  try {
    const parsed = new URL(known);
    const path = parsed.pathname.replace(/\/+$/, '');
    const marker = '/integrations/';
    const idx = path.indexOf(marker);
    if (idx >= 0) {
      parsed.pathname = `${path.slice(0, idx)}${marker}stock-sync/zones`;
    } else if (/\/stock-sync$/i.test(path)) {
      parsed.pathname = `${path}/zones`;
    } else {
      parsed.pathname = `${path}/integrations/stock-sync/zones`;
    }
    parsed.search = '';
    return parsed.toString();
  } catch {
    return null;
  }
}
