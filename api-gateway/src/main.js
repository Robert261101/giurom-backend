const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

// Enable CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
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

// Proxy configuration for microservices
const microservices = {
  // Employees microservice
  '/employees': {
    target: 'http://localhost:3012',
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Attendance microservice
  '/attendance': {
    target: 'http://localhost:3016',
    changeOrigin: true,
    logLevel: 'debug'
  },
  
  // Calendar microservice  
  '/calendar': {
    target: 'http://localhost:3010',
    changeOrigin: true,
    logLevel: 'debug'
  },
  
  // Requests microservice (leave-requests and shift-change-requests)
  '/leave-requests': {
    target: 'http://localhost:3013',
    changeOrigin: true,
    logLevel: 'debug'
  },
  
  '/shift-change-requests': {
    target: 'http://localhost:3013', 
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Notifications microservice
  '/notifications': {
    target: 'http://localhost:3020',
    changeOrigin: true,
    logLevel: 'debug',
    ws: true
  },

  // Company HTTP
  '/companies': {
    target: 'http://localhost:3003',
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Locations HTTP
  '/locations': {
    target: 'http://localhost:3004',
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Recipes HTTP
  '/recipes': {
    target: 'http://localhost:3005',
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Recipe Preparations HTTP
  '/recipe-preparations': {
    target: 'http://localhost:3005',
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Recipe Labels HTTP
  '/recipe-labels': {
    target: 'http://localhost:3005',
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Stock HTTP
  '/stock': {
    target: 'http://localhost:3006',
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Categories (part of stock microservice)
  '/categories': {
    target: 'http://localhost:3006',
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Suppliers HTTP
  '/suppliers': {
    target: 'http://localhost:3007',
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Waste Records HTTP
  '/waste-records': {
    target: 'http://localhost:3014',
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Waste HTTP (alias)
  '/waste': {
    target: 'http://localhost:3014',
    changeOrigin: true,
    logLevel: 'debug'
  }
  ,
  // Veziv Tasks Service
  '/tasks': {
    target: 'http://localhost:3008',
    changeOrigin: true,
    logLevel: 'debug',
    ws: true
    // NU mai folosim pathRewrite - microserviciul expune deja rutele cu /tasks
  },

  // Templates Service (parte din veziv-tasks2)
  '/templates': {
    target: 'http://localhost:3008',
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: { '^/templates': '/tasks/templates' }
    // Rewrites /templates -> /tasks/templates pentru veziv-tasks2
  },

  // Auth Service
  '/auth': {
    target: 'http://localhost:3021',
    changeOrigin: true,
    logLevel: 'debug'
  },

  // Users Service (part of auth)
  '/users': {
    target: 'http://localhost:3021',
    changeOrigin: true,
    logLevel: 'debug'
  }
};

// Create proxy middlewares for each microservice
Object.keys(microservices).forEach(path => {
  const config = microservices[path];
  
  app.use(path, createProxyMiddleware({
    target: config.target,
    changeOrigin: config.changeOrigin,
    logLevel: config.logLevel,
    pathRewrite: config.pathRewrite,
    ws: config.ws,
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[${new Date().toISOString()}] Proxying ${req.method} ${req.originalUrl} -> ${config.target}${req.url}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[${new Date().toISOString()}] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
    },
    onError: (err, req, res) => {
      console.error(`[${new Date().toISOString()}] Proxy error for ${req.method} ${req.originalUrl}:`, err.message);
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'Microservice unavailable',
        service: config.target,
        timestamp: new Date().toISOString()
      });
    }
  }));
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

// Start the gateway
app.listen(PORT, () => {
  console.log(`ðŸš€ API Gateway is running on http://localhost:${PORT}`);
  console.log(`ðŸ“‹ Health check: http://localhost:${PORT}/health`);
  console.log('ðŸ”€ Routing configuration:');
  Object.keys(microservices).forEach(path => {
    console.log(`   ${path} -> ${microservices[path].target}`);
  });
});