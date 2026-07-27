import { ForbiddenException } from '@nestjs/common';

export type WasteRecordsJwtUser = {
  userId?: number;
  sub?: number;
  permissions?: string[];
  roles?: string[];
  company_id?: number | null;
  work_location_id?: number | null;
  work_location_default_id?: number | null;
};

export function getJwtCompanyId(user?: WasteRecordsJwtUser): number | null {
  const companyId = Number(user?.company_id);
  return Number.isFinite(companyId) && companyId > 0 ? companyId : null;
}

export function getJwtWorkLocationId(user?: WasteRecordsJwtUser): number | null {
  const loc = Number(user?.work_location_id ?? user?.work_location_default_id);
  return Number.isFinite(loc) && loc > 0 ? loc : null;
}

export function isGlobalWasteAdmin(user?: WasteRecordsJwtUser): boolean {
  const perms = user?.permissions ?? [];
  return (
    perms.includes('assignment.read_all') ||
    perms.includes('waste-records.read_all')
  );
}

export function assertRecordLocationAllowed(
  user: WasteRecordsJwtUser | undefined,
  locationId: number | null | undefined,
  permittedLocationIds: number[],
): void {
  if (isGlobalWasteAdmin(user)) {
    return;
  }
  if (locationId == null) {
    throw new ForbiddenException('Înregistrarea de deșeu nu are locație asociată');
  }
  if (!permittedLocationIds.includes(Number(locationId))) {
    throw new ForbiddenException(
      'Acces interzis la înregistrări de deșeu din altă locație/companie',
    );
  }
}
