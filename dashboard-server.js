/**
 * Dashboard Server - Real-time monitoring for irrigation automation
 * Provides Server-Sent Events (SSE) for live updates
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './src/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, 'logs');

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
      maxFarms: 3,
      dayFilter: ''  // Day filter: '', '월', '화', '수', '목', '금', '토', '일'
    };
    
    // Connect logger to dashboard server for SSE broadcasts
    logger.setDashboardServer(this);
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, async () => {
        const url = `http://localhost:${this.port}`;
        logger.info(`Dashboard server started at ${url}`, { port: this.port, url });
        console.log(`📊 Dashboard ready at: ${url}`);
        console.log(`   → Open this URL to configure and start automation`);
        
        // Auto-open browser
        try {
          const { default: open } = await import('open');
          await open(url);
          logger.success('Browser launched automatically');
        } catch (err) {
          logger.warning('Could not open browser automatically', { error: err.message });
        }
        
        resolve(url);
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.warning(`Port ${this.port} is busy, trying ${this.port + 1}`, { port: this.port });
          this.port++;
          this.server.listen(this.port);
        } else {
          logger.error('Server error', error);
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
      const timerId = logger.functionEntry('handleControlStart', { endpoint: '/control/start' });
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const config = JSON.parse(body);
          logger.apiRequest('POST', '/control/start', config);
          this.config = { ...this.config, ...config };
          this.isStarted = true;
          const response = { success: true, config: this.config };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          logger.apiResponse('POST', '/control/start', response, 200);
          logger.success('Automation started', { 
            manager: this.config.manager, 
            mode: this.config.mode, 
            maxFarms: this.config.maxFarms,
            startFrom: this.config.startFrom,
            dayFilter: this.config.dayFilter || 'none'
          });
          if (this.config.dayFilter) {
            logger.info(`Day filter active: ${this.config.dayFilter}`, { dayFilter: this.config.dayFilter });
          }
          logger.functionExit(timerId, response);
        } catch (error) {
          const response = { success: false, error: error.message };
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          logger.apiResponse('POST', '/control/start', response, 400);
          logger.functionError(timerId, error);
        }
      });
    }
    else if (url.pathname === '/control/start-report-sending' && req.method === 'POST') {
      const timerId = logger.functionEntry('handleControlStartReportSending', { endpoint: '/control/start-report-sending' });
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const config = JSON.parse(body);
          logger.apiRequest('POST', '/control/start-report-sending', config);
          this.config = { ...this.config, ...config, mode: 'report-sending' };
          this.isStarted = true;
          const response = { success: true, config: this.config };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          logger.apiResponse('POST', '/control/start-report-sending', response, 200);
          logger.success('Report Sending Mode activated', {
            manager: this.config.manager,
            maxFarms: this.config.maxFarms,
            startFrom: this.config.startFrom,
            dayFilter: this.config.dayFilter || 'none'
          });
          if (this.config.dayFilter) {
            logger.info(`Day filter active: ${this.config.dayFilter}`, { dayFilter: this.config.dayFilter });
          }
          logger.functionExit(timerId, response);
        } catch (error) {
          const response = { success: false, error: error.message };
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          logger.apiResponse('POST', '/control/start-report-sending', response, 400);
          logger.functionError(timerId, error);
        }
      });
    }
    else if (url.pathname === '/control/stop' && req.method === 'POST') {
      logger.buttonClick('Stop Automation', { source: 'dashboard' });
      this.shouldStop = true;
      const response = { success: true, stopped: true };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      logger.apiResponse('POST', '/control/stop', response, 200);
      logger.warning('Automation stopped by user');
    }
    else if (url.pathname === '/control/trigger-f9' && req.method === 'POST') {
      // F9 global hotkey trigger - allows dashboard to trigger crash report
      logger.buttonClick('F9 Crash Report', { source: 'dashboard' });
      logger.warning('F9 triggered from Dashboard - Saving crash report');
      this.f9Triggered = true;  // Flag that will be checked by the Playwright worker
      this.broadcast({
        type: 'log',
        message: '📸 F9 triggered! Crash report being saved...',
        level: 'warning'
      });
      const response = { success: true, triggered: true };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      logger.apiResponse('POST', '/control/trigger-f9', response, 200);
    }
    else if (url.pathname === '/control/reset' && req.method === 'POST') {
      logger.buttonClick('Reset Dashboard', { source: 'dashboard' });
      this.isStarted = false;
      this.shouldStop = false;
      this.f9Triggered = false;
      const response = { success: true, reset: true };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      logger.apiResponse('POST', '/control/reset', response, 200);
      logger.info('Dashboard reset to initial state');
    }
    else if (url.pathname === '/control/check-f9' && req.method === 'GET') {
      // Playwright worker polls this to check if F9 was triggered
      const triggered = this.f9Triggered || false;
      this.f9Triggered = false;  // Reset after reading
      const response = { triggered };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      // Only log if triggered to avoid log spam
      if (triggered) {
        logger.debug('F9 check - triggered flag was set', { triggered });
      }
    }
    else if (url.pathname === '/control/mode' && req.method === 'POST') {
      const timerId = logger.functionEntry('handleControlMode', { endpoint: '/control/mode' });
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { mode } = JSON.parse(body);
          logger.apiRequest('POST', '/control/mode', { mode });
          const previousMode = this.config.mode;
          this.config.mode = mode;
          const response = { success: true, mode };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          logger.apiResponse('POST', '/control/mode', response, 200);
          logger.success(`Mode changed: ${previousMode} → ${mode}`, { previousMode, newMode: mode });
          logger.functionExit(timerId, response);
        } catch (error) {
          const response = { success: false, error: error.message };
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          logger.apiResponse('POST', '/control/mode', response, 400);
          logger.functionError(timerId, error);
        }
      });
    }
    else if (url.pathname === '/control/add-farms' && req.method === 'POST') {
      const timerId = logger.functionEntry('handleControlAddFarms', { endpoint: '/control/add-farms' });
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { additionalFarms } = JSON.parse(body);
          logger.apiRequest('POST', '/control/add-farms', { additionalFarms });
          const previousMax = this.config.maxFarms;
          this.config.maxFarms += additionalFarms;
          logger.success(`Added ${additionalFarms} more farms`, { 
            previousMax, 
            newMax: this.config.maxFarms, 
            additionalFarms 
          });
          this.broadcast({
            type: 'log',
            message: `Extended automation by ${additionalFarms} farms (now processing up to ${this.config.maxFarms} farms)`,
            level: 'success'
          });
          const response = { success: true, newMaxFarms: this.config.maxFarms };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          logger.apiResponse('POST', '/control/add-farms', response, 200);
          logger.functionExit(timerId, response);
        } catch (error) {
          const response = { success: false, error: error.message };
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          logger.apiResponse('POST', '/control/add-farms', response, 400);
          logger.functionError(timerId, error);
        }
      });
    }
    // API endpoints for log retrieval
    else if (url.pathname === '/api/logs' && req.method === 'GET') {
      this.serveLogsAPI(url, res);
    }
    else if (url.pathname === '/api/log-client' && req.method === 'POST') {
      this.handleClientLog(req, res);
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

  /**
   * Serve logs API endpoint
   * @param {URL} url - Request URL with query params
   * @param {ServerResponse} res - HTTP response
   */
  serveLogsAPI(url, res) {
    const filters = {
      level: url.searchParams.get('level') || undefined,
      type: url.searchParams.get('type') || undefined,
      function: url.searchParams.get('function') || undefined,
      since: url.searchParams.get('since') || undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')) : 100,
      format: url.searchParams.get('format') || 'json',
      date: url.searchParams.get('date') || undefined,
      category: url.searchParams.get('category') || 'server'
    };
    
    logger.debug('Logs API request', filters);
    
    try {
      let logs;
      if (filters.date) {
        // Get logs from file for specific date
        logs = logger.getLogsFromFile(filters.date, filters.category);
      } else {
        // Get logs from memory
        logs = logger.getLogs(filters);
      }
      
      if (filters.format === 'csv') {
        res.writeHead(200, { 
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="logs.csv"'
        });
        res.end(logger.exportLogsCSV(filters));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(logs, null, 2));
      }
    } catch (error) {
      logger.error('Failed to retrieve logs', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Handle client-side log submissions
   * @param {IncomingMessage} req - HTTP request
   * @param {ServerResponse} res - HTTP response
   */
  handleClientLog(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const logEntry = JSON.parse(body);
        
        // Process client log based on type
        switch (logEntry.type) {
          case 'chartInteraction':
            logger.chartInteraction(logEntry.eventType, logEntry.data);
            break;
          case 'apiCall':
            logger.apiCall(
              logEntry.method, 
              logEntry.url, 
              logEntry.payload, 
              logEntry.response, 
              logEntry.statusCode
            );
            break;
          case 'buttonClick':
            logger.buttonClick(logEntry.button, logEntry.context);
            break;
          default:
            // General log
            const level = logEntry.level || 'info';
            logger.log(level, 'clientLog', logEntry.message, { 
              source: 'browser', 
              ...logEntry.data 
            });
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        logger.error('Failed to process client log', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
  }

  stop() {
    if (this.server) {
      logger.info('Shutting down dashboard server');
      this.clients.forEach(client => {
        try {
          client.end();
        } catch (e) {
          // Ignore errors
        }
      });
      this.clients = [];
      this.server.close();
      logger.success('Dashboard server stopped');
    }
  }
}

export default DashboardServer;


