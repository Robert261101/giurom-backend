# Audit securitate tenant isolation — Giurom Backend

Documentație completă a auditului, remediilor implementate, pattern-uri reutilizabile și proceduri de deploy.

**Commit principal:** `481cbc6f` — `fix(security): enforce tenant isolation across microservices and gateway`  
**Data:** 27 iulie 2026  
**Repo:** `BitAP-It-Services/giurom-backend`

---

## 1. Verdict audit

**Nu există izolare tenant 100%** fără remedieri. Probleme identificate:

- ~8/14 microservicii cu vulnerabilități IDOR cross-tenant
- Rute auth `/users/*` fără guards
- Header-e client (`x-work-location-id`, `x-company-id`, `x-user-id`) transmise fără validare la gateway
- Apeluri interne / RPC fără context utilizator

**Obiectiv remedieri:** verificare `company_id` / `location_id` din JWT față de resursa accesată, guards pe toate rutele critice, eliminarea încrederii în header-e controlate de client.

---

## 2. Ce s-a implementat (pe serviciu)

### 2.1 Auth (cel mai critic)

**Problema:** ~30 rute `/users/*` fără guard (roles, permissions, CRUD utilizatori).

**Fix:**

| Fișier | Modificare |
|--------|------------|
| `auth/src/auth/internal-service.guard.ts` | Aliniat la pattern employees: `bypassAuth`, `timingSafeEqual`, return `true` fără headers interne |
| `auth/src/guards/auth.guard.ts` | Skip când `request.bypassAuth` |
| `auth/src/guards/roles.guard.ts` | Skip când `request.bypassAuth` |
| `auth/src/users/users.controller.ts` | Guards pe **toate** endpoint-urile |
| `auth/src/users/users.service.ts` | Metode `ForRequester`, `assertCanReadEmployee`, `assertCanWriteEmployee`, `assertCanManageRoles`, etc. |

---

### 2.2 waste-records-ms

| Fișier | Modificare |
|--------|------------|
| `waste-records-ms/src/waste-records-access.ts` | **NOU** — logică acces tenant |
| `waste-records-ms/src/waste-records/waste-records.service.ts` | Filtrare `location_id`, verificări pe findAll/findOne/update/remove/create |
| `waste-records-ms/src/auth/jwt.strategy.ts` | Extins cu `company_id`, `roles`, `sub` |
| `waste-records-ms/package.json` | Adăugat `@nestjs/axios` |

---

### 2.3 veziv-tasks

| Fișier | Modificare |
|--------|------------|
| `veziv-tasks/src/execution/execution.controller.ts` | Reactivat guard pe `GET /executions/:id` |
| `veziv-tasks/src/execution/execution.service.ts` | `findOne(id, user, authorization)` + `assertCanAccessExecution` |
| `veziv-tasks/src/assignment/assignment.controller.ts` | Guard delete |
| `veziv-tasks/src/assignment/assignment.service.ts` | `assertCanManageAssignment` pe delete |

---

### 2.4 attendance-ms

| Fișier | Modificare |
|--------|------------|
| `attendance-ms/src/attendance.service.ts` | `assertEmployeeAttendanceAccess`, `assertEmployeeInCompany` |
| `attendance-ms/src/attendance.controller.ts` | Transmite `req.user` + `Authorization` |

Protejate: shifts, presences, inflexions GPS (find/update/delete).

---

### 2.5 stock

| Fișier | Modificare |
|--------|------------|
| `stock/src/stock/stock-access.ts` | **NOU** — logică acces tenant |
| `stock/src/stock/stock.service.ts` | Protejate findStock, updateStock, deleteStock, waste-records CRUD, findProduct/updateProduct/deleteProduct |
| `stock/src/auth/jwt.strategy.ts` | `company_id` în JWT strategy |
| `stock/src/stock/stock.http.controller.ts` | `@Request() req` pe operații ID |

