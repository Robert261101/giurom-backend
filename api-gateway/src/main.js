const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const net = require("net");

const app = express();
const PORT = process.env.PORT || 3002;

// Target-uri din env (pentru Docker/PM2/alt host); fallback la localhost
const target = (defaultUrl, envKey) =>
  (process.env[envKey] || defaultUrl).replace(/\/$/, "");

function isSocketIoRequest(req) {
  const url = req.originalUrl || req.url || "";
  return /\/socket\.io(\/|\?|$)/.test(url);
}

// Socket.IO folosește body text/plain — bodyParser + rescrierea JSON din onProxyReq corupe pachetele (POST 400).
app.use((req, res, next) => {
  if (isSocketIoRequest(req)) return next();
  bodyParser.json({ limit: "10mb" })(req, res, next);
});
app.use((req, res, next) => {
  if (isSocketIoRequest(req)) return next();
  bodyParser.urlencoded({ limit: "10mb", extended: true })(req, res, next);
});

// IP-ul public al serverului — configurabil via env, cu fallback la valoarea curentă (nu se schimbă comportamentul implicit).
const PUBLIC_SERVER_IP = process.env.PUBLIC_SERVER_IP || "89.46.6.45";

// Enable CORS
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://giurom.bitap.ro",
      "http://giurom.bitap.ro",
      "https://restosoft.eu",
      "http://restosoft.eu",
      `http://${PUBLIC_SERVER_IP}:3000`,
      `http://${PUBLIC_SERVER_IP}`,
      // Adaugă domenii Vercel specifice via env (ex: VERCEL_ALLOWED_ORIGINS=https://giurom-frontend.vercel.app)
      ...(process.env.VERCEL_ALLOWED_ORIGINS || "https://giurom-frontend.vercel.app")
        .split(",").map(s => s.trim()).filter(Boolean),
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  }),
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "API Gateway is running",
    timestamp: new Date().toISOString(),
    routes: {
      "/employees": "http://localhost:3011",
      "/attendance": "http://localhost:3016",
      "/calendar": "http://localhost:3010",
      "/leave-requests": "http://localhost:3013",
      "/shift-change-requests": "http://localhost:3013",
      "/notifications": "http://localhost:3020",
      "/companies": "http://localhost:3003",
      "/locations": "http://localhost:3004",
      "/recipes": "http://localhost:3005",
      "/recipe-preparations": "http://localhost:3005",
      "/recipe-labels": "http://localhost:3005",
      "/stock": "http://localhost:3006",
      "/categories": "http://localhost:3006",
      "/suppliers": "http://localhost:3007",
      "/waste-records": "http://localhost:3014",
      "/waste": "http://localhost:3014",
      "/tasks": "http://localhost:3008",
      "/templates": "http://localhost:3008",
      "/auth": "http://localhost:3021",
      "/users": "http://localhost:3021",
    },
  });
});

// Serve static files from images directory (must be before other middlewares)
// Trebuie sa fie EXACT acelasi folder in care scriu backend-urile (stock/veziv-tasks/etc getRepoRoot()).
// Pe server seteaza REPO_ROOT=/home/restosoft ca sa citesti din afara giurom-backend/giurom-frontend.
function resolveRepoRoot() {
  const fromEnv = (process.env.REPO_ROOT || process.env.IMAGES_ROOT || "").trim();
  if (fromEnv) return path.resolve(fromEnv);
  // __dirname is .../giurom-backend/api-gateway/src
  let repoRoot = path.resolve(__dirname, "../../..");
  if (path.basename(repoRoot) === "giurom-backend") {
    repoRoot = path.dirname(repoRoot);
  }
  return repoRoot;
}
const imagesPath = path.join(resolveRepoRoot(), "images");
console.log(`📂 API Gateway static images path: ${imagesPath}`);

app.use(
  "/api/images",
  express.static(imagesPath, {
    maxAge: "1d", // Cache for 1 day
    etag: true,
    lastModified: true,
  }),
);


