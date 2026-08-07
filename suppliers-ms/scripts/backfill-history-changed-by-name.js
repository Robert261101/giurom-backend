const mysql = require('mysql2/promise');

/**
 * Backfill changed_by_name on preferred-price history.
 * changed_by_user_id is JWT `sub` (= employees.id) in this system,
 * not always auth.users.id.
 */
(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: 'root',
    database: 'giurombitap_suppliers',
    multipleStatements: true,
  });

  const [before] = await conn.query(`
    SELECT COUNT(*) AS cnt
    FROM supplier_product_client_price_history
    WHERE changed_by_user_id IS NOT NULL
      AND (changed_by_name IS NULL OR TRIM(changed_by_name) = '')
  `);
  console.log('rows_missing_name_before', before[0].cnt);

  const [result] = await conn.query(`
    UPDATE supplier_product_client_price_history h
    LEFT JOIN giurombitap_auth.users u_by_id
      ON u_by_id.id = h.changed_by_user_id
    LEFT JOIN giurombitap_employees.employees e
      ON e.id = COALESCE(u_by_id.id_employee, h.changed_by_user_id)
    SET h.changed_by_name = NULLIF(
      TRIM(CONCAT(IFNULL(e.first_name, ''), ' ', IFNULL(e.last_name, ''))),
      ''
    )
    WHERE h.changed_by_user_id IS NOT NULL
      AND (h.changed_by_name IS NULL OR TRIM(h.changed_by_name) = '')
      AND e.id IS NOT NULL
  `);
  console.log('updated', result.affectedRows);

  const [sample] = await conn.query(`
    SELECT id, changed_by_user_id, changed_by_name, action, changed_at
    FROM supplier_product_client_price_history
    WHERE supplier_product_id = 9
    ORDER BY changed_at DESC, id DESC
  `);
  console.log('faina_after', JSON.stringify(sample, null, 2));

  await conn.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