---

### 2.6 employees

| Fișier | Modificare |
|--------|------------|
| `employees/src/employee.service.ts` | `assertCanAccessEmployee` via `work_location_default_id` + `assertLocationInCompany` |
| `employees/src/employee.http.controller.ts` | Protejate findOne, update, remove, toggleActive |

---

### 2.7 locations

| Fișier | Modificare |
|--------|------------|
| `locations/src/locations/locations.service.ts` | Verificare `company_id` JWT vs `location.company_id` în `findWorkLocationById` |
| `locations/src/locations.http.controller.ts` | PATCH/DELETE trimit `req.user` |

---

### 2.8 requests-ms (shift-change)

| Fișier | Modificare |
|--------|------------|
| `shift-change-requests.controller.ts` | POST: `getCanonicalEmployeeId(user)` din JWT, nu `x-user-id` |
| `shift-change-requests.service.ts` | `assertShiftChangeReadAccess` aruncă dacă lipsește user; `reviewed_by_id` din JWT la update |

---

### 2.9 suppliers-ms (comenzi)

| Fișier | Modificare |
|--------|------------|
| `suppliers-ms/src/suppliers/order-access.ts` | **NOU** — `assertOrderCompanyAccess`, `OrderRequesterUser`, `resolveOrderActorUserId`, `filterOrdersByRequesterCompany` |
| `suppliers-ms/src/suppliers/suppliers.service.ts` | `findOrderForRequester`, `findOrderItemForRequester`, `filterOrderIdsForRequester`; protecție pe toate operațiile order |
| `suppliers-ms/src/suppliers/suppliers.http.controller.ts` | `req.user` pe toate rutele order; `x-user-id` înlocuit cu JWT `sub` |

**Operații protejate:**

- deliver, warehouse-review, partial-reception, approve/reject receptions
- assignments, driver-assignments, toggle-availability
- cancel-items, cancel-remaining, delivery-date
- GET receptions / cancelled-items (inclusiv batch)
- createOrder — forțează `company_id` din JWT pentru non-admin

---

### 2.10 recipes

| Fișier | Modificare |
|--------|------------|
| `recipes/src/recipes/recipe-access.ts` | Pattern existent extins |
| `recipes/src/recipes/recipes.service.ts` | `ensureRecipeAccess`, `assertPreparationRecipeAccess` |
| `recipes/src/recipes/recipes.service.ts` | Ingrediente, media, scaled-ingredients (anterior) |
| `recipes/src/recipes/recipes-preparations.service.ts` | Acces pe create/update/remove/findOne/findMany/prepareWithStock |
| `recipes/src/recipes/recipes-labels.service.ts` | Filtrare findAll, assert pe findOne/remove/create |
| `recipes/src/recipes.http.controller.ts` | Propagare `buildRecipeAccessRequester(req.user)` |

**Notă:** categoriile rețete (`recipe_categories`) sunt globale în DB (fără `company_id`) — risc redus.

---

### 2.11 api-gateway

| Fișier | Modificare |
|--------|------------|
| `api-gateway/src/tenant-headers.js` | **NOU** — middleware validare header-e tenant |
| `api-gateway/src/main.js` | Integrare middleware |
| `api-gateway/package.json` | Dependință `jsonwebtoken` |

**Comportament middleware:**

1. Decodează/verifică JWT din `Authorization` (cu `JWT_SECRET` din env)
2. Respinge spoofing `x-company-id` / `x-work-location-id` față de claims JWT
3. Admini globali (`assignment.read_all`) — bypass
4. Admini company (`assignment.read_company`) — pot schimba locația în companie
5. **Elimină `x-user-id`** de la client (anti-spoofing)
6. Excepții: `/health`, `/auth`, `/api/images`, apeluri interne cu `x-internal-service` + `x-service-secret`

**Env necesar pe gateway:**

