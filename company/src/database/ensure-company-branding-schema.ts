import { createConnection, Connection } from 'mysql2/promise';

/**
 * Creează `company_branding` dacă lipsește (logo + paletă per firmă).
 * Idempotent — safe la fiecare restart. Folosește env DB_* din .env / PM2.
 *
 * Important: mysql2/MariaDB nu execută mai multe statement-uri într-un singur
 * `query()` (fără multipleStatements). CREATE + INSERT din fișierul SQL trebuie
 * rulate separat — altfel boot-ul cade în buclă (ER_PARSE_ERROR la INSERT).
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
      await conn.query(`
        CREATE TABLE IF NOT EXISTS company_branding (
          company_id INT NOT NULL,
          logo_file VARCHAR(255) NULL,
          logo_mime VARCHAR(100) NULL,
          logo_version INT NOT NULL DEFAULT 0,
          color_primary VARCHAR(9) NULL,
          color_primary_foreground VARCHAR(9) NULL,
          color_accent VARCHAR(9) NULL,
          color_page_bg VARCHAR(9) NULL,
          color_surface VARCHAR(9) NULL,
          color_sidebar VARCHAR(9) NULL,
          color_text VARCHAR(9) NULL,
          color_text_muted VARCHAR(9) NULL,
          color_border VARCHAR(9) NULL,
          updated_by_user_id INT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }

    // Randul platformei (company_id = 0) — statement separat, mereu idempotent.
    await conn.query(`
      INSERT INTO company_branding (company_id)
      SELECT 0 FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM company_branding WHERE company_id = 0)
    `);

    console.log('✅ [ensureCompanyBrandingSchema] Schema branding verificată');
  } catch (error: any) {
    console.error(`❌ [ensureCompanyBrandingSchema] Migrare eșuată: ${error?.message || error}`);
    throw error;
  } finally {
    await conn?.end();
  }
}
