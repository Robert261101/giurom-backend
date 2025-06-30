# 🚀 Giurom Backend - Complete Testing Guide

## ✅ Status: Romanian Character Encoding - **FIXED & WORKING**

The character encoding issue with Romanian characters (ș, ț, ă, î, â) has been **successfully resolved** by:
- Adding explicit UTF-8 charset and collation to all string columns in TypeORM entities
- Configuring MariaDB connection with proper UTF-8 support
- Setting database charset to `utf8mb4` with Unicode collation

---

## 🔧 Application Status
- **Backend**: ✅ Running on `http://localhost:3001`
- **Database**: ✅ MariaDB with UTF-8 support
- **API Documentation**: ✅ Available at `http://localhost:3001/api/docs`
- **Romanian Characters**: ✅ **WORKING PERFECTLY**

---

## 📋 Quick Start Testing

### 1. Start the Application
```bash
npm run start:dev
```

### 2. Verify API is Running
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/companies" -Method GET
```

### 3. Test Romanian Characters (Companies)
```powershell
$romanianCompany = @"
{
  "company_name": "Giurom Software SRL",
  "cui": "RO87654321",
  "trade_register_number": "J40/9876/2023",
  "address": "Bulevardul Unirii nr. 15, Sector 3",
  "city": "București",
  "county": "Ilfov",
  "postal_code": "030821",
  "phone_number": "+40213456789",
  "email": "contact@giurom-software.ro",
  "incorporation_date": "2023-03-20",
  "legal_form": "SRL",
  "activity_code": "6201",
  "vat_payer": true,
  "status": "activ",
  "notes": "Companie de dezvoltare software cu sediul în București"
}
"@

Invoke-RestMethod -Uri "http://localhost:3001/companies" -Method POST -Body $romanianCompany -ContentType "application/json"
```

### 4. Test Romanian Characters (Locations)
```powershell
$romanianLocation = @"
{
  "company_id": 2,
  "location_name": "Biroul Timișoara",
  "address": "Strada Dobrescu nr. 25, Etajul 3",
  "city": "Timișoara",
  "county": "Timiș",
  "postal_code": "300087",
  "phone_number": "+40256123456",
  "email": "timisoara@giurom.ro",
  "employee_id": 1,
  "notes": "Punct de lucru secundar în Timișoara"
}
"@

Invoke-RestMethod -Uri "http://localhost:3001/locations" -Method POST -Body $romanianLocation -ContentType "application/json"
```

---

## 🧪 Complete API Testing

### Companies Module (/companies)

#### Create Company
```bash
POST http://localhost:3001/companies
Content-Type: application/json

{
  "company_name": "Test Company SRL",
  "cui": "RO12345679",
  "trade_register_number": "J40/5678/2023",
  "address": "Strada Test nr. 123",
  "city": "București",
  "county": "București",
  "postal_code": "010000",
  "phone_number": "+40212345678",
  "email": "contact@test.ro",
  "incorporation_date": "2023-06-15",
  "legal_form": "SRL",
  "activity_code": "6201",
  "vat_payer": true,
  "status": "activ",
  "notes": "Companie de test"
}
```

#### List Companies
```bash
GET http://localhost:3001/companies
GET http://localhost:3001/companies?page=1&limit=10
GET http://localhost:3001/companies?status=activ
```

#### Get Company by ID
```bash
GET http://localhost:3001/companies/1
```

#### Search by CUI
```bash
GET http://localhost:3001/companies/cui/RO12345678
```

#### Update Company
```bash
PATCH http://localhost:3001/companies/1
Content-Type: application/json

{
  "company_name": "Updated Company Name",
  "status": "activ"
}
```

#### Delete Company
```bash
DELETE http://localhost:3001/companies/1
```

#### Company Statistics
```bash
GET http://localhost:3001/companies/statistics
```

### Work Locations Module (/locations)

#### Create Location
```bash
POST http://localhost:3001/locations
Content-Type: application/json

{
  "company_id": 1,
  "location_name": "Sediul Principal",
  "address": "Strada Exemplu nr. 456",
  "city": "Cluj-Napoca",
  "county": "Cluj",
  "postal_code": "400000",
  "phone_number": "+40264123456",
  "email": "cluj@test.ro",
  "employee_id": 1,
  "notes": "Punct de lucru principal"
}
```

#### List Locations
```bash
GET http://localhost:3001/locations
GET http://localhost:3001/locations?company_id=1
```

#### Get Location by ID
```bash
GET http://localhost:3001/locations/1
```

#### Update Location
```bash
PATCH http://localhost:3001/locations/1
Content-Type: application/json