```env
JWT_SECRET=<același secret ca la auth>
SERVICE_SECRET=<același ca la microservicii>
```

---

## 3. Pattern-uri reutilizabile

### 3.1 Tenant pe locație (stock, waste-records)

```typescript
resolvePermittedLocationIds(user) // via GET locations/company/:companyId
assertLocationInCompany(locationId, user)
```

### 3.2 Tenant pe companie (comenzi suppliers)

```typescript
const order = await this.findOrderForRequester(orderId, user);
// order-access.ts
assertOrderCompanyAccess(order, buildSupplierProductUserContext(user));
```

### 3.3 Tenant pe rețetă (recipes)

```typescript
await this.ensureRecipeAccess(recipeId, buildRecipeAccessRequester(user));
// → assertRecipeAccessibleToRequester via employees locations
```

### 3.4 Internal service (microservicii)

```typescript
InternalServiceGuard → bypassAuth = true → skip JWT/permissions
```

**Referințe bune în codebase:**

- `calendar-ms/calendar-access.ts`
- `company/company.service.ts` — `assertCompanyAccessibleToRequester`
- `employees` — `InternalServiceGuard`

---

## 4. Fișiere noi create

```
api-gateway/src/tenant-headers.js
stock/src/stock/stock-access.ts
suppliers-ms/src/suppliers/order-access.ts
waste-records-ms/src/waste-records-access.ts
```

---

## 5. Build — verificare locală

Toate serviciile modificate compilează cu succes:

```bash
cd auth && npm run build
cd suppliers-ms && npm run build
cd recipes && npm run build
cd requests-ms && npm run build
cd waste-records-ms && npm run build
cd veziv-tasks && npm run build
cd attendance-ms && npm run build
cd stock && npm run build
cd employees && npm run build
cd locations && npm run build
# api-gateway: pe Linux npm run build; pe Windows verificare syntax:
node -c api-gateway/src/main.js
node -c api-gateway/src/tenant-headers.js
```

---

## 6. Deploy

### 6.1 GitHub Actions (mod normal)

Workflow: `.github/workflows/deploy.yml`

**Trigger:** push pe `main`

**Flux:**

```
push → GitHub runner checkout → npm ci + build → rsync (dist, node_modules, package.json)
     → SSH pe server → pm2 restart
```

**Path server:** `/home/restosoft/giurom-backend/<serviciu>/`

**Important:** folderul de producție **NU conține `.git`** — doar artefacte build. Actions **nu face `git pull` pe server**.

**Secrets necesare:** `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER`

### 6.2 Eșec Actions (billing)

Dacă Actions pică cu mesaj billing/spending limit, commit-ul e pe GitHub dar **nu ajunge pe server** până la re-run sau deploy manual.

### 6.3 Deploy manual (echivalent Actions)

**Opțiunea A — Re-run Actions** după fix billing (recomandat).

**Opțiunea B — Deploy key pe server + git:**

```bash
# O singură dată: Deploy key în GitHub repo settings
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub  # → GitHub Deploy keys

git clone git@github.com:BitAP-It-Services/giurom-backend.git ~/giurom-backend-src
```

**Opțiunea C — Build pe PC + scp** (fără git pe server).

**Script deploy pe server (după clone):**

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd ~/giurom-backend-src
git pull origin main

SERVICES="api-gateway auth employees locations recipes stock suppliers-ms veziv-tasks requests-ms waste-records-ms attendance-ms"

for svc in $SERVICES; do
  echo "========== $svc =========="
  cd ~/giurom-backend-src/$svc
  npm ci && npm run build && npm prune --omit=dev
  rsync -av --delete dist/ node_modules/ package.json ~/giurom-backend/$svc/
  pm2 restart "$svc" --update-env
done

pm2 save
```

**Opțiunea D — Build pe Windows + scp:**

```powershell
cd "e:\Veziv - Coduri\giurom-nou\giurom-backend"
git pull origin main

