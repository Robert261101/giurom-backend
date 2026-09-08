# Subscription / quota SQL migrations (non-company DBs)

Plan matrix seeds live in **company** DB and are applied via
`giurom-backend/company/scripts/apply-subscription-migrations.js`.
Do **not** change those seeds for furnizor downgrade blocks.

## Staff soft-block (`employees_suppliers.is_active`)

- File: `giurom-backend/suppliers-ms/migrations/20260908_employees_suppliers_is_active.sql`
- Database: **suppliers** DB (same as `employees_suppliers`)
- Apply manually, e.g.:

```bash
mysql -u USER -p SUPPLIERS_DB < giurom-backend/suppliers-ms/migrations/20260908_employees_suppliers_is_active.sql
```

## Location soft-block (`work_location.is_active`)

- File: `giurom-backend/locations/migrations/20260908_work_location_is_active.sql`
- Database: **locations** DB (same as `work_location`)
- Apply manually, e.g.:

```bash
mysql -u USER -p LOCATIONS_DB < giurom-backend/locations/migrations/20260908_work_location_is_active.sql
```

`apply-subscription-migrations.js` was **not** updated — it only targets the company DB.
