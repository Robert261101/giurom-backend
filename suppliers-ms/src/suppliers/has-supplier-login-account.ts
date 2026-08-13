import type { Connection } from 'typeorm';

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
export async function hasSupplierLoginAccount(
  connection: Connection,
  supplier: SupplierAccountLookupInput | null | undefined,
  options?: {
    authDbName?: string;
    employeesDbName?: string;
    locationsDbName?: string;
  },
): Promise<boolean> {
  if (!supplier) {
    return false;
  }

  const ownerCompanyId = Number(supplier.owner_company_id);
  if (!Number.isFinite(ownerCompanyId) || ownerCompanyId <= 0) {
    return false;
  }

  const authDbName =
    options?.authDbName ||
    process.env.AUTH_DB_NAME ||
    'giurombitap_auth';
  const employeesDbName =
    options?.employeesDbName ||
    process.env.EMPLOYEES_DB_NAME ||
    'giurombitap_employees';
  const locationsDbName =
    options?.locationsDbName ||
    process.env.LOCATIONS_DB_NAME ||
    'giurombitap_locations';

  try {
    const rows: Array<{ ok?: number | string }> = await connection.query(
      `
      SELECT 1 AS ok
      FROM \`${authDbName}\`.users u
      INNER JOIN \`${authDbName}\`.user_roles ur ON ur.user_id = u.id
      INNER JOIN \`${authDbName}\`.roles r ON r.id = ur.role_id
      INNER JOIN \`${employeesDbName}\`.employees e ON e.id = u.id_employee
      INNER JOIN \`${locationsDbName}\`.work_location l
        ON l.id = e.work_location_default_id
      WHERE l.company_id = ?
        AND LOWER(TRIM(r.name)) = 'furnizor'
        AND u.is_active = 1
        AND e.is_active = 1
      LIMIT 1
      `,
      [ownerCompanyId],
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    // Defensive: cross-DB lookup failure → treat as no account (safer alternate flow)
    return false;
  }
}
