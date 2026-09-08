/**
 * Staff quota bridge (employees-ms → suppliers-ms).
 *
 * Business rule: an employee whose position becomes magazioner (5) / șofer (4)
 * consumes a staff slot of the furnizor company's plan. The canonical counter
 * lives in suppliers-ms (employees_suppliers). This module makes sure the quota
 * is asserted on BOTH paths (suppliers link AND employee create/update), so
 * `employees.position_default_id` cannot bypass it.
 *
 * FAIL-CLOSED: if the company cannot be resolved or suppliers-ms is unreachable,
 * the create/update with an operational position is refused (no Free fallback),
 * unless PLAN_GATING_MODE=off.
 */
import {
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import { resolvePlanGatingMode } from '@giurom/tenant-access';

export const POSITION_SOFER = 4;
export const POSITION_MAGAZIONER = 5;

export type StaffRole = 'warehouse' | 'driver';

/** Maps `position_default_id` to the operational role it implies (null = none). */
export function staffRoleForPosition(
  positionId: number | null | undefined,
): StaffRole | null {
  const pid = Number(positionId);
  if (pid === POSITION_MAGAZIONER) return 'warehouse';
  if (pid === POSITION_SOFER) return 'driver';
  return null;
}

/**
 * Decides whether an update needs a staff-quota assert: only when the new
 * position implies a role AND it differs from the role implied by the current one.
 */
export function staffRoleRequiringAssertOnUpdate(
  currentPositionId: number | null | undefined,
  nextPositionId: number | null | undefined,
): StaffRole | null {
  if (nextPositionId === undefined) return null;
  const next = staffRoleForPosition(nextPositionId);
  if (!next) return null;
  const current = staffRoleForPosition(currentPositionId);
  return current === next ? null : next;
}

type TenantUser = {
  bypassAuth?: boolean;
  company_id?: number | null;
  companyId?: number | null;
};

@Injectable()
export class EmployeeStaffQuotaService {
  private readonly logger = new Logger(EmployeeStaffQuotaService.name);

  private suppliersBaseUrl(): string {
    return (process.env.SUPPLIERS_HTTP_URL || 'http://localhost:3007').replace(
      /\/$/,
      '',
    );
  }

  private headers(): Record<string, string> {
    return {
      'x-internal-service': 'employees',
      'x-service-secret': process.env.SERVICE_SECRET || '',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Company for the quota: tenant JWT company first; otherwise (platform /
   * internal caller) the company of the employee's location; null if unknown.
   */
  resolveCompanyId(
    user: TenantUser | null | undefined,
    locationCompanyId: number | null | undefined,
  ): number | null {
    const fromJwt = Number(user?.company_id ?? user?.companyId);
    if (Number.isFinite(fromJwt) && fromJwt > 0) return fromJwt;
    const fromLocation = Number(locationCompanyId);
    return Number.isFinite(fromLocation) && fromLocation > 0 ? fromLocation : null;
  }

  /**
   * Assert with suppliers-ms that `employeeId` may take `role` under `companyId`'s plan.
   * 403 (with canonical body) when the quota is reached; 503 when unverifiable.
   */
  async assertStaffQuota(
    companyId: number | null,
    role: StaffRole,
    employeeId?: number | null,
  ): Promise<void> {
    const mode = resolvePlanGatingMode();
    if (mode === 'off') return;
    if (companyId == null) {
      const error = new ForbiddenException({
        statusCode: 403,
        error: 'PLAN_COMPANY_UNRESOLVED',
        code: 'PLAN_COMPANY_UNRESOLVED',
        message:
          'Compania angajatului nu a putut fi determinată; poziția operațională nu poate fi atribuită.',
      });
      if (mode === 'log') {
        this.logger.warn(`[plan-gating:log] ${error.message}`);
        return;
      }
      throw error;
    }
    try {
      await axios.post(
        `${this.suppliersBaseUrl()}/suppliers/internal/companies/${companyId}/staff-quota/assert`,
        { role, employee_id: employeeId ?? null },
        { headers: this.headers(), timeout: 8000 },
      );
    } catch (error: any) {
      const status = Number(error?.response?.status);
      const body = error?.response?.data;
      let mapped: HttpException;
      if (status === 403 && body && typeof body === 'object') {
        mapped = new ForbiddenException(body);
      } else {
        this.logger.warn(
          `assertStaffQuota company=${companyId} role=${role} failed: ${error?.message || error}`,
        );
        mapped = new ServiceUnavailableException({
          statusCode: 503,
          error: 'PLAN_RESOLUTION_FAILED',
          code: 'PLAN_RESOLUTION_FAILED',
          message:
            'Limita de personal operațional nu a putut fi verificată. Reîncearcă.',
        });
      }
      if (mode === 'log') {
        this.logger.warn(`[plan-gating:log] ${JSON.stringify(mapped.getResponse())}`);
        return;
      }
      throw mapped;
    }
  }

  /** Best-effort: free staff slots when an employee is deleted. */
  async removeStaffLinks(employeeId: number): Promise<void> {
    try {
      await axios.delete(
        `${this.suppliersBaseUrl()}/suppliers/internal/employees/${employeeId}/staff-links`,
        { headers: this.headers(), timeout: 8000 },
      );
    } catch (error: any) {
      this.logger.warn(
        `removeStaffLinks employee=${employeeId} failed: ${error?.message || error}`,
      );
    }
  }

  /**
   * Keep employees_suppliers in sync with position_default_id:
   * - role null → remove ops links (frees slot)
   * - warehouse/driver → upsert link under company quota (freeze-assign)
   */
  async syncStaffRole(
    companyId: number | null,
    employeeId: number,
    role: StaffRole | null,
  ): Promise<void> {
    const eid = Number(employeeId);
    if (!Number.isFinite(eid) || eid <= 0) return;
    if (role == null) {
      await this.removeStaffLinks(eid);
      return;
    }
    const mode = resolvePlanGatingMode();
    if (mode === 'off') return;
    if (companyId == null) {
      const error = new ForbiddenException({
        statusCode: 403,
        error: 'PLAN_COMPANY_UNRESOLVED',
        code: 'PLAN_COMPANY_UNRESOLVED',
        message:
          'Compania angajatului nu a putut fi determinată; poziția operațională nu poate fi atribuită.',
      });
      if (mode === 'log') {
        this.logger.warn(`[plan-gating:log] ${error.message}`);
        return;
      }
      throw error;
    }
    try {
      await axios.post(
        `${this.suppliersBaseUrl()}/suppliers/internal/companies/${companyId}/staff-links`,
        { employee_id: eid, role },
        { headers: this.headers(), timeout: 8000 },
      );
    } catch (error: any) {
      const status = Number(error?.response?.status);
      const body = error?.response?.data;
      let mapped: HttpException;
      if (status === 403 && body && typeof body === 'object') {
        mapped = new ForbiddenException(body);
      } else {
        this.logger.warn(
          `syncStaffRole company=${companyId} role=${role} employee=${eid} failed: ${error?.message || error}`,
        );
        mapped = new ServiceUnavailableException({
          statusCode: 503,
          error: 'PLAN_RESOLUTION_FAILED',
          code: 'PLAN_RESOLUTION_FAILED',
          message:
            'Limita de personal operațional nu a putut fi verificată. Reîncearcă.',
        });
      }
      if (mode === 'log') {
        this.logger.warn(`[plan-gating:log] ${JSON.stringify(mapped.getResponse())}`);
        return;
      }
      throw mapped;
    }
  }
}
