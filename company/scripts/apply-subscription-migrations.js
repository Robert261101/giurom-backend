/**
 * Apply Phase 2 subscription migrations locally (schema + seed + backfill).
 *   node scripts/apply-subscription-migrations.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = [
    '20260827_01_subscription_schema.sql',
    '20260827_02_subscription_plans_seed.sql',
    '20260827_03_subscription_backfill_clients.sql',
    '20260901_01_subscription_billing_schema.sql',
    '20260901_02_subscription_billing_seed.sql',
    '20260901_03_subscription_demo_prices.sql',
    '20260908_01_plan_features_schema.sql',
    '20260908_02_plan_features_seed.sql',
    '20260908_03_plan_limits_seed_v2.sql',
    '20260908_04_subscription_backfill_furnizor.sql',
  ];

  const c = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_DATABASE || 'giurombitap_company',
    multipleStatements: true,
  });

  console.log(`Connected to ${process.env.DB_DATABASE || 'giurombitap_company'}`);

  // Cleanup accidental tables created in suppliers DB from a prior mis-run
  await c.query(`
    DROP TABLE IF EXISTS giurombitap_suppliers.plan_limits;
    DROP TABLE IF EXISTS giurombitap_suppliers.company_subscriptions;
    DROP TABLE IF EXISTS giurombitap_suppliers.subscription_plans;
  `);

  for (const file of files) {
    const full = path.join(migrationsDir, file);
    const sql = fs.readFileSync(full, 'utf8');
    console.log(`Applying ${file}...`);
    await c.query(sql);
    console.log(`OK ${file}`);
  }

  const [subs] = await c.query(`
    SELECT cs.company_id, c.company_name, cs.plan_code, cs.status
    FROM giurombitap_company.company_subscriptions cs
    JOIN giurombitap_company.companies c ON c.id = cs.company_id
    ORDER BY cs.company_id
  `);
  console.table(subs);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