// Middleware pentru a ignora cererile Next.js specifice și alte cereri care nu ar trebui să ajungă la API Gateway
app.use((req, res, next) => {
  const url = req.originalUrl || req.url;

  // Listează pattern-urile care trebuie ignorate (Next.js internals, Chrome DevTools, etc.)
  const ignoredPatterns = [
    /^\/_next\//, // Next.js internals (_next/internal/helpers.ts, _next/static/runtime.ts, etc.)
    /^\/\.well-known\//, // Well-known paths (.well-known/appspecific/com.chrome.devtools.json)
    /^\/favicon\.ico/, // Favicon requests
    /^\/login$/, // Login page (ar trebui să fie servit de Next.js, nu de API Gateway)
  ];

  // Verifică dacă URL-ul se potrivește cu vreun pattern ignorat
  const shouldIgnore = ignoredPatterns.some((pattern) => pattern.test(url));

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
  "/employees": {
    target: target("http://localhost:3011", "EMPLOYEES_SERVICE_URL"),
    changeOrigin: true,
  },

  // Attendance microservice
  "/attendance": {
    target: target("http://localhost:3016", "ATTENDANCE_SERVICE_URL"),
    changeOrigin: true,
  },

  // Calendar microservice
  "/calendar": {
    target: target("http://localhost:3010", "CALENDAR_SERVICE_URL"),
    changeOrigin: true,
  },

  // Requests microservice (leave-requests and shift-change-requests)
  "/leave-requests": {
    target: target("http://localhost:3013", "REQUESTS_SERVICE_URL"),
    changeOrigin: true,
  },

  "/shift-change-requests": {
    target: target("http://localhost:3013", "REQUESTS_SERVICE_URL"),
    changeOrigin: true,
  },

  // Notifications microservice
  "/notifications": {
    target: target("http://localhost:3020", "NOTIFICATIONS_SERVICE_URL"),
    changeOrigin: true,
    ws: true,
  },

  // Company HTTP
  "/companies": {
    target: target("http://localhost:3003", "COMPANIES_SERVICE_URL"),
    changeOrigin: true,
  },

  // Locations HTTP
  "/locations": {
    target: target("http://localhost:3004", "LOCATIONS_SERVICE_URL"),
    changeOrigin: true,
  },

  // Recipes HTTP
  "/recipes": {
    target: target("http://localhost:3005", "RECIPES_SERVICE_URL"),
    changeOrigin: true,
  },

  // Recipe Preparations HTTP
  "/recipe-preparations": {
    target: target("http://localhost:3005", "RECIPES_SERVICE_URL"),
    changeOrigin: true,
  },

  // Recipe Labels HTTP
  "/recipe-labels": {
    target: target("http://localhost:3005", "RECIPES_SERVICE_URL"),
    changeOrigin: true,
  },

  // Stock HTTP
  "/stock": {
    target: target("http://localhost:3006", "STOCK_SERVICE_URL"),
    changeOrigin: true,
  },

  // Categories (part of stock microservice)
  "/categories": {
    target: target("http://localhost:3006", "STOCK_SERVICE_URL"),
    changeOrigin: true,
  },

  // Suppliers HTTP
  "/suppliers": {
    target: target("http://localhost:3007", "SUPPLIERS_SERVICE_URL"),
    changeOrigin: true,
  },

  // Waste Records HTTP
  "/waste-records": {
    target: target("http://localhost:3014", "WASTE_SERVICE_URL"),
    changeOrigin: true,
  },

  // Waste HTTP (alias)
  "/waste": {
    target: target("http://localhost:3014", "WASTE_SERVICE_URL"),
    changeOrigin: true,
  },
  // Veziv Tasks Service
  "/tasks": {
    target: target("http://localhost:3008", "TASKS_SERVICE_URL"),
    changeOrigin: true,
    ws: true,
  },

  // Templates Service (parte din veziv-tasks2)
  "/templates": {
    target: target("http://localhost:3008", "TASKS_SERVICE_URL"),
    changeOrigin: true,
    pathRewrite: { "^/templates": "/tasks/templates" },
  },

  // Auth Service
  "/auth": {
    target: target("http://localhost:3021", "AUTH_SERVICE_URL"),
    changeOrigin: true,
  },

  // Users Service (part of auth)
  "/users": {
    target: target("http://localhost:3021", "AUTH_SERVICE_URL"),
    changeOrigin: true,
  },
};

const wsProxies = [];

// Create proxy middlewares for each microservice
Object.keys(microservices).forEach((path) => {
  const config = microservices[path];

  const proxyMiddleware = createProxyMiddleware({
    target: config.target,
    changeOrigin: config.changeOrigin,
    logLevel: "warn",
    pathRewrite: config.pathRewrite,
    ws: config.ws,
    onProxyReq: (proxyReq, req, res) => {
      // Forward authorization headers - check all possible variations and case-insensitive
      const authHeader = req.headers.authorization ||
                        req.headers.Authorization ||
                        req.headers['authorization'] ||
                        req.headers['Authorization'];

      if (authHeader) {
        proxyReq.setHeader("Authorization", authHeader);
      }

      // Forward other important headers that might be needed for authentication and context
      const headersToForward = [
        'x-internal-service',
        'x-service-secret', 
        'x-work-location-id',
        'x-company-id',
        'content-type',
        'accept',
        'user-agent'
      ];

      headersToForward.forEach(headerName => {
        const headerValue = req.headers[headerName] || req.headers[headerName.toLowerCase()];
        if (headerValue) {
          proxyReq.setHeader(headerName, headerValue);
        }
      });

      // Forward body for POST/PUT/PATCH so downstream never waits for missing body (inclusiv body "{}").
      // Socket.IO polling: lasă http-proxy să pipe-uiască body-ul raw (altfel POST → 400 Bad Request).
      try {
        if (isSocketIoRequest(req)) {
          return;
        }
        if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
          const bodyData = JSON.stringify(req.body != null ? req.body : {});
          if (!proxyReq.getHeader("content-type")) {
            proxyReq.setHeader("Content-Type", "application/json");
          }
          proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      } catch (err) {
        console.error(
          "Error forwarding request body to proxy target:",
          err && err.message,
        );
      }
    },
    onError: (err, req, res) => {
      const url = (req && (req.originalUrl || req.url)) || "unknown";
      console.error(
        `[${new Date().toISOString()}] Proxy error for ${req && req.method} ${url} -> ${config.target}:`,
        err.message,
      );
      const isWebSocket =
        req && req.headers && req.headers.upgrade === "websocket";

      if (!isWebSocket && res && typeof res.writeHead === "function") {
        res.status(502).json({
          error: "Bad Gateway",
          message: "Microservice unavailable",
          service: config.target,
          timestamp: new Date().toISOString(),
        });
      } else if (res && typeof res.destroy === "function") {
        res.destroy();
      }
    },
  });

  app.use(path, proxyMiddleware);

  if (config.ws) {
    wsProxies.push({ path, proxy: proxyMiddleware, config });
  }
});

// Fallback for unknown routes
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: Object.keys(microservices),
    timestamp: new Date().toISOString(),
  });
});

