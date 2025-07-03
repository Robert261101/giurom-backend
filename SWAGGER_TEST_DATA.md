# 🧪 Giurom Backend - Date Complete de Testare Swagger

## 📊 Status Implementare

✅ **Company Module** - Complet implementat și testat  
✅ **Locations Module** - Complet implementat și testat  
✅ **Employee Module** - Complet implementat (conform diagramei ER)
   - ✅ Employee Entity (angajați)
   - ✅ Employee Work Location History (istoric locații)
   - ✅ Employee Files (fișiere angajați)
   - ✅ Generated Documents (documente generate)

---

## 👥 Employee Module - Date de Testare

### 🔧 Endpoint: `POST /employees` - Crearea unui angajat nou

```json
{
  "first_name": "Ion",
  "last_name": "Popescu",
  "email": "ion.popescu@giurom.ro",
  "phone": "+40712345678",
  "personal_number": "1900515123456",
  "birth_date": "1990-05-15",
  "gender": "male",
  "marital_status": "single",
  "nationality": "Română",
  "address": "Strada Primăverii nr. 25, Apartament 12, București",
  "hire_date": "2023-01-15",
  "position_default_id": 1,
  "department_default_id": 1,
  "work_location_default_id": 1,
  "contract_type": "permanent",
  "is_active": true
}
```

### 🔧 Endpoint: `POST /employees` - Angajat cu caractere românești

```json
{
  "first_name": "Maria",
  "last_name": "Gheorghiu",
  "email": "maria.gheorghiu@giurom.ro",
  "phone": "+40723456789",
  "personal_number": "2850112234567",
  "birth_date": "1985-01-12",
  "gender": "female",
  "marital_status": "married",
  "nationality": "Română",
  "address": "Bulevardul Unirii nr. 150, Timișoara, Timiș",
  "hire_date": "2023-06-20",
  "termination_date": "2025-06-20",
  "position_default_id": 2,
  "department_default_id": 2,
  "work_location_default_id": 1,
  "contract_type": "fixed-term",
  "is_active": true
}
```

### 🔧 Endpoint: `POST /employees` - Stagiar

```json
{
  "first_name": "Andrei",
  "last_name": "Ionescu",
  "email": "andrei.ionescu@giurom.ro",
  "phone": "+40734567890",
  "personal_number": "5000301345678",
  "birth_date": "2000-03-01",
  "gender": "male",
  "nationality": "Română",
  "address": "Strada Florilor nr. 8, Cluj-Napoca, Cluj",
  "hire_date": "2024-07-01",
  "termination_date": "2024-12-31",
  "contract_type": "internship",
  "is_active": true
}
```

---

## 🏢 Company Module - Date de Testare (Existente)

### 🔧 Endpoint: `POST /companies`

```json
{
  "company_name": "Tech Solutions România SRL",
  "cui": "RO12345679",
  "trade_register_number": "J40/5678/2023",
  "address": "Strada Progresului nr. 45, Etajul 2",
  "city": "București",
  "county": "Bucuresti",
  "postal_code": "010789",
  "phone_number": "+40212345679",
  "email": "contact@techsolutions.ro",
  "incorporation_date": "2023-06-15",
  "legal_form": "SRL",
  "activity_code": "6201",
  "vat_payer": true,
  "bank_name": "Banca Transilvania",
  "bank_account_number": "RO12BTRL1234567890123456",
  "website": "https://techsolutions.ro",
  "status": "activ",
  "notes": "Companie de dezvoltare software cu sediul în București"
}
```

---

## 📍 Locations Module - Date de Testare (Existente)

### 🔧 Endpoint: `POST /locations` - Locație cu coordonate GPS

```json
{
  "company_id": 1,
  "location_name": "Biroul Central Cluj",
  "address": "Strada Memorandumului nr. 28",
  "city": "Cluj-Napoca",
  "county": "Cluj",
  "postal_code": "400114",
  "phone_number": "+40264123456",
  "email": "cluj@giurom.ro",
  "employee_id": 1,
  "notes": "Biroul principal din Cluj-Napoca cu geofencing",
  "gps_lat": 46.7712,
  "gps_lng": 23.6236,
  "gps_radius_m": 100
}
```

### 🔧 Endpoint: `POST /locations` - Locație București cu GPS

```json
{
  "company_id": 1,
  "location_name": "Sediul Central București",
  "address": "Bulevardul Ion Mihalache nr. 104-106",
  "city": "București",
  "county": "București",
  "postal_code": "011171",
  "phone_number": "+40212345678",
  "email": "bucuresti@giurom.ro",
  "employee_id": 1,
  "notes": "Sediul central cu sistem de pontaj GPS",
  "gps_lat": 44.4268,
  "gps_lng": 26.1025,
  "gps_radius_m": 50
}
```

---

