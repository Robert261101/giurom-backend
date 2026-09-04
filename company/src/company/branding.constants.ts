/**
 * Paleta de branding: ce culori se pot schimba și de la ce pornesc.
 *
 * Implicitele sunt culorile de brand pe care aplicația le folosește deja, luate din
 * `giurom-frontend/app/globals.css` și din clasele hardcodate care se repetă cel mai des
 * (`#0A1629` text, `#7D8592` text secundar, `#3F8CFF` brand). O firmă care n-a atins
 * nimic vede practic aceeași interfață.
 *
 * Excepția de știut: câteva griuri neutre din shadcn (`--accent`, `--ring`) sunt legate
 * de `color_accent` / `color_primary`, deci preiau tenta de brand — stările de hover din
 * meniuri și inelul de focus devin albăstrui în loc de gri. E schimbarea care face ca
 * paleta să se vadă cu adevărat în toată aplicația; cine vrea neutrul înapoi pune
 * `color_accent` pe un gri.
 *
 * Rulare teste: npx jest src/company/branding.constants.test.ts
 */

export const BRANDING_COLOR_KEYS = [
  'color_primary',
  'color_primary_foreground',
  'color_accent',
  'color_page_bg',
  'color_surface',
  'color_sidebar',
  'color_text',
  'color_text_muted',
  'color_border',
] as const;

export type BrandingColorKey = (typeof BRANDING_COLOR_KEYS)[number];

export type BrandingPalette = Record<BrandingColorKey, string>;

/** Culorile aplicației înainte de orice branding. */
export const DEFAULT_PALETTE: BrandingPalette = {
  color_primary: '#3F8CFF',
  color_primary_foreground: '#FFFFFF',
  color_accent: '#EFF6FF',
  color_page_bg: '#F6FBFF',
  color_surface: '#FFFFFF',
  color_sidebar: '#FFFFFF',
  color_text: '#0A1629',
  color_text_muted: '#7D8592',
  color_border: '#E0E7EF',
};

/** Eticheta și explicația fiecărei culori, pentru ecranul de branding. */
export const BRANDING_COLOR_LABELS: Record<
  BrandingColorKey,
  { label: string; description: string }
> = {
  color_primary: {
    label: 'Culoare principală',
    description: 'Butoane, linkuri, iconițe active și accente de brand.',
  },
  color_primary_foreground: {
    label: 'Text pe culoarea principală',
    description: 'Scrisul de pe butoanele colorate. De obicei alb.',
  },
  color_accent: {
    label: 'Accent suav',
    description: 'Fundalul rândurilor selectate, al badge-urilor și al stărilor hover.',
  },
  color_page_bg: {
    label: 'Fundal pagină',
    description: 'Fundalul din spatele cardurilor și al tabelelor.',
  },
  color_surface: {
    label: 'Fundal carduri',
    description: 'Suprafața cardurilor, dialogurilor și a panourilor.',
  },
  color_sidebar: {
    label: 'Fundal meniu',
    description: 'Fundalul meniului din stânga.',
  },
  color_text: {
    label: 'Text principal',
    description: 'Titluri, valori, textul de bază.',
  },
  color_text_muted: {
    label: 'Text secundar',
    description: 'Etichete, descrieri și placeholder-e.',
  },
  color_border: {
    label: 'Linii și contururi',
    description: 'Separatoare, marginile cardurilor și conturul câmpurilor.',
  },
};

/** Extensiile acceptate pentru logo, cu tipul MIME corespunzător. */
export const LOGO_MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export const LOGO_EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/**
 * 512 KB. Un logo de bară de meniu are câteva zeci de KB; limita e acolo ca cineva să nu
 * încarce fotografia de 8 MB direct din telefon, pe care fiecare pagină ar descărca-o.
 */
export const LOGO_MAX_BYTES = 512 * 1024;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Culoare validă = doar `#rgb`, `#rrggbb` sau `#rrggbbaa`.
 *
 * Deliberat nu acceptăm `rgb()`, `oklch()` sau nume CSS: valoarea ajunge într-un
 * `<style>` injectat în pagină, deci orice sintaxă mai largă ar fi o cale de a strecura
 * CSS arbitrar. Un `#` urmat de hexazecimale nu poate închide o declarație.
 */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim());
}

/** Normalizează la majuscule cu `#` în față; `null` pentru orice nu e culoare validă. */
export function normalizeHexColor(value: unknown): string | null {
  if (!isHexColor(value)) return null;
  return value.trim().toUpperCase();
}

/**
 * Paleta efectivă: ce a ales firma, peste implicitul platformei, peste implicitul din cod.
 *
 * Se rezolvă culoare cu culoare, nu rând cu rând: o firmă care și-a schimbat doar culoarea
 * principală trebuie să moștenească restul de la platformă, nu să sară peste ea.
 */
export function resolvePalette(
  companyRow: Partial<Record<BrandingColorKey, string | null>> | null,
  platformRow: Partial<Record<BrandingColorKey, string | null>> | null,
): BrandingPalette {
  const resolved = {} as BrandingPalette;
  for (const key of BRANDING_COLOR_KEYS) {
    resolved[key] =
      normalizeHexColor(companyRow?.[key]) ??
      normalizeHexColor(platformRow?.[key]) ??
      DEFAULT_PALETTE[key];
  }
  return resolved;
}
