const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const net = require('net');

const app = express();
const PORT = process.env.PORT || 3002;

// Target-uri din env (pentru Docker/PM2/alt host); fallback la localhost
const target = (defaultUrl, envKey) => (process.env[envKey] || defaultUrl).replace(/\/$/, '');

app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

// Enable CORS
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:3001',
    'https://giurom.bitap.ro',
    'http://giurom.bitap.ro',
    'http://89.46.6.45:3000',
    'http://89.46.6.45',
    // Permite toate domeniile Vercel
    /^https:\/\/.*\.vercel\.app$/
  ],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API Gateway is running',
    timestamp: new Date().toISOString(),
    routes: {
      '/employees': 'http://localhost:3012',
      '/attendance': 'http://localhost:3016',
      '/calendar': 'http://localhost:3010', 
      '/leave-requests': 'http://localhost:3013',
      '/shift-change-requests': 'http://localhost:3013',
      '/notifications': 'http://localhost:3020',
      '/companies': 'http://localhost:3003',
      '/locations': 'http://localhost:3004',
      '/recipes': 'http://localhost:3005',
      '/recipe-preparations': 'http://localhost:3005',
      '/recipe-labels': 'http://localhost:3005',
      '/stock': 'http://localhost:3006',
      '/categories': 'http://localhost:3006',
      '/suppliers': 'http://localhost:3007',
      '/waste-records': 'http://localhost:3014',
      '/waste': 'http://localhost:3014',
      '/tasks': 'http://localhost:3008',
      '/templates': 'http://localhost:3008',
      '/auth': 'http://localhost:3021',
      '/users': 'http://localhost:3021'
    }
  });
});

// Serve static files from images directory (must be before other middlewares)
// API Gateway is in /home/giurombitap/api-gateway/src
// Images are in /home/giurombitap/images
const imagesPath = path.join(__dirname, '../../images');
console.log('\n🟡 ========== API GATEWAY STATIC FILES ==========');
console.log('📂 __dirname:', __dirname);
console.log('📂 Images path calculat:', imagesPath);
console.log('📂 Path absolut:', path.resolve(imagesPath));
console.log('🟡 ===============================================\n');

// Log all image requests for debugging
app.use('/api/images', (req, res, next) => {
  const fullPath = path.join(imagesPath, req.path);
  const exists = require('fs').existsSync(fullPath);
  console.log('\n🔴 ========== CERERE IMAGINE ==========');
  console.log('🌐 URL cerut:', req.path);
  console.log('📂 Path complet căutat:', fullPath);
  console.log('✅ Fișierul există?', exists);
  if (!exists) {
    console.log('❌ FIȘIERUL NU EXISTĂ LA ACEST PATH!');
    // List files in directory to see what's there
    const dir = path.dirname(fullPath);
    if (require('fs').existsSync(dir)) {
      const files = require('fs').readdirSync(dir);
      console.log('📋 Fișiere în director:', files.length > 0 ? files.slice(0, 5) : 'GOL');
    }
  }
  console.log('🔴 =====================================\n');
  next();
});

app.use('/api/images', express.static(imagesPath, {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true
}));

// Middleware pentru a ignora cererile Next.js specifice și alte cereri care nu ar trebui să ajungă la API Gateway
app.use((req, res, next) => {
  const url = req.originalUrl || req.url;
  
  // Listează pattern-urile care trebuie ignorate (Next.js internals, Chrome DevTools, etc.)
  const ignoredPatterns = [
    /^\/_next\//,                    // Next.js internals (_next/internal/helpers.ts, _next/static/runtime.ts, etc.)
    /^\/\.well-known\//,             // Well-known paths (.well-known/appspecific/com.chrome.devtools.json)
    /^\/favicon\.ico/,               // Favicon requests
    /^\/login$/,                     // Login page (ar trebui să fie servit de Next.js, nu de API Gateway)
  ];
  
  // Verifică dacă URL-ul se potrivește cu vreun pattern ignorat
  const shouldIgnore = ignoredPatterns.some(pattern => pattern.test(url));
  
  if (shouldIgnore) {
    // Returnează 404 rapid, fără logging excesiv
    return res.status(404).end();
  }
  
  // Continuă la următorul middleware
  next();
});

