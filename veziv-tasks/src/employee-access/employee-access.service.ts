import { ForbiddenException, Injectable } from '@nestjs/common';import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  assertJwtEmployeeIdConsistency,
  getCanonicalEmployeeId,
  isAdminUser,
  isFurnizorSupplierAdmin,
  isOperationalStaffUser,
  type EmployeeAccessUser,
} from './employee-access';

// Cache-ul pe staff IDs a fost eliminat: după soft-block/reactivate pe employees_suppliers.is_active
// un TTL scurt producea 403 stale pe employee-points (lista activă rămânea fără angajatul reactivat).
@Injectable()
export class EmployeeAccessService {
  constructor(private readonly httpService: HttpService) {}

  private suppliersBaseUrl(): string {
    return (
      process.env.SUPPLIERS_HTTP_URL ||
      process.env.SUPPLIERS_SERVICE_URL ||
      'http://localhost:3007'
    );
  }

  private userAuthHeaders(authorization?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Cu JWT utilizator: nu trimite secret intern — suppliers-ms altfel ocolește JWT și pierde company_type.
    if (authorization) {
      headers.Authorization = authorization;
      return headers;
    }
    headers['x-internal-service'] = 'veziv-tasks';
    headers['x-service-secret'] =
      process.env.SERVICE_SECRET || '';
    return headers;
  }

  private employeesBaseUrl(): string {
    return (
      process.env.EMPLOYEES_HTTP_URL ||
      process.env.EMPLOYEES_SERVICE_URL ||
      'http://localhost:3011'
    );
  }

  private async fetchEmployeeProfile(
    employeeId: number,
    authorization?: string,
  ): Promise<{
    id: number;
    is_active?: boolean;
    work_location_default_id?: number | null;
  } | null> {
    const headers = this.userAuthHeaders(authorization);
    try {
      const resp = await firstValueFrom(
        this.httpService.get(
          `${this.employeesBaseUrl()}/employees/${employeeId}`,
          { headers, timeout: 8000 },
        ),
      );
      const data = resp.data?.data ?? resp.data ?? {};
      return {
        id: Number(data.id ?? employeeId),
        is_active: data.is_active !== false,
        work_location_default_id:
          data.work_location_default_id ?? data.work_location_id ?? null,
      };
    } catch {
      return null;
    }
  }

  async fetchSupplierId(authorization?: string): Promise<number | null> {
    const base = this.suppliersBaseUrl();
    const headers = this.userAuthHeaders(authorization);
    try {
      const myResp = await firstValueFrom(
        this.httpService.get(`${base}/suppliers/my-supplier`, {
          headers,
          timeout: 8000,
        }),
      );
      const supplierId = Number(myResp.data?.id);
      return Number.isFinite(supplierId) && supplierId > 0 ? supplierId : null;
    } catch {
      return null;
    }
  }

  async fetchSupplierStaffEmployeeIds(
    authorization?: string,
  ): Promise<number[]> {
    const base = this.suppliersBaseUrl();
    const headers = this.userAuthHeaders(authorization);
    try {
      const myResp = await firstValueFrom(
        this.httpService.get(`${base}/suppliers/my-supplier`, {
          headers,
          timeout: 8000,
        }),
      );
      const supplierId = Number(myResp.data?.id);
      if (!Number.isFinite(supplierId) || supplierId <= 0) {
        return [];
      }
      // Default endpoints return only operational-active staff (is_active != 0).
      const [driversResp, warehouseResp] = await Promise.all([
        firstValueFrom(
          this.httpService.get(`${base}/suppliers/${supplierId}/drivers`, {
            headers,
            timeout: 8000,
          }),
        ),
        firstValueFrom(
          this.httpService.get(`${base}/suppliers/${supplierId}/warehouse`, {
            headers,
            timeout: 8000,
          }),
        ),
      ]);
      const ids = new Set<number>();
      for (const row of [
        ...(driversResp.data ?? []),
        ...(warehouseResp.data ?? []),
      ]) {
        const id = Number(row?.employee_id);
        if (Number.isFinite(id) && id > 0) {
          ids.add(id);
        }
      }
      return [...ids];
    } catch {
      return [];
    }
  }

  /**
   * Verifică dacă utilizatorul autentificat poate citi datele angajatului țintă.
   * Aruncă ForbiddenException la acces neautorizat.
   */
  async assertCanReadEmployeeData(
    user: EmployeeAccessUser | undefined,
    targetEmployeeId: number,
    authorization?: string,
  ): Promise<void> {
    if (!user) {
      throw new ForbiddenException('Utilizator neautentificat');
    }

    assertJwtEmployeeIdConsistency(user);

    if (!Number.isFinite(targetEmployeeId) || targetEmployeeId <= 0) {
      throw new ForbiddenException('ID angajat invalid');
    }

    if (isOperationalStaffUser(user)) {
      const selfId = getCanonicalEmployeeId(user);
      if (selfId !== targetEmployeeId) {
        throw new ForbiddenException(
          'Nu aveți acces la datele acestui angajat',
        );
      }
      return;
    }

    if (isAdminUser(user)) {
      return;
    }

    if (isFurnizorSupplierAdmin(user)) {
      const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
      if (!staffIds.includes(targetEmployeeId)) {
        throw new ForbiddenException(
          'Angajatul nu aparține furnizorului autentificat',
        );
      }
      return;
    }

    const selfId = getCanonicalEmployeeId(user);
    if (selfId != null && selfId === targetEmployeeId) {
      return;
    }

    throw new ForbiddenException('Nu aveți acces la datele acestui angajat');
  }

