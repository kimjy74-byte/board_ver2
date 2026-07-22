const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ip = require('ip');
const QRCode = require('qrcode');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Preserve original filename safely while adding timestamp to prevent overwrite collisions
    const ext = path.extname(file.originalname);
    const originalNameWithoutExt = path.basename(file.originalname, ext);
    const safeName = originalNameWithoutExt.replace(/[^a-zA-Z0-9_\-\u3131-\u318D\uAC00-\uD7A3]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E4);
    cb(null, `${safeName}_${uniqueSuffix}${ext || '.jpg'}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit per photo
});

// Utility to get network addresses
function getNetworkIp() {
  try {
    return ip.address() || 'localhost';
  } catch (e) {
    return 'localhost';
  }
}

// Server API Routes

// 1. Get Connection Info & QR Code
app.get('/api/info', async (req, res) => {
  const localIp = getNetworkIp();
  const connectUrl = `http://${localIp}:${PORT}`;
  
  try {
    const qrDataUrl = await QRCode.toDataURL(connectUrl, {
      margin: 2,
      color: {
        dark: '#2B4C7E',
        light: '#FFFFFF'
      }
    });
    res.json({
      ip: localIp,
      port: PORT,
      url: connectUrl,
      qrCode: qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// 2. Get All Photos List
app.get('/api/photos', (req, res) => {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to scan directory' });
    }
    
    // Sort files by modified time descending (newest first)
    const photos = files
      .map(file => {
        const filePath = path.join(UPLOADS_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            size: stats.size,
            uploadedAt: stats.mtime,
            url: `/uploads/${file}`,
            downloadUrl: `/api/download/${encodeURIComponent(file)}`
          };
        } catch (e) {
          return null;
        }
      })
      .filter(p => p !== null)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json(photos);
  });
});

// 3. Upload Photo API
app.post('/api/upload', upload.array('photos', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const uploadedPhotos = req.files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    uploadedAt: new Date(),
    url: `/uploads/${file.filename}`,
    downloadUrl: `/api/download/${encodeURIComponent(file.filename)}`
  }));

  // Broadcast to all connected clients (PC and Phones)
  io.emit('photos_uploaded', uploadedPhotos);

  res.json({ message: 'Success', photos: uploadedPhotos });
});

// 4. Force File Download API (Ensures direct download on Android Gallery / PC)
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.download(filePath, filename, (err) => {
    if (err && !res.headersSent) {
      res.status(500).send('Could not download file');
    }
  });
});

// 5. Delete Photo API
app.delete('/api/photos/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOADS_DIR, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    io.emit('photo_deleted', { filename });
    return res.json({ message: 'Photo deleted successfully' });
  } else {
    return res.status(404).json({ error: 'File not found' });
  }
});

// Socket.io Realtime connection
io.on('connection', (socket) => {
  console.log('📱 Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log(' Client disconnected:', socket.id);
  });
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  const localIp = getNetworkIp();
  console.log(`\n==================================================`);
  console.log(`🌸 Anime Photo Sync Server Started!`);
  console.log(`💻 Local Access (PC):     http://localhost:${PORT}`);
  console.log(`📱 Mobile Access (WiFi):  http://${localIp}:${PORT}`);
  console.log(`==================================================\n`);
});
