// PM2 process list pentru toate microserviciile giurom-backend + api-gateway.
// Rulare: pm2 start ecosystem.config.js
//
// IMPORTANT: NODE_ENV, ALLOWED_ORIGINS și SERVICE_SECRET sunt verificate în fiecare
// main.ts ÎNAINTE ca NestJS să apuce să încarce .env-ul (SERVICE_SECRET e verificat
// chiar la începutul bootstrap(), înaintea NestFactory.create) — deci NU e suficient
// să fie doar în .env, trebuie să fie variabile de mediu reale ale procesului.
// De-aia le setăm aici explicit, pentru fiecare serviciu, ca un `pm2 start` de la zero
// să nu mai poată crăpa la boot din lipsa lor (exact ce a picat la employees → 502).
//
// Ajustează ALLOWED_ORIGINS dacă domeniul se schimbă sau dacă giurom.bitap.ro
// nu mai e folosit.

const REPO_ROOT = '/home/restosoft';
const SERVICE_SECRET = 'veziv-internal-secret'; // trebuie IDENTIC în toate serviciile (apeluri interne x-service-secret)
const ALLOWED_ORIGINS = 'https://restosoft.eu,https://giurom.bitap.ro';

const nestjsEnv = {
  NODE_ENV: 'production',
  ALLOWED_ORIGINS,
  SERVICE_SECRET,
};

module.exports = {
  apps: [
    {
      name: 'api-gateway',
      cwd: `${REPO_ROOT}/giurom-backend/api-gateway`,
      script: 'src/main.js',
      env: {
        PORT: 3002,
        REPO_ROOT,
      },
    },
    {
      name: 'auth',
      cwd: `${REPO_ROOT}/giurom-backend/auth`,
      script: 'dist/main.js',
      env: { ...nestjsEnv },
    },
    {
      name: 'employees',
      cwd: `${REPO_ROOT}/giurom-backend/employees`,
      script: 'dist/main.js',
      env: { ...nestjsEnv, REPO_ROOT },
    },
    {
      name: 'attendance-ms',
      cwd: `${REPO_ROOT}/giurom-backend/attendance-ms`,
      script: 'dist/main.js',
      env: { ...nestjsEnv },
    },
    {
      name: 'calendar-ms',
      cwd: `${REPO_ROOT}/giurom-backend/calendar-ms`,
      script: 'dist/main.js',
      env: { ...nestjsEnv },
    },
    {
      name: 'company',
      cwd: `${REPO_ROOT}/giurom-backend/company`,
      script: 'dist/main.js',
      env: {
        ...nestjsEnv,
        REPO_ROOT,
        LOCATIONS_HTTP_URL: 'http://127.0.0.1:3004',
        // Abonamentul din giurom 2.0, afișat în ecranul de abonament de aici.
        // Cheia partajată (GIUROM2_STOCK_SYNC_API_KEY) rămâne în company/.env — e secretă
        // și e aceeași cu a celorlalte servicii care vorbesc cu App2.
        // Public: /api/... pe restosoft.ro (api.restosoft.ro nu există pe DNS).
        GIUROM2_PARTNER_SUBSCRIPTION_URL:
          'https://restosoft.ro/api/integrations/partner-link/subscription',
      },
    },
    {
      name: 'locations',
      cwd: `${REPO_ROOT}/giurom-backend/locations`,
      script: 'dist/main.js',
      env: { ...nestjsEnv, REPO_ROOT },
    },
    {
      name: 'recipes',
      cwd: `${REPO_ROOT}/giurom-backend/recipes`,
      script: 'dist/main.js',
      env: { ...nestjsEnv, REPO_ROOT },
    },
    {
      name: 'requests-ms',
      cwd: `${REPO_ROOT}/giurom-backend/requests-ms`,
      script: 'dist/main.js',
      env: { ...nestjsEnv },
    },
    {
      name: 'stock',
      cwd: `${REPO_ROOT}/giurom-backend/stock`,
      script: 'dist/main.js',
      env: { ...nestjsEnv, REPO_ROOT },
    },
    {
      name: 'suppliers-ms',
      cwd: `${REPO_ROOT}/giurom-backend/suppliers-ms`,
      script: 'dist/main.js',
      env: { ...nestjsEnv, REPO_ROOT, LOCATIONS_HTTP_URL: 'http://127.0.0.1:3004' },
    },
    {
      name: 'waste-records-ms',
      cwd: `${REPO_ROOT}/giurom-backend/waste-records-ms`,
      script: 'dist/main.js',
      env: { ...nestjsEnv },
    },
    {
      name: 'notifications-ms',
      cwd: `${REPO_ROOT}/giurom-backend/notifications-ms`,
      script: 'dist/main.js',
      env: { ...nestjsEnv, PORT: 3020 },
    },
    {
      name: 'veziv-tasks',
      cwd: `${REPO_ROOT}/giurom-backend/veziv-tasks`,
      script: 'dist/main.js',
      env: { ...nestjsEnv, REPO_ROOT },
    },
  ],
};