  /**
   * Furnizor: angajat în staff + activ + la locația sarcinii.
   */
  async assertSupplierAssigneeAtLocation(
    user: EmployeeAccessUser | undefined,
    assigneeId: number | null | undefined,
    locationId: number | null | undefined,
    authorization?: string,
  ): Promise<void> {
    if (!isFurnizorSupplierAdmin(user ?? {})) {
      return;
    }
    const id = Number(assigneeId);
    const locId = Number(locationId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new ForbiddenException('Angajat invalid pentru atribuire');
    }
    if (!Number.isFinite(locId) || locId <= 0) {
      throw new ForbiddenException('Locația este obligatorie pentru sarcină');
    }

    const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
    if (!staffIds.includes(id)) {
      throw new ForbiddenException(
        'Angajatul nu aparține staff-ului furnizorului',
      );
    }

    const profile = await this.fetchEmployeeProfile(id, authorization);
    if (!profile || profile.is_active === false) {
      throw new ForbiddenException('Angajatul nu este activ');
    }
    if (Number(profile.work_location_default_id) !== locId) {
      throw new ForbiddenException(
        'Angajatul nu aparține locației selectate pentru sarcină',
      );
    }
  }

  /** Batch: id -> profil de bază (is_active, work_location_default_id), un singur apel HTTP pentru N angajați. */
  private async fetchEmployeeProfilesBatch(
    employeeIds: number[],
    authorization?: string,
  ): Promise<
    Map<number, { is_active?: boolean; work_location_default_id?: number | null }>
  > {
    const map = new Map<
      number,
      { is_active?: boolean; work_location_default_id?: number | null }
    >();
    const uniqueIds = [
      ...new Set(employeeIds.filter((id) => Number.isFinite(id) && id > 0)),
    ];
    if (uniqueIds.length === 0) {
      return map;
    }

    const headers = this.userAuthHeaders(authorization);
    try {
      const resp = await firstValueFrom(
        this.httpService.get(`${this.employeesBaseUrl()}/employees/batch`, {
          headers,
          params: { ids: uniqueIds.join(',') },
          timeout: 8000,
        }),
      );
      const rows = Array.isArray(resp.data) ? resp.data : [];
      for (const row of rows) {
        const id = Number(row?.id);
        if (Number.isFinite(id) && id > 0) {
          map.set(id, {
            is_active: row?.is_active,
            work_location_default_id: row?.work_location_default_id ?? null,
          });
        }
      }
    } catch {
      // map rămâne gol pentru ID-uri nerezolvate — apelantul tratează ca profil negăsit
    }
    return map;
  }

  /**
   * Versiune batch a assertSupplierAssigneeAtLocation — verifică TOȚI assignee-ii cu un
   * singur apel pentru staffIds (cache scurt) + un singur apel batch pentru profile,
   * în loc de câte 2 apeluri HTTP secvențiale per assignee (N+1 la crearea în masă).
   */
  async assertSupplierAssigneesAtLocationBatch(
    user: EmployeeAccessUser | undefined,
    assigneeIds: Array<number | null | undefined>,
    locationId: number | null | undefined,
    authorization?: string,
  ): Promise<void> {
    if (!isFurnizorSupplierAdmin(user ?? {})) {
      return;
    }
    const locId = Number(locationId);
    if (!Number.isFinite(locId) || locId <= 0) {
      throw new ForbiddenException('Locația este obligatorie pentru sarcină');
    }

    const ids = assigneeIds.map((id) => Number(id));
    if (ids.some((id) => !Number.isFinite(id) || id <= 0)) {
      throw new ForbiddenException('Angajat invalid pentru atribuire');
    }

    const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
    for (const id of ids) {
      if (!staffIds.includes(id)) {
        throw new ForbiddenException(
          'Angajatul nu aparține staff-ului furnizorului',
        );
      }
    }

    const profiles = await this.fetchEmployeeProfilesBatch(ids, authorization);
    for (const id of ids) {
      const profile = profiles.get(id);
      if (!profile || profile.is_active === false) {
        throw new ForbiddenException('Angajatul nu este activ');
      }
      if (Number(profile.work_location_default_id) !== locId) {
        throw new ForbiddenException(
          'Angajatul nu aparține locației selectate pentru sarcină',
        );
      }
    }
  }

