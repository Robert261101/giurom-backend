import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

const logger = new Logger('EmployeeDisplayNames');

function employeesBaseUrl(): string {
  return process.env.EMPLOYEES_HTTP_URL || 'http://localhost:3011';
}

function internalServiceHeaders(): Record<string, string> {
  return {
    'x-internal-service': 'requests',
    'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
  };
}

export async function fetchEmployeeDisplayNames(
  httpService: HttpService,
  employeeIds: number[],
): Promise<Map<number, string>> {
  const uniqueIds = Array.from(
    new Set(employeeIds.filter((id) => Number.isFinite(id) && id > 0)),
  );
  const nameById = new Map<number, string>();
  if (uniqueIds.length === 0) {
    return nameById;
  }

  try {
    const response = await firstValueFrom(
      httpService.get(
        `${employeesBaseUrl()}/employees/batch?ids=${uniqueIds.join(',')}`,
        { headers: internalServiceHeaders() },
      ),
    );
    const rows = Array.isArray(response.data) ? response.data : [];
    for (const emp of rows) {
      const id = Number(emp?.id);
      const name = `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim();
      if (Number.isFinite(id) && id > 0 && name) {
        nameById.set(id, name);
      }
    }
  } catch (error: any) {
    logger.warn(
      `Failed to batch-load employee names: ${error?.message || error}`,
    );
  }

  return nameById;
}

export function attachEmployeeDisplayNames<T extends { employee_id: number }>(
  rows: T[],
  nameById: Map<number, string>,
): Array<T & { employee_name?: string }> {
  return rows.map((row) => {
    const employee_name = nameById.get(row.employee_id);
    return employee_name ? { ...row, employee_name } : row;
  });
}

export function attachShiftChangeDisplayNames<
  T extends { employee_id: number; replacement_id: number },
>(
  rows: T[],
  nameById: Map<number, string>,
): Array<T & { employee_name?: string; replacement_name?: string }> {
  return rows.map((row) => {
    const employee_name = nameById.get(row.employee_id);
    const replacement_name = nameById.get(row.replacement_id);
    if (!employee_name && !replacement_name) {
      return row;
    }
    return {
      ...row,
      ...(employee_name ? { employee_name } : {}),
      ...(replacement_name ? { replacement_name } : {}),
    };
  });
}
