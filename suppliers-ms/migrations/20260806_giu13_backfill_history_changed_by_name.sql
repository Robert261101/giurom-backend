-- Controlled backfill: populate changed_by_name from employee linked to actor id.
-- In this system JWT sub (stored in changed_by_user_id) is usually employees.id,
-- not auth.users.id.

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
  AND e.id IS NOT NULL;
