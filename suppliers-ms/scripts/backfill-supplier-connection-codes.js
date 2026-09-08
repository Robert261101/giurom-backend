/**
 * Backfill connection_code for account suppliers missing a code.
 * Idempotent: skips rows that already have connection_code.
 * Does NOT assign codes to Manual suppliers (owner_company_id IS NULL).
 *
 * Usage (from suppliers-ms):
 *   node scripts/backfill-supplier-connection-codes.js
 *
 * Loads ../.env when present. Env: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && process.env[m[1].trim()] == null) {
      process.env[m[1].trim()] = m[2].trim();
    }
  }
}

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const LENGTH = 12;

function generateCode() {
  const bytes = crypto.randomBytes(LENGTH);
  let out = '';
  for (let i = 0; i < LENGTH; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_DATABASE || 'giurombitap_suppliers',
  });

  const [rows] = await conn.query(
    `SELECT id FROM suppliers
     WHERE owner_company_id IS NOT NULL
       AND (connection_code IS NULL OR connection_code = '')`,
  );

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    let assigned = false;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = generateCode();
      try {
        const [result] = await conn.query(
          `UPDATE suppliers
           SET connection_code = ?
           WHERE id = ?
             AND owner_company_id IS NOT NULL
             AND (connection_code IS NULL OR connection_code = '')`,
          [code, row.id],
        );
        if (result.affectedRows === 1) {
          updated += 1;
          assigned = true;
          break;
        }
        skipped += 1;
        assigned = true;
        break;
      } catch (err) {
        if (err && (err.code === 'ER_DUP_ENTRY' || /Duplicate/i.test(String(err.message)))) {
          continue;
        }
        throw err;
      }
    }
    if (!assigned) {
      throw new Error(`Failed to assign unique connection_code for supplier id=${row.id}`);
    }
  }

  console.log(
    JSON.stringify({
      candidates: rows.length,
      updated,
      already_had_or_raced: skipped,
    }),
  );
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
