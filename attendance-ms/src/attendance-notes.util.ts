export type CorrectionAuditEntry = {
  action: string;
  corrected_by: number | null;
  corrected_at: string;
  correction_reason: string;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
};

export type PresenceNotesPayload = {
  text: string | null;
  corrections: CorrectionAuditEntry[];
};

export function parsePresenceNotes(
  raw: string | null | undefined,
): PresenceNotesPayload {
  if (!raw?.trim()) {
    return { text: null, corrections: [] };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      const corrections = Array.isArray(parsed.corrections)
        ? (parsed.corrections as CorrectionAuditEntry[])
        : [];

      if (typeof parsed.text === 'string' && parsed.text.trim()) {
        return { text: parsed.text.trim(), corrections };
      }

      const legacyFromArray = corrections
        .map((c) => (c as Record<string, unknown>).legacy_notes)
        .find((v) => typeof v === 'string' && v.trim());
      if (typeof legacyFromArray === 'string') {
        return { text: legacyFromArray.trim(), corrections };
      }

      if (corrections.length > 0) {
        return { text: null, corrections };
      }
    }
  } catch {
    return { text: raw.trim(), corrections: [] };
  }

  return { text: raw.trim(), corrections: [] };
}

export function serializePresenceNotes(payload: PresenceNotesPayload): string {
  return JSON.stringify({
    text: payload.text,
    corrections: payload.corrections,
  });
}

export function appendCorrectionAudit(
  raw: string | null | undefined,
  entry: CorrectionAuditEntry,
): string {
  const payload = parsePresenceNotes(raw);
  payload.corrections.push(entry);
  return serializePresenceNotes(payload);
}

export function extractCorrectionReasons(raw: string | null | undefined): string | null {
  const payload = parsePresenceNotes(raw);
  if (!payload.corrections.length) {
    return payload.text;
  }
  const reasons = payload.corrections
    .map((c) => c.correction_reason)
    .filter(Boolean);
  return reasons.length > 0 ? reasons.join('; ') : payload.text;
}
