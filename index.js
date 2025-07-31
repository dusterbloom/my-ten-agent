#!/usr/bin/env node

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Load extensions
const extensions = new Map();

function loadExtensions() {
  const extensionsDir = join(__dirname, 'extensions');
  
  if (!existsSync(extensionsDir)) {
    console.log('No extensions directory found');
    return;
  }

  const extensionFolders = readdirSync(extensionsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const folder of extensionFolders) {
    const manifestPath = join(extensionsDir, folder, 'manifest.json');
    const extensionPath = join(extensionsDir, folder, 'extension.py');
    
    if (existsSync(manifestPath) && existsSync(extensionPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        extensions.set(folder, {
          manifest,
          path: extensionPath,
          name: folder
        });
        console.log(`Loaded extension: ${folder}`);
      } catch (error) {
        console.error(`Error loading extension ${folder}:`, error.message);
      }
    }
  }
}

// API Routes
app.get('/api/extensions', (req, res) => {
  const extensionList = Array.from(extensions.values()).map(ext => ({
    name: ext.name,
    manifest: ext.manifest
  }));
  res.json(extensionList);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', extensions: extensions.size });
});

// WebSocket for real-time communication
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);
      
      // Echo back for now - implement extension communication later
      ws.send(JSON.stringify({ type: 'echo', data }));
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;

loadExtensions();

server.listen(PORT, () => {
  console.log(`TEN Agent server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
  console.log(`Loaded ${extensions.size} extensions`);
});