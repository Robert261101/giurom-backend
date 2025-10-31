# Integrarea Autentificării în API Gateway

## Prezentare Generală

Autentificarea a fost integrată în API Gateway pentru a centraliza toate apelurile către microserviciile de autentificare și pentru a oferi o interfață unificată pentru frontend.

## Structura Integrării

### 1. API Gateway (Port 3002)
- **Rol**: Proxy central pentru toate microserviciile
- **Rute noi adăugate**:
  - `/auth/*` → `http://localhost:3001` (Auth Microservice)
  - `/users/*` → `http://localhost:3001` (Auth Microservice)

### 2. Auth Microservice (Port 3001)
- **Rol**: Serviciul de autentificare NestJS
- **Endpoints disponibile**:
  - `/auth/validate-identifier`
  - `/auth/login`
  - `/auth/refresh`
  - `/auth/logout`
  - `/auth/profile`
  - `/users/*` (management utilizatori)

### 3. Frontend Updates
- **AuthService**: Actualizat să folosească API Gateway
- **URL-uri actualizate**:
  - Development: `http://localhost:3002`
  - Production: `/api` (prin proxy)

## Configurare

### Pornirea Serviciilor

1. **Pornire automată** (toate serviciile):
   ```bash
   cd giurom-backend
   start-all-services.bat
   ```

2. **Pornire manuală**:
   ```bash
   # Auth Microservice
   cd veziv-auth2
   npm run start:dev

   # API Gateway
   cd api-gateway
   npm start
   ```

### Testarea Integrării

```bash
cd giurom-backend
npm run test:auth-integration
```

## URL-uri Disponibile

### Development
- **API Gateway**: http://localhost:3002
- **Auth Microservice**: http://localhost:3001
- **Health Check**: http://localhost:3002/health

### Production
- **API Gateway**: http://giurom.bitap.ro:3002
- **Frontend Proxy**: `/api/*`

## Fluxul de Autentificare

1. **Frontend** face apeluri către `http://localhost:3002/auth/*`
2. **API Gateway** routează către `http://localhost:3001/auth/*`
3. **Auth Microservice** procesează cererea
4. **Răspunsul** este returnat prin API Gateway către frontend

## Beneficii

1. **Centralizare**: Toate apelurile API trec prin gateway
2. **Securitate**: Un singur punct de intrare pentru autentificare
3. **Monitorizare**: Logging centralizat pentru toate cererile
4. **Scalabilitate**: Ușor de adăugat noi microservicii
5. **Consistență**: Interfață unificată pentru frontend

## Fișiere Modificate

### Backend
- `api-gateway/src/main.js` - Adăugate rute pentru auth
- `start-all-services.bat` - Adăugat pornirea auth microservice
- `package.json` - Adăugat script de test

### Frontend
- `lib/services/auth.service.ts` - Actualizat URL-ul de bază
- `app/api/auth-proxy/[...segments]/route.ts` - Actualizat URL-ul
- `app/login/otp/OtpForm.tsx` - Actualizat URL-ul
- `app/login/verify/VerifyForm.tsx` - Actualizat URL-ul
- `components/login-form.tsx` - Actualizat URL-ul
- `components/api-status.tsx` - Actualizat URL-ul
- `test-token-refresh.html` - Actualizat URL-ul
- `lib/api.ts` - Actualizat URL-ul de bază
- `app/api/proxy/[...segments]/route.ts` - Actualizat URL-urile

## Verificare Funcționalitate

1. Pornește serviciile cu `start-all-services.bat`
2. Rulează testul cu `npm run test:auth-integration`
3. Verifică health check-ul: http://localhost:3002/health
4. Testează autentificarea în frontend

## Note Importante

- Auth Microservice trebuie pornit înainte de API Gateway
- Toate apelurile de autentificare trec acum prin API Gateway
- Frontend-ul folosește localhost:3002 în development
- În producție, se folosește proxy-ul Vercel


































































































