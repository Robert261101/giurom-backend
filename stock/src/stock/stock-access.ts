import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  hasPlatformWideAccess,
  resolveJwtCompanyId,
} from '@giurom/tenant-access';

export type StockJwtUser = {
  permissions?: string[];
  company_id?: number | null;
  companyId?: number | null;
  isSuperAdmin?: boolean;
  roles?: string[];
  work_location_id?: number | null;
  work_location_default_id?: number | null;
};

/** @deprecated Prefer `resolveJwtCompanyId` — kept for stock-ms call sites. */
export function getJwtCompanyId(user?: StockJwtUser): number | null {
  return resolveJwtCompanyId(user);
}

export { resolveJwtCompanyId };

export function getJwtWorkLocationId(user?: StockJwtUser): number | null {
  const loc = Number(user?.work_location_id ?? user?.work_location_default_id);
  return Number.isFinite(loc) && loc > 0 ? loc : null;
}

/** Platform-wide stock admin (tenant-bound JWT is never global). */
export function isGlobalStockAdmin(user?: StockJwtUser): boolean {
  return hasPlatformWideAccess(user);
}

/** True when JWT is a real tenant (company bound, not platform). */
export function isTenantStockRequester(user?: StockJwtUser): boolean {
  if (!user || isGlobalStockAdmin(user)) {
    return false;
  }
  return resolveJwtCompanyId(user) != null;
}

export function parseStockLocationId(
  raw: number | string | null | undefined,
): number | undefined {
  if (raw == null || raw === '') {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Tenant HTTP reads/consumes require an explicit location_id.
 * Platform operators may omit it where the endpoint supports global semantics.
 */
export function assertTenantLocationIdRequired(
  user: StockJwtUser | undefined,
  locationId: number | null | undefined,
): asserts locationId is number {
  if (!isTenantStockRequester(user)) {
    return;
  }
  const parsed = parseStockLocationId(locationId);
  if (parsed == null) {
    throw new BadRequestException('location_id este obligatoriu');
  }
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
