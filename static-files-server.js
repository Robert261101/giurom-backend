/**
 * Simple static files server for images
 * Serves files from ../images directory on port 3005
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.STATIC_FILES_PORT || 3005;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://giurom.bitap.ro:3005';

// Enable CORS for all origins
app.use(cors());

// Parse JSON bodies up to 20MB (for base64 PDF uploads)
app.use(express.json({ limit: '20mb' }));

// Serve images from the images directory
const imagesDir = path.join(__dirname, '..', 'images');
app.use('/images', express.static(imagesDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Static files server is running' });
});

// Upload endpoint for supplier order PDFs
app.post('/upload/comenzi', (req, res) => {
  try {
    const { fileName, content } = req.body;
    if (!fileName || !content) {
      return res.status(400).json({ error: 'Missing fileName or content' });
    }

    // Strip data URI prefix if present
    const base64Data = content.replace(/^data:[^;]+;base64,/, '');

    // Generate a unique file name to avoid collisions
    const timestamp = Date.now();
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${timestamp}_${safeName}`;

    const uploadDir = path.join(imagesDir, 'comenzi');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueFileName);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    const fileUrl = `${PUBLIC_BASE_URL}/images/comenzi/${uniqueFileName}`;
    console.log(`📄 PDF uploaded: ${fileUrl}`);
    return res.json({ url: fileUrl, fileName: uniqueFileName });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
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
  console.log(`📤 PDF upload: POST http://localhost:${PORT}/upload/comenzi`);
});
