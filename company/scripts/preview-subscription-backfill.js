/**
 * Preview client company subscriptions + supplier usage (read-only).
 *
 *   node scripts/preview-subscription-backfill.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root',
    multipleStatements: true,
  });

  const limitsByPlan = {
    free: { account: 1, manual: 3 },
    silver: { account: 3, manual: 7 },
    gold: { account: 10, manual: 25 },
  };

  const [companies] = await c.query(`
    SELECT id, company_name, company_type
    FROM giurombitap_company.companies
    WHERE company_type = 'client'
    ORDER BY id
  `);

  const rows = [];
  for (const co of companies) {
    const companyId = Number(co.id);
    let planCode =
      companyId === 1 ? 'gold' : companyId === 15 ? 'silver' : 'free';

    const [existing] = await c.query(
      `SELECT plan_code FROM giurombitap_company.company_subscriptions WHERE company_id = ? LIMIT 1`,
      [companyId],
    );
    if (existing.length) {
      planCode = String(existing[0].plan_code);
    }

    const [locs] = await c.query(
      `SELECT id FROM giurombitap_locations.work_location WHERE company_id = ?`,
      [companyId],
    );
    const locationIds = locs.map((r) => Number(r.id));

    const [accountRows] = await c.query(
      `SELECT COUNT(*) AS c FROM giurombitap_suppliers.client_supplier_links WHERE client_company_id = ?`,
      [companyId],
    );
    const accountUsed = Number(accountRows[0].c);

    let manualUsed = 0;
    if (locationIds.length) {
      const [manualRows] = await c.query(
        `
        SELECT COUNT(DISTINCT s.id) AS c
        FROM giurombitap_suppliers.suppliers s
        JOIN giurombitap_suppliers.supplier_locations sl ON sl.supplier_id = s.id
        WHERE (s.owner_company_id IS NULL OR s.owner_company_id = 0)
          AND sl.id_location IN (${locationIds.map(() => '?').join(',')})
        `,
        locationIds,
      );
      manualUsed = Number(manualRows[0].c);
    }

    const lim = limitsByPlan[planCode] || limitsByPlan.free;
    rows.push({
      company_id: companyId,
      company_name: co.company_name,
      plan_code: planCode,
      account_suppliers_used: accountUsed,
      account_limit: lim.account,
      manual_suppliers_used: manualUsed,
      manual_limit: lim.manual,
      account_over_limit: accountUsed > lim.account,
      manual_over_limit: manualUsed > lim.manual,
      subscription_exists: existing.length > 0,
    });
  }

  console.table(rows);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
