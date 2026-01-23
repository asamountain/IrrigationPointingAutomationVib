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
    this.shouldStop = false;
    this.isStarted = false;
    this.logs = []; // Store logs for crash report capture
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

      this.server.listen(this.port, async () => {
        const url = `http://localhost:${this.port}`;
        console.log(`📊 Dashboard server started at ${url}`);
        console.log(`📊 Dashboard ready at: ${url}`);
        console.log(`   → Open this URL to configure and start automation`);
        
        // Auto-open browser
        try {
          const { default: open } = await import('open');
          await open(url);
          console.log('✨ Browser launched automatically!');
        } catch (err) {
          console.log('⚠️  Could not open browser automatically (Manual open required)');
        }
        
        resolve(url);
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
    // Serve history page
    else if (url.pathname === '/history') {
      this.serveHistory(res);
    }
    // API endpoint for history data
    else if (url.pathname === '/api/history') {
      this.serveHistoryData(res);
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
    // Serve learning data
    else if (url.pathname === '/learning-data') {
      this.serveLearningData(res);
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
    else if (url.pathname === '/control/start-report-sending' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const config = JSON.parse(body);
          this.config = { ...this.config, ...config, mode: 'report-sending' };
          this.isStarted = true;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, config: this.config }));
          console.log(`📤 Report Sending Mode activated:`, this.config);
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
    }
    else if (url.pathname === '/control/stop' && req.method === 'POST') {
      this.shouldStop = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, stopped: true }));
    }
    else if (url.pathname === '/control/mode' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { mode } = JSON.parse(body);
          this.config.mode = mode;
          console.log(`✅ Mode changed to: ${mode}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, mode }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
    }
    else if (url.pathname === '/control/add-farms' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { additionalFarms } = JSON.parse(body);
          this.config.maxFarms += additionalFarms;
          console.log(`✅ Added ${additionalFarms} more farms. New total: ${this.config.maxFarms}`);
          this.broadcast({
            type: 'log',
            message: `Extended automation by ${additionalFarms} farms (now processing up to ${this.config.maxFarms} farms)`,
            level: 'success'
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, newMaxFarms: this.config.maxFarms }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
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

  serveHistory(res) {
    const historyPath = path.join(__dirname, 'history.html');
    fs.readFile(historyPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading history page');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  }

  serveHistoryData(res) {
    const historyFile = path.join(__dirname, 'history', 'run_logs.json');
    fs.readFile(historyFile, 'utf8', (err, data) => {
      if (err) {
        // If file doesn't exist, return empty array
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
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

  serveLearningData(res) {
    const trainingFile = path.join(__dirname, 'training', 'training-data.json');
    
    if (!fs.existsSync(trainingFile)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        count: 0, 
        firstX: 0, firstY: 0, 
        lastX: 0, lastY: 0,
        status: 'no_data'
      }));
      return;
    }

    try {
      const trainingData = JSON.parse(fs.readFileSync(trainingFile));
      const corrected = trainingData.filter(entry => entry.userCorrections);
      
      if (corrected.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          count: 0, 
          firstX: 0, firstY: 0, 
          lastX: 0, lastY: 0,
          status: 'no_corrections'
        }));
        return;
      }
      
      let firstXTotal = 0, firstYTotal = 0, firstCount = 0;
      let lastXTotal = 0, lastYTotal = 0, lastCount = 0;
      
      corrected.forEach(entry => {
        if (entry.userCorrections.first) {
          firstXTotal += entry.userCorrections.first.svgX - entry.algorithmDetection.first.svgX;
          firstYTotal += entry.userCorrections.first.svgY - entry.algorithmDetection.first.svgY;
          firstCount++;
        }
        if (entry.userCorrections.last) {
          lastXTotal += entry.userCorrections.last.svgX - entry.algorithmDetection.last.svgX;
          lastYTotal += entry.userCorrections.last.svgY - entry.algorithmDetection.last.svgY;
          lastCount++;
        }
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        count: corrected.length,
        firstX: firstCount > 0 ? firstXTotal / firstCount : 0,
        firstY: firstCount > 0 ? firstYTotal / firstCount : 0,
        lastX: lastCount > 0 ? lastXTotal / lastCount : 0,
        lastY: lastCount > 0 ? lastYTotal / lastCount : 0,
        firstCount,
        lastCount,
        status: 'active'
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message, status: 'error' }));
    }
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

  updateProgress(currentFarm, totalFarms, farmName = '') {
    this.broadcast({
      type: 'progress',
      currentFarm,
      totalFarms,
      farmName
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
    // Store log for crash report capture
    this.logs.push({
      timestamp: Date.now(),
      message,
      type: level
    });
    // Keep only last 200 logs
    if (this.logs.length > 200) {
      this.logs.shift();
    }
    
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


