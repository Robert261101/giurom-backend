-- One-shot backfill: company-wide supplier_locations for Manual + Cont-linked.
-- Idempotent INSERT ... SELECT WHERE NOT EXISTS. Does NOT create links,
-- change owner_company_id, delete rows, or touch unassociated suppliers.
-- Prefer running scripts/backfill-company-wide-supplier-locations.js --dry-run first.

-- Cont: client_supplier_links → all company work_locations
INSERT INTO giurombitap_suppliers.supplier_locations
  (supplier_id, id_location, created_at, updated_at)
SELECT
  csl.supplier_id,
  wl.id,
  NOW(3),
  NOW(3)
FROM giurombitap_suppliers.client_supplier_links csl
JOIN giurombitap_locations.work_location wl
  ON wl.company_id = csl.client_company_id
WHERE NOT EXISTS (
  SELECT 1
  FROM giurombitap_suppliers.supplier_locations sl
  WHERE sl.supplier_id = csl.supplier_id
    AND sl.id_location = wl.id
);

-- Manual: already on ≥1 company location → fill remaining company locations
INSERT INTO giurombitap_suppliers.supplier_locations
  (supplier_id, id_location, created_at, updated_at)
SELECT DISTINCT
  s.id,
  wl_all.id,
  NOW(3),
  NOW(3)
FROM giurombitap_suppliers.suppliers s
JOIN giurombitap_suppliers.supplier_locations sl_seed
  ON sl_seed.supplier_id = s.id
JOIN giurombitap_locations.work_location wl_seed
  ON wl_seed.id = sl_seed.id_location
JOIN giurombitap_locations.work_location wl_all
  ON wl_all.company_id = wl_seed.company_id
WHERE (s.owner_company_id IS NULL OR s.owner_company_id = 0)
  AND NOT EXISTS (
    SELECT 1
    FROM giurombitap_suppliers.supplier_locations sl
    WHERE sl.supplier_id = s.id
      AND sl.id_location = wl_all.id
  );
