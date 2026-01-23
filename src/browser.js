/**
 * Browser Management Module
 * Centralized browser launching and lifecycle management
 */

import { chromium } from 'playwright';
import { log } from './utils.js';

// Browser instance reference
let browserInstance = null;
let contextInstance = null;

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 BROWSER LAUNCH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Launch browser with optimized settings
 * @param {object} options - Launch options
 * @param {boolean} options.headless - Run headless mode
 * @param {boolean} options.devtools - Open DevTools
 * @returns {Promise<{browser: Browser, context: BrowserContext, page: Page}>}
 */
export async function launchBrowser(options = {}) {
  const {
    headless = false,
    devtools = false,
    slowMo = 0,
    viewport = { width: 1920, height: 1080 }
  } = options;

  log('Launching browser...', 'info');

  // Close any existing browser
  if (browserInstance) {
    await closeBrowser();
  }

  // Launch with optimized args
  browserInstance = await chromium.launch({
    headless,
    devtools,
    slowMo,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage'
    ]
  });

  // Create context with viewport
  contextInstance = await browserInstance.newContext({
    viewport,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  // Create initial page
  const page = await contextInstance.newPage();

  log('Browser launched successfully', 'success');

  return { browser: browserInstance, context: contextInstance, page };
}

/**
 * Close the browser gracefully
 */
export async function closeBrowser() {
  try {
    if (contextInstance) {
      await contextInstance.close();
      contextInstance = null;
    }
    if (browserInstance) {
      await browserInstance.close();
      browserInstance = null;
    }
    log('Browser closed', 'info');
  } catch (e) {
    log(`Error closing browser: ${e.message}`, 'warning');
  }
}

/**
 * Get the current browser instance
 * @returns {Browser|null}
 */
export function getBrowser() {
  return browserInstance;
}

/**
 * Get the current context instance
 * @returns {BrowserContext|null}
 */
export function getContext() {
  return contextInstance;
}

/**
 * Check if browser is connected
 * @returns {boolean}
 */
export function isBrowserConnected() {
  return browserInstance && browserInstance.isConnected();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📸 CRASH REPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a crash report with screenshots and diagnostics
 * @param {Page} page - Playwright page
 * @param {string} reason - Reason for the crash report
 * @returns {Promise<string>} - Path to crash report directory
 */
export async function createCrashReport(page, reason = 'manual') {
  const fs = await import('fs');
  const path = await import('path');
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const crashDir = path.join(process.cwd(), 'crash-reports', `crash-${timestamp}`);
  
  // Ensure directory exists
  if (!fs.existsSync(crashDir)) {
    fs.mkdirSync(crashDir, { recursive: true });
  }

  log(`Creating crash report: ${reason}`, 'warning');

  try {
    // 1. Screenshot
    await page.screenshot({
      path: path.join(crashDir, 'screenshot.png'),
      fullPage: true
    });

    // 2. Current URL
    const url = page.url();
    fs.writeFileSync(path.join(crashDir, 'url.txt'), url);

    // 3. HTML content
    try {
      const html = await page.content();
      fs.writeFileSync(path.join(crashDir, 'page.html'), html);
    } catch (e) {
      log('Could not capture HTML', 'warning');
    }

    // 4. Console logs (if available)
    fs.writeFileSync(path.join(crashDir, 'reason.txt'), reason);

    // 5. Timestamp
    fs.writeFileSync(path.join(crashDir, 'timestamp.txt'), new Date().toISOString());

    log(`Crash report saved to: ${crashDir}`, 'success');
    return crashDir;

  } catch (e) {
    log(`Error creating crash report: ${e.message}`, 'error');
    return null;
  }
}

export default {
  launchBrowser,
  closeBrowser,
  getBrowser,
  getContext,
  isBrowserConnected,
  createCrashReport
};
