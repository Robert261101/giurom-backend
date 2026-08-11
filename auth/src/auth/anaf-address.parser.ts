const DETAIL_TOKEN_PATTERNS: Array<{
  label: 'Bl.' | 'Sc.' | 'Et.' | 'Ap.';
  regex: RegExp;
}> = [
  { label: 'Bl.', regex: /\b(?:Bloc|Bl\.?)\.?\s*([A-Za-z0-9]+)/giu },
  { label: 'Sc.', regex: /\b(?:Scar[aă]|Scara|Sc\.?)\.?\s*([A-Za-z0-9]+)/giu },
  { label: 'Et.', regex: /\b(?:Etaj|Et\.?)\.?\s*([A-Za-z0-9]+)/giu },
  { label: 'Ap.', regex: /\b(?:Apartament|Ap\.?)\.?\s*([A-Za-z0-9]+)/giu },
];

/** Elimină suffixul de cod poștal din texte libere ANAF (ex. „Cod 021713”). */
function stripPostalCodeSuffix(text: string): string {
  return text.replace(/\b[Cc]od\.?\s*\d[\d\s]*$/g, '').trim();
}

/**
 * Extrage componentele structurate Bl / Sc / Et / Ap dintr-un text de adresă ANAF,
 * păstrând ordinea apariției.
 */
export function extractAddressDetailComponents(source: string): string[] {
  const cleaned = stripPostalCodeSuffix(source.trim());
  if (!cleaned) return [];

  const matches: Array<{ index: number; value: string }> = [];

  for (const { label, regex } of DETAIL_TOKEN_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(cleaned)) !== null) {
      matches.push({
        index: match.index,
        value: `${label} ${match[1]}`,
      });
    }
  }

  matches.sort((a, b) => a.index - b.index);

  const seen = new Set<string>();
  const components: string[] = [];
  for (const item of matches) {
    const key = item.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    components.push(item.value);
  }

  return components;
}

/** Segmente comma-separated din adresa generală ANAF care nu sunt oraș/județ/stradă/nr/cod. */
function extractUnrecognizedAnafSegments(
  generalAddress: string,
  street?: string | null,
  number?: string | null,
): string[] {
  const segments = generalAddress
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const normalizedStreet = street?.trim().toLowerCase() ?? '';
  const normalizedNumber = number?.trim() ?? '';

  const skipSegment = (segment: string): boolean => {
    const upper = segment.toUpperCase();
    if (/^(MUNICIPIUL|MUN\.|OR\.|ORA[SŞ]|COM\.|SAT\.|JUD\.|JUDE[TŢ])/i.test(upper)) {
      return true;
    }
    if (/^SECTOR\b/i.test(upper)) return true;
    if (/^NR\.?\s*\d/i.test(upper)) return true;
    if (/^COD\.?\s*\d/i.test(upper)) return true;
    if (
      normalizedStreet &&
      upper.includes(normalizedStreet.toUpperCase().replace(/\./g, ''))
    ) {
      return true;
    }
    if (
      normalizedStreet &&
      normalizedStreet.length >= 4 &&
      upper.replace(/\./g, '').includes(
        normalizedStreet.toUpperCase().replace(/^[^A-Z0-9]+/i, '').slice(0, 6),
      )
    ) {
      return true;
    }
    if (normalizedNumber && new RegExp(`^NR\\.?\\s*${normalizedNumber}\\b`, 'i').test(segment)) {
      return true;
    }
    // Componentele structurate sunt extrase separat.
    if (/^(BL\.?|BLOC|SC\.?|SCAR|ET\.?|ETAJ|AP\.?|APART)/i.test(upper)) {
      return true;
    }
    return false;
  };

  return segments.filter((segment) => !skipSegment(segment));
}

/**
 * Construiește câmpul „detalii adresă” din sursele ANAF.
 * ANAF pune adesea Bl/Sc/Et/Ap în `date_generale.adresa`, nu în `sdetalii_Adresa`.
 */
export function buildAnafAddressDetails(input: {
  explicitDetails?: string | null;
  generalAddress?: string | null;
  street?: string | null;
  number?: string | null;
}): string | null {
  const components: string[] = [];
  const seen = new Set<string>();

  const addComponents = (values: string[]) => {
    for (const value of values) {
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      components.push(value);
    }
  };

  if (input.explicitDetails?.trim()) {
    addComponents(extractAddressDetailComponents(input.explicitDetails));
  }

  if (input.generalAddress?.trim()) {
    addComponents(extractAddressDetailComponents(input.generalAddress));

    if (components.length === 0) {
      addComponents(
        extractUnrecognizedAnafSegments(
          input.generalAddress,
          input.street,
          input.number,
        ),
      );
    }
  }

  if (components.length > 0) {
    return components.join(', ');
  }

  return input.explicitDetails?.trim() || null;
}

/**
 * Parsează o adresă ANAF liberă (ex. din formular sau test) în componente structurate.
 * Util pentru teste și fallback frontend.
 */
export function parseAnafFreeformAddress(source: string): {
  street: string | null;
  number: string | null;
  postalCode: string | null;
  details: string | null;
} {
  const cleaned = source.trim();
  if (!cleaned) {
    return { street: null, number: null, postalCode: null, details: null };
  }

  const postalMatch = cleaned.match(/\b[Cc]od\.?\s*(\d[\d\s]*)\s*$/);
  const postalRaw = postalMatch?.[1]?.replace(/\D/g, '') ?? null;
  const postalCode =
    postalRaw && /^\d{1,6}$/.test(postalRaw)
      ? postalRaw.padStart(6, '0')
      : null;

  const withoutPostal = stripPostalCodeSuffix(cleaned);
  const details = buildAnafAddressDetails({
    explicitDetails: withoutPostal,
    generalAddress: withoutPostal,
  });

  let street: string | null = null;
  let number: string | null = null;

  const streetNumberMatch = withoutPostal.match(
    /^(.+?)\s+(\d+[A-Za-z]?)(?=\s+(?:Bl\.?|Bloc|Sc\.?|Scar|Et\.?|Etaj|Ap\.?|Apartament|Cod\b)|$)/iu,
  );
  if (streetNumberMatch) {
    street = streetNumberMatch[1].trim();
    number = streetNumberMatch[2].trim();
  }

  return { street, number, postalCode, details };
}
