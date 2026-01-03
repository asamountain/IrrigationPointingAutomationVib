/**
 * Dashboard Server - Real-time monitoring for irrigation automation
 * Provides Server-Sent Events (SSE) for live updates
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DashboardServer {
  constructor(port = 3456) {
    this.port = port;
    this.clients = [];
    this.server = null;
    this.isPaused = false;
    this.shouldStop = false;
    this.isStarted = false;
    this.config = {
      manager: '승진',
      startFrom: 0,
      mode: 'normal',
      maxFarms: 3
    };
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, () => {
        console.log(`📊 Dashboard server started at http://localhost:${this.port}`);
        resolve(`http://localhost:${this.port}`);
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`⚠️  Port ${this.port} is busy, trying ${this.port + 1}...`);
          this.port++;
          this.server.listen(this.port);
        } else {
          reject(error);
        }
      });
    });
  }

  handleRequest(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${this.port}`);

    // Serve dashboard HTML
    if (url.pathname === '/' || url.pathname === '/dashboard') {
      this.serveDashboard(res);
    }
    // SSE endpoint for real-time updates
    else if (url.pathname === '/events') {
      this.handleSSE(req, res);
    }
    // Serve screenshots
    else if (url.pathname === '/screenshot') {
      const screenshotPath = url.searchParams.get('path');
      this.serveScreenshot(screenshotPath, res);
    }
    // Control endpoints
    else if (url.pathname === '/control/start' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const config = JSON.parse(body);
          this.config = { ...this.config, ...config };
          this.isStarted = true;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, config: this.config }));
          console.log(`✅ Configuration received from dashboard:`, this.config);
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
    }
    else if (url.pathname === '/control/pause' && req.method === 'POST') {
      this.isPaused = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, paused: true }));
    }
    else if (url.pathname === '/control/resume' && req.method === 'POST') {
      this.isPaused = false;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, paused: false }));
    }
    else if (url.pathname === '/control/stop' && req.method === 'POST') {
      this.shouldStop = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, stopped: true }));
    }
    // 404
    else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  serveDashboard(res) {
    const dashboardPath = path.join(__dirname, 'dashboard.html');
    fs.readFile(dashboardPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading dashboard');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  }

  handleSSE(req, res) {
    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Add client to list
    this.clients.push(res);

    // Send initial connection message
    this.sendToClient(res, {
      type: 'log',
      message: 'Connected to automation server',
      level: 'success'
    });

    // Remove client when connection closes
    req.on('close', () => {
      this.clients = this.clients.filter(client => client !== res);
    });
  }

  serveScreenshot(screenshotPath, res) {
    if (!screenshotPath) {
      res.writeHead(400);
      res.end('Screenshot path required');
      return;
    }

    const fullPath = path.join(__dirname, screenshotPath);
    
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Screenshot not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(data);
    });
  }

  sendToClient(client, data) {
    try {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      // Client disconnected
      this.clients = this.clients.filter(c => c !== client);
    }
  }

  broadcast(data) {
    this.clients.forEach(client => this.sendToClient(client, data));
  }

  // Public methods for automation to call
  updateStatus(status, statusClass = 'running') {
    this.broadcast({
      type: 'status',
      status,
      statusClass
    });
  }

  updateStep(step, progress) {
    this.broadcast({
      type: 'step',
      step,
      progress
    });
  }

  log(message, level = 'info') {
    this.broadcast({
      type: 'log',
      message,
      level
    });
  }

  updateScreenshot(screenshotPath) {
    this.broadcast({
      type: 'screenshot',
      path: screenshotPath,
      timestamp: Date.now()
    });
  }

  setManager(name) {
    this.broadcast({
      type: 'manager',
      name
    });
  }

  checkIfPaused() {
    return this.isPaused;
  }

  checkIfStopped() {
    return this.shouldStop;
  }

  checkIfStarted() {
    return this.isStarted;
  }

  getConfig() {
    return this.config;
  }

  async waitUntilStarted() {
    console.log('⏳ Waiting for user to click "Start" in dashboard...');
    this.broadcast({
      type: 'log',
      message: 'Waiting for configuration and start command from dashboard...',
      level: 'info'
    });
    
    while (!this.isStarted) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('✅ Start command received from dashboard');
    return this.config;
  }

  async waitIfPaused() {
    while (this.isPaused && !this.shouldStop) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  stop() {
    if (this.server) {
      this.clients.forEach(client => {
        try {
          client.end();
        } catch (e) {
          // Ignore errors
        }
      });
      this.clients = [];
      this.server.close();
      console.log('📊 Dashboard server stopped');
    }
  }
}

export default DashboardServer;