  async assertSupplierOwnsGroupAssignments(
    staffIds: number[],
    assignments: Array<{ assigned_to_id?: number | null }>,
  ): Promise<void> {
    for (const row of assignments) {
      const assignee = Number(row.assigned_to_id);
      if (!Number.isFinite(assignee) || assignee <= 0) {
        throw new ForbiddenException(
          'Grup invalid: participant fără angajat alocat',
        );
      }
      if (!staffIds.includes(assignee)) {
        throw new ForbiddenException(
          'Nu poți gestiona sarcini în afara staff-ului furnizorului',
        );
      }
    }
  }

  /**
   * Citire assignment: admin, furnizor (staff), participant operațional, read_own.
   */
  async assertCanReadAssignment(
    user: EmployeeAccessUser | undefined,
    assignment: {
      assigned_to_id?: number | null;
      created_by_employee_id?: number;
      is_visible_for_employee?: boolean;
      department_group_id?: string | null;
    },
    authorization?: string,
  ): Promise<void> {
    if (!user) {
      throw new ForbiddenException('Utilizator neautentificat');
    }
    assertJwtEmployeeIdConsistency(user);
    const perms = user.permissions ?? [];

    if (isAdminUser(user) || perms.includes('assignment.read_all')) {
      return;
    }
    if (
      perms.includes('assignment.read_company') ||
      perms.includes('assignment.read_location')
    ) {
      return;
    }

    if (isFurnizorSupplierAdmin(user)) {
      const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
      const assignee = Number(assignment.assigned_to_id);
      const creator = Number(assignment.created_by_employee_id);
      if (
        (Number.isFinite(assignee) && staffIds.includes(assignee)) ||
        (Number.isFinite(creator) && staffIds.includes(creator))
      ) {
        return;
      }
      throw new ForbiddenException(
        'Sarcina nu aparține furnizorului autentificat',
      );
    }

    if (isOperationalStaffUser(user) || perms.includes('assignment.read_own')) {
      const selfId = getCanonicalEmployeeId(user);
      const assignedToMe =
        selfId != null &&
        Number(assignment.assigned_to_id) === Number(selfId);
      const visible = assignment.is_visible_for_employee !== false;
      if (assignedToMe && visible) {
        return;
      }
      throw new ForbiddenException('Nu ai dreptul să accesezi această sarcină');
    }

    throw new ForbiddenException('Nu ai dreptul să accesezi această sarcină');
  }

  /** Gestionare (edit/anulare): admin sau furnizor pe staff-ul propriu. */
  async assertCanManageAssignment(
    user: EmployeeAccessUser | undefined,
    assignment: {
      assigned_to_id?: number | null;
      created_by_employee_id?: number;
      status?: string;
    },
    authorization?: string,
  ): Promise<void> {
    if (!user) {
      throw new ForbiddenException('Utilizator neautentificat');
    }
    if (isOperationalStaffUser(user)) {
      throw new ForbiddenException(
        'Angajații operaționali nu pot modifica sarcinile',
      );
    }
    const perms = user.permissions ?? [];
    if (
      isAdminUser(user) ||
      perms.includes('assignment.update') ||
      perms.includes('assignment.create')
    ) {
      if (!isFurnizorSupplierAdmin(user)) {
        return;
      }
    }
    if (isFurnizorSupplierAdmin(user) && perms.includes('suppliers.create')) {
      const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
      const assignee = Number(assignment.assigned_to_id);
      const creator = Number(assignment.created_by_employee_id);
      if (
        (Number.isFinite(assignee) && staffIds.includes(assignee)) ||
        (Number.isFinite(creator) && staffIds.includes(creator))
      ) {
        return;
      }
      throw new ForbiddenException(
        'Nu poți modifica sarcini în afara staff-ului furnizorului',
      );
    }
    throw new ForbiddenException('Permisiuni insuficiente pentru gestionare');
  }

  assertIsAssignmentParticipant(
    user: EmployeeAccessUser | undefined,
    assignment: { assigned_to_id?: number | null; status?: string },
  ): void {
    if (!user) {
      throw new ForbiddenException('Utilizator neautentificat');
    }
    const selfId = getCanonicalEmployeeId(user);
    if (selfId == null) {
      throw new ForbiddenException('ID angajat invalid în token');
    }
    if (assignment.status === 'deactivated') {
      throw new ForbiddenException('Sarcina este anulată');
    }
    if (Number(assignment.assigned_to_id) !== Number(selfId)) {
      throw new ForbiddenException(
        'Nu ești participant la această sarcină',
      );
    }
  }

  async assertSupplierAssigneeAllowed(
    user: EmployeeAccessUser | undefined,
    assigneeId: number | null | undefined,
    authorization?: string,
    locationId?: number | null,
  ): Promise<void> {
    if (!isFurnizorSupplierAdmin(user ?? {})) {
      return;
    }
    if (locationId != null && Number.isFinite(Number(locationId))) {
      await this.assertSupplierAssigneeAtLocation(
        user,
        assigneeId,
        Number(locationId),
        authorization,
      );
      return;
    }
    const id = Number(assigneeId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new ForbiddenException('Angajat invalid pentru atribuire');
    }
    const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
    if (!staffIds.includes(id)) {
      throw new ForbiddenException(
        'Angajatul nu aparține staff-ului furnizorului',
      );
    }
  }
}