## 🏢 Work Location Departments - Date de Testare

### 🔧 Endpoint: `POST /locations/departments` - Departament IT

```json
{
  "name": "Departamentul IT",
  "code": "IT001",
  "description": "Departament responsabil pentru infrastructura IT, dezvoltarea software și suportul tehnic pentru toate proiectele companiei",
  "work_location_id": 1
}
```

### 🔧 Endpoint: `POST /locations/departments` - Departament HR

```json
{
  "name": "Resurse Umane",
  "code": "HR001", 
  "description": "Departament responsabil pentru recrutarea, formarea și managementul resurselor umane ale companiei",
  "work_location_id": 1
}
```

### 🔧 Endpoint: `POST /locations/departments` - Departament Financiar

```json
{
  "name": "Departamentul Financiar",
  "code": "FIN001",
  "description": "Departament responsabil pentru contabilitatea, bugetul și planificarea financiară",
  "work_location_id": 1
}
```

---

## 👤 Work Location Department Positions - Date de Testare

### 🔧 Endpoint: `POST /locations/department-positions` - Dezvoltator Senior

```json
{
  "name": "Dezvoltator Software Senior",
  "code": "DEV_SR_001",
  "description": "Responsabil pentru dezvoltarea aplicațiilor web complexe, mentorarea dezvoltatorilor juniori și arhitectura sistemelor",
  "department_id": 1
}
```

### 🔧 Endpoint: `POST /locations/department-positions` - Team Lead

```json
{
  "name": "Team Lead IT",
  "code": "TL_IT_001",
  "description": "Coordonează echipa de dezvoltatori, planifică sprinturile și asigură calitatea deliverables-urilor",
  "department_id": 1
}
```

### 🔧 Endpoint: `POST /locations/department-positions` - HR Specialist

```json
{
  "name": "Specialist Resurse Umane",
  "code": "HR_SP_001",
  "description": "Responsabil pentru procesele de recrutare, onboarding-ul angajaților noi și menținerea relațiilor cu angajații",
  "department_id": 2
}
```

### 🔧 Endpoint: `POST /locations/department-positions` - Contabil

```json
{
  "name": "Contabil Principal",
  "code": "ACC_PR_001",
  "description": "Responsabil pentru înregistrarea operațiunilor contabile, întocmirea bilanțurilor și raportărilor financiare",
  "department_id": 3
}
```

---

## 🔄 Employee Work Location History Module - Date de Testare

### 🔧 Endpoint: `POST /employee-work-location-history` - Creare istoric transfer

```json
{
  "employee_id": 1,
  "work_location_id": 1,
  "description": "Transferat de la sediul central București la filiala Cluj-Napoca pentru proiectul de dezvoltare software. Transfer efectuat la cererea angajatului și în urma aprobării managerului de proiect."
}
```

### 🔧 Endpoint: `POST /employee-work-location-history` - Mutare temporară

```json
{
  "employee_id": 2,
  "work_location_id": 2,
  "description": "Mutare temporară la biroul din Timișoara pentru suport tehnic de 3 luni în cadrul proiectului de modernizare IT."
}
```

### 📊 Endpoints Utile
- `GET /employee-work-location-history/statistics` - Statistici mutări
- `GET /employee-work-location-history/employee/1` - Istoricul unui angajat
- `GET /employee-work-location-history/work-location/1` - Mutările pentru o locație

---

## 📁 Employee Files Module - Date de Testare

### 🔧 Endpoint: `POST /employee-files` - Încărcare CV

```json
{
  "employee_id": 1,
  "file_name": "CV_Ion_Popescu_2024.pdf",
  "file_type": "CV",
  "file_link": "/storage/employees/1/cv_ion_popescu_2024.pdf"
}
```

### 🔧 Endpoint: `POST /employee-files` - Contract de muncă

```json
{
  "employee_id": 1,
  "file_name": "Contract_Munca_Ion_Popescu.pdf",
  "file_type": "Contract",
  "file_link": "/storage/employees/1/contract_munca.pdf"
}
```

### 🔧 Endpoint: `POST /employee-files` - Document identitate

```json
{
  "employee_id": 2,
  "file_name": "CI_Maria_Gheorghiu_scan.pdf",
  "file_type": "Act_Identitate",
  "file_link": "/storage/employees/2/ci_scan.pdf"
}
```

### 🔧 Endpoint: `POST /employee-files` - Diplomă studii

```json
{
  "employee_id": 3,
  "file_name": "Diploma_Licenta_Andrei_Ionescu.pdf",
  "file_type": "Diploma",
  "file_link": "/storage/employees/3/diploma_licenta.pdf"
}
```

### 📊 Endpoints Utile
- `GET /employee-files/statistics` - Statistici fișiere
- `GET /employee-files/employee/1` - Fișierele unui angajat
- `GET /employee-files/type/CV` - Toate CV-urile
- `GET /employee-files/validate/1/access` - Validare acces la fișier