{
  "location_name": "Updated Location Name",
  "notes": "Updated notes"
}
```

#### Delete Location
```bash
DELETE http://localhost:3001/locations/1
```

---

## 🛡️ Security Features Testing

### Rate Limiting
The API implements 3-level rate limiting:
- **Short**: 3 requests per second
- **Medium**: 20 requests per 10 seconds  
- **Long**: 100 requests per minute

Test by making rapid requests:
```powershell
for ($i=1; $i -le 5; $i++) {
  Invoke-RestMethod -Uri "http://localhost:3001/companies" -Method GET
  Write-Output "Request $i completed"
}
```

### Validation Testing

#### Phone Number Validation
```powershell
# ❌ Invalid format
$invalidPhone = '{"company_name":"Test","cui":"RO12345678","trade_register_number":"J40/1234/2023","address":"Test Address","city":"Test","incorporation_date":"2023-01-01","legal_form":"SRL","activity_code":"6201","phone_number":"0212345678"}'

# ✅ Valid format
$validPhone = '{"company_name":"Test","cui":"RO12345678","trade_register_number":"J40/1234/2023","address":"Test Address","city":"Test","incorporation_date":"2023-01-01","legal_form":"SRL","activity_code":"6201","phone_number":"+40212345678"}'
```

#### CUI Validation
```powershell
# ❌ Invalid CUI
$invalidCUI = '{"company_name":"Test","cui":"12345678","trade_register_number":"J40/1234/2023","address":"Test Address","city":"Test","incorporation_date":"2023-01-01","legal_form":"SRL","activity_code":"6201"}'

# ✅ Valid CUI
$validCUI = '{"company_name":"Test","cui":"RO12345678","trade_register_number":"J40/1234/2023","address":"Test Address","city":"Test","incorporation_date":"2023-01-01","legal_form":"SRL","activity_code":"6201"}'
```

---

## 🌐 Swagger UI Testing

Access the interactive API documentation at: **http://localhost:3001/api/docs**

### Features:
- 📖 Complete API documentation in Romanian
- 🧪 Interactive testing interface
- 📝 Pre-filled examples for all endpoints
- 🔍 Schema definitions and validation rules
- 🚀 One-click API testing

### Testing Steps:
1. Open `http://localhost:3001/api/docs` in browser
2. Expand any endpoint (e.g., `POST /companies`)
3. Click "Try it out"
4. Use the pre-filled example or modify as needed
5. Click "Execute"
6. View the response

---

## ✅ Test Results Summary

### ✅ Romanian Character Support
- [x] **Companies**: București, Timișoara, Iași, Constanța
- [x] **Locations**: Timișoara, Timiș, Cluj-Napoca
- [x] **Database Storage**: UTF-8 characters stored correctly
- [x] **API Responses**: Romanian characters returned properly
- [x] **Validation Messages**: Error messages in Romanian

### ✅ CRUD Operations
- [x] **Create**: All entities can be created with Romanian data
- [x] **Read**: All entities retrieved with proper character encoding
- [x] **Update**: Romanian characters maintained during updates
- [x] **Delete**: Operations work correctly

### ✅ Security Features
- [x] **Rate Limiting**: 3-level protection active
- [x] **CORS**: Configured for frontend integration
- [x] **Helmet**: Security headers implemented
- [x] **Validation**: Romanian-specific rules (phone, CUI, IBAN)

### ✅ API Documentation
- [x] **Swagger UI**: Fully functional with Romanian examples
- [x] **Interactive Testing**: All endpoints testable via browser
- [x] **Romanian Language**: Documentation and examples in Romanian

---

## 🎯 Final Status

**🎉 Romanian Character Encoding Issue: COMPLETELY RESOLVED**

The Giurom Backend is now fully functional with:
- ✅ Complete UTF-8 support for Romanian characters (ș, ț, ă, î, â)
- ✅ All CRUD operations working with Romanian data
- ✅ Security features implemented and tested
- ✅ Comprehensive API documentation in Romanian
- ✅ Interactive testing via Swagger UI
- ✅ Proper validation with Romanian-specific rules

The application is ready for production use with full Romanian language support. 