// Proxy configuration for microservices
const microservices = {
  // Employees microservice
  '/employees': {
    target: target('http://localhost:3012', 'EMPLOYEES_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Attendance microservice
  '/attendance': {
    target: target('http://localhost:3016', 'ATTENDANCE_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },
  
  // Calendar microservice  
  '/calendar': {
    target: target('http://localhost:3010', 'CALENDAR_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },
  
  // Requests microservice (leave-requests and shift-change-requests)
  '/leave-requests': {
    target: target('http://localhost:3013', 'REQUESTS_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },
  
  '/shift-change-requests': {
    target: target('http://localhost:3013', 'REQUESTS_SERVICE_URL'), 
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Notifications microservice
  '/notifications': {
    target: target('http://localhost:3020', 'NOTIFICATIONS_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug',
    ws: true
  },

  // Company HTTP
  '/companies': {
    target: target('http://localhost:3003', 'COMPANIES_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Locations HTTP
  '/locations': {
    target: target('http://localhost:3004', 'LOCATIONS_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Recipes HTTP
  '/recipes': {
    target: target('http://localhost:3005', 'RECIPES_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Recipe Preparations HTTP
  '/recipe-preparations': {
    target: target('http://localhost:3005', 'RECIPES_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Recipe Labels HTTP
  '/recipe-labels': {
    target: target('http://localhost:3005', 'RECIPES_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Stock HTTP
  '/stock': {
    target: target('http://localhost:3006', 'STOCK_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Categories (part of stock microservice)
  '/categories': {
    target: target('http://localhost:3006', 'STOCK_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Suppliers HTTP
  '/suppliers': {
    target: target('http://localhost:3007', 'SUPPLIERS_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Waste Records HTTP
  '/waste-records': {
    target: target('http://localhost:3014', 'WASTE_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Waste HTTP (alias)
  '/waste': {
    target: target('http://localhost:3014', 'WASTE_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },
  // Veziv Tasks Service
  '/tasks': {
    target: target('http://localhost:3008', 'TASKS_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug',
    ws: true
  },

  // Templates Service (parte din veziv-tasks2)
  '/templates': {
    target: target('http://localhost:3008', 'TASKS_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: { '^/templates': '/tasks/templates' }
  },

  // Auth Service
  '/auth': {
    target: target('http://localhost:3021', 'AUTH_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Users Service (part of auth)
  '/users': {
    target: target('http://localhost:3021', 'AUTH_SERVICE_URL'),
    changeOrigin: true,
    logLevel: 'debug'
  }
};

const wsProxies = [];

// Create proxy middlewares for each microservice
Object.keys(microservices).forEach(path => {
  const config = microservices[path];

  const proxyMiddleware = createProxyMiddleware({
    target: config.target,
    changeOrigin: config.changeOrigin,
    logLevel: config.logLevel,
    pathRewrite: config.pathRewrite,
    ws: config.ws,
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[${new Date().toISOString()}] Proxying ${req.method} ${req.originalUrl} -> ${config.target}${req.url}`);
      
      // Forward authorization headers
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
      
      // Forward internal service headers for microservice-to-microservice communication
      if (req.headers['x-internal-service']) {
        proxyReq.setHeader('x-internal-service', req.headers['x-internal-service']);
      }
      
      if (req.headers['x-service-secret']) {
        proxyReq.setHeader('x-service-secret', req.headers['x-service-secret']);
      }

      // If the request body was parsed by bodyParser, forward the raw body
      // to the proxied request. Without this, POST/PUT bodies are lost
      // and downstream services may hang waiting for a body.
      try {
        if (req.body && Object.keys(req.body).length) {
          const bodyData = JSON.stringify(req.body);
          // Ensure content-type and length are correctly set
          if (!proxyReq.getHeader('content-type')) {
            proxyReq.setHeader('Content-Type', 'application/json');
          }
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      } catch (err) {
        console.error('Error forwarding request body to proxy target:', err && err.message);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[${new Date().toISOString()}] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
    },
    onError: (err, req, res) => {
      const url = (req && (req.originalUrl || req.url)) || 'unknown';
      console.error(`[${new Date().toISOString()}] Proxy error for ${req && req.method} ${url} -> ${config.target}:`, err.message);
      const isWebSocket = req && req.headers && req.headers.upgrade === 'websocket';

      if (!isWebSocket && res && typeof res.writeHead === 'function') {
        res.status(502).json({
          error: 'Bad Gateway',
          message: 'Microservice unavailable',
          service: config.target,
          timestamp: new Date().toISOString()
        });
      } else if (res && typeof res.destroy === 'function') {
        res.destroy();
      }
    }
  });

  app.use(path, proxyMiddleware);

  if (config.ws) {
    wsProxies.push({ path, proxy: proxyMiddleware, config });
  }
});

// Fallback for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: Object.keys(microservices),
    timestamp: new Date().toISOString()
  });
});

// Verificare la pornire: care microservicii sunt accesibile
function checkTarget(url, pathName) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const port = parseInt(u.port || (u.protocol === 'https:' ? 443 : 80), 10);
      const socket = new net.Socket();
      const timeout = 1500;
      socket.setTimeout(timeout);
      socket.once('connect', () => {
        socket.destroy();
        resolve({ path: pathName, target: url, ok: true });
      });
      socket.once('error', () => {
        resolve({ path: pathName, target: url, ok: false });
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve({ path: pathName, target: url, ok: false });
      });
      socket.connect(port, u.hostname);
    } catch (e) {
      resolve({ path: pathName, target: url, ok: false });
    }
  });
}

// Start the gateway
const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway is running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log('🔀 Routing configuration:');
  Object.keys(microservices).forEach(p => {
    console.log(`   ${p} -> ${microservices[p].target}`);
  });

  // Verificare microservicii (target-uri unice)
  const seen = new Set();
  const checks = [];
  Object.keys(microservices).forEach(p => {
    const url = microservices[p].target;
    if (!seen.has(url)) {
      seen.add(url);
      checks.push(checkTarget(url, p));
    }
  });
  Promise.all(checks).then((results) => {
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      console.log('\n⚠️  MICROSERVICII INACCESIBILE (ECONNREFUSED = serviciul nu rulează pe acel port):');
      failed.forEach((r) => {
        console.log(`   - ${r.path} -> ${r.target}`);
        console.log(`     Pornește microserviciul sau setează variabila de mediu corespunzătoare.`);
      });
      console.log('');
    }
  });
});

server.on('upgrade', (req, socket, head) => {
  const pathname = req.url.split('?')[0];
  const matchedProxy = wsProxies.find(({ path }) => pathname.startsWith(path));

  if (matchedProxy) {
    console.log(`[${new Date().toISOString()}] Upgrading WS ${pathname} -> ${matchedProxy.config.target}`);
    matchedProxy.proxy.upgrade(req, socket, head);
  } else {
    console.warn(`[${new Date().toISOString()}] WS upgrade fără proxy configurat pentru ${pathname}`);
    socket.destroy();
  }
});