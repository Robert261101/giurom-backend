import { createConnection, Connection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Creează `company_branding` dacă lipsește (logo + paletă per firmă).
 * Idempotent — safe la fiecare restart. Folosește env DB_* din .env / PM2.
 */
export async function ensureCompanyBrandingSchema(): Promise<void> {
  const host = process.env.DB_HOST;
  const database = process.env.DB_DATABASE;
  const username = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const port = parseInt(process.env.DB_PORT || '3306', 10);

  if (!host || !database || !username) {
    console.warn('⚠️ [ensureCompanyBrandingSchema] DB env incomplet — sar peste migrare automată');
    return;
  }

  let conn: Connection | undefined;
  try {
    conn = await createConnection({ host, port, user: username, password, database });

    const [rows] = await conn.query<any[]>(
      `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'company_branding'`,
      [database],
    );
    const exists = Number(rows?.[0]?.cnt ?? 0) > 0;

    if (!exists) {
      console.log('📦 [ensureCompanyBrandingSchema] Creez tabela company_branding...');
      const sqlPath = join(__dirname, '..', '..', 'migrations', '20260904_01_company_branding.sql');
      const sql = readFileSync(sqlPath, 'utf8');
      await conn.query(sql);
    } else {
      // Randul platformei (company_id = 0) poate lipsi pe instalari vechi.
      await conn.query(`
        INSERT INTO company_branding (company_id)
        SELECT 0
        WHERE NOT EXISTS (SELECT 1 FROM company_branding WHERE company_id = 0)
      `);
    }

    console.log('✅ [ensureCompanyBrandingSchema] Schema branding verificată');
  } catch (error: any) {
    console.error(`❌ [ensureCompanyBrandingSchema] Migrare eșuată: ${error?.message || error}`);
    throw error;
  } finally {
    await conn?.end();
  }
}