$server = "restosoft@<IP_SERVER>"
$remote = "/home/restosoft/giurom-backend"
$services = @("api-gateway","auth","employees","locations","recipes","stock","suppliers-ms","veziv-tasks","requests-ms","waste-records-ms","attendance-ms")

foreach ($svc in $services) {
  Set-Location "e:\Veziv - Coduri\giurom-nou\giurom-backend\$svc"
  npm ci
  if ($svc -eq "api-gateway") {
    Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path dist | Out-Null
    Copy-Item -Path "src\*" -Destination dist -Recurse -Force
  } else { npm run build }
  npm prune --omit=dev
  scp -r dist node_modules package.json "${server}:${remote}/${svc}/"
}
```

Apoi pe server:

```bash
pm2 restart api-gateway auth employees locations recipes stock suppliers-ms veziv-tasks requests-ms waste-records-ms attendance-ms --update-env
pm2 save
```

### 6.4 PM2 — servicii backend

| Nume PM2 | Port (implicit) |
|----------|-----------------|
| api-gateway | 3002 |
| auth | 3021 |
| company | 3003 |
| locations | 3004 |
| recipes | 3005 |
| stock | 3006 |
| suppliers-ms | 3007 |
| veziv-tasks | 3008 |
| calendar-ms | 3010 |
| employees | 3011 |
| requests-ms | 3013 |
| waste-records-ms | 3014 |
| attendance-ms | 3016 |
| notifications-ms | 3020 |

---

## 7. Teste manuale post-deploy

Cu **2 conturi din companii diferite**, verifică **403** sau **404** (nu date):

| Test | Endpoint / acțiune |
|------|-------------------|
| IDOR comenzi | PATCH/GET `/suppliers/orders/{id}` cross-company |
| IDOR angajat | GET `/employees/{id}` cross-company |
| IDOR locație | PATCH `/locations/{id}` cross-company |
| Header spoof | DevTools: schimbă `x-work-location-id` / `x-company-id` → **403** la gateway |
| Shift-change | GET `/shift-change-requests/{id}` user neimplicat |
| Rețete/preparations | GET `/recipe-preparations/{id}` cross-locație |
| Auth users | GET `/users/{id}` cross-company |

**Verificare gateway:**

```bash
curl -s http://localhost:3002/health
pm2 env api-gateway | grep JWT_SECRET
```

---

## 8. Rămas opțional (prioritate mică)

| Item | Descriere |
|------|-----------|
| Micro-controllere RPC | `attendance.micro.controller`, `employee.micro.controller`, `locations.micro.controller`, `stock.micro.controller` — accesibile doar via RabbitMQ; păstrare bypass doar cu `x-internal-service` valid |
| Categorii rețete | Globale în DB, fără tenant |
| Roluri super-admin / franchiză | Verificare manuală fluxuri cross-company legitime |
| Frontend | Curățare trimitere `x-user-id` (gateway îl elimină oricum) |

---

## 9. Erori build rezolvate în sesiune

1. **waste-records:** lipsea `@nestjs/axios` — instalat
2. **stock:** import-uri `PaginatedStockResponse` șterse accidental — restaurate
3. **suppliers:** import duplicat `SupplierProductUserContext` — eliminat

---

## 10. Rezumat executiv

| Înainte | După |
|---------|------|
| Header-e tenant editabile din DevTools | Gateway validează vs JWT |
| `x-user-id` trusted de suppliers/requests | Actor din JWT `sub` |
| IDOR pe comenzi, angajați, locații, stock, waste | Verificare company/location |
| Rute auth `/users/*` deschise | Guards + `ForRequester` |
| Magazioner cu `order.read` citea shift-change | `assertShiftChangeReadAccess` obligatoriu |

**Commit:** `481cbc6f` pe `main`  
**Deploy:** GitHub Actions (când billing e activ) sau manual conform secțiunii 6.
