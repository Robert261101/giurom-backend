const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: 'root',
    database: 'giurombitap_suppliers',
  });

  const [cols] = await conn.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'supplier_order_item_receptions'
      AND COLUMN_NAME IN ('reception_batch_id','approved_at','net_quantity')
  `);
  console.log(
    'existing cols:',
    cols.map((c) => c.COLUMN_NAME).join(',') || '(none)',
  );

  const have = new Set(cols.map((c) => c.COLUMN_NAME));
  const alters = [];
  if (!have.has('reception_batch_id')) {
    alters.push(
      "ADD COLUMN reception_batch_id VARCHAR(36) NULL COMMENT 'uuid comun rândurilor create în același apel de recepție' AFTER status",
    );
  }
  if (!have.has('approved_at')) {
    alters.push(
      "ADD COLUMN approved_at DATETIME NULL COMMENT 'momentul aprobării' AFTER reception_batch_id",
    );
  }
  if (!have.has('net_quantity')) {
    alters.push(
      "ADD COLUMN net_quantity DECIMAL(10,2) NULL COMMENT 'cantitatea netă după conversie' AFTER approved_at",
    );
  }

  if (alters.length) {
    const sql =
      'ALTER TABLE supplier_order_item_receptions ' + alters.join(', ');
    console.log('Running ALTER...');
    await conn.query(sql);
    console.log('ALTER OK');
  } else {
    console.log('Columns already present');
  }

  const [idx] = await conn.query(`
    SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'supplier_order_item_receptions'
      AND INDEX_NAME IN ('IDX_soir_reception_batch_id','IDX_soir_status_approved_at')
  `);
  const haveIdx = new Set(idx.map((i) => i.INDEX_NAME));

  if (!haveIdx.has('IDX_soir_reception_batch_id')) {
    await conn.query(
      'CREATE INDEX IDX_soir_reception_batch_id ON supplier_order_item_receptions (reception_batch_id)',
    );
    console.log('Created IDX_soir_reception_batch_id');
  }
  if (!haveIdx.has('IDX_soir_status_approved_at')) {
    await conn.query(
      'CREATE INDEX IDX_soir_status_approved_at ON supplier_order_item_receptions (status, approved_at)',
    );
    console.log('Created IDX_soir_status_approved_at');
  }

  const [finalCols] = await conn.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'supplier_order_item_receptions'
      AND COLUMN_NAME IN ('reception_batch_id','approved_at','net_quantity')
  `);
  console.log('final cols:', finalCols.map((c) => c.COLUMN_NAME).join(','));
  await conn.end();
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
