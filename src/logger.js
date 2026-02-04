/**
 * Structured Logger Module
 * Provides comprehensive logging with correlation IDs, log levels, file output,
 * and specialized logging for chart interactions, API calls, and button clicks.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, '..', 'logs');

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 LOG LEVELS
// ═══════════════════════════════════════════════════════════════════════════════

const LOG_LEVELS = {
  debug: { priority: 0, emoji: '🔍', color: '\x1b[90m' },
  info: { priority: 1, emoji: '📋', color: '\x1b[36m' },
  success: { priority: 2, emoji: '✅', color: '\x1b[32m' },
  warning: { priority: 3, emoji: '⚠️', color: '\x1b[33m' },
  error: { priority: 4, emoji: '❌', color: '\x1b[31m' }
};

const RESET_COLOR = '\x1b[0m';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 LOGGER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class Logger {
  constructor() {
    this.minLevel = 'debug';
    this.logs = [];
    this.maxMemoryLogs = 500;
    this.dashboardServer = null;
    this.currentContext = {};
    this.functionTimers = new Map();
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  /**
   * Generate a unique correlation ID
   * @returns {string}
   */
  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current date string for log files
   * @returns {string}
   */
  getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Set the dashboard server reference for SSE broadcasts
   * @param {object} server - DashboardServer instance
   */
  setDashboardServer(server) {
    this.dashboardServer = server;
  }

  /**
   * Set current context (farmName, date, etc.)
   * @param {object} context
   */
  setContext(context) {
    this.currentContext = { ...this.currentContext, ...context };
  }

  /**
   * Clear current context
   */
  clearContext() {
    this.currentContext = {};
  }

  /**
   * Create a structured log entry
   * @param {string} level - Log level
   * @param {string} type - Log type (general, chartInteraction, apiCall, buttonClick, functionCall)
   * @param {string} message - Log message
   * @param {object} data - Additional data
   * @returns {object}
   */
  createLogEntry(level, type, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      type,
      message,
      correlationId: this.currentContext.correlationId || this.generateCorrelationId(),
      ...this.currentContext,
      data
    };
    return entry;
  }

  /**
   * Write log entry to file
   * @param {object} entry - Log entry
   * @param {string} category - File category (server, chart-interactions, api-calls, errors)
   */
  writeToFile(entry, category = 'server') {
    const dateStr = this.getDateString();
    const logFile = path.join(LOG_DIR, `${category}-${dateStr}.log`);
    
    const line = JSON.stringify(entry) + '\n';
    
    fs.appendFileSync(logFile, line, 'utf8');
    
    // Also write errors to dedicated error log
    if (entry.level === 'error') {
      const errorFile = path.join(LOG_DIR, `errors-${dateStr}.log`);
      fs.appendFileSync(errorFile, line, 'utf8');
    }
  }

  /**
   * Store log in memory for retrieval
   * @param {object} entry - Log entry
   */
  storeInMemory(entry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxMemoryLogs) {
      this.logs.shift();
    }
  }

  /**
   * Broadcast log to dashboard via SSE
   * @param {object} entry - Log entry
   */
  broadcastToDashboard(entry) {
    if (this.dashboardServer) {
      this.dashboardServer.broadcast({
        type: 'structured_log',
        entry
      });
    }
  }

  /**
   * Format and output log to console
   * @param {object} entry - Log entry
   */
  logToConsole(entry) {
    const levelInfo = LOG_LEVELS[entry.level] || LOG_LEVELS.info;
    const time = entry.timestamp.split('T')[1].split('.')[0];
    
    let output = `${levelInfo.color}[${time}] ${levelInfo.emoji} [${entry.type}] ${entry.message}${RESET_COLOR}`;
    
    if (entry.function) {
      output += ` (${entry.function})`;
    }
    
    if (Object.keys(entry.data).length > 0 && entry.level !== 'debug') {
      const dataStr = JSON.stringify(entry.data, null, 0);
      if (dataStr.length < 200) {
        output += ` ${dataStr}`;
      }
    }
    
    console.log(output);
  }

  /**
   * Check if log level should be output
   * @param {string} level - Log level to check
   * @returns {boolean}
   */
  shouldLog(level) {
    const minPriority = LOG_LEVELS[this.minLevel]?.priority || 0;
    const currentPriority = LOG_LEVELS[level]?.priority || 1;
    return currentPriority >= minPriority;
  }

  /**
   * Main log function
   * @param {string} level - Log level
   * @param {string} type - Log type
   * @param {string} message - Message
   * @param {object} data - Additional data
   * @param {string} category - File category
   */
  log(level, type, message, data = {}, category = 'server') {
    if (!this.shouldLog(level)) return;
    
    const entry = this.createLogEntry(level, type, message, data);
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, category);
    this.broadcastToDashboard(entry);
    
    return entry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📝 CONVENIENCE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  debug(message, data = {}) {
    return this.log('debug', 'general', message, data);
  }

  info(message, data = {}) {
    return this.log('info', 'general', message, data);
  }

  success(message, data = {}) {
    return this.log('success', 'general', message, data);
  }

  warning(message, data = {}) {
    return this.log('warning', 'general', message, data);
  }

  error(message, data = {}) {
    if (data instanceof Error) {
      data = {
        errorMessage: data.message,
        stack: data.stack
      };
    }
    return this.log('error', 'general', message, data);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔄 FUNCTION TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log function entry with parameters
   * @param {string} functionName - Name of the function
   * @param {object} params - Function parameters
   * @returns {string} - Timer ID for tracking duration
   */
  functionEntry(functionName, params = {}) {
    const timerId = `${functionName}-${Date.now()}`;
    this.functionTimers.set(timerId, {
      name: functionName,
      startTime: Date.now(),
      params
    });
    
    const entry = this.createLogEntry('info', 'functionCall', `→ ${functionName}() called`, {
      function: functionName,
      params,
      phase: 'entry'
    });
    entry.function = functionName;
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, 'server');
    this.broadcastToDashboard(entry);
    
    return timerId;
  }

  /**
   * Log function exit with return value and duration
   * @param {string} timerId - Timer ID from functionEntry
   * @param {*} returnValue - Function return value
   * @param {object} additionalData - Any additional data to log
   */
  functionExit(timerId, returnValue = undefined, additionalData = {}) {
    const timerInfo = this.functionTimers.get(timerId);
    if (!timerInfo) {
      this.warning(`functionExit called with unknown timerId: ${timerId}`);
      return;
    }
    
    const duration = Date.now() - timerInfo.startTime;
    this.functionTimers.delete(timerId);
    
    // Serialize return value safely
    let safeReturnValue = returnValue;
    if (typeof returnValue === 'object' && returnValue !== null) {
      try {
        safeReturnValue = JSON.parse(JSON.stringify(returnValue, (key, val) => {
          if (typeof val === 'function') return '[Function]';
          if (val instanceof Error) return { error: val.message };
          return val;
        }));
      } catch (e) {
        safeReturnValue = '[Unserializable]';
      }
    }
    
    const entry = this.createLogEntry('success', 'functionCall', `← ${timerInfo.name}() returned`, {
      function: timerInfo.name,
      returnValue: safeReturnValue,
      durationMs: duration,
      phase: 'exit',
      ...additionalData
    });
    entry.function = timerInfo.name;
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, 'server');
    this.broadcastToDashboard(entry);
    
    return entry;
  }

  /**
   * Log function error
   * @param {string} timerId - Timer ID from functionEntry
   * @param {Error|string} error - Error that occurred
   */
  functionError(timerId, error) {
    const timerInfo = this.functionTimers.get(timerId);
    const functionName = timerInfo?.name || 'unknown';
    const duration = timerInfo ? Date.now() - timerInfo.startTime : 0;
    
    if (timerInfo) {
      this.functionTimers.delete(timerId);
    }
    
    const entry = this.createLogEntry('error', 'functionCall', `✗ ${functionName}() failed`, {
      function: functionName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
      phase: 'error'
    });
    entry.function = functionName;
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, 'server');
    this.writeToFile(entry, 'errors');
    this.broadcastToDashboard(entry);
    
    return entry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📊 CHART INTERACTION LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log chart interaction events
   * @param {string} eventType - Type of chart interaction (pointClick, detection, markerDrag, etc.)
   * @param {object} data - Interaction data
   */
  chartInteraction(eventType, data = {}) {
    const message = this.getChartInteractionMessage(eventType, data);
    const level = data.success === false ? 'warning' : 'info';
    
    const entry = this.createLogEntry(level, 'chartInteraction', message, {
      eventType,
      ...data
    });
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, 'chart-interactions');
    this.broadcastToDashboard(entry);
    
    return entry;
  }

  /**
   * Get human-readable message for chart interaction
   * @param {string} eventType
   * @param {object} data
   * @returns {string}
   */
  getChartInteractionMessage(eventType, data) {
    switch (eventType) {
      case 'pointClick':
        return `Chart point clicked: ${data.type || 'point'} at index ${data.index} (${data.time || 'unknown time'})`;
      case 'detection':
        return `Irrigation events detected: ${data.count || 0} events`;
      case 'markerDrag':
        return `Marker dragged: ${data.markerType} to time ${data.newTime}`;
      case 'overlayShow':
        return `Overlay displayed for chart confirmation`;
      case 'overlayConfirm':
        return `User confirmed chart selection: first=${data.firstTime}, last=${data.lastTime}`;
      case 'overlayCancel':
        return `User cancelled chart selection`;
      case 'algorithmRun':
        return `HSSP algorithm executed with ${data.dataPoints} data points`;
      default:
        return `Chart interaction: ${eventType}`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🌐 API CALL LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log API call with request and response
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {object} payload - Request payload
   * @param {object} response - Response data
   * @param {number} statusCode - HTTP status code
   */
  apiCall(method, url, payload = null, response = null, statusCode = null) {
    const isSuccess = statusCode >= 200 && statusCode < 300;
    const level = isSuccess ? 'success' : (statusCode >= 400 ? 'error' : 'warning');
    
    const message = `${method} ${url} → ${statusCode || 'pending'}`;
    
    const entry = this.createLogEntry(level, 'apiCall', message, {
      method,
      url,
      payload: this.sanitizePayload(payload),
      response: this.sanitizeResponse(response),
      statusCode,
      success: isSuccess
    });
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, 'api-calls');
    this.broadcastToDashboard(entry);
    
    return entry;
  }

  /**
   * Log API request start (before response)
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {object} payload - Request payload
   */
  apiRequest(method, url, payload = null) {
    const message = `→ ${method} ${url}`;
    
    const entry = this.createLogEntry('info', 'apiCall', message, {
      method,
      url,
      payload: this.sanitizePayload(payload),
      phase: 'request'
    });
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, 'api-calls');
    
    return entry;
  }

  /**
   * Log API response
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {object} response - Response data
   * @param {number} statusCode - HTTP status code
   * @param {number} durationMs - Request duration
   */
  apiResponse(method, url, response, statusCode, durationMs = null) {
    const isSuccess = statusCode >= 200 && statusCode < 300;
    const level = isSuccess ? 'success' : (statusCode >= 400 ? 'error' : 'warning');
    
    const message = `← ${method} ${url} [${statusCode}]${durationMs ? ` (${durationMs}ms)` : ''}`;
    
    const entry = this.createLogEntry(level, 'apiCall', message, {
      method,
      url,
      response: this.sanitizeResponse(response),
      statusCode,
      durationMs,
      success: isSuccess,
      phase: 'response'
    });
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, 'api-calls');
    this.broadcastToDashboard(entry);
    
    return entry;
  }

  /**
   * Sanitize payload to avoid logging sensitive data
   * @param {object} payload
   * @returns {object}
   */
  sanitizePayload(payload) {
    if (!payload) return null;
    const sanitized = { ...payload };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
    for (const key of sensitiveKeys) {
      if (sanitized[key]) sanitized[key] = '[REDACTED]';
    }
    return sanitized;
  }

  /**
   * Sanitize response to limit size
   * @param {object} response
   * @returns {object}
   */
  sanitizeResponse(response) {
    if (!response) return null;
    const str = JSON.stringify(response);
    if (str.length > 1000) {
      return { truncated: true, length: str.length, preview: str.substring(0, 500) + '...' };
    }
    return response;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🖱️ BUTTON CLICK LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log button click event
   * @param {string} buttonName - Name or text of the button
   * @param {object} context - Additional context
   */
  buttonClick(buttonName, context = {}) {
    const message = `Button clicked: "${buttonName}"`;
    
    const entry = this.createLogEntry('info', 'buttonClick', message, {
      button: buttonName,
      ...context
    });
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, 'server');
    this.broadcastToDashboard(entry);
    
    return entry;
  }

  /**
   * Log button click result
   * @param {string} buttonName - Name or text of the button
   * @param {boolean} success - Whether click was successful
   * @param {object} result - Result data
   */
  buttonClickResult(buttonName, success, result = {}) {
    const level = success ? 'success' : 'warning';
    const message = success 
      ? `Button "${buttonName}" click successful`
      : `Button "${buttonName}" click failed`;
    
    const entry = this.createLogEntry(level, 'buttonClick', message, {
      button: buttonName,
      success,
      ...result
    });
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, 'server');
    this.broadcastToDashboard(entry);
    
    return entry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📋 TABLE OPERATION LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log table validation
   * @param {object} validationResult - Validation result
   */
  tableValidation(validationResult) {
    const level = validationResult.ready ? 'success' : 'warning';
    const message = validationResult.ready 
      ? `Table validation passed`
      : `Table validation failed: ${validationResult.reason || 'unknown'}`;
    
    const entry = this.createLogEntry(level, 'tableOperation', message, validationResult);
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, 'server');
    this.broadcastToDashboard(entry);
    
    return entry;
  }

  /**
   * Log table refresh attempt
   * @param {number} attempt - Attempt number
   * @param {object} result - Refresh result
   */
  tableRefresh(attempt, result = {}) {
    const level = result.success ? 'success' : 'warning';
    const message = result.success
      ? `Table refresh attempt ${attempt} successful`
      : `Table refresh attempt ${attempt} failed`;
    
    const entry = this.createLogEntry(level, 'tableOperation', message, {
      attempt,
      ...result
    });
    
    this.logToConsole(entry);
    this.storeInMemory(entry);
    this.writeToFile(entry, 'server');
    this.broadcastToDashboard(entry);
    
    return entry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📦 LOG RETRIEVAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get logs from memory
   * @param {object} filters - Filter criteria
   * @returns {Array}
   */
  getLogs(filters = {}) {
    let logs = [...this.logs];
    
    if (filters.level) {
      logs = logs.filter(l => l.level === filters.level);
    }
    if (filters.type) {
      logs = logs.filter(l => l.type === filters.type);
    }
    if (filters.function) {
      logs = logs.filter(l => l.function === filters.function || l.data?.function === filters.function);
    }
    if (filters.since) {
      const sinceDate = new Date(filters.since);
      logs = logs.filter(l => new Date(l.timestamp) >= sinceDate);
    }
    if (filters.limit) {
      logs = logs.slice(-filters.limit);
    }
    
    return logs;
  }

  /**
   * Get logs from file
   * @param {string} date - Date string (YYYY-MM-DD)
   * @param {string} category - Log category
   * @returns {Array}
   */
  getLogsFromFile(date = null, category = 'server') {
    const dateStr = date || this.getDateString();
    const logFile = path.join(LOG_DIR, `${category}-${dateStr}.log`);
    
    if (!fs.existsSync(logFile)) {
      return [];
    }
    
    const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l.trim());
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return { raw: line };
      }
    });
  }

  /**
   * Export logs as JSON
   * @param {object} filters - Filter criteria
   * @returns {string}
   */
  exportLogsJSON(filters = {}) {
    const logs = this.getLogs(filters);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Export logs as CSV
   * @param {object} filters - Filter criteria
   * @returns {string}
   */
  exportLogsCSV(filters = {}) {
    const logs = this.getLogs(filters);
    if (logs.length === 0) return '';
    
    const headers = ['timestamp', 'level', 'type', 'message', 'function', 'farmName', 'data'];
    const rows = logs.map(log => {
      return headers.map(h => {
        let val = log[h];
        if (h === 'data') val = JSON.stringify(val || {});
        return `"${String(val || '').replace(/"/g, '""')}"`;
      }).join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const logger = new Logger();

export default logger;
export { Logger, LOG_LEVELS, LOG_DIR };
