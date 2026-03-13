# Notificări: scop pe locație / firmă

Regula dorită: **toate notificările** să fie trimise fie la **adminul firmei care are locația**, fie la **angajații / managerul de la locație** (nu la toți adminii/managerii din sistem).

---

## 1. Tabel: handler, context, status

| Handler | Tipuri evenimente | Are work_location_id în payload? | Are company_id? | Targeting actual | Modificare propusă / Status |
|--------|--------------------|-----------------------------------|-----------------|-------------------|-----------------------------|
| **onOrderNotification** | order_*, supplier_order_* | ✅ `work_location_id` | - | ✅ `getUsersWithRolesForLocation` + fallback global | Păstrat; opțional: scoate fallback pentru strict locație |
| **onLocationNotification** | location_created/updated/deleted, revenue_sent/approved/rejected | ✅ location: `entity_id`; revenue: `metadata.work_location_id` | - | ❌ toți adminii | ✅ **Implementat**: `getUsersWithRolesForLocation(['admin'], workLocationId)` + fallback |
| **onRevenueApproved** | revenue_approved (per angajat) | ✅ `workLocationId` în event | - | Angajați pontați (rezolvare employee_id → user_id) | OK – deja per angajat la locație |
| **onEmployeeNotification** | employee_created/updated/deleted | ❌ nu trimite | - | Doar admin | **Emitter**: employees-ms să trimită `work_location_id` în metadata; aici: `getUsersWithRolesForLocation(['admin'], work_location_id)` |
| **onSupplierNotification** | supplier_*, supplier_order_created | ❌ nu trimite | - | Doar admin | **Emitter**: suppliers-ms poate trimite `work_location_id` (locație principală/comandă); aici: filtrare pe locație dacă există |
| **onStockNotification** | stock_in_*, stock_out_* | ❌ de verificat în stock-ms | - | Manager + admin | **Emitter**: stock să trimită `work_location_id`; aici: `getUsersWithRolesForLocation` |
| **onRecipeNotification** | recipe_*, preparation_*, label_* | ❌ | - | Admin / admin+manager | Rețete pot fi la nivel companie; dacă există `company_id` sau `work_location_id` în payload → filtrare |
| **onLeaveNotification** | leave_request_created, aprobare/respingere | ❌ | - | Manager+admin / angajat | **Emitter**: leave să trimită `work_location_id` (locația angajatului); aici: `getUsersWithRolesForLocation` pentru manager+admin |
| **onShiftChangeNotification** | shift_change_request_* | ❌ | - | La fel ca leave | Idem: `work_location_id` din emitter + `getUsersWithRolesForLocation` |
| **onShiftNotification** | modificări ture | ❌ | - | Manager+admin + angajat | Idem: locație în payload + filtrare manager/admin pe locație |
| **onAttendanceNotification** | attendance_* | ❌ | - | Manager+admin + angajat | Idem |
| **onTaskNotification** | template.*, execution.*, assignment.* | Posibil în metadata (workLocationId / locationId) | - | Admin (șabloane); user asignat + manager/admin (task) | Pentru template.* OK doar admin; pentru task cu locație: filtrare manager/admin pe locație dacă metadata are work_location_id |
| **onCalendarNotification** | calendar_* | ❌ de verificat | - | Manager + admin | Dacă evenimentul e legat de locație → `work_location_id` + `getUsersWithRolesForLocation` |
| **onWasteRecordsNotification** | waste_* | ❌ de verificat | - | Manager + admin | Idem |
| **onCompanyNotification** | company_* | - | ✅ company_id (din entity_id sau metadata) | Manager + admin | **Necesar**: `getUsersWithRolesForCompany(roleNames, companyId)` dacă API-ul users expune company_id per user; altfel rămâne global |
| **Cron documente expirate/expirând** | company_document_*, location_file_*, employee_file_*, supplier_document_* | ✅ per document: company_id, work_location_id, employee_id, supplier_id | ✅ company_id | Toți manager/admin | **Implementat**: pentru location_file_* → filtrare pe `work_location_id`. Pentru company_document_* → necesită getUsersWithRolesForCompany. Pentru employee_file_* → poate fi filtrat după locația angajatului (API employee → location). Furnizor: opțional pe locații furnizor. |

---

## 2. Helpers existente

- **getUsersWithRoles(roleNames)** – toți userii cu rolurile date (fără filtrare firmă/locație).
- **getUsersWithRolesForLocation(roleNames, workLocationId)** – userii cu rolurile date care au `work_location_id` sau `work_location_default_id` = workLocationId (răspuns GET `/users/:id`).

---

## 3. Ce lipsește pentru 100% scop locație/firmă

1. **API Users**: dacă există multi-tenant (mai multe firme), utilizatorii ar trebui să aibă `company_id` (sau echivalent) și/sau `work_location_id` / `work_location_default_id` – deja folosit pentru locație.
2. **getUsersWithRolesForCompany(roleNames, companyId)** – nou în notifications-ms, dacă API-ul expune company per user.
3. **Emitters** (employees, suppliers, stock, leave, shift, attendance, etc.): să includă **work_location_id** (sau company_id unde e cazul) în payload-ul notificărilor, astfel încât notifications-ms să poată apela `getUsersWithRolesForLocation` (sau ForCompany).

---

## 4. Modificări deja făcute

- **onLocationNotification**: se obține `work_location_id` din event (`entity_id` pentru entity_type location, `metadata.work_location_id` pentru revenue). Se folosește `getUsersWithRolesForLocation(['admin'], work_location_id)` cu fallback la `getUsersWithRoles(['admin'])` dacă nu există locație sau nu găsește useri.
- **Cron documente – location files**: la notificări pentru documente locație expirate/expirând, destinatarii sunt filtrați cu `getUsersWithRolesForLocation` pe `file.work_location_id`.

---

## 5. Locația selectată în UI (colț dreapta sus)

**Regula importantă**: notificările trebuie să folosească **locația selectată în momentul acțiunii** (dropdown colț dreapta sus), nu locația implicită a userului.

- **Frontend**: la fiecare request care poate genera notificări, trimite locația selectată:
  - Header: **`x-work-location-id`** (recomandat), sau
  - Query: **`location_id`** / **`work_location_id`**.
- **Backend**: fiecare microserviciu care emite notificări citește această valoare din request (Headers/Query) și o include în payload-ul notificării ca **`metadata.work_location_id`** (sau câmp top-level unde e cazul), astfel încât notifications-ms să poată filtra destinatarii cu `getUsersWithRolesForLocation`.

**Implementat**:
- **employees-ms**: create/update/remove citesc `x-work-location-id` sau `location_id`, trimit `metadata.work_location_id`; onEmployeeNotification filtrează admin pe locație.
- **suppliers-ms**: create folosește location_id (din query/header/user), update/remove primesc selectedWorkLocationId din header/query; toate trimit work_location_id în metadata; onSupplierNotification filtrează admin pe locație. Comanda furnizor trimite supplier_location_id.
- **locations-ms**: deja trimite work_location_id (entity_id pentru locații, metadata pentru revenue).

## 6. Pași următori (opțional)

1. **stock**, **recipes**, **leave**, **shift**, **attendance**, **calendar**, **waste**, **tasks**: citire `x-work-location-id` / `location_id` din request și incluziune în payload notificări; în notifications-ms folosire pentru `getUsersWithRolesForLocation` unde există.
2. **Company**: implementare `getUsersWithRolesForCompany` + folosire în onCompanyNotification și cron company_document_*, după ce API users expune company_id.
