import { ForbiddenException } from '@nestjs/common';
import {
  CalendarJwtUser,
  getJwtCompanyId,
  getJwtWorkLocationId,
} from './calendar-access';

export type SupplierCalendarScope = {
  companyId: number;
  permittedLocationIds: number[];
};

function suppliersBaseUrl(): string {
  return (
    process.env.SUPPLIERS_HTTP_URL ||
    process.env.SUPPLIERS_SERVICE_URL ||
    'http://localhost:3007'
  );
}

async function fetchJson<T>(
  url: string,
  authorization?: string,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authorization) {
    headers.Authorization = authorization;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new ForbiddenException(
      'Nu s-a putut determina scope-ul furnizorului pentru calendar',
    );
  }
  return (await response.json()) as T;
}

export async function resolveSupplierCalendarScope(
  user: CalendarJwtUser,
  authorization?: string,
): Promise<SupplierCalendarScope> {
  const base = suppliersBaseUrl();
  const mySupplier = await fetchJson<{ id: number; owner_company_id?: number }>(
    `${base}/suppliers/my-supplier`,
    authorization,
  );
  const supplierId = Number(mySupplier?.id);
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw new ForbiddenException('Furnizorul autentificat nu a fost identificat');
  }

  const ownerCompanyId = Number(
    mySupplier.owner_company_id ?? getJwtCompanyId(user),
  );
  if (!Number.isFinite(ownerCompanyId) || ownerCompanyId <= 0) {
    throw new ForbiddenException(
      'Compania furnizorului nu a putut fi determinată',
    );
  }

  const [drivers, warehouse] = await Promise.all([
    fetchJson<Array<{ work_location_default_id?: number | null }>>(
      `${base}/suppliers/${supplierId}/drivers`,
      authorization,
    ),
    fetchJson<Array<{ work_location_default_id?: number | null }>>(
      `${base}/suppliers/${supplierId}/warehouse`,
      authorization,
    ),
  ]);

  const locationIds = new Set<number>();
  const jwtLoc = getJwtWorkLocationId(user);
  if (jwtLoc != null) {
    locationIds.add(jwtLoc);
  }
  for (const row of [...(drivers || []), ...(warehouse || [])]) {
    const loc = Number(row?.work_location_default_id);
    if (Number.isFinite(loc) && loc > 0) {
      locationIds.add(loc);
    }
  }

  return {
    companyId: ownerCompanyId,
    permittedLocationIds: [...locationIds],
  };
}
