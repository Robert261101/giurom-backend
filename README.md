# Giurom Backend - Punct de Lucru și Adăugare Firmă

Backend API pentru modulele **Punct de Lucru** și **Adăugare Firmă** din aplicația Giurom, construit cu NestJS și MariaDB.

## 📋 Caracteristici

- **🏢 Modulul Company**: Gestionarea completă a companiilor și documentelor acestora
- **📍 Modulul Locations**: Gestionarea locațiilor de lucru și atribuirea template-urilor de sarcini
- **🔒 Securitate**: Implementat cu helmet, CORS, rate limiting și validări class-validator
- **📚 Swagger**: Documentație API completă cu exemple pentru testare
- **🗄️ MariaDB**: Baza de date robustă cu relații complexe
- **✅ Validări**: Validări complete pentru toate input-urile folosind class-validator

## 🚀 Instalare și Configurare

### Prerequizite

- Node.js (v18 sau mai nou)
- MariaDB (v10.6 sau mai nou)
- npm sau yarn

### Pași de instalare

1. **Clonați repository-ul:**
   ```bash
   git clone <repository-url>
   cd giurom-backend
   ```

2. **Instalați dependențele:**
   ```bash
   npm install
   ```

3. **Configurați variabilele de mediu:**
   ```bash
   cp .env.example .env
   ```
   Editați fișierul `.env` cu configurațiile voastre:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USERNAME=your_username
   DB_PASSWORD=your_password
   DB_DATABASE=giurom_db
   ```

4. **Creați baza de date:**
   ```sql
   CREATE DATABASE giurom_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

5. **Porniți aplicația:**
   ```bash
   # Dezvoltare
   npm run start:dev
   
   # Producție
   npm run start:prod
   ```

## 📊 Diagrama ER

Aplicația implementează următoarele entități conform diagramei ER:

- **Company**: Entitatea principală pentru companii
- **Company_Document**: Documentele asociate companiilor
- **Work_Location**: Locațiile de lucru ale companiilor
- **WorkLocation_TaskTemplate**: Relația many-to-many între locații și template-uri

## 🔧 API Endpoints

### Companii (`/companies`)

#### Operațiuni CRUD pentru companii:
- `POST /companies` - Creează o nouă companie
- `GET /companies` - Lista companiilor (cu paginare și filtrare)
- `GET /companies/:id` - Detalii companie după ID
- `GET /companies/cui/:cui` - Caută companie după CUI
- `PATCH /companies/:id` - Actualizează companie
- `DELETE /companies/:id` - Șterge companie
- `GET /companies/statistics` - Statistici companii

#### Operațiuni pentru documente:
- `POST /companies/:companyId/documents` - Adaugă document la companie
- `GET /companies/:companyId/documents` - Lista documente companie
- `GET /companies/documents/:documentId` - Detalii document
- `PATCH /companies/documents/:documentId` - Actualizează document
- `DELETE /companies/documents/:documentId` - Șterge document

### Locații (`/locations`)

#### Operațiuni CRUD pentru locații:
- `POST /locations` - Creează locație de lucru
- `GET /locations` - Lista locațiilor (cu paginare și filtrare)
- `GET /locations/:id` - Detalii locație
- `GET /locations/company/:companyId` - Locațiile unei companii
- `PATCH /locations/:id` - Actualizează locație
- `DELETE /locations/:id` - Șterge locație
- `GET /locations/statistics` - Statistici locații

#### Operațiuni pentru atribuiri de template-uri:
- `POST /locations/assignments` - Atribuie template la locație
- `GET /locations/assignments` - Lista atribuirilor
- `GET /locations/:locationId/assignments` - Atribuirile unei locații
- `GET /locations/assignments/:assignmentId` - Detalii atribuire
- `PATCH /locations/assignments/:assignmentId` - Actualizează atribuire
- `PATCH /locations/assignments/:assignmentId/toggle` - Activează/dezactivează
- `DELETE /locations/assignments/:assignmentId` - Șterge atribuire
- `PATCH /locations/templates/:templateId/deactivate` - Dezactivează template

## 📚 Documentația Swagger

Accesați documentația completă la: `http://localhost:3001/api/docs`

Documentația include:
- Descrieri detaliate pentru toate endpoint-urile
- Exemple de request/response
- Scheme de validare
- Coduri de status HTTP
- Filtre și opțiuni de căutare

## 🔒 Securitate

Aplicația implementează următoarele măsuri de securitate:

- **Helmet**: Headers de securitate HTTP
- **CORS**: Configurare cross-origin controlată
- **Rate Limiting**: Limitarea numărului de cereri per minut
- **Validări**: class-validator pentru toate input-urile
- **TypeORM**: Protecție împotriva SQL injection

## 🗃️ Structura Bazei de Date

```sql
-- Tabelul principal pentru companii
Company (
  id, company_name, cui, trade_register_number,
  address, city, county, postal_code, country,
  phone_number, email, incorporation_date,
  legal_form, activity_code, vat_payer,
  bank_name, bank_account_number, website,
  status, notes, created_at, updated_at
)

-- Documentele companiilor
Company_Document (
  id, company_id, document_name, document_type,
  location_path, upload_date, notes, created_at
)

-- Locațiile de lucru
Work_Location (
  id, company_id, location_name, address,
  city, county, postal_code, country,
  phone_number, email, employee_id, notes, created_at
)

-- Relația many-to-many pentru template-uri
WorkLocation_TaskTemplate (
  id, location_id, template_id, assigned_at,
  active, notes, created_at
)
```

## 🧪 Testare cu Swagger

Pentru a testa API-ul:

1. Accesați `http://localhost:3001/api/docs`
2. Folosiți exemplele pre-definite din documentație
3. Pentru `employee_id` și `template_id`, folosiți valoarea `1` (configurată ca default)

### Exemplu de testare - Crearea unei companii:

```json
{
  "company_name": "SC Test SRL",
  "cui": "RO12345678",
  "trade_register_number": "J40/1234/2023",
  "address": "Str. Exemplu nr. 123, Sector 1",
  "city": "București",
  "incorporation_date": "2023-01-15",
  "legal_form": "SRL",
  "activity_code": "6201"
}
```

## 🚀 Principii de Dezvoltare

Codul respectă principiile:
- **DRY** (Don't Repeat Yourself)
- **KISS** (Keep It Simple, Stupid)
- **Clean Code**: Cod curat și ușor de înțeles
- **Type Safety**: Folosire completă a TypeScript
- **Error Handling**: Gestionare centralizată a erorilor

## 📈 Funcționalități Avansate

- Paginare automată pentru toate listele
- Filtrare și căutare flexibilă
- Statistici în timp real
- Validări robuste cu mesaje în română
- Relații cascadă pentru ștergere sigură
- Indexare optimizată pentru performanță

## 🔧 Dezvoltare

Pentru dezvoltare:

```bash
# Mod dezvoltare cu auto-reload
npm run start:dev

# Rulare teste
npm run test

# Verificare cod
npm run lint

# Format cod
npm run format
```

## 📞 Support

Pentru întrebări sau probleme, contactați echipa de dezvoltare Giurom. 