---

## 📋 Generated Documents Module - Date de Testare

### 🔧 Endpoint: `POST /generated-documents` - Document generat și semnat

```json
{
  "employee_id": 1,
  "doc_id": 101,
  "status": "Signed",
  "signed_at": "2024-01-15T09:30:00Z",
  "expired_date": "2025-01-15"
}
```

### 🔧 Endpoint: `POST /generated-documents` - Document în draft

```json
{
  "employee_id": 2,
  "doc_id": 102,
  "status": "Draft"
}
```

### 🔧 Endpoint: `POST /generated-documents` - Contract temporar

```json
{
  "employee_id": 3,
  "doc_id": 103,
  "status": "Generated",
  "expired_date": "2024-12-31"
}
```

### 📊 Endpoints Utile
- `GET /generated-documents/statistics` - Statistici documente
- `GET /generated-documents/employee/1` - Documentele unui angajat
- `GET /generated-documents/status/Signed` - Documente semnate
- `GET /generated-documents/expired` - Documente expirate
- `PUT /generated-documents/1/sign` - Semnare document
- `PUT /generated-documents/1/cancel` - Anulare document
- `GET /generated-documents/1/is-valid` - Verificare validitate

---

## 🎯 Endpoints de Testare Rapidă

### Employees (Modul Principal)
- `GET /employees` - Lista angajaților
- `GET /employees/statistics` - Statistici angajați
- `GET /employees/email/ion.popescu@giurom.ro` - Căutare după email
- `GET /employees/cnp/1900515123456` - Căutare după CNP
- `GET /employees/1` - Detalii angajat după ID
- `PATCH /employees/1/toggle-active` - Activare/dezactivare angajat

### Employee Work Location History
- `GET /employee-work-location-history` - Lista mutărilor
- `GET /employee-work-location-history/statistics` - Statistici mutări
- `GET /employee-work-location-history/employee/1` - Istoricul unui angajat
- `GET /employee-work-location-history/work-location/1` - Mutările pentru o locație

### Employee Files
- `GET /employee-files` - Lista fișierelor
- `GET /employee-files/statistics` - Statistici fișiere
- `GET /employee-files/employee/1` - Fișierele unui angajat
- `GET /employee-files/type/CV` - Fișiere după tip
- `DELETE /employee-files/employee/1/all` - Șterge toate fișierele unui angajat

### Generated Documents
- `GET /generated-documents` - Lista documentelor
- `GET /generated-documents/statistics` - Statistici documente
- `GET /generated-documents/employee/1` - Documentele unui angajat
- `GET /generated-documents/status/Signed` - Documente după status
- `GET /generated-documents/expired` - Documente expirate
- `PUT /generated-documents/1/sign` - Semnare document
- `PUT /generated-documents/1/cancel` - Anulare document
- `POST /generated-documents/mark-expired` - Marchează documentele expirate

### Companies (Existente)
- `GET /companies` - Lista companiilor
- `GET /companies/statistics` - Statistici companii
- `GET /companies/cui/RO12345678` - Căutare după CUI

### Locations (Existente)
- `GET /locations` - Lista locațiilor
- `GET /locations/statistics` - Statistici locații
- `GET /locations/company/1` - Locațiile unei companii

---

## 🚀 Structura Completă API

```
📦 Giurom Backend API
├── 🏢 Companies (/companies)
│   ├── CRUD operations
│   ├── Company documents
│   └── Statistics
├── 📍 Locations (/locations)
│   ├── CRUD operations
│   ├── Task template assignments
│   └── Statistics
└── 👥 Employees (/employees) ✨ NOU
    ├── CRUD operations
    ├── Work location history
    ├── Employee files
    ├── Generated documents
    └── Statistics
```

---

## ✅ Validări Implementate

### Employee Validations
- **Email**: Format valid + unicitate
- **CNP**: Format 13 cifre + unicitate
- **Telefon**: Format +40xxxxxxxxx
- **Vârstă**: Minim 16 ani
- **Data angajării**: Nu poate fi în viitor
- **Data încetării**: Trebuie să fie după data angajării

### Caractere Românești
- Suport complet UTF-8 pentru: ă, î, â, ș, ț
- Configurație MariaDB optimizată
- Encoding utf8mb4_unicode_ci

---

## 📊 Status Final

🎉 **IMPLEMENTARE COMPLETĂ** - Toate modulele (Company, Locations, Employee) sunt funcționale cu:
- ✅ CRUD complet
- ✅ Validări avansate
- ✅ Suport caractere românești
- ✅ Documentație Swagger
- ✅ Securitate (Helmet, CORS, Rate Limiting, Validation)
- ✅ Conexiune MariaDB optimizată 