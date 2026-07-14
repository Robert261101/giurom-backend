// PM2 process list pentru toate microserviciile giurom-backend + api-gateway.
// Rulare: pm2 start ecosystem.config.js
// Fiecare serviciu NestJS își citește restul variabilelor din propriul .env (ConfigModule.forRoot);
// aici setăm doar REPO_ROOT (folosit pentru salvarea imaginilor/fișierelor în afara giurom-backend/giurom-frontend)
// și, pentru api-gateway (care nu are .env), toate variabilele lui necesare.

const REPO_ROOT = '/home/restosoft';

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
    },
    {
      name: 'employees',
      cwd: `${REPO_ROOT}/giurom-backend/employees`,
      script: 'dist/main.js',
      env: { REPO_ROOT },
    },
    {
      name: 'attendance-ms',
      cwd: `${REPO_ROOT}/giurom-backend/attendance-ms`,
      script: 'dist/main.js',
    },
    {
      name: 'calendar-ms',
      cwd: `${REPO_ROOT}/giurom-backend/calendar-ms`,
      script: 'dist/main.js',
    },
    {
      name: 'company',
      cwd: `${REPO_ROOT}/giurom-backend/company`,
      script: 'dist/main.js',
      env: { REPO_ROOT },
    },
    {
      name: 'locations',
      cwd: `${REPO_ROOT}/giurom-backend/locations`,
      script: 'dist/main.js',
      env: { REPO_ROOT },
    },
    {
      name: 'recipes',
      cwd: `${REPO_ROOT}/giurom-backend/recipes`,
      script: 'dist/main.js',
      env: { REPO_ROOT },
    },
    {
      name: 'requests-ms',
      cwd: `${REPO_ROOT}/giurom-backend/requests-ms`,
      script: 'dist/main.js',
    },
    {
      name: 'stock',
      cwd: `${REPO_ROOT}/giurom-backend/stock`,
      script: 'dist/main.js',
      env: { REPO_ROOT },
    },
    {
      name: 'suppliers-ms',
      cwd: `${REPO_ROOT}/giurom-backend/suppliers-ms`,
      script: 'dist/main.js',
      env: { REPO_ROOT },
    },
    {
      name: 'waste-records-ms',
      cwd: `${REPO_ROOT}/giurom-backend/waste-records-ms`,
      script: 'dist/main.js',
    },
    {
      name: 'notifications-ms',
      cwd: `${REPO_ROOT}/giurom-backend/notifications-ms`,
      script: 'dist/main.js',
    },
    {
      name: 'veziv-tasks',
      cwd: `${REPO_ROOT}/giurom-backend/veziv-tasks`,
      script: 'dist/main.js',
      env: { REPO_ROOT },
    },
  ],
};
