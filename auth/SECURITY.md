# 🔒 Sistem de Securitate - Veziv Auth2

## 📋 Prezentare Generală

Sistemul de securitate implementat oferă protecție avansată împotriva atacurilor și detectează comportamente anormale în timp real.

## 🛡️ Caracteristici Implementate

### 1. **Protecție împotriva Brute Force**
- **Configurare**: Maxim 5 încercări eșuate
- **Blocare**: 15 minute după depășirea limitului
- **Reset**: Automat după 1 oră de inactivitate
- **Logging**: Toate încercările sunt înregistrate

### 2. **Rotirea Automată a Token-urilor**
- **Refresh Token Rotation**: Fiecare refresh generează un token nou
- **Invalidare Automată**: Token-urile vechi sunt invalidate
- **Prevenirea Replay Attacks**: Token-urile folosite sunt marcate
- **Versiune Token**: Fiecare token are o versiune incrementată

### 3. **Detectarea Anomaliilor**
- **Analiză IP**: Detectează IP-uri neobișnuite
- **User Agent**: Monitorizează browsere/dispozitive neobișnuite
- **Ore de Activitate**: Detectează login-uri la ore neobișnuite
- **Frecvența Login-urilor**: Identifică prea multe încercări
- **Scor de Anomalie**: 0-100 cu factori de risc

### 4. **Alerte de Securitate**
- **Evenimente Critice**: Logging imediat pentru evenimente critice
- **Alerte Suspecte**: Pentru comportamente anormale
- **Brute Force Alerts**: Pentru atacuri detectate
- **Severitate**: LOW, MEDIUM, HIGH, CRITICAL

## 🔧 Configurare

### Variabile de Mediu
```env
# JWT Configuration
JWT_SECRET=your-super-secret-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# Security Configuration
MAX_LOGIN_ATTEMPTS=5
BLOCK_DURATION_MINUTES=15
RESET_TIME_HOURS=1
```

### Configurare Brute Force
```typescript
// În brute-force.service.ts
private readonly MAX_ATTEMPTS = 5; // Maxim 5 încercări
private readonly BLOCK_DURATION = 15 * 60 * 1000; // 15 minute
private readonly RESET_TIME = 60 * 60 * 1000; // 1 oră
```

## 📊 API Endpoints

### Autentificare Securizată
```http
POST /auth/login
Content-Type: application/json

{
  "identifier": "user@example.com",
  "password": "password123"
}
```

### Refresh Token cu Rotire
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Endpoint-uri de Securitate
```http
# Status sistem securitate
GET /security/status
Authorization: Bearer <token>

# Evenimente de securitate
GET /security/events
Authorization: Bearer <token>

# Comportament utilizator
GET /security/behavior
Authorization: Bearer <token>

# Curățare manuală
POST /security/cleanup
Authorization: Bearer <token>
```

## 🚨 Tipuri de Evenimente

### SecurityEventType
- `BRUTE_FORCE_ATTEMPT` - Încercări brute force
- `SUSPICIOUS_LOGIN` - Login suspect
- `TOKEN_THEFT_SUSPECTED` - Furt de token suspectat
- `MULTIPLE_FAILED_ATTEMPTS` - Multiple încercări eșuate
- `UNUSUAL_ACTIVITY` - Activitate neobișnuită
- `ACCOUNT_LOCKED` - Cont blocat

### Severitate
- `LOW` - Eveniment minor
- `MEDIUM` - Eveniment moderat
- `HIGH` - Eveniment important
- `CRITICAL` - Eveniment critic

## 🔍 Detectarea Anomaliilor

### Factori de Scor
1. **IP Neobișnuit** (30 puncte)
2. **User Agent Neobișnuit** (20 puncte)
3. **Oră Neobișnuită** (25 puncte)
4. **Frecvență Ridicată** (15 puncte)
5. **Încercări Eșuate** (10 puncte)

### Scoruri de Severitate
- **0-39**: LOW - Comportament normal
- **40-59**: MEDIUM - Comportament suspect
- **60-79**: HIGH - Comportament foarte suspect
- **80-100**: CRITICAL - Comportament critic

## 🧹 Curățare Automată

### Program Cron
- **La fiecare oră**: Curăță datele de securitate
- **La 2:00 AM zilnic**: Curățare completă + statistici

### Date Curățate
- Încercări brute force expirate
- Evenimente de securitate vechi (>1 oră)
- Comportamente utilizatori vechi (>30 zile)

## 📈 Monitoring și Logging

### Log-uri de Securitate
```typescript
// Exemplu de log
🚨 SECURITY ALERT [HIGH]: BRUTE_FORCE_ATTEMPT - Parolă incorectă
{
  userId: "123",
  email: "user@example.com",
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  timestamp: "2024-01-15T10:30:00Z"
}
```

### Statistici Disponibile
- Numărul de încercări brute force
- Evenimente de securitate per utilizator
- Comportamentul utilizatorilor
- Statusul sistemului de securitate

## 🔐 Best Practices

### Pentru Dezvoltatori
1. **Nu dezactiva** protecția brute force în producție
2. **Monitorizează** log-urile de securitate zilnic
3. **Configurează** alertele pentru evenimente critice
4. **Testează** sistemul periodic

### Pentru Administrators
1. **Verifică** endpoint-ul `/security/status` zilnic
2. **Monitorizează** evenimentele critice
3. **Curăță** manual datele dacă este necesar
4. **Actualizează** configurația după necesitate

## 🚀 Implementare

### Integrare în AuthService
```typescript
// Exemplu de integrare
async signIn(identifier: string, pass: string, ipAddress: string, userAgent: string) {
  // 1. Verifică brute force
  await this.bruteForceService.checkBruteForce(identifier);
  
  // 2. Autentificare
  const user = await this.authenticateUser(identifier, pass);
  
  // 3. Detectează anomalii
  const anomalyScore = await this.anomalyDetectionService.detectAnomalies(user.id, 'LOGIN', {
    ipAddress, userAgent, timestamp: new Date(), success: true
  });
  
  // 4. Log evenimente suspecte
  if (anomalyScore.score > 70) {
    await this.securityAlertsService.logSecurityEvent({...});
  }
  
  // 5. Generează token-uri cu rotire
  return await this.tokenRotationService.generateTokensWithRotation(user);
}
```

## 📞 Suport

Pentru întrebări sau probleme legate de securitate:
- Verifică log-urile din consolă
- Consultă endpoint-ul `/security/status`
- Contactează echipa de dezvoltare

---

**⚠️ Important**: Acest sistem de securitate este esențial pentru protecția aplicației. Nu dezactiva niciodată aceste măsuri în producție! 