import { ForbiddenException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { LeaveAccessUser } from './leave-requests/leave-request-access';

/**
 * Colegi activi din aceeași locație — apel intern la employees-ms /for-own.
 * Nu folosește fallback silențios: eșecul employees-ms se propagă.
 */
export async function fetchColleagueIdsByLocation(
  httpService: HttpService,
  locationId: number,
): Promise<number[]> {
  if (!Number.isFinite(locationId) || locationId <= 0) {
    throw new ForbiddenException(
      'Locația de lucru nu este configurată pentru validarea colegilor',
    );
  }
  const base = process.env.EMPLOYEES_HTTP_URL || 'http://localhost:3011';
  const resp = await firstValueFrom(
    httpService.get(`${base}/employees/for-own`, {
      params: { location_id: locationId },
      headers: {
        'x-internal-service': 'requests',
        'x-service-secret':
          process.env.SERVICE_SECRET || 'default-service-secret',
      },
      timeout: 8000,
    }),
  );
  const list: { id: number }[] = Array.isArray(resp.data) ? resp.data : [];
  return list
    .map((e) => Number(e.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export async function fetchOperationalColleagueIds(
  httpService: HttpService,
  user: LeaveAccessUser & {
    work_location_id?: number;
    work_location_default_id?: number;
  },
): Promise<number[]> {
  const selfId = Number(user?.sub ?? user?.employee_id);
  const locationId = Number(
    user?.work_location_id ?? user?.work_location_default_id,
  );
  if (!Number.isFinite(locationId) || locationId <= 0) {
    throw new ForbiddenException(
      'Locația de lucru nu este configurată în tokenul de autentificare',
    );
  }
  const ids = await fetchColleagueIdsByLocation(httpService, locationId);
  if (Number.isFinite(selfId) && selfId > 0 && !ids.includes(selfId)) {
    ids.push(selfId);
  }
  return ids;
}
