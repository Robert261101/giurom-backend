# Gestiune stoc — ce mai rămâne de făcut

Data: 2026-08-03  
Context: sync App1 (`restosoft.eu`) ↔ App2 (`restosoft.ro`), cleanup duplicate agregate, opening balance, remapare EXIT `location_key=0`.

---

## Deja făcut (nu mai repeta)

- [x] Un agregat unic per `(product_id, location_key)` + UNIQUE pe DB
- [x] Merge duplicate pe producție (`duplicate_groups = 0`, ~71 rânduri stoc)
- [x] Sold deschidere (ENTRY `opening_balance`) pentru cantități fără ledger
- [x] Remapare EXIT/ENTRY cu `location_key = 0` pe locația din `stock`
- [x] Write-through App2 → App1 (outbox) verificat pe Sare (ENTRY NIR + EXIT KDS)
- [x] UI: dată cu an + oră:minut la Intrări/Ieșiri
- [x] Etichetă sursă RestoSoft.ro pe mișcări `app2:*`

---

## De făcut — prioritate

### 1. Sănătate date (urgent)

- [ ] **Reconciliere `stock.quantity` vs ledger** pe locații legate  
  Raport: `qty − (SUM entry − SUM exit)` per produs+locație; corectare unde `|diff| > 0.01`.
- [ ] **Verificare FEFO** după remapare + opening balance  
  Consum real pe 2–3 produse cu stoc; dacă open lot = 0 dar agregatul are cantitate, confirmă că fallback-ul agregat e OK sau resetează soldurile.
- [ ] **Schimbă parola DB** `restosoft_stock` (a apărut în chat / terminal)

### 2. Sync & deploy

- [ ] Confirmă pe `.eu` că `stock` rulează build cu UNIQUE + `findOrCreate` race-safe (folderul deploy **nu** e git — verifică `dist` / CI)
- [ ] Monitor **outbox** pe `.ro`: `stock_outbox` status `pending` / `failed` (ecran admin sau alertă)
- [ ] Checklist scurt live:
  - [ ] NIR pe App2 → ENTRY pe `.eu`
  - [ ] KDS/POS → EXIT pe `.eu` (tab Ieșiri)
  - [ ] Cantitate identică pe ambele după sync (~1 min)

### 3. UX gestiune

- [ ] Intrări + Ieșiri pe aceeași vedere (sau badge cu număr pe tab)
- [ ] Etichete clare: „Sold deschidere” vs „RestoSoft.ro” vs „Comandă furnizor”
- [ ] Filtru dată pe mișcări (istoric lung după remapare)

### 4. Operațional

- [ ] Regulă: pe zone legate, **App1 = sursa de adevăr**; App2 doar write-through + oglindă
- [ ] Inventar fizic periodic pe locația legată (ex. lunar) vs App1
- [ ] Verificare NIR read-only pe App2 (operatorii știu unde le văd)

### 5. Mai târziu

- [ ] Rapoarte consum / valoare stoc / export
- [ ] Alerte sub-minim pe zonă
- [ ] Audit UI (cine a făcut mișcarea)

---

## SQL util (referință)

```sql
-- Diferențe qty vs ledger (locație 3)
SELECT s.product_id, p.name, s.quantity AS qty,
  COALESCE(SUM(CASE WHEN t.type='entry' THEN t.quantity END),0) AS entries,
  COALESCE(SUM(CASE WHEN t.type='exit' THEN t.quantity END),0) AS exits,
  s.quantity - (
    COALESCE(SUM(CASE WHEN t.type='entry' THEN t.quantity END),0)
    - COALESCE(SUM(CASE WHEN t.type='exit' THEN t.quantity END),0)
  ) AS diff
FROM stock s
LEFT JOIN products p ON p.id = s.product_id
LEFT JOIN stock_transactions t
  ON t.product_id = s.product_id AND t.location_key = s.location_key
WHERE s.location_id = 3
GROUP BY s.id, s.product_id, p.name, s.quantity
HAVING ABS(diff) > 0.01
ORDER BY ABS(diff) DESC;
```

```sql
-- Outbox App2 (pe DB giurom2, user din resto-backend .env)
SELECT id, status, operation, quantity, target, last_error, created_at, sent_at
FROM stock_outbox
ORDER BY id DESC
LIMIT 20;
```

---

## Următorul pas recomandat

1. Rulează raportul de diferențe pe locația 3.  
2. Corectează FEFO / cantități dacă e nevoie.  
3. Schimbă parola DB.
