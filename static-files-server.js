/**
 * Simple static files server for images
 * Serves files from ../images directory on port 3005
 */

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.STATIC_FILES_PORT || 3005;

// Enable CORS for all origins
app.use(cors());

// Serve images from the images directory
const imagesDir = path.join(__dirname, '..', 'images');
app.use('/images', express.static(imagesDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Static files server is running' });
});

// Log all requests
app.use((req, res, next) => {
  console.log(`📂 ${req.method} ${req.url}`);
  next();
});

app.listen(PORT, () => {
  console.log(`📁 Static files server running on http://localhost:${PORT}`);
  console.log(`📷 Serving images from: ${imagesDir}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
