import { Logger } from '@nestjs/common';
import type { Connection } from 'typeorm';

const logger = new Logger('HasSupplierLoginAccount');

export type SupplierAccountLookupInput = {
  id: number;
  owner_company_id?: number | null;
};

/**
 * True if this supplier has an authenticatable furnizor-tenant login:
 * owner_company_id set AND at least one active user with role `furnizor`
 * whose employee default work location belongs to that company.
 *
 * Evaluated from supplier_id → owner_company_id (never guessed by name/email).
 * Does not assume 1:1 company↔supplier.
 */
type SupplierLoginLookupOptions = {
  authDbName?: string;
  employeesDbName?: string;
  locationsDbName?: string;
};

function resolveLoginLookupDbNames(options?: SupplierLoginLookupOptions) {
  return {
    authDbName:
      options?.authDbName ||
      process.env.AUTH_DB_NAME ||
      'giurombitap_auth',
    employeesDbName:
      options?.employeesDbName ||
      process.env.EMPLOYEES_DB_NAME ||
      'giurombitap_employees',
    locationsDbName:
      options?.locationsDbName ||
      process.env.LOCATIONS_DB_NAME ||
      'giurombitap_locations',
  };
}

/**
 * Owner company IDs that currently have an authenticatable furnizor login.
 * Used to attach `has_supplier_account` on supplier lists without N+1 queries.
 */
export async function getOwnerCompanyIdsWithSupplierLogin(
  connection: Connection,
  ownerCompanyIds: number[],
  options?: SupplierLoginLookupOptions,
): Promise<Set<number>> {
  const uniqueIds = [
    ...new Set(
      ownerCompanyIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (uniqueIds.length === 0) {
    return new Set();
  }

  const { authDbName, employeesDbName, locationsDbName } =
    resolveLoginLookupDbNames(options);

  try {
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const rows: Array<{ company_id?: number | string }> = await connection.query(
      `
      SELECT DISTINCT l.company_id AS company_id
      FROM \`${authDbName}\`.users u
      INNER JOIN \`${authDbName}\`.user_roles ur ON ur.user_id = u.id
      INNER JOIN \`${authDbName}\`.roles r ON r.id = ur.role_id
      INNER JOIN \`${employeesDbName}\`.employees e ON e.id = u.id_employee
      INNER JOIN \`${locationsDbName}\`.work_location l
        ON l.id = e.work_location_default_id
      WHERE l.company_id IN (${placeholders})
        AND LOWER(TRIM(r.name)) = 'furnizor'
        AND u.is_active = 1
        AND e.is_active = 1
      `,
      uniqueIds,
    );
    return new Set(
      (Array.isArray(rows) ? rows : [])
        .map((row) => Number(row.company_id))
        .filter((id) => Number.isFinite(id) && id > 0),
    );
  } catch (error) {
    // Temporary: surface the real cross-DB failure on server instead of failing closed silently.
    const err = error as { message?: string; code?: string; sqlMessage?: string; errno?: number };
    logger.error(
      `Cross-DB supplier login lookup failed ` +
        `(auth=${authDbName}, employees=${employeesDbName}, locations=${locationsDbName}, ` +
        `ownerCompanyIds=${uniqueIds.join(',')}): ` +
        `${err?.sqlMessage || err?.message || String(error)}` +
        (err?.code ? ` [code=${err.code}]` : '') +
        (err?.errno != null ? ` [errno=${err.errno}]` : ''),
      error instanceof Error ? error.stack : undefined,
    );
    return new Set();
  }
}

export async function hasSupplierLoginAccount(
  connection: Connection,
  supplier: SupplierAccountLookupInput | null | undefined,
  options?: SupplierLoginLookupOptions,
): Promise<boolean> {
  if (!supplier) {
    return false;
  }

  const ownerCompanyId = Number(supplier.owner_company_id);
  if (!Number.isFinite(ownerCompanyId) || ownerCompanyId <= 0) {
    return false;
  }

  const withAccount = await getOwnerCompanyIdsWithSupplierLogin(
    connection,
    [ownerCompanyId],
    options,
  );
  return withAccount.has(ownerCompanyId);
}
