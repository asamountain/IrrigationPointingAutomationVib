/**
 * Execution Logger - Saves all console output to timestamped log files
 * This helps debug issues after automation runs complete
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let logStream = null;
let originalConsole = {};

/**
 * Initialize execution logging - call this at the start of your script
 * @returns {string} Path to the log file
 */
function initExecutionLog() {
  const logsDir = path.join(__dirname, '../../logs');
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Create timestamped log file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFileName = `execution-${timestamp}.log`;
  const logFilePath = path.join(logsDir, logFileName);
  
  // Create write stream
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  
  // Save original console methods
  originalConsole.log = console.log;
  originalConsole.error = console.error;
  originalConsole.warn = console.warn;
  originalConsole.info = console.info;
  
  // Override console methods to also write to file
  console.log = (...args) => {
    const message = formatLogMessage('LOG', args);
    logStream.write(message + '\n');
    originalConsole.log.apply(console, args);
  };
  
  console.error = (...args) => {
    const message = formatLogMessage('ERROR', args);
    logStream.write(message + '\n');
    originalConsole.error.apply(console, args);
  };
  
  console.warn = (...args) => {
    const message = formatLogMessage('WARN', args);
    logStream.write(message + '\n');
    originalConsole.warn.apply(console, args);
  };
  
  console.info = (...args) => {
    const message = formatLogMessage('INFO', args);
    logStream.write(message + '\n');
    originalConsole.info.apply(console, args);
  };
  
  // Log startup message
  console.log(`\n${'='.repeat(80)}`);
  console.log(`EXECUTION LOG STARTED: ${new Date().toISOString()}`);
  console.log(`Log file: ${logFilePath}`);
  console.log(`${'='.repeat(80)}\n`);
  
  return logFilePath;
}

/**
 * Format a log message with timestamp and level
 */
function formatLogMessage(level, args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  return `[${timestamp}] [${level}] ${message}`;
}

/**
 * Close the log stream properly
 */
function closeExecutionLog() {
  if (logStream) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`EXECUTION LOG ENDED: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}\n`);
    
    logStream.end();
    logStream = null;
    
    // Restore original console methods
    if (originalConsole.log) console.log = originalConsole.log;
    if (originalConsole.error) console.error = originalConsole.error;
    if (originalConsole.warn) console.warn = originalConsole.warn;
    if (originalConsole.info) console.info = originalConsole.info;
  }
}

/**
 * Write a separator line to the log for clarity
 */
function logSeparator(title = '') {
  if (title) {
    console.log(`\n--- ${title} ${'─'.repeat(Math.max(0, 70 - title.length))}---\n`);
  } else {
    console.log(`\n${'─'.repeat(80)}\n`);
  }
}

export {
  initExecutionLog,
  closeExecutionLog,
  logSeparator
};
