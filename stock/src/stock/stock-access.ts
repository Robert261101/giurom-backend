import { ForbiddenException } from '@nestjs/common';

export type StockJwtUser = {
  permissions?: string[];
  company_id?: number | null;
  work_location_id?: number | null;
  work_location_default_id?: number | null;
};

export function getJwtCompanyId(user?: StockJwtUser): number | null {
  const companyId = Number(user?.company_id);
  return Number.isFinite(companyId) && companyId > 0 ? companyId : null;
}

export function getJwtWorkLocationId(user?: StockJwtUser): number | null {
  const loc = Number(user?.work_location_id ?? user?.work_location_default_id);
  return Number.isFinite(loc) && loc > 0 ? loc : null;
}

export function isGlobalStockAdmin(user?: StockJwtUser): boolean {
  const perms = user?.permissions ?? [];
  return perms.includes('assignment.read_all');
}

export function assertLocationAllowed(
  user: StockJwtUser | undefined,
  locationId: number | null | undefined,
  permittedLocationIds: number[],
): void {
  if (!user || isGlobalStockAdmin(user)) {
    return;
  }
  if (locationId == null) {
    throw new ForbiddenException('Resursa nu are locație asociată');
  }
  if (!permittedLocationIds.includes(Number(locationId))) {
    throw new ForbiddenException(
      'Acces interzis la resurse din altă locație/companie',
    );
  }
}
