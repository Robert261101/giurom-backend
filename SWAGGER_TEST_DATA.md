# 🧪 SWAGGER TEST DATA - CHARACTER ENCODING SAFE

## ⚠️ CHARACTER ENCODING ISSUE DETECTED
The error shows issues with Romanian characters (ș, ț). Let's test systematically:

## 1. FIRST TEST - ASCII CHARACTERS ONLY

### Test Company 1 (ASCII Safe)
```json
{
  "company_name": "Tech Solutions SRL",
  "cui": "RO12345678",
  "trade_register_number": "J40/1234/2023",
  "address": "Bd. Unirii Nr. 10",
  "city": "Bucharest",
  "county": "Bucharest",
  "postal_code": "030167",
  "phone_number": "+40212345678",
  "email": "contact@techsolutions.ro",
  "incorporation_date": "2023-01-15",
  "legal_form": "SRL",
  "activity_code": "6201",
  "vat_payer": true,
  "status": "activ",
  "notes": "First test company - ASCII safe"
}
```

### Test Company 2 (ASCII Safe)
```json
{
  "company_name": "Software Innovations SRL",
  "cui": "RO87654321", 
  "trade_register_number": "J12/5678/2023",
  "address": "Str. Revolutiei Nr. 25",
  "city": "Cluj-Napoca",
  "county": "Cluj",
  "postal_code": "400001",
  "phone_number": "+40264123456",
  "email": "info@softinnovations.ro",
  "incorporation_date": "2023-03-01",
  "legal_form": "SRL",
  "activity_code": "6202",
  "vat_payer": false,
  "status": "activ",
  "notes": "Second test company - ASCII safe"
}
```

### Test Location 1 (ASCII Safe)
```json
{
  "company_id": 1,
  "location_name": "Sediul Central",
  "address": "Bd. Unirii Nr. 10",
  "city": "Bucharest",
  "county": "Bucharest", 
  "postal_code": "030167",
  "phone_number": "+40212345678",
  "email": "bucharest@techsolutions.ro",
  "employee_id": 1,
  "notes": "Sediul principal"
}
```

### Test Location 2 (ASCII Safe)
```json
{
  "company_id": 2,
  "location_name": "Biroul Cluj",
  "address": "Str. Revolutiei Nr. 25", 
  "city": "Cluj-Napoca",
  "county": "Cluj",
  "postal_code": "400001",
  "phone_number": "+40264123456",
  "email": "cluj@softinnovations.ro",
  "employee_id": 2,
  "notes": "Biroul din Cluj"
}
```

## 2. SECOND TEST - ROMANIAN CHARACTERS

⚠️ **Only test these AFTER fixing the encoding issue**

### Company with Romanian Characters
```json
{
  "company_name": "Companie Românească SRL",
  "cui": "RO11111111",
  "trade_register_number": "J40/1111/2023", 
  "address": "Str. Mihai Eminescu Nr. 15",
  "city": "București",
  "county": "București",
  "postal_code": "010101",
  "phone_number": "+40211111111",
  "email": "contact@romaneasca.ro",
  "incorporation_date": "2023-01-01",
  "legal_form": "SRL",
  "activity_code": "6201",
  "vat_payer": true,
  "status": "activ",
  "notes": "Companie cu caractere românești: ă, î, â, ș, ț"
}
```

### Location with Romanian Characters
```json
{
  "company_id": 3,
  "location_name": "Sediul din București",
  "address": "Str. Ștefan cel Mare Nr. 100",
  "city": "București", 
  "county": "București",
  "postal_code": "010101",
  "phone_number": "+40211111111",
  "email": "bucuresti@romaneasca.ro",
  "employee_id": 1,
  "notes": "Locație cu caractere speciale: ș, ț, ă, î, â"
}
```

## 3. TESTING STRATEGY

### Step 1: Test ASCII Data First
1. Use the ASCII-safe examples above
2. Verify all CRUD operations work
3. Check that data is properly stored and retrieved

### Step 2: Test Romanian Characters
1. After ASCII tests pass, try Romanian character examples
2. If errors occur, the database charset needs fixing

### Step 3: Verify Encoding Fix
1. Restart the application after charset changes
2. Test Romanian characters again
3. All characters should work: ă, î, â, ș, ț

## 4. COMMON CHARACTER ISSUES

### Problematic Characters:
- `ș` (s with comma below)
- `ț` (t with comma below) 
- `ă` (a with breve)
- `î` (i with circumflex)
- `â` (a with circumflex)

### Safe Alternatives for Testing:
- `ș` → `s`
- `ț` → `t`
- `ă` → `a`
- `î` → `i`
- `â` → `a`

## 5. VALIDATION TESTS

Use these to test validation with ASCII characters:

### Invalid Phone Test
```json
{
  "company_name": "Test Validation",
  "cui": "RO99999999",
  "phone_number": "0212345678"
}
```
**Expected:** Phone format error

### Invalid CUI Test  
```json
{
  "company_name": "Test CUI",
  "cui": "INVALID123"
}
```
**Expected:** CUI validation error

## 🎯 RECOMMENDED TESTING ORDER

1. **Start with ASCII-safe company data**
2. **Test all CRUD operations** 
3. **Add ASCII-safe locations**
4. **Test template assignments**
5. **Try Romanian characters** (after encoding fix)
6. **Test validation scenarios**

This approach ensures you can test the functionality even if there are encoding issues! 