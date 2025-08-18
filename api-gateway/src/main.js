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
      '/attendance': 'http://localhost:3007',
      '/calendar': 'http://localhost:3010', 
      '/leave-requests': 'http://localhost:3013',
      '/shift-change-requests': 'http://localhost:3013',
      '/notifications': 'http://localhost:3011',
      '/companies': 'http://localhost:3003',
      '/locations': 'http://localhost:3004',
      '/recipes': 'http://localhost:3005',
      '/recipe-preparations': 'http://localhost:3005',
      '/recipe-labels': 'http://localhost:3005',
      '/stock': 'http://localhost:3006',
      '/suppliers': 'http://localhost:3007'
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
    target: 'http://localhost:3007',
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
    target: 'http://localhost:3011',
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

  // Suppliers HTTP
  '/suppliers': {
    target: 'http://localhost:3007',
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
  console.log(`🚀 API Gateway is running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log('🔀 Routing configuration:');
  Object.keys(microservices).forEach(path => {
    console.log(`   ${path} -> ${microservices[path].target}`);
  });
});