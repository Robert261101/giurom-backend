/** Normalizează o dată la format YYYY-MM-DD (fără componentă de timp). */
export function normalizeWorkDate(input: string | Date): string {
  if (typeof input === 'string') {
    return input.replace(/T.*/, '').slice(0, 10);
  }
  const y = input.getFullYear();
  const m = String(input.getMonth() + 1).padStart(2, '0');
  const d = String(input.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Agregă punctele pe zi – folosește MAX când există rânduri duplicate (ex. pontaj + task-uri). */
export function aggregatePointsByWorkDate(
  rows: Array<{ work_date?: string | Date; total_points?: number | string }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.work_date) continue;
    const dateStr = normalizeWorkDate(row.work_date as string | Date);
    const pts = parseFloat(String(row.total_points ?? 0)) || 0;
    map.set(dateStr, Math.max(map.get(dateStr) ?? 0, pts));
  }
  return map;
}