// Verificare la pornire: care microservicii sunt accesibile
function checkTarget(url, pathName) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const port = parseInt(u.port || (u.protocol === "https:" ? 443 : 80), 10);
      const socket = new net.Socket();
      const timeout = 1500;
      socket.setTimeout(timeout);
      socket.once("connect", () => {
        socket.destroy();
        resolve({ path: pathName, target: url, ok: true });
      });
      socket.once("error", () => {
        resolve({ path: pathName, target: url, ok: false });
      });
      socket.once("timeout", () => {
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
  console.log("🔀 Routing configuration:");
  Object.keys(microservices).forEach((p) => {
    console.log(`   ${p} -> ${microservices[p].target}`);
  });

  // Verificare microservicii (target-uri unice)
  const seen = new Set();
  const checks = [];
  Object.keys(microservices).forEach((p) => {
    const url = microservices[p].target;
    if (!seen.has(url)) {
      seen.add(url);
      checks.push(checkTarget(url, p));
    }
  });
  Promise.all(checks).then((results) => {
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      console.log(
        "\n⚠️  MICROSERVICII INACCESIBILE (ECONNREFUSED = serviciul nu rulează pe acel port):",
      );
      failed.forEach((r) => {
        console.log(`   - ${r.path} -> ${r.target}`);
        console.log(
          `     Pornește microserviciul sau setează variabila de mediu corespunzătoare.`,
        );
      });
      console.log("");
    }
  });
});

server.on("upgrade", (req, socket, head) => {
  const pathname = req.url.split("?")[0];
  const matchedProxy = wsProxies.find(({ path }) => pathname.startsWith(path));

  if (matchedProxy) {
    console.log(
      `[${new Date().toISOString()}] Upgrading WS ${pathname} -> ${matchedProxy.config.target}`,
    );
    matchedProxy.proxy.upgrade(req, socket, head);
  } else {
    console.warn(
      `[${new Date().toISOString()}] WS upgrade fără proxy configurat pentru ${pathname}`,
    );
    socket.destroy();
  }
});
