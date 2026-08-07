import { createConnection, Connection } from 'mysql2/promise';

/**
 * Aplică migrarea PR #35 (company_type + câmpuri ANAF) dacă lipsește pe DB.
 * Idempotent — safe la fiecare restart. Folosește env DB_* din .env / PM2.
 */
export async function ensurePr35CompanySchema(): Promise<void> {
  const host = process.env.DB_HOST;
  const database = process.env.DB_DATABASE;
  const username = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const port = parseInt(process.env.DB_PORT || '3306', 10);

  if (!host || !database || !username) {
    console.warn('⚠️ [ensurePr35CompanySchema] DB env incomplet — sar peste migrare automată');
    return;
  }

  let conn: Connection | undefined;
  try {
    conn = await createConnection({ host, port, user: username, password, database });

    await addColumnIfMissing(conn, database, 'company_type',
      `ALTER TABLE companies ADD COLUMN company_type ENUM('furnizor', 'client') NOT NULL DEFAULT 'client' AFTER status`);

    await addColumnIfMissing(conn, database, 'data_source',
      `ALTER TABLE companies ADD COLUMN data_source ENUM('anaf', 'manual') NOT NULL DEFAULT 'manual' AFTER notes`);

    await addColumnIfMissing(conn, database, 'anaf_verified_at',
      `ALTER TABLE companies ADD COLUMN anaf_verified_at DATETIME NULL DEFAULT NULL AFTER data_source`);

    await addColumnIfMissing(conn, database, 'anaf_original_data',
      `ALTER TABLE companies ADD COLUMN anaf_original_data JSON NULL DEFAULT NULL AFTER anaf_verified_at`);

  } catch (error: any) {
    console.error(`❌ [ensurePr35CompanySchema] Migrare eșuată: ${error?.message || error}`);
    throw error;
  } finally {
    await conn?.end();
  }
}

async function addColumnIfMissing(
  conn: Connection,
  database: string,
  columnName: string,
  alterSql: string,
): Promise<void> {
  const [rows] = await conn.query<any[]>(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'companies' AND COLUMN_NAME = ?`,
    [database, columnName],
  );
  const exists = Number(rows?.[0]?.cnt ?? 0) > 0;
  if (exists) {
    return;
  }
  await conn.query(alterSql);
}
