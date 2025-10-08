# Veziv Auth Service

Microserviciu pentru autentificare și autorizare bazat pe NestJS cu JWT și 2FA.

## Structura Proiectului

```
src/
├── auth/                 # Modulul de autentificare clasică
│   ├── dto/             # Data Transfer Objects
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── 2fa-auth/            # Modulul pentru autentificare 2FA
│   ├── dto/             # Data Transfer Objects
│   ├── 2fa-auth.controller.ts
│   ├── 2fa-auth.service.ts
│   └── 2fa-auth.module.ts
├── users/               # Serviciul pentru utilizatori
│   ├── users.service.ts
│   └── users.module.ts
├── guards/              # Guard-uri pentru autorizare
│   ├── auth.guard.ts
│   └── index.ts
├── app.controller.ts
├── app.service.ts
├── app.module.ts
└── main.ts
```

## Funcționalități

- **Autentificare JWT**: Login cu email și parolă
- **Autentificare 2FA**: Login cu email și OTP trimis pe telefon
- **Autorizare**: Verificare token JWT pentru rute protejate
- **Roluri și Permisiuni**: Extragere din microserviciul users
- **Swagger Documentation**: API documentation automată

## Endpoint-uri

### Autentificare Clasică
- `POST /auth/login` - Autentificare cu email și parolă
- `GET /auth/profile` - Profilul utilizatorului (protejat)

### Autentificare 2FA
- `POST /2fa/send-otp` - Trimite OTP pe telefon
- `POST /2fa/login` - Autentificare cu email și OTP

### Informații
- `GET /` - Informații despre serviciu
- `GET /api` - Swagger UI

## Configurare

1. Instalează dependențele:
```bash
npm install
```

2. Creează fișierul `.env` cu:
```env
MOBILE_SMS_API_KEY="your-sms-api-key"
```

3. Pornește microserviciul:
```bash
npm run start:dev
```

4. Accesează Swagger UI la: `http://localhost:3000/api`

## Integrare cu Microservicii

Acest serviciu se integrează cu:
- **veziv-user**: Pentru gestionarea utilizatorilor și rolurilor
- **veziv-logging**: Pentru logging-ul acțiunilor
- **SMSAdvert**: Pentru trimiterea SMS-urilor cu OTP

## JWT Token

Token-ul JWT conține:
- `sub`: ID-ul utilizatorului
- `email`: Email-ul utilizatorului
- `roles`: Array cu rolurile utilizatorului
- `permissions`: Array cu permisiunile utilizatorului

## Flux 2FA

1. **Trimite OTP**: `POST /2fa/send-otp` cu email
2. **Primire SMS**: Utilizatorul primește OTP pe telefon
3. **Verificare OTP**: `POST /2fa/login` cu email și OTP
4. **JWT Token**: Returnează token JWT pentru autentificare

## Stocare OTP

OTP-urile sunt stocate temporar în memorie și expiră după 5 minute.
În producție, se recomandă folosirea unei baze de date pentru persistență.
