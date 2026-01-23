/**
 * Browser Service Module - 100% Playwright Native
 * Clean architecture for browser management with heartbeat monitoring
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CRASH_REPORTS_DIR = './crash-reports';
const STATUS_FILE = path.join(CRASH_REPORTS_DIR, 'browser-status.json');
const HEARTBEAT_INTERVAL_MS = 5000;

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL STATE
// ═══════════════════════════════════════════════════════════════════════════

let heartbeatInterval = null;
let currentBrowser = null;
let currentPage = null;

// ═══════════════════════════════════════════════════════════════════════════
// STATUS FILE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function ensureCrashReportsDir() {
  if (!fs.existsSync(CRASH_REPORTS_DIR)) {
    fs.mkdirSync(CRASH_REPORTS_DIR, { recursive: true });
  }
}

/**
 * Write browser status to JSON file
 */
export function writeStatus(status, extra = {}) {
  ensureCrashReportsDir();
  
  const statusData = {
    status,
    timestamp: new Date().toISOString(),
    mode: 'playwright',
    uptime: process.uptime(),
    ...extra
  };
  
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(statusData, null, 2));
  } catch (err) {
    console.error(`[BrowserService] Failed to write status: ${err.message}`);
  }
}

/**
 * Read current browser status from file
 */
export function getBrowserStatus() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    }
  } catch (err) {
    // Ignore read errors
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HEARTBEAT MONITORING
// ═══════════════════════════════════════════════════════════════════════════

function startHeartbeat(browser) {
  stopHeartbeat();
  
  console.log(`💓 [BrowserService] Heartbeat started (every ${HEARTBEAT_INTERVAL_MS / 1000}s)`);
  
  heartbeatInterval = setInterval(() => {
    try {
      const isConnected = browser.isConnected();
      
      if (isConnected) {
        writeStatus('alive', {
          connected: true,
          url: currentPage?.url() || null
        });
      } else {
        writeStatus('dead', { reason: 'browser disconnected' });
        stopHeartbeat();
      }
    } catch (err) {
      writeStatus('dead', { error: err.message });
      stopHeartbeat();
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BROWSER LAUNCH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Launch a visible Playwright browser with heartbeat monitoring
 */
export async function launchBrowser(options = {}) {
  const { maximized = true } = options;
  
  ensureCrashReportsDir();
  writeStatus('starting');
  
  console.log('\n🚀 [BrowserService] LAUNCHING PLAYWRIGHT BROWSER...');
  
  let browser = null;
  let context = null;
  let page = null;
  
  try {
    // Launch with headless: false (ALWAYS VISIBLE)
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: [
        '--start-maximized',
        '--window-position=0,0',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check'
      ]
    });
    
    currentBrowser = browser;
    
    // Write alive status IMMEDIATELY after launch succeeds
    writeStatus('alive', { connected: browser.isConnected() });
    console.log('  ✅ Browser launched successfully');
    
    // Handle disconnection
    browser.on('disconnected', () => {
      console.log('\n💀 [BrowserService] BROWSER DISCONNECTED');
      writeStatus('dead', { reason: 'disconnected' });
      stopHeartbeat();
      currentBrowser = null;
      currentPage = null;
    });
    
    // Create context
    context = await browser.newContext({
      viewport: null,
      screen: { width: 1920, height: 1080 }
    });
    
    // Create page
    page = await context.newPage();
    currentPage = page;
    
    // Maximize window via CDP
    if (maximized) {
      try {
        const session = await page.context().newCDPSession(page);
        const { windowId } = await session.send('Browser.getWindowForTarget');
        await session.send('Browser.setWindowBounds', {
          windowId,
          bounds: { windowState: 'maximized' }
        });
        console.log('  ✅ Window maximized');
      } catch (e) {
        console.log('  ⚠️  CDP maximize failed:', e.message);
      }
    }
    
    // Start heartbeat
    startHeartbeat(browser);
    
    console.log('🚀 [BrowserService] READY\n');
    
    return { browser, context, page };
    
  } catch (error) {
    // CRITICAL: Write dead status before throwing
    writeStatus('dead', { 
      error: error.message,
      stack: error.stack 
    });
    
    console.error('❌ [BrowserService] LAUNCH FAILED:', error.message);
    
    // Cleanup any partial state
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    
    throw error;
  }
}

/**
 * Safely close browser
 */
export async function closeBrowser(browser) {
  stopHeartbeat();
  
  try {
    if (browser && browser.isConnected()) {
      await browser.close();
    }
    writeStatus('closed');
  } catch (error) {
    writeStatus('dead', { closeError: error.message });
  }
  
  currentBrowser = null;
  currentPage = null;
}

/**
 * Capture error with screenshot
 */
export async function captureError(page, error, context = 'Error') {
  ensureCrashReportsDir();
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  const errorDir = path.join(CRASH_REPORTS_DIR, `${timestamp}_${context}`);
  
  try {
    fs.mkdirSync(errorDir, { recursive: true });
    
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(errorDir, 'error.png'), fullPage: true }).catch(() => {});
      const html = await page.content().catch(() => '');
      if (html) fs.writeFileSync(path.join(errorDir, 'dom.html'), html);
    }
    
    fs.writeFileSync(path.join(errorDir, 'CRASH_SUMMARY.json'), JSON.stringify({
      errorName: context,
      message: error?.message || 'Unknown',
      stack: error?.stack || '',
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`📁 [BrowserService] Error captured: ${errorDir}`);
    return errorDir;
  } catch (e) {
    return null;
  }
}

export default {
  launchBrowser,
  closeBrowser,
  captureError,
  getBrowserStatus,
  writeStatus,
  stopHeartbeat
};
