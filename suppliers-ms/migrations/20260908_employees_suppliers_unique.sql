-- One operational role per employee per supplier (business rule: un singur rol ops).
-- Idempotent (MariaDB: CREATE UNIQUE INDEX IF NOT EXISTS). Dedupe first, keep lowest id.

DELETE e1 FROM employees_suppliers e1
INNER JOIN employees_suppliers e2
  ON e1.employee_id = e2.employee_id
 AND e1.supplier_id = e2.supplier_id
 AND e1.id > e2.id;

CREATE UNIQUE INDEX IF NOT EXISTS UQ_employees_suppliers_employee_supplier
  ON employees_suppliers (employee_id, supplier_id);
