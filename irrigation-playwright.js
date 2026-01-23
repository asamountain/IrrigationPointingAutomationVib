/**
 * Irrigation Report Automation - Playwright Version
 * Purpose: Automate data extraction from admin.iocrops.com 관수리포트 menu
 * 
 * Week 1 Goal: Proof of Concept - Navigate and screenshot
 * 
 * Using Playwright instead of Vibium for better Windows compatibility
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import DashboardServer from './dashboard-server.js';
import { setupNetworkInterception, waitForChartData, extractDataPoints } from './network-interceptor.js';

// Configuration (move to config.js later)
const CONFIG = {
  url: 'https://admin.iofarm.com/report/',
  username: 'admin@admin.com',
  password: 'jojin1234!!',
  targetName: '승진', // Will be set by dashboard
  outputDir: './data',
  screenshotDir: './screenshots',
  chartLearningMode: false, // Will be set by dashboard
  watchMode: false // Will be set by dashboard
};

// Ensure output directories exist
[CONFIG.outputDir, CONFIG.screenshotDir, './training', './history', './crash-reports'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Training data file
const TRAINING_FILE = './training/training-data.json';

// Global dashboard instance (will be set in main)
let globalDashboard = null;

// Helper function to take screenshots and update dashboard
async function takeScreenshot(page, screenshotPath) {
  await page.screenshot({ path: screenshotPath, fullPage: true });
  if (globalDashboard) {
    globalDashboard.updateScreenshot(screenshotPath);
  }
  return screenshotPath;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🛠️ CRASH REPORT SYSTEM - Self-diagnosing for AI analysis
// ═══════════════════════════════════════════════════════════════════════════

// Global storage for browser console logs (captured during page lifecycle)
let browserConsoleLogs = [];
let lastFailedNetworkRequests = [];

// Setup console and network listeners on a page
function setupCrashDiagnostics(page) {
  // Capture browser console logs
  page.on('console', msg => {
    const entry = `[${new Date().toISOString()}] [${msg.type().toUpperCase()}] ${msg.text()}`;
    browserConsoleLogs.push(entry);
    // Keep only last 100 entries
    if (browserConsoleLogs.length > 100) {
      browserConsoleLogs.shift();
    }
  });
  
  // Capture failed network requests
  page.on('requestfailed', request => {
    lastFailedNetworkRequests.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText || 'Unknown',
      timestamp: new Date().toISOString()
    });
    // Keep only last 20 failed requests
    if (lastFailedNetworkRequests.length > 20) {
      lastFailedNetworkRequests.shift();
    }
  });
  
  console.log('  ✅ Crash diagnostics listeners attached');
}

/**
 * Setup F9 Key Listener for manual crash report trigger
 * Press F9 in the browser window to instantly save a crash report
 * @param {Page} page - Playwright page object
 */
async function setupF9ManualTrigger(page) {
  // Expose Node.js function to the browser context
  await page.exposeFunction('triggerCrashReport', async (reason) => {
    console.log(`\n⌨️  F9 PRESSED - Manual crash report triggered!`);
    await saveCrashReport(page, reason || 'Manual_F9_Trigger', null);
  });
  
  // Inject script to listen for F9 keypress
  await page.addInitScript(() => {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'F9' || event.code === 'F9') {
        event.preventDefault();
        console.log('🔑 F9 key detected - triggering crash report...');
        
        // Call the exposed Node.js function
        window.triggerCrashReport('Manual_F9_Trigger');
      }
    });
    
    console.log('✅ F9 Manual Trigger listener installed - Press F9 to save crash report');
  });
  
  console.log('  ✅ F9 Manual Trigger installed (Press F9 in browser to save crash report)');
}

/**
 * Save a comprehensive crash report for AI analysis
 * @param {Page} page - Playwright page object
 * @param {string} errorName - Short error name (e.g., "LoginTimeout", "FarmClickFailed")
 * @param {Error} error - The error object (optional)
 */
async function saveCrashReport(page, errorName, error = null) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  const safeName = errorName.replace(/[^a-zA-Z0-9]/g, '_');
  const crashDir = path.join('./crash-reports', `${timestamp}_${safeName}`);
  
  console.log(`\n🚨 SAVING CRASH REPORT: ${crashDir}`);
  console.log('═'.repeat(60));
  
  // Ensure crash-reports directory exists
  if (!fs.existsSync('./crash-reports')) {
    fs.mkdirSync('./crash-reports', { recursive: true });
  }
  fs.mkdirSync(crashDir, { recursive: true });
  
  const report = {
    errorName: errorName,
    timestamp: new Date().toISOString(),
    url: 'unknown',
    files: []
  };
  
  try {
    // 1. Screenshot
    const screenshotPath = path.join(crashDir, 'state.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    report.files.push('state.png');
    console.log('  ✅ [1/5] Screenshot saved: state.png');
  } catch (e) {
    console.log(`  ❌ [1/5] Screenshot failed: ${e.message}`);
  }
  
  try {
    // 2. HTML Snapshot (DOM)
    const htmlContent = await page.content();
    const htmlPath = path.join(crashDir, 'dom.html');
    fs.writeFileSync(htmlPath, htmlContent);
    report.files.push('dom.html');
    report.url = page.url();
    console.log('  ✅ [2/5] DOM snapshot saved: dom.html');
  } catch (e) {
    console.log(`  ❌ [2/5] DOM snapshot failed: ${e.message}`);
  }
  
  try {
    // 3. Console Logs (last 50 lines)
    const consolePath = path.join(crashDir, 'console.txt');
    const last50Logs = browserConsoleLogs.slice(-50).join('\n');
    const consoleContent = `=== BROWSER CONSOLE LOGS (Last 50) ===\n\n${last50Logs || '(No console logs captured)'}\n\n=== ERROR DETAILS ===\nError Name: ${errorName}\nError Message: ${error?.message || 'N/A'}\nStack Trace:\n${error?.stack || 'N/A'}`;
    fs.writeFileSync(consolePath, consoleContent);
    report.files.push('console.txt');
    console.log('  ✅ [3/5] Console logs saved: console.txt');
  } catch (e) {
    console.log(`  ❌ [3/5] Console logs failed: ${e.message}`);
  }
  
  try {
    // 4. Failed Network Requests
    const networkPath = path.join(crashDir, 'network_last_failed.json');
    const networkData = {
      description: 'Recently failed network requests (if any)',
      failedRequests: lastFailedNetworkRequests.slice(-10),
      currentUrl: page.url()
    };
    fs.writeFileSync(networkPath, JSON.stringify(networkData, null, 2));
    report.files.push('network_last_failed.json');
    console.log('  ✅ [4/5] Network log saved: network_last_failed.json');
  } catch (e) {
    console.log(`  ❌ [4/5] Network log failed: ${e.message}`);
  }
  
  try {
    // 5. Dashboard Logs (extract from our running dashboard server)
    const dashboardLogPath = path.join(crashDir, 'dashboard_logs.txt');
    // Get logs from global dashboard instance if available
    let dashboardLogs = '(Dashboard logs not available - no global dashboard instance)';
    if (globalDashboard && globalDashboard.logs && globalDashboard.logs.length > 0) {
      dashboardLogs = globalDashboard.logs.map(log => {
        const ts = new Date(log.timestamp).toISOString();
        return `[${ts}] [${log.type.toUpperCase()}] ${log.message}`;
      }).join('\n');
    }
    const dashboardContent = `=== DASHBOARD SERVER LOGS ===\n\n${dashboardLogs}\n\n=== END DASHBOARD LOGS ===`;
    fs.writeFileSync(dashboardLogPath, dashboardContent);
    report.files.push('dashboard_logs.txt');
    console.log('  ✅ [5/5] Dashboard logs saved: dashboard_logs.txt');
  } catch (e) {
    console.log(`  ❌ [5/5] Dashboard logs failed: ${e.message}`);
  }
  
  // Save summary report
  try {
    const summaryPath = path.join(crashDir, 'CRASH_SUMMARY.json');
    fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2));
    console.log('  ✅ Summary saved: CRASH_SUMMARY.json');
  } catch (e) {
    console.log(`  ❌ Summary failed: ${e.message}`);
  }
  
  console.log('═'.repeat(60));
  console.log(`📁 CRASH REPORT SAVED TO: ${crashDir}`);
  console.log('💡 Upload this folder to Claude/ChatGPT for AI analysis\n');
  
  return crashDir;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 ROBUST LOGIN FUNCTION - Aggressive click with retry logic
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Perform a robust login with aggressive clicking and retry logic
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} - true if login successful
 */
async function performRobustLogin(page) {
  console.log('\n  🔐 ROBUST LOGIN SEQUENCE:');
  console.log('  ═══════════════════════════════════════');
  
  // Step 1: Fill credentials
  console.log('  [1/5] Filling credentials...');
  
  // Wait for email field and fill - IoFarm uses name="userEmail" not type="email"
  const emailField = page.locator('input[name="userEmail"], input[type="email"], input[name="email"], input[name="username"]').first();
  await emailField.waitFor({ state: 'visible', timeout: 10000 });
  await emailField.fill(CONFIG.username);
  console.log(`       ✅ Email: ${CONFIG.username}`);
  
  // Fill password
  const passwordField = page.locator('input[type="password"]').first();
  await passwordField.waitFor({ state: 'visible', timeout: 5000 });
  await passwordField.fill(CONFIG.password);
  console.log('       ✅ Password: ********');
  
  // Step 2: Find and prepare login button
  console.log('  [2/5] Locating login button...');
  const buttonSelectors = [
    'button[type="submit"]',
    'button:has-text("로그인")',
    'button:has-text("Login")',
    'button:has-text("Sign in")',
    'input[type="submit"]'
  ];
  
  let loginButton = null;
  for (const selector of buttonSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        loginButton = btn;
        console.log(`       ✅ Found button: ${selector}`);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!loginButton) {
    throw new Error('Login button not found with any known selector');
  }
  
  // Step 3: Wait for button stability (enabled, not animating)
  console.log('  [3/5] Waiting for button stability...');
  await loginButton.waitFor({ state: 'visible', timeout: 5000 });
  
  // Check if button is enabled
  const isDisabled = await loginButton.isDisabled();
  if (isDisabled) {
    console.log('       ⚠️ Button is disabled, waiting...');
    await page.waitForTimeout(1000);
  }
  console.log('       ✅ Button is stable and ready');
  
  // Step 4: AGGRESSIVE CLICK with force
  console.log('  [4/5] Clicking login button (force: true)...');
  
  // First attempt - force click
  await loginButton.click({ force: true, timeout: 5000 });
  console.log('       ✅ First click sent');
  
  // Step 5: Validate login - Wait for URL change OR error message
  console.log('  [5/5] Validating login result...');
  
  const loginResult = await Promise.race([
    // Success: URL changes away from login (url is a URL object, use .href)
    page.waitForURL(url => !url.href.includes('/login') && !url.href.includes('/signin') && url.href !== 'https://admin.iofarm.com/', { timeout: 8000 })
      .then(() => ({ success: true, reason: 'URL changed' })),
    
    // Failure: Error message appears
    page.locator('text=/invalid|incorrect|failed|error|wrong|실패|오류|잘못/i').first()
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => ({ success: false, reason: 'Error message visible' })),
    
    // Timeout fallback
    new Promise(resolve => setTimeout(() => resolve({ success: false, reason: 'timeout' }), 8000))
  ]);
  
  if (loginResult.success) {
    console.log(`       ✅ Login successful! (${loginResult.reason})`);
    console.log(`       → Redirected to: ${page.url()}`);
    console.log('  ═══════════════════════════════════════\n');
    return true;
  }
  
  // DOUBLE-TAP STRATEGY: If first click didn't work, try again
  if (loginResult.reason === 'timeout') {
    console.log('       ⚠️ First click may have been ignored, trying DOUBLE-TAP...');
    
    // Re-click the button
    await loginButton.click({ force: true, timeout: 3000 }).catch(() => {});
    console.log('       🔄 Second click sent');
    
    // Wait again for URL change
    try {
      await page.waitForURL(url => !url.href.includes('/login') && !url.href.includes('/signin') && url.href !== 'https://admin.iofarm.com/', { timeout: 10000 });
      console.log(`       ✅ DOUBLE-TAP successful! Redirected to: ${page.url()}`);
      console.log('  ═══════════════════════════════════════\n');
      return true;
    } catch (e) {
      console.log('       ❌ DOUBLE-TAP also failed');
    }
  }
  
  // Check for specific error messages
  const errorText = await page.locator('.error, .alert-error, [class*="error"], text=/error|invalid|failed/i')
    .first().textContent().catch(() => null);
  
  if (errorText) {
    console.log(`       ❌ Login error detected: "${errorText.trim()}"`);
  }
  
  console.log('  ═══════════════════════════════════════\n');
  throw new Error(`Login failed: ${loginResult.reason}${errorText ? ' - ' + errorText.trim() : ''}`);
}

// Load existing learning data for auto-correction
function loadLearningOffsets() {
  if (!fs.existsSync(TRAINING_FILE)) {
    return { firstX: 0, firstY: 0, lastX: 0, lastY: 0, count: 0 };
  }
  
  try {
    const trainingData = JSON.parse(fs.readFileSync(TRAINING_FILE));
    const corrected = trainingData.filter(entry => entry.userCorrections);
    
    if (corrected.length === 0) {
      return { firstX: 0, firstY: 0, lastX: 0, lastY: 0, count: 0 };
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
    
    return {
      firstX: firstCount > 0 ? firstXTotal / firstCount : 0,
      firstY: firstCount > 0 ? firstYTotal / firstCount : 0,
      lastX: lastCount > 0 ? lastXTotal / lastCount : 0,
      lastY: lastCount > 0 ? lastYTotal / lastCount : 0,
      count: corrected.length
    };
  } catch (err) {
    console.log('⚠️  Could not load learning data:', err.message);
    return { firstX: 0, firstY: 0, lastX: 0, lastY: 0, count: 0 };
  }
}

// 📤 REPORT SENDING MODE: Validate table data and click "Create Report" button
async function runReportSending(config, dashboard, runStats) {
  console.log('\n📤 ========================================');
  console.log('📤   REPORT SENDING AUTOMATION MODE');
  console.log('📤 ========================================\n');
  
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--start-maximized', '--window-position=0,0']
  });
  
  const context = await browser.newContext({
    viewport: null,
    screen: { width: 1920, height: 1080 }
  });
  
  // ⚠️ CRITICAL: DO NOT BLOCK RESOURCES for report-sending mode
  // The table needs CSS to render the "-" characters correctly
  console.log('  ℹ️  Resource blocking: DISABLED (table needs full rendering)\n');
  
  const page = await context.newPage();
  
  // �️ CRASH DIAGNOSTICS: Setup listeners for self-diagnosis
  setupCrashDiagnostics(page);
  
  // F9 MANUAL TRIGGER: Press F9 anytime to save crash report
  await setupF9ManualTrigger(page);
  console.log('  [F9] Press anytime to save crash report\n');
  
  // �🔍 BLACK BOX DIAGNOSTICS: Listen to browser console
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      console.log(`🌐 [BROWSER ${type.toUpperCase()}]: ${text}`);
    }
  });
  console.log('  ✅ Browser console listener active (will show errors/warnings)\n');
  
  // Maximize window via CDP
  const session = await page.context().newCDPSession(page);
  const { windowId } = await session.send('Browser.getWindowForTarget');
  await session.send('Browser.setWindowBounds', {
    windowId,
    bounds: { windowState: 'maximized' }
  });
  
  try {
    // 🎯 STEP 1: DUAL STATE DETECTION (Check Success BEFORE Login)
    console.log('🔐 Step 1: Navigation & Authentication...');
    dashboard.updateStatus('🔐 Authenticating...', 'running');
    
    console.log('  → Navigating to root URL...');
    await page.goto('https://admin.iofarm.com/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Wait for page to settle
    await page.waitForTimeout(2000);
    
    // 🎯 SMART CHECK: First check if already authenticated (Success State)
    console.log('  → Checking authentication state...');
    const isLoggedIn = await page.locator('div.css-nd8svt a').first().isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isLoggedIn) {
      // ✅ SCENARIO A: Already Authenticated - Farm list is visible
      console.log('  ✅ Already authenticated (Farm list visible)');
      console.log('  → Skipping login flow\n');
      
    } else {
      // 🔒 SCENARIO B: Need to Login
      console.log('  → Farm list not visible, checking for login form...');
      
      let loginFormVisible = await page.locator('input[type="email"]').first().isVisible({ timeout: 5000 }).catch(() => false);
      
      if (!loginFormVisible) {
        console.log('  ⚠️  Login form not visible, performing safety reload...');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        
        // Check again for already logged in (after reload)
        const isLoggedInAfterReload = await page.locator('div.css-nd8svt a').first().isVisible({ timeout: 3000 }).catch(() => false);
        
        if (isLoggedInAfterReload) {
          console.log('  ✅ Already authenticated after reload (Farm list visible)');
          console.log('  → Skipping login flow\n');
        } else {
          // Check for login form after reload
          loginFormVisible = await page.locator('input[type="email"]').first().isVisible({ timeout: 5000 }).catch(() => false);
          
          if (!loginFormVisible) {
            // Take error screenshot to see what the browser is showing
            const errorScreenshot = path.join(CONFIG.screenshotDir, 'error-login-state.png');
            await page.screenshot({ path: errorScreenshot, fullPage: true });
            console.log(`  📸 ERROR SCREENSHOT SAVED: ${errorScreenshot}`);
            console.log('     → Check this screenshot to see what went wrong!');
            throw new Error('Login form not found after reload. Check error-login-state.png screenshot.');
          }
          
          // Proceed with login
          await performLogin();
        }
      } else {
        // Login form visible - proceed with login
        await performLogin();
      }
    }
    
    // 🔒 LOGIN ACTION FUNCTION - Uses robust login implementation
    async function performLogin() {
      console.log('  ✅ Login form visible, proceeding with authentication...');
      
      // Use the robust login function with aggressive clicking and retry
      await performRobustLogin(page);
      
      // Additional verification after redirect
      console.log('  📍 Post-login verification:');
      
      // Wait for network to stabilize
      console.log('  → Waiting for network to stabilize...');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        console.log('    ⚠️  Network not idle, continuing...');
      });
      console.log('    ✅ Network idle');
      
      // Wait for page load
      console.log('  → Waiting for page to be fully loaded...');
      await page.waitForLoadState('load', { timeout: 10000 });
      console.log('    ✅ Page loaded\n');
    }
    
    // 🎯 STEP 2: Navigate to Report Page
    const finalUrl = page.url();
    if (!finalUrl.includes('/report')) {
      console.log('  📍 Navigating to /report page...');
      await page.goto('https://admin.iofarm.com/report', { 
        waitUntil: 'domcontentloaded', 
        timeout: 20000 
      });
      console.log(`  ✅ At: ${page.url()}\n`);
    } else {
      console.log('  ✅ Already at /report page\n');
    }
    
    // 🎯 STEP 3: Final Verification - Wait for Farm List
    console.log('  → Waiting for farm list to appear...');
    await page.waitForSelector('div.css-nd8svt a', { 
      state: 'visible',
      timeout: 30000 
    });
    console.log('  ✅ Farm list loaded\n');
    
    // Step 5: Extract Farm List
    console.log('🏭 Step 2: Extracting farm list...');
    dashboard.updateStatus('📋 Loading farms...', 'running');
    
    const farmList = await page.evaluate(() => {
      const farms = [];
      const tabs = document.querySelector('[id*="tabs"][id*="content-point"]');
      if (tabs) {
        const farmContainer = tabs.querySelector('div > div:first-child > div:nth-child(2)');
        if (farmContainer) {
          const farmLinks = farmContainer.querySelectorAll('a[href*="/report/point/"]');
          farmLinks.forEach((link, idx) => {
            const text = link.textContent.trim();
            if (!text || text.length < 3 || text.length > 200) return;
            if (/\d{4}년|\d{2}월|\d{2}일/.test(text)) return;
            if (text.includes('전체 보기') || text.includes('저장')) return;
            farms.push({ 
              index: idx + 1, 
              name: text,
              href: link.getAttribute('href')
            });
          });
        }
      }
      return farms;
    });
    
    console.log(`  ✅ Found ${farmList.length} farms\n`);
    
    // Broadcast farm count
    if (dashboard) {
      dashboard.broadcast('update_farm_count', { count: farmList.length });
    }
    
    // Step 3: Calculate farm range
    const totalFarms = farmList.length;
    let startIndex = (config.startFrom > 0) ? (config.startFrom - 1) : 0;
    let maxCount = config.maxFarms || totalFarms;
    
    // Auto-correct if needed
    if (startIndex >= totalFarms) {
      startIndex = totalFarms - 1;
      console.warn(`⚠️  Auto-corrected start index to Farm #${startIndex + 1}\n`);
    }
    
    let endIndex = Math.min(startIndex + maxCount, totalFarms);
    const farmsToProcess = farmList.slice(startIndex, endIndex);
    
    console.log(`📋 Processing Plan:`);
    console.log(`   → Total farms: ${totalFarms}`);
    console.log(`   → Range: Farm #${startIndex + 1} to #${endIndex}`);
    console.log(`   → Count: ${farmsToProcess.length}\n`);
    
    // Step 4: Process each farm
    let reportsCreated = 0;
    let reportsSkipped = 0;
    
    for (let farmIdx = 0; farmIdx < farmsToProcess.length; farmIdx++) {
      const farm = farmsToProcess[farmIdx];
      const farmNumber = startIndex + farmIdx + 1;
      
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`🏭 Farm ${farmNumber}/${totalFarms}: ${farm.name}`);
      console.log(`${'═'.repeat(70)}\n`);
      
      dashboard.updateProgress(farmIdx + 1, farmsToProcess.length, farm.name);
      
      // Check for STOP
      if (dashboard && dashboard.checkIfStopped()) {
        console.log('\n⛔ STOP requested. Halting...\n');
        break;
      }
      
      // Construct the send-report URL
      const sendReportUrl = farm.href.replace('/report/point/', '/report/send-report/');
      const fullUrl = `https://admin.iofarm.com${sendReportUrl}`;
      
      console.log(`  🌐 Navigating to: ${fullUrl}`);
      
      try {
        // 🛡️ TIMEOUT SAFETY: Wrap in try/catch with explicit timeout
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        console.log('  ✅ Page loaded');
        
        // 🔍 CRITICAL: Wait for network to be idle (table data fully loaded)
        console.log('  ⏳ Waiting for table data to populate...');
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        console.log('  ✅ Network idle - table should be ready');
        
        // Additional safety: wait for table to exist
        await page.waitForSelector('table', { state: 'visible', timeout: 5000 });
        console.log('  ✅ Table element found\n');
        
        // Step 5: PRECISE TABLE VALIDATION
        console.log('  📊 Validating table data (PRECISE MODE)...');
        
        const validationResult = await page.evaluate(() => {
          // Find all tables on the page
          const tables = Array.from(document.querySelectorAll('table'));
          
          if (tables.length === 0) {
            return { 
              ready: false, 
              reason: 'No table found on page',
              debug: 'No <table> elements detected'
            };
          }
          
          // Use the last table (most likely the data table)
          const table = tables[tables.length - 1];
          const rows = Array.from(table.querySelectorAll('tbody tr'));
          
          if (rows.length === 0) {
            return { 
              ready: false, 
              reason: 'Table body is empty',
              debug: `Found ${tables.length} tables but tbody has no rows`
            };
          }
          
          console.log(`[BROWSER] Found table with ${rows.length} rows`);
          
          // Build a map of row labels to their last column value
          const dataMap = {};
          
          rows.forEach((row, idx) => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length < 2) return; // Skip rows without enough cells
            
            const label = cells[0].textContent.trim();
            const lastCellValue = cells[cells.length - 1].textContent.trim();
            
            dataMap[label] = lastCellValue;
            console.log(`[BROWSER] Row ${idx + 1}: "${label}" = "${lastCellValue}"`);
          });
          
          // 🎯 PRECISE VALIDATION RULES
          const checks = {
            nightMoisture: { 
              key: '야간 함수율 편차', 
              mustBe: '-', 
              actual: null, 
              pass: false 
            },
            lastIrrigationTime: { 
              key: '마지막 급액 시간', 
              mustBe: '-', 
              actual: null, 
              pass: false 
            },
            firstIrrigationTime: { 
              key: '첫 급액 시간', 
              mustNotBe: '-', 
              actual: null, 
              pass: false 
            },
            sunrise: { 
              key: '일출 시', 
              mustNotBe: '-', 
              actual: null, 
              pass: false 
            }
          };
          
          // Find matching rows (partial match on key)
          Object.keys(dataMap).forEach(label => {
            if (label.includes('야간 함수율 편차') || label.includes('야간함수율편차')) {
              checks.nightMoisture.actual = dataMap[label];
              checks.nightMoisture.pass = (dataMap[label] === '-' || dataMap[label] === '—');
            }
            if (label.includes('마지막 급액 시간') || label.includes('마지막급액시간')) {
              checks.lastIrrigationTime.actual = dataMap[label];
              checks.lastIrrigationTime.pass = (dataMap[label] === '-' || dataMap[label] === '—');
            }
            if (label.includes('첫 급액 시간') || label.includes('첫급액시간')) {
              checks.firstIrrigationTime.actual = dataMap[label];
              checks.firstIrrigationTime.pass = (dataMap[label] !== '-' && dataMap[label] !== '—' && dataMap[label] !== '');
            }
            if (label.includes('일출 시')) {
              checks.sunrise.actual = dataMap[label];
              checks.sunrise.pass = (dataMap[label] !== '-' && dataMap[label] !== '—' && dataMap[label] !== '');
            }
          });
          
          // Check if all conditions are met
          const failedChecks = [];
          
          if (!checks.nightMoisture.pass) {
            failedChecks.push(`야간 함수율 편차 must be "-" (got: "${checks.nightMoisture.actual || 'NOT FOUND'}")`);
          }
          if (!checks.lastIrrigationTime.pass) {
            failedChecks.push(`마지막 급액 시간 must be "-" (got: "${checks.lastIrrigationTime.actual || 'NOT FOUND'}")`);
          }
          if (!checks.firstIrrigationTime.pass) {
            failedChecks.push(`첫 급액 시간 must have data (got: "${checks.firstIrrigationTime.actual || 'NOT FOUND'}")`);
          }
          if (!checks.sunrise.pass) {
            failedChecks.push(`일출 시 must have data (got: "${checks.sunrise.actual || 'NOT FOUND'}")`);
          }
          
          const allPassed = failedChecks.length === 0;
          
          return {
            ready: allPassed,
            reason: allPassed 
              ? '✅ All validation checks passed' 
              : failedChecks.join(' | '),
            checks: checks,
            debug: `Rows found: ${rows.length}, Data map keys: ${Object.keys(dataMap).join(', ')}`
          };
        });
        
        console.log(`     → Ready to send: ${validationResult.ready ? '✅ YES' : '❌ NO'}`);
        console.log(`     → Reason: ${validationResult.reason}`);
        console.log(`     → Debug: ${validationResult.debug}\n`);
        
        if (validationResult.ready) {
          // Step 6: Click "리포트 생성" button
          console.log('  📤 All checks passed! Clicking "리포트 생성" button...');
          
          const buttonClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const reportButton = buttons.find(btn => 
              btn.textContent.includes('리포트 생성') || 
              btn.textContent.includes('리포트생성')
            );
            
            if (reportButton) {
              console.log('[BROWSER] Found "리포트 생성" button, clicking...');
              reportButton.click();
              return true;
            }
            console.error('[BROWSER] "리포트 생성" button not found');
            return false;
          });
          
          if (buttonClicked) {
            console.log('  ✅ Report sent successfully!\n');
            dashboard.log(`✅ Report sent for: ${farm.name}`, 'success');
            reportsCreated++;
            runStats.successCount++;
            await page.waitForTimeout(1500); // Brief wait for submission
          } else {
            console.log('  ⚠️  "리포트 생성" button not found on page\n');
            dashboard.log(`⚠️ Button not found for: ${farm.name}`, 'warning');
            reportsSkipped++;
          }
        } else {
          console.log('  ⚠️  Validation failed. Skipping report creation.\n');
          dashboard.log(`⚠️ Skipped ${farm.name}: ${validationResult.reason}`, 'warning');
          reportsSkipped++;
          runStats.skipCount++;
        }
        
        runStats.farmsCompleted++;
        
      } catch (error) {
        // 🛡️ TIMEOUT SAFETY: Catch and log, then continue
        console.log(`  ❌ Error processing farm (timeout or page issue):`);
        console.log(`     → ${error.message}`);
        console.log(`     → Force-continuing to next farm...\n`);
        dashboard.log(`❌ Timeout/Error on ${farm.name}: ${error.message}`, 'error');
        reportsSkipped++;
        runStats.errorCount++;
        
        // Take error screenshot
        try {
          const errorScreenshot = path.join(CONFIG.screenshotDir, `error-farm-${farmNumber}-${Date.now()}.png`);
          await page.screenshot({ path: errorScreenshot, fullPage: true });
          console.log(`     📸 Error screenshot: ${errorScreenshot}\n`);
        } catch (ssError) {
          console.log('     ⚠️  Could not save error screenshot\n');
        }
      }
    }
    
    // Summary
    console.log(`\n${'═'.repeat(70)}`);
    console.log('📊 REPORT SENDING SUMMARY');
    console.log(`${'═'.repeat(70)}`);
    console.log(`   ✅ Reports Created: ${reportsCreated}`);
    console.log(`   ⚠️  Reports Skipped: ${reportsSkipped}`);
    console.log(`   📋 Total Processed: ${runStats.farmsCompleted}`);
    console.log(`${'═'.repeat(70)}\n`);
    
    dashboard.updateStatus('✅ Report sending complete', 'success');
    dashboard.log(`Report sending complete: ${reportsCreated} sent, ${reportsSkipped} skipped`, 'success');
    
  } catch (error) {
    console.error('❌ Fatal error during report sending:', error);
    console.error('   Stack trace:', error.stack);
    dashboard.updateStatus('❌ Fatal error', 'error');
    dashboard.log(`Fatal error: ${error.message}`, 'error');
    
    // 🚨 SAVE CRASH REPORT for AI analysis
    try {
      const errorName = error.message.includes('Login') ? 'LoginFailed' : 
                        error.message.includes('timeout') ? 'Timeout' : 'ReportSendingError';
      await saveCrashReport(page, errorName, error);
    } catch (crashErr) {
      console.log(`   ⚠️ Could not save crash report: ${crashErr.message}`);
    }
  } finally {
    console.log('🔒 Closing browser...');
    await browser.close();
    console.log('✅ Browser closed\n');
  }
}

async function main() {
  console.log('🚀 Starting Irrigation Report Automation (Playwright)...\n');
  
  // Initialize and start dashboard server
  const dashboard = new DashboardServer();
  globalDashboard = dashboard; // Set global instance
  const dashboardUrl = await dashboard.start();
  console.log(`📊 Dashboard ready at: ${dashboardUrl}`);
  console.log(`   → Open this URL to configure and start automation\n`);
  
  // Wait for user to click "Start" in dashboard
  const config = await dashboard.waitUntilStarted();
  
  // 📊 Initialize Run Statistics Tracking
  const runStats = {
    timestamp: new Date().toISOString(),
    startTime: Date.now(),
    manager: config.manager,
    totalFarmsTargeted: config.maxFarms === 999 ? 'All' : config.maxFarms,
    startFromFarm: config.startFrom === 0 ? 1 : config.startFrom,
    farmsCompleted: 0,
    datesProcessed: 0,
    chartsClicked: 0,
    successCount: 0,
    skipCount: 0,
    errorCount: 0,
    dateRange: { start: null, end: null },
    mode: config.mode
  };
  
  // Apply configuration from dashboard
  CONFIG.targetName = config.manager;
  CONFIG.watchMode = (config.mode === 'watch');
  CONFIG.chartLearningMode = (config.mode === 'learning');
  
  // Update dashboard with selected manager
  dashboard.setManager(config.manager);
  dashboard.log('Automation starting with user configuration...', 'success');
  
  // Load learned offsets from previous training
  const learnedOffsets = loadLearningOffsets();
  if (learnedOffsets.count > 0) {
    console.log(`🎓 Loaded learning data from ${learnedOffsets.count} training sessions`);
    console.log(`   → Applying corrections: First(${learnedOffsets.firstX.toFixed(1)}, ${learnedOffsets.firstY.toFixed(1)}), Last(${learnedOffsets.lastX.toFixed(1)}, ${learnedOffsets.lastY.toFixed(1)})\n`);
    dashboard.log(`Loaded learning data from ${learnedOffsets.count} training sessions`, 'success');
  }
  
  // Show selected configuration
  console.log(`👤 Manager: ${config.manager}`);
  console.log(`🏭 Start From: ${config.startFrom === 0 ? 'All farms' : 'Farm #' + config.startFrom}`);
  console.log(`📊 Mode: ${config.mode}`);
  console.log(`🔢 Max Farms: ${config.maxFarms === 999 ? 'All' : config.maxFarms}`);
  
  if (CONFIG.watchMode) {
    console.log(`👁️  WATCH MODE: Script will observe but not interfere`);
    dashboard.log('Watch mode enabled', 'info');
  } else if (CONFIG.chartLearningMode) {
    console.log(`🎓 LEARNING MODE: Will pause for corrections`);
    dashboard.log('Learning mode enabled', 'info');
  } else if (config.mode === 'report-sending') {
    console.log(`📤 REPORT SENDING MODE: Will validate and send reports`);
    dashboard.log('Report sending mode enabled', 'success');
  }
  console.log();

  // 📤 ROUTE: If report-sending mode, use specialized function
  if (config.mode === 'report-sending') {
    await runReportSending(config, dashboard, runStats);
    return;
  }

  // Launch browser with maximized window
  dashboard.updateStatus('🚀 Launching browser...', 'running');
  dashboard.updateStep('Initializing browser', 5);
  
  const browser = await chromium.launch({
    headless: false,         // ✅ FORCE VISIBLE (not background)
    channel: 'chrome',       // ✅ Use real Chrome (not Chromium)
    args: [
      '--start-maximized',   // Start with maximized window
      '--window-position=0,0' // Position at top-left
    ]
  });
  
  const context = await browser.newContext({
    viewport: null,  // Use full window size (no fixed viewport)
    screen: { width: 1920, height: 1080 }
  });
  
  // Open automation page
  const page = await context.newPage();
  
  // �️ CRASH DIAGNOSTICS: Setup listeners for self-diagnosis
  setupCrashDiagnostics(page);
  
  // F9 MANUAL TRIGGER: Press F9 anytime to save crash report
  await setupF9ManualTrigger(page);
  console.log('  [F9] Press anytime to save crash report\n');
  
  // �🔒 AUTHENTICATION FIX: No resource blocking - allow all auth scripts to run
  console.log('🔒 Authentication mode: All resources enabled for stable login');
  dashboard.log('Browser launched successfully', 'success');
  dashboard.log(`Dashboard accessible at ${dashboardUrl}`, 'success');
  
  // Maximize the window using CDP
  const session = await page.context().newCDPSession(page);
  const { windowId } = await session.send('Browser.getWindowForTarget');
  await session.send('Browser.setWindowBounds', {
    windowId,
    bounds: { windowState: 'maximized' }
  });
  
  try {
    // Step 1: Navigate to IoFarm admin report page
    console.log('📍 Step 1: Navigating to admin.iofarm.com/report/...');
    dashboard.updateStatus('🌐 Navigating to report page...', 'running');
    dashboard.updateStep('Step 1: Navigating to report page', 10);
    dashboard.log('Navigating to admin.iofarm.com/report/', 'info');
    
    await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('domcontentloaded');
    
    // ⚡ SMART: Wait for body and ensure page is interactive
    console.log('  → Waiting for page to be interactive...');
    await page.waitForSelector('body', { state: 'attached', timeout: 5000 });
    await page.waitForLoadState('load').catch(() => {}); // Allow some extra loading time
    
    // Show current URL
    const currentUrl1 = page.url();
    console.log(`  → Current URL: ${currentUrl1}`);
    dashboard.log(`Current URL: ${currentUrl1}`, 'info');
    
    // Take screenshot to verify we're on the right page
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const screenshotPath = path.join(CONFIG.screenshotDir, `1-homepage-${timestamp}.png`);
    await takeScreenshot(page, screenshotPath);
    console.log(`✅ Report page loaded. Screenshot saved: ${screenshotPath}\n`);
    dashboard.log('Report page loaded successfully', 'success');
    
    // Step 2: Check if login is needed, if so, login
    console.log('🔐 Step 2: Checking if login is required...');
    dashboard.updateStatus('🔐 Checking authentication...', 'running');
    
    try {
      // ⚡ SMART: Wait for page to be ready before checking for login form
      await page.waitForLoadState('domcontentloaded');
      console.log('  → Checking for login form...');
      
      // Check if we're already authenticated by looking for authenticated elements
      const alreadyAuthenticated = await page.evaluate(() => {
        // Look for farm list container (only visible when authenticated)
        const farmContainer = document.querySelector('[id*="tabs"][id*="content-point"]');
        const hasAuthenticatedContent = farmContainer !== null;
        const isOnLoginPage = window.location.href.includes('/login') || window.location.href.includes('/signin');
        return hasAuthenticatedContent && !isOnLoginPage;
      });
      
      if (alreadyAuthenticated) {
        console.log('  ✅ Already authenticated! Farm list is visible.');
        console.log(`  → Current URL: ${page.url()}\n`);
        dashboard.log('Already authenticated', 'success');
      } else {
        // Check if login form exists
        const loginFormExists = await page.locator('input[type="email"], input[type="text"], input[name="email"], input[name="username"]').first().isVisible({ timeout: 5000 }).catch(() => false);
        
        if (loginFormExists) {
          console.log('  → Login form detected, proceeding with ROBUST login...');
          dashboard.updateStatus('🔐 Logging in...', 'running');
          
          // Use the robust login function with aggressive clicking and retry
          await performRobustLogin(page);
          
          // Wait for network to stabilize after login
          console.log('  📍 Post-login stabilization:');
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
            console.log('     ⚠️  Network not idle after 10s, continuing...');
          });
          console.log('     ✅ Network idle');
          
          // Navigate to report page if not already there
          const currentUrl = page.url();
          if (!currentUrl.includes('/report')) {
            console.log('  📍 Navigating to /report page...');
            await page.goto('https://admin.iofarm.com/report', { 
              waitUntil: 'networkidle',
              timeout: 20000 
            });
            console.log(`  ✅ Navigated to: ${page.url()}`);
          }
          
          // 🎯 CRITICAL: Final verification - wait for farm list to be visible
          console.log('  🎯 Final verification: Looking for farm list...');
          
          try {
            await page.waitForSelector('[id*="tabs"][id*="content-point"]', { 
              state: 'visible', 
              timeout: 15000 
            });
            console.log('     ✅ Farm list container is visible');
          } catch (e) {
            console.log(`     ❌ Farm list container not found: ${e.message}`);
            const debugUrl = page.url();
            console.log(`     → Current URL: ${debugUrl}`);
            
            // Take debug screenshot
            const debugScreenshot = path.join(CONFIG.screenshotDir, `debug-no-farms-${timestamp}.png`);
            await page.screenshot({ path: debugScreenshot, fullPage: true });
            console.log(`     → Debug screenshot: ${debugScreenshot}`);
            
            // If still on login page, throw error
            if (debugUrl.includes('/login') || debugUrl.includes('/signin')) {
              throw new Error('Still on login page after authentication - credentials may be incorrect');
            }
          }
          
          // Wait for farm links to populate
          console.log('     → Waiting for farm links to populate...');
          await page.waitForSelector('div.css-nd8svt a[href*="/report/point/"]', { 
            state: 'visible', 
            timeout: 30000 
          });
          console.log('     ✅ Farm links are visible and ready\n');
          
          const loginScreenshot = path.join(CONFIG.screenshotDir, `2-after-login-${timestamp}.png`);
          await page.screenshot({ path: loginScreenshot, fullPage: true });
          console.log(`✅ Login completed successfully. Screenshot: ${loginScreenshot}\n`);
          dashboard.log('Login successful', 'success');
          
        } else {
          console.log('  ✅ No login form found, checking if already authenticated...');
          const currentUrl = page.url();
          console.log(`  → Current URL: ${currentUrl}\n`);
          
          // Verify we're on the right page
          if (currentUrl.includes('/report') || await page.isVisible('[id*="tabs"]')) {
            console.log('  ✅ Already on authenticated page\n');
            dashboard.log('Already authenticated', 'success');
          } else {
            console.log('  ⚠️  Unclear authentication state, will attempt to continue...\n');
          }
        }
      }
      
    } catch (loginError) {
      console.log('❌ Login process failed. Error:', loginError.message);
      console.log('   Stack:', loginError.stack);
      console.log('   → Taking error screenshot...');
      
      const errorScreenshot = path.join(CONFIG.screenshotDir, `error-login-${timestamp}.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`   → Error screenshot: ${errorScreenshot}\n`);
      
      dashboard.log('Login failed: ' + loginError.message, 'error');
      throw loginError; // Re-throw to stop execution
    }
    
    // Step 3: Wait for manager's irrigation to show up
    console.log(`📊 Step 3: Waiting for "${CONFIG.targetName}'s irrigation" to appear...`);
    
    try {
      // Show current URL
      const currentUrl3 = page.url();
      console.log(`  → Current URL: ${currentUrl3}`);
      
      // ⚡ FAST: Wait for main content container
      await page.waitForSelector('body', { state: 'visible', timeout: 3000 }).catch(() => {});
      
      // Get page title for verification
      const pageTitle = await page.title();
      console.log(`  → Page Title: "${pageTitle}"`);
      
      // Look for text containing manager name and "irrigation" or "관수"
      const searchTexts = [
        `${CONFIG.targetName}'s irrigation`,
        `${CONFIG.targetName}`,
        '관수',
        'irrigation',
        'report',
        '리포트'
      ];
      
      console.log('  → Searching for target elements...');
      
      // Check if any of these texts appear on the page
      let foundTarget = false;
      for (const searchText of searchTexts) {
        try {
          const element = page.locator(`text=${searchText}`).first();
          if (await element.isVisible({ timeout: 2000 })) {
            console.log(`  ✅ Found: "${searchText}"`);
            foundTarget = true;
          }
        } catch (e) {
          // Text not found, try next
          continue;
        }
      }
      
      if (!foundTarget) {
        console.log(`  ⚠️  Could not find "${CONFIG.targetName}'s irrigation" text`);
        console.log('     → Might be on the page but with different formatting');
      }
      
      // Get all visible text on page for debugging
      const bodyText = await page.locator('body').textContent();
      const firstChars = bodyText?.substring(0, 200).replace(/\s+/g, ' ').trim();
      console.log(`  → First 200 chars of page: "${firstChars}..."`);
      
      // Take screenshot regardless
      const targetScreenshot = path.join(CONFIG.screenshotDir, `3-target-page-${timestamp}.png`);
      await page.screenshot({ path: targetScreenshot, fullPage: true });
      console.log(`📸 Screenshot saved: ${targetScreenshot}\n`);
      
    } catch (searchError) {
      console.log('⚠️  Error while searching for target. Error:', searchError.message);
      
      // Take screenshot
      const errorScreenshot = path.join(CONFIG.screenshotDir, `3-search-error-${timestamp}.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`📸 Error screenshot saved: ${errorScreenshot}\n`);
    }
    
    // Step 4: Click manager radio button to select that manager
    console.log(`🎯 Step 4: Selecting "${CONFIG.targetName}" manager...`);
    
    try {
      // Use JavaScript to click the radio button (more reliable than Playwright click)
      const radioClicked = await page.evaluate((managerName) => {
        // Find radio button by label text
        const labels = Array.from(document.querySelectorAll('label'));
        const managerLabel = labels.find(label => label.textContent.includes(managerName));
        if (managerLabel) {
          managerLabel.click();
          return true;
        }
        
        // Fallback: try input directly
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        const managerRadio = radios.find(radio => 
          radio.id.includes(managerName) || radio.value.includes(managerName)
        );
        if (managerRadio) {
          managerRadio.click();
          return true;
        }
        
        return false;
      }, CONFIG.targetName); // Pass the manager name from CONFIG
      
      if (radioClicked) {
        console.log(`  ✅ Clicked "${CONFIG.targetName}" radio button via JavaScript`);
        // ⚡ FAST: No wait needed after JavaScript click
        
        const step4Screenshot = path.join(CONFIG.screenshotDir, `4-selected-manager-${timestamp}.png`);
        await page.screenshot({ path: step4Screenshot, fullPage: true });
        console.log(`  📸 Screenshot: ${step4Screenshot}\n`);
      } else {
        console.log(`  ⚠️  Could not find "${CONFIG.targetName}" radio button\n`);
      }
    } catch (error) {
      console.log(`  ⚠️  Error clicking "${CONFIG.targetName}" radio: ${error.message}\n`);
    }
    
    // Step 5: Get all farms from the list and loop through them
    console.log('🏭 Step 5: Getting list of all farms...');
    
    // 🎯 Ensure farm list container is ready before extraction
    console.log('  → Verifying farm list container is present...');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[id*="tabs"][id*="content-point"]', { state: 'visible', timeout: 15000 }).catch(() => {
      console.log('  ⚠️  Warning: Farm list container not found!');
    });
    
    // ⚡ SMART: Extended wait for farm links to ensure SPA has fully rendered
    console.log('  → Waiting for farm links to populate...');
    await page.waitForSelector('div.css-nd8svt a[href*="/report/point/"]', { state: 'visible', timeout: 30000 });
    console.log('  ✅ Farm links are visible and ready');
    
    let farmList = [];
    try {
      farmList = await page.evaluate(() => {
        const farms = [];
        const tabs = document.querySelector('[id*="tabs"][id*="content-point"]');
        if (tabs) {
          // CRITICAL FIX: Find individual <a> elements, not the parent container
          const farmContainer = tabs.querySelector('div > div:first-child > div:nth-child(2)');
          
          if (!farmContainer) {
            console.error('[BROWSER] ❌ Farm container not found!');
            return farms;
          }
          
          // Find all <a> tags (each represents one farm)
          const farmLinks = farmContainer.querySelectorAll('a[href*="/report/point/"]');
          console.log(`[BROWSER] Found ${farmLinks.length} farm links`);
          
          farmLinks.forEach((link, idx) => {
            const text = link.textContent.trim();
            
            // BUGFIX: Filter out invalid elements
            if (!text || text.length < 3 || text.length > 200) return;
            if (/\d{4}년|\d{2}월|\d{2}일/.test(text)) return; // Skip dates
            if (text.includes('전체 보기') || text.includes('저장')) return; // Skip UI buttons
            if (text.includes('Created with') || text.includes('Highcharts')) return; // Skip chart
            if (/^\d{2}:\d{2}/.test(text)) return; // Skip if starts with time
            if (text.startsWith('구역')) return; // Skip table labels
            
            console.log(`[BROWSER] ✓ Valid farm #${idx + 1}: ${text}`);
            farms.push({ index: idx + 1, name: text });
          });
        }
        return farms;
      });
      
      console.log(`  ✅ Found ${farmList.length} farms`);
      farmList.forEach((farm, idx) => {
        console.log(`     [${idx + 1}] ${farm.name}`);
      });
      console.log('');
      
      // 📡 SYNC: Broadcast real farm count to dashboard
      if (dashboard) {
        dashboard.broadcast('update_farm_count', { count: farmList.length });
        console.log(`  📡 Broadcasted farm count to dashboard: ${farmList.length}\n`);
      }
    } catch (error) {
      console.log(`  ⚠️  Error getting farm list: ${error.message}`);
      console.log('  → Will try processing just the first farm\n');
      farmList = [{ index: 1, name: 'First Farm (fallback)' }];
    }
    
    // Array to store all farm data
    const allFarmData = [];
    
    // 📅 EXPLICIT DATE CALCULATION: Define "Today" and calculate past 5 days
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight
    
    console.log('\n📅 Date Range Configuration:');
    console.log(`   → Today: ${today.toLocaleDateString('ko-KR')}`);
    console.log(`   → Method: Direct URL navigation with explicit date parameters`);
    console.log(`   → Range: Today (T-0) back to 5 days ago (T-5)\n`);
    
    // --- NEW FARM ITERATION LOGIC ---
    // Get configuration from dashboard
    const dashboardConfig = dashboard.getConfig();
    const totalFarms = farmList.length;
    
    // Parse config (dashboard sends 1-based index for 'startFrom', 0 means 'all')
    let startIndex = (dashboardConfig.startFrom > 0) ? (dashboardConfig.startFrom - 1) : 0;
    let maxCount = dashboardConfig.maxFarms || totalFarms;
    
    // 🛡️ SAFETY AUTO-CORRECT: Validate and clamp startIndex if invalid
    if (startIndex >= totalFarms) {
      const requestedFarm = startIndex + 1;
      startIndex = totalFarms - 1; // Clamp to last available farm
      const warningMsg = `⚠️ Request for Farm #${requestedFarm} exceeds limit (${totalFarms} farms exist). Auto-correcting to start from Farm #${startIndex + 1}.`;
      console.warn(`\n${warningMsg}\n`);
      if (dashboard) {
        dashboard.log(warningMsg, 'warning');
        dashboard.updateStatus('⚠️ Auto-corrected configuration', 'running');
      }
    }
    
    // 🛡️ SAFETY: Ensure endIndex never exceeds totalFarms
    let endIndex = Math.min(startIndex + maxCount, totalFarms);
    
    console.log(`\n📋 Farm Processing Plan:`);
    console.log(`   → Total available: ${totalFarms}`);
    console.log(`   → Starting at: Farm #${startIndex + 1}`);
    console.log(`   → Stopping at: Farm #${endIndex}`);
    console.log(`   → Batch size: ${endIndex - startIndex} farms\n`);
    
    // Slice the array to get only the farms we want to process
    const farmsToProcess = farmList.slice(startIndex, endIndex);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🏭 FARM LOOP (OUTER) - Process each farm with try/catch for robustness
    // ═══════════════════════════════════════════════════════════════════════════
    for (let farmIdx = 0; farmIdx < farmsToProcess.length; farmIdx++) {
      // Get current config (may have been updated via "Add More Farms")
      const currentConfig = dashboard.getConfig();
      
      // Check if we've reached the current maxFarms limit
      if (farmIdx >= currentConfig.maxFarms) {
        console.log(`\n✅ Reached maxFarms limit (${currentConfig.maxFarms}). Stopping farm processing.\n`);
        dashboard.log(`Completed processing ${currentConfig.maxFarms} farms`, 'success');
        break;
      }
      // Check if user pressed STOP
      if (dashboard && dashboard.checkIfStopped()) {
        console.log('\n⛔ STOP requested by user. Halting farm processing...\n');
        dashboard.log('Processing stopped by user', 'warning');
        dashboard.updateStatus('⛔ Stopped by user', 'paused');
        break; // Exit the farm loop
      }
      
      // Check if mode was changed (live update - reuse currentConfig from above)
      if (currentConfig.mode === 'learning' && !CONFIG.chartLearningMode) {
        CONFIG.chartLearningMode = true;
        CONFIG.watchMode = false;
        console.log('✅ Switched to Learning Mode');
        dashboard.log('Learning Mode activated', 'success');
      } else if (currentConfig.mode === 'normal' && CONFIG.chartLearningMode) {
        CONFIG.chartLearningMode = false;
        CONFIG.watchMode = false;
        console.log('✅ Switched to Normal Mode');
        dashboard.log('Normal Mode activated', 'success');
      } else if (currentConfig.mode === 'watch' && !CONFIG.watchMode) {
        CONFIG.watchMode = true;
        CONFIG.chartLearningMode = false;
        console.log('✅ Switched to Watch Mode');
        dashboard.log('Watch Mode activated', 'success');
      }
      
      // Get current farm from the sliced array
      const currentFarm = farmsToProcess[farmIdx];
      const actualFarmIndex = startIndex + farmIdx; // Calculate actual index in original farmList for clicking
      
      console.log(`\n${'='.repeat(70)}`);
      console.log(`🏭 Processing Farm ${farmIdx + 1}/${farmsToProcess.length}: ${currentFarm.name} (Farm #${actualFarmIndex + 1} of ${totalFarms})`);
      console.log(`${'='.repeat(70)}\n`);
      
      // Update dashboard progress (reuse currentConfig from above)
      if (dashboard) {
        dashboard.updateProgress(farmIdx + 1, farmsToProcess.length, currentFarm.name);
      }
      
      // 🛡️ ROBUST TRY/CATCH: Wrap entire farm processing so failures don't stop the loop
      try {
      
      // Set up network interception to capture chart data
      console.log('  🌐 Setting up network interception...');
      const networkData = setupNetworkInterception(page);
      
      // Click the farm - MODERN APPROACH (Scroll + Force Click + Validate)
      try {
        console.log(`  🎯 Attempting to click farm: "${currentFarm.name}"`);
        
        // CRITICAL: Re-locate the element inside the loop using the SAME selector that found the farms
        const farmContainer = page.locator('div.css-nd8svt');
        const farmLink = farmContainer.locator('a[href*="/report/point/"]').nth(actualFarmIndex);
        
        // ⚡ SUPER FAST: Parallel execution - Setup trap, scroll, click, validate
        console.log(`     → Setting up navigation trap...`);
        
        // Step 1: Setup the navigation promise (the "trap")
        const navigationPromise = page.waitForURL('**/report/point/**', { timeout: 5000 }).catch(() => null);
        
        // Step 2: Scroll into view (no wait for animation)
        await farmLink.scrollIntoViewIfNeeded();
        
        // Step 3: Get target URL for logging
        const expectedHref = await farmLink.getAttribute('href');
        console.log(`     → Target URL: ${expectedHref}`);
        
        // Step 4: Click with noWaitAfter (instant, non-blocking)
        console.log(`     → Clicking farm link...`);
        await farmLink.click({ force: true, noWaitAfter: true });
        
        // Step 5: Await the trap (waits for URL change)
        console.log(`     → Waiting for navigation...`);
        const navSuccess = await navigationPromise;
        
        if (navSuccess !== null) {
          const currentURL = page.url();
          console.log(`  ✅ Successfully navigated to farm "${currentFarm.name}"`);
          console.log(`     → URL: ${currentURL}`);
          
          // ⚡ FAST: Wait for main content to be visible
          await page.waitForSelector('div.css-nd8svt', { state: 'visible', timeout: 3000 }).catch(() => {});
        } else {
          console.log(`  ⚠️  Navigation timeout - URL did not change`);
          console.log(`     → Skipping this farm...
`);
          continue;
        }
      } catch (error) {
        console.log(`  ⚠️  Error clicking farm: ${error.message}`);
        console.log(`     → This could be due to: element detached, timeout, or network issue`);
        console.log(`     → Skipping this farm...
`);
        continue;
      }
    
      // 🌐 Get the base farm URL (without date parameter) for later navigation
      const baseFarmUrl = page.url().split('?')[0]; // Remove any existing query params
      const urlParams = new URL(page.url()).searchParams;
      const manager = urlParams.get('manager') || CONFIG.targetName;
      const farmUrlWithManager = `${baseFarmUrl}?manager=${encodeURIComponent(manager)}`;
      
      console.log(`  🔗 Base farm URL: ${farmUrlWithManager}\n`);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 📅 DATE LOOP (INNER) - Process dates from 5 days ago → Today
    //    Using DIRECT URL NAVIGATION instead of clicking Previous/Next buttons
    // ═══════════════════════════════════════════════════════════════════════════
    const totalDaysToCheck = 6; // T-5 to T-0 (6 days total)
    let dateIdx = 0;
    const farmDateData = []; // Store data for all dates of this farm
    
    // 🔄 FIXED: Loop from 5 → 0 (5 days ago to Today)
    for (let dayOffset = 5; dayOffset >= 0; dayOffset--) {
      dateIdx++;
      
      // 📅 CALCULATE TARGET DATE EXPLICITLY
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - dayOffset); // Subtract days to go into past
      
      // Format date as YYYY-MM-DD for URL parameter
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      // Format for Korean display
      const koreanDate = targetDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
      
      console.log(`\n  📅 Processing Date ${dateIdx}/${totalDaysToCheck}: ${koreanDate} (${dateString}) - T-${dayOffset} days`);
      console.log(`  ${'─'.repeat(70)}`);
      
      // 🌐 DIRECT URL NAVIGATION: Construct URL with explicit date parameter
      const currentUrl = new URL(page.url());
      currentUrl.searchParams.set('date', dateString);
      currentUrl.searchParams.set('manager', manager);
      const targetUrl = currentUrl.toString();
      
      console.log(`  🌐 Direct URL navigation to: ${targetUrl}`);
      
      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        console.log(`  ✅ Loaded page for date: ${dateString}`);
        
        // Wait for main content to be visible
        await page.waitForSelector('div.css-nd8svt', { state: 'visible', timeout: 5000 }).catch(() => {
          console.log('  ⚠️  Main content selector not found (may be normal)');
        });
      } catch (navError) {
        console.log(`  ❌ Failed to navigate to date ${dateString}: ${navError.message}`);
        console.log(`  → Skipping this date...\n`);
        continue; // Skip to next date
      }
      
      // Verify the date loaded correctly by reading the date picker
      const displayedDate = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button.chakra-button'));
        const dateButton = buttons.find(btn => {
          const hasSvg = btn.querySelector('svg rect[x="3"][y="4"][width="18"][height="18"]');
          const hasDateText = btn.textContent.includes('년') && btn.textContent.includes('일');
          return hasSvg && hasDateText;
        });
        
        if (dateButton) {
          return dateButton.textContent.trim();
        }
        return 'Unknown Date';
      });
      
      console.log(`  📍 Displayed date on page: ${displayedDate}`);
      
      // Check if user pressed STOP
      if (dashboard && dashboard.checkIfStopped()) {
        console.log('\n⛔ STOP requested. Halting date processing...\n');
        break; // Exit date loop
      }
      
      // Check if mode was changed (live update)
      const currentConfig = dashboard.getConfig();
      if (currentConfig.mode === 'learning' && !CONFIG.chartLearningMode) {
        CONFIG.chartLearningMode = true;
        CONFIG.watchMode = false;
        console.log('  ✅ Mode switched to: Learning');
      } else if (currentConfig.mode === 'normal' && CONFIG.chartLearningMode) {
        CONFIG.chartLearningMode = false;
        CONFIG.watchMode = false;
        console.log('  ✅ Mode switched to: Normal');
      } else if (currentConfig.mode === 'watch' && !CONFIG.watchMode) {
        CONFIG.watchMode = true;
        CONFIG.chartLearningMode = false;
        console.log('  ✅ Mode switched to: Watch');
      }
      
      // Step 2: Check if tables are already filled for this date
      console.log('  💧 Checking irrigation time tables...');
      
      try {
        // ⚡ FAST: No wait needed - table data is already loaded
        // Check the two table fields - look specifically in the right panel
        const tableStatus = await page.evaluate(() => {
        const results = { debug: [] };
        
        // Target exact labels
        const firstTimeLabel = '구역 1 첫 급액 시간 1 (시분)';
        const lastTimeLabel = '구역 1 마지막 급액 시간 1 (시분)';
        
        let firstTimeValue = null;
        let lastTimeValue = null;
        
        // Strategy: Find headings with exact text, then look for input/display below
        const allElements = Array.from(document.querySelectorAll('*'));
        
        allElements.forEach(elem => {
          const text = (elem.textContent || '').trim();
          
          // Must match EXACTLY the label (to avoid picking up "진우")
          if (text.includes('첫 급액 시간') && elem.children.length === 0) {
            results.debug.push(`Found first label: ${elem.tagName}`);
            
            // Look in parent container for input or value display
            let container = elem.closest('div, section, article');
            if (container) {
              // Look for input field
              const input = container.querySelector('input[type="text"], input:not([type])');
              if (input) {
                firstTimeValue = input.value || input.placeholder;
                results.debug.push(`First value from input: "${firstTimeValue}"`);
              }
              
              // Or look for display text in sibling/child
              if (!firstTimeValue) {
                const siblings = Array.from(container.children);
                siblings.forEach(sib => {
                  const sibText = sib.textContent.trim();
                  if (sibText && sibText !== firstTimeLabel && sibText.length < 20) {
                    if (!firstTimeValue || sibText.includes(':')) {
                      firstTimeValue = sibText;
                      results.debug.push(`First value from sibling: "${sibText}"`);
                    }
                  }
                });
              }
            }
          }
          
          if (text.includes('마지막 급액 시간') && elem.children.length === 0) {
            results.debug.push(`Found last label: ${elem.tagName}`);
            
            let container = elem.closest('div, section, article');
            if (container) {
              const input = container.querySelector('input[type="text"], input:not([type])');
              if (input) {
                lastTimeValue = input.value || input.placeholder;
                results.debug.push(`Last value from input: "${lastTimeValue}"`);
              }
              
              if (!lastTimeValue) {
                const siblings = Array.from(container.children);
                siblings.forEach(sib => {
                  const sibText = sib.textContent.trim();
                  if (sibText && sibText !== lastTimeLabel && sibText.length < 20) {
                    if (!lastTimeValue || sibText.includes(':')) {
                      lastTimeValue = sibText;
                      results.debug.push(`Last value from sibling: "${sibText}"`);
                    }
                  }
                });
              }
            }
          }
        });
        
        // Clean up values - remove the label text if it got included
        if (firstTimeValue && firstTimeValue.includes(firstTimeLabel)) {
          firstTimeValue = firstTimeValue.replace(firstTimeLabel, '').trim();
        }
        if (lastTimeValue && lastTimeValue.includes(lastTimeLabel)) {
          lastTimeValue = lastTimeValue.replace(lastTimeLabel, '').trim();
        }
        
        return {
          firstTime: firstTimeValue,
          lastTime: lastTimeValue,
          needsFirstClick: !firstTimeValue || firstTimeValue === '' || firstTimeValue === '-' || firstTimeValue === '--:--' || firstTimeValue.includes('클릭'),
          needsLastClick: !lastTimeValue || lastTimeValue === '' || lastTimeValue === '-' || lastTimeValue === '--:--' || lastTimeValue.includes('클릭'),
          debug: results.debug
        };
      });
      
        console.log(`     → Debug: ${tableStatus.debug.join(', ')}`);
        console.log(`     → 첫 급액시간: "${tableStatus.firstTime || 'EMPTY'}"`);
        console.log(`     → 마지막 급액시간: "${tableStatus.lastTime || 'EMPTY'}"`);
        console.log(`     → Needs first click: ${tableStatus.needsFirstClick}`);
        console.log(`     → Needs last click: ${tableStatus.needsLastClick}\n`);
        
        // Check if tables are already completely filled
        const tablesAlreadyFilled = !tableStatus.needsFirstClick && !tableStatus.needsLastClick;
        
        if (tablesAlreadyFilled) {
          console.log(`     ✅ Tables already filled for this date - NO MODIFICATION NEEDED`);
          console.log(`        → Existing First: ${tableStatus.firstTime}`);
          console.log(`        → Existing Last: ${tableStatus.lastTime}`);
          console.log(`        → Skipping HSSP algorithm (preserving existing data)\n`);
          
          // Store the existing data without running detection
          const dateData = {
            date: displayedDate,
            firstIrrigationTime: tableStatus.firstTime,
            lastIrrigationTime: tableStatus.lastTime,
            extractedAt: new Date().toISOString(),
            alreadyFilled: true
          };
          farmDateData.push(dateData);
          
          // 📊 Track skip
          runStats.skipCount++;
          runStats.datesProcessed++;
          if (!runStats.dateRange.start) runStats.dateRange.start = displayedDate;
          runStats.dateRange.end = displayedDate;
          
          // Take screenshot
          const skipScreenshot = path.join(CONFIG.screenshotDir, `farm-${farmIdx + 1}-date-${dateIdx}-skipped-${timestamp}.png`);
          await page.screenshot({ path: skipScreenshot, fullPage: true });
          console.log(`     📸 Screenshot: ${skipScreenshot}\n`);
          
          // ✅ Direct URL navigation handles date change - no button click needed
          continue; // Skip to next date
        }
        
        // If either field is empty, click the chart points
        if (tableStatus.needsFirstClick || tableStatus.needsLastClick) {
        console.log('  ⚠️  Tables need data, clicking chart points...\n');
        
        // NETWORK INTERCEPTION APPROACH (Replaces Highcharts DOM access)
        console.log('  ⏳ Waiting for chart data from network...');
        try {
          // Wait for the API response to be captured
          const chartData = await waitForChartData(networkData, 10000);
          console.log('  ✅ Chart data successfully captured from network!\n');
          
          // 🎨 CRITICAL FIX: Wait for Highcharts to render the visual SVG graph
          console.log('  ⏳ Waiting for chart SVG to render...');
          try {
            await page.waitForSelector('.highcharts-series-0 path.highcharts-graph, .highcharts-root path', { 
              state: 'visible', 
              timeout: 5000 
            });
            console.log('  ✅ Chart SVG is visible');
            
            // Small safety buffer to ensure animation completes
            await page.waitForTimeout(500);
            console.log('  ✅ Chart render animation complete\n');
          } catch (svgWaitError) {
            console.log(`  ⚠️  Chart SVG wait timeout: ${svgWaitError.message}`);
            console.log('  → Will attempt to continue anyway...\n');
          }
          
          // Extract normalized data points
          const dataPoints = extractDataPoints(chartData);
          
          if (!dataPoints || dataPoints.length < 10) {
            console.log('  ⚠️  Insufficient data points for analysis');
            console.log(`     → Got ${dataPoints?.length || 0} points, need at least 10`);
            console.log('     → Skipping chart interaction for this date\n');
            
            // ✅ Direct URL navigation handles date change - no button click needed
            continue; // Skip to next date
          }
          
          console.log(`  📊 Analyzing ${dataPoints.length} data points for irrigation events...`);
          
          // 🔬 ROLLING WINDOW & LOCAL MINIMUM Algorithm
          // Purpose: Catch gentle sustained rises + Find absolute valley bottom
          
          const yValues = dataPoints.map(p => p.y);
          const maxY = Math.max(...yValues);
          const minY = Math.min(...yValues);
          const yRange = maxY - minY;
          
          console.log(`     → Y range: ${minY.toFixed(2)} to ${maxY.toFixed(2)} (span: ${yRange.toFixed(2)})`);
          
          // ROLLING WINDOW PARAMETERS
          const SURGE_WINDOW = 5;       // Compare with 5 minutes ago (catches slow rises)
          const SURGE_THRESHOLD = Math.max(0.02, yRange * 0.015); // 1.5% or 0.02, whichever higher
          const LOOKBACK_WINDOW = 20;   // Look back 20 minutes to find valley
          const DEBOUNCE_MINUTES = 30;  // Minutes between events
          
          console.log(`     → Surge window: ${SURGE_WINDOW} minutes`);
          console.log(`     → Surge threshold: ${SURGE_THRESHOLD.toFixed(4)} (sustained rise detection)`);
          console.log(`     → Lookback window: ${LOOKBACK_WINDOW} minutes (valley search)`);
          
          const allEvents = [];
          let lastEventIndex = -DEBOUNCE_MINUTES;
          
          // SCAN: Start after enough data for the window
          for (let i = SURGE_WINDOW; i < dataPoints.length - 5; i++) {
            const currentVal = dataPoints[i].y;
            const pastVal = dataPoints[i - SURGE_WINDOW].y;
            const diff = currentVal - pastVal;
            
            // DETECT: Sustained Rise (comparing 5-min window)
            if (diff > SURGE_THRESHOLD && i > lastEventIndex + DEBOUNCE_MINUTES) {
              console.log(`     → Sustained rise detected at index ${i} (5-min rise: ${diff.toFixed(4)})`);
              
              // FIND VALLEY: Scan lookback window for ABSOLUTE MINIMUM
              let minVal = currentVal;
              let valleyIndex = i;
              const startSearch = Math.max(0, i - LOOKBACK_WINDOW);
              
              console.log(`     → Searching for valley: indices ${startSearch} to ${i} (${i - startSearch} points)`);
              
              for (let j = i; j >= startSearch; j--) {
                if (dataPoints[j].y <= minVal) {
                  minVal = dataPoints[j].y;
                  valleyIndex = j;
                }
              }
              
              // VALIDATE: Must be in "Yellow Zone" (07:00 - 17:00)
              const eventTimestamp = dataPoints[valleyIndex].x;
              const eventDate = new Date(eventTimestamp);
              const eventHour = eventDate.getHours();
              const eventMinute = eventDate.getMinutes();
              const isDaytime = eventHour >= 7 && eventHour <= 17;
              
              const timeStr = `${String(eventHour).padStart(2, '0')}:${String(eventMinute).padStart(2, '0')}`;
              
              console.log(`     → Valley found at index ${valleyIndex} (searched back ${i - valleyIndex} points)`);
              console.log(`     → Valley time: ${timeStr} (hour: ${eventHour})`);
              console.log(`     → Valley Y: ${dataPoints[valleyIndex].y.toFixed(3)}, Surge Y: ${currentVal.toFixed(3)}`);
              console.log(`     → Total rise from valley: ${(currentVal - dataPoints[valleyIndex].y).toFixed(3)}`);
              console.log(`     → Daytime filter: ${isDaytime ? '✅ PASS' : '❌ SKIP (outside 07:00-17:00)'}`);
              
              if (isDaytime) {
                allEvents.push({
                  index: valleyIndex,
                  x: dataPoints[valleyIndex].x,
                  y: dataPoints[valleyIndex].y,
                  peakIndex: i,
                  rise: currentVal - dataPoints[valleyIndex].y,
                  time: timeStr
                });
                
                lastEventIndex = valleyIndex;
                i = Math.max(i, valleyIndex + 15); // Skip forward
              } else {
                console.log(`     → Event rejected (outside active hours)`);
              }
            }
          }
          
          console.log(`  🔬 [WINDOW-MIN] Raw detections: ${allEvents.length} events`);
          
          // DE-DUPLICATE: Keep events at least 5% apart
          const uniqueEvents = [];
          const minSeparation = dataPoints.length * 0.05;
          
          for (const event of allEvents) {
            let isDuplicate = false;
            for (const existing of uniqueEvents) {
              if (Math.abs(event.index - existing.index) < minSeparation) {
                isDuplicate = true;
                // Keep the one with larger rise
                if (event.rise > existing.rise) {
                  uniqueEvents[uniqueEvents.indexOf(existing)] = event;
                  console.log(`     → Replaced duplicate: kept event at ${event.time} (larger rise)`);
                }
                break;
              }
            }
            if (!isDuplicate) {
              uniqueEvents.push(event);
            }
          }
          

          console.log(`  ✅ Found ${uniqueEvents.length} irrigation events`);
          
          if (uniqueEvents.length === 0) {
            console.log('     → No irrigation detected for this date\n');
            // ✅ Direct URL navigation handles date change - no button click needed
            continue;
          }
          
          // Sort by index
          uniqueEvents.sort((a, b) => a.index - b.index);
          
          const firstEvent = uniqueEvents[0];
          const lastEvent = uniqueEvents[uniqueEvents.length - 1];
          
          console.log(`     → First event at index ${firstEvent.index}`);
          console.log(`     → Last event at index ${lastEvent.index}`);
          console.log(`  🎯 Now attempting to click chart at these positions...\n`);
          
          // TODO: Actually click the chart points using the indices
          // For now, we've successfully analyzed the data!
          // The clicking logic using Highcharts API can be kept if it works,
          // or we can implement coordinate-based clicking
          
        } catch (timeoutError) {
          console.log('  ⚠️  Network data capture timed out after 10 seconds');
          console.log('     → Chart data API may not have been called');
          console.log('     → Or API response format is different than expected');
          console.log('     → Skipping chart interaction for this date\n');
          
          // ✅ Direct URL navigation handles date change - no button click needed
          continue; // Skip to next date
        }

        const clickResults = await page.evaluate((needs) => {
          const results = [];
          
          // Log to browser console for debugging
          console.log('🔍 [BROWSER] Starting irrigation point detection...');
          console.log('🔍 [BROWSER] Needs first click:', needs.needsFirstClick);
          console.log('🔍 [BROWSER] Needs last click:', needs.needsLastClick);
          
          // ============================================
          // METHOD 1: Try Highcharts API (Most Accurate)
          // ============================================
          let chart = null;
          if (window.Highcharts && window.Highcharts.charts) {
            chart = window.Highcharts.charts.find(c => c !== undefined);
          }
          
          if (chart && chart.series && chart.series[0]) {
            results.push({ message: '✅ Highcharts API accessible' });
            console.log('✅ [BROWSER] Highcharts API accessible');
          
          const series = chart.series[0];
          const dataPoints = series.data;
          
            if (dataPoints.length > 0) {
              // Find irrigation spikes (Y-value drops)
          const spikes = [];
          for (let i = 1; i < dataPoints.length; i++) {
            const prevY = dataPoints[i - 1].y;
            const currY = dataPoints[i].y;
            const drop = prevY - currY;
            
                // Significant drop = irrigation event
            if (drop > 5) {
              spikes.push({
                index: i,
                    point: dataPoints[i],
                    x: dataPoints[i].x,
                    y: currY,
                    plotX: dataPoints[i].plotX + chart.plotLeft,
                    plotY: dataPoints[i].plotY + chart.plotTop,
                drop: drop,
                    time: dataPoints[i].category || dataPoints[i].x
              });
            }
          }
          
              if (spikes.length > 0) {
                results.push({ message: `Found ${spikes.length} irrigation spikes via API` });
                
                const firstSpike = spikes[0];
                const lastSpike = spikes[spikes.length - 1];
                
              // Click first spike
              if (needs.needsFirstClick) {
                firstSpike.point.select(true, false);
                firstSpike.point.firePointEvent('click');
          results.push({ 
                  action: '✅ API: Clicked FIRST spike', 
                  x: Math.round(firstSpike.plotX), 
                  y: Math.round(firstSpike.plotY),
                  time: firstSpike.time
                });
              }
              
              // Click last spike (use a different approach to ensure it registers)
              if (needs.needsLastClick) {
                // Deselect first spike first
                if (needs.needsFirstClick) {
                  firstSpike.point.select(false, false);
                }
                
                lastSpike.point.select(true, false);
                lastSpike.point.firePointEvent('click');
          results.push({
                  action: '✅ API: Clicked LAST spike', 
                  x: Math.round(lastSpike.plotX), 
                  y: Math.round(lastSpike.plotY),
                  time: lastSpike.time
                });
              }
                
                return results;
              }
            }
          }
          
          // ============================================
          // METHOD 2: SVG Path Analysis (Fallback)
          // ============================================
          results.push({ message: '⚠️ Highcharts API not accessible, using SVG path analysis' });
          console.log('⚠️ [BROWSER] Highcharts API not accessible, using SVG path analysis');
          
          // Find the series path
          const seriesPath = document.querySelector('.highcharts-series path[data-z-index="1"]');
          if (!seriesPath) {
            console.error('❌ [BROWSER] No series path found in SVG');
            return { error: 'No series path found in SVG' };
          }
          console.log('✅ [BROWSER] Found series path in SVG');
          
          const pathData = seriesPath.getAttribute('d');
          if (!pathData) {
            return { error: 'Path data attribute not found' };
          }
          
          // Parse SVG path coordinates (handles M, L, and C commands)
          const coordinates = [];
          
          // Extract all numbers from the path
          const numbers = pathData.match(/[\d.-]+/g);
          if (!numbers || numbers.length < 6) {
            return { error: `Path has insufficient data: ${numbers ? numbers.length : 0} numbers` };
          }
          
          // Parse coordinates (every 2 numbers = one point)
          for (let i = 0; i < numbers.length - 1; i += 2) {
            coordinates.push({
              x: parseFloat(numbers[i]),
              y: parseFloat(numbers[i + 1])
            });
          }
          
          // For Bézier curves (C command), only use the end points (every 3rd point)
          // This gives us the actual plotted points, not the control points
          const plottedPoints = [];
          plottedPoints.push(coordinates[0]); // First M command point
          for (let i = 3; i < coordinates.length; i += 3) {
            plottedPoints.push(coordinates[i]); // End point of each C command
          }
          
          // Use plotted points for spike detection
          const finalCoords = plottedPoints.length > 10 ? plottedPoints : coordinates;
            
            results.push({ 
            message: `Parsed ${finalCoords.length} plot points from SVG path (from ${coordinates.length} total coords)` 
          });
          
          // Debug: Show sample coordinates
          if (finalCoords.length > 0) {
            results.push({
              message: `Sample points: [0]=(${Math.round(finalCoords[0].x)},${Math.round(finalCoords[0].y)}), [${Math.floor(finalCoords.length/2)}]=(${Math.round(finalCoords[Math.floor(finalCoords.length/2)].x)},${Math.round(finalCoords[Math.floor(finalCoords.length/2)].y)})`
            });
          }
          
          if (finalCoords.length < 3) {
            return { error: `Not enough coordinates to find spikes: ${finalCoords.length} points` };
          }
          
          // HSSP Method: Find Highest Slope Start Points (irrigation event starts)
          
          // Get Y-range for context
          const allY = finalCoords.map(c => c.y);
          const maxY = Math.max(...allY);
          const minY = Math.min(...allY);
          const yRange = maxY - minY;
            
            results.push({ 
            message: `Y range: ${Math.round(minY)} to ${Math.round(maxY)} (span: ${Math.round(yRange)})` 
          });
          
          // NEW APPROACH: Find steep DROPS (irrigation events)
          // Irrigation = sudden decrease in water level = Y increases (visual drop)
          
          const drops = [];
          const smoothWindow = 3; // Smooth over 3 points to reduce noise
          
          // Calculate smoothed Y values
          const smoothedY = [];
          for (let i = 0; i < finalCoords.length; i++) {
            const start = Math.max(0, i - smoothWindow);
            const end = Math.min(finalCoords.length, i + smoothWindow + 1);
            const window = finalCoords.slice(start, end);
            const avg = window.reduce((sum, p) => sum + p.y, 0) / window.length;
            smoothedY.push(avg);
          }
          
          // Find significant drops (Y increasing = water level dropping)
          for (let i = 15; i < finalCoords.length - 15; i++) {
            // Look back 10 points to see if there's a significant drop
            const before = smoothedY.slice(i - 10, i);
            const after = smoothedY.slice(i, i + 10);
            
            const avgBefore = before.reduce((sum, y) => sum + y, 0) / before.length;
            const avgAfter = after.reduce((sum, y) => sum + y, 0) / after.length;
            
            // Drop = avgAfter is HIGHER than avgBefore (remember: higher Y = lower water = drop)
            const dropAmount = avgAfter - avgBefore;
            const dropPercent = (dropAmount / yRange) * 100;
            
            // Significant drop: at least 8% of Y range
            if (dropAmount > yRange * 0.08) {
              drops.push({
                index: i,
                x: finalCoords[i].x,
                y: finalCoords[i].y,
                dropAmount: dropAmount,
                dropPercent: dropPercent.toFixed(1),
                beforeY: avgBefore,
                afterY: avgAfter
              });
            }
          }
          
          console.log(`🔍 [BROWSER] Found ${drops.length} significant drops (≥8% Y-range)`);
          
          if (drops.length === 0) {
            console.log(`⚠️ [BROWSER] No irrigation drops detected - may have no irrigation this date`);
            results.push({ message: 'No irrigation drops found' });
          }
          
          // De-duplicate adjacent drops (merge drops within 10% of X-span)
          const uniqueDrops = [];
          const xSpan = finalCoords[finalCoords.length - 1].x - finalCoords[0].x;
          
          for (let i = 0; i < drops.length; i++) {
            const drop = drops[i];
            
            // Check if this drop is close to any existing unique drop
            let isDuplicate = false;
            for (const existingDrop of uniqueDrops) {
              const xDiff = Math.abs(drop.x - existingDrop.x);
              const xDiffPercent = (xDiff / xSpan) * 100;
              
              // If within 10% X-distance, consider it the same irrigation event
              if (xDiffPercent < 10) {
                isDuplicate = true;
                // Keep the one with bigger drop
                if (drop.dropAmount > existingDrop.dropAmount) {
                  uniqueDrops[uniqueDrops.indexOf(existingDrop)] = drop;
                }
                break;
              }
            }
            
            if (!isDuplicate) {
              uniqueDrops.push(drop);
            }
          }
          
          console.log(`🎯 [BROWSER] After de-duplication: ${uniqueDrops.length} unique irrigation events`);
          if (drops.length > uniqueDrops.length) {
            console.log(`   → Removed ${drops.length - uniqueDrops.length} duplicate drops`);
          }
          
          // Sort by X position (time order - left to right)
          uniqueDrops.sort((a, b) => a.x - b.x);
          
          // For each drop, find START (before drop) and END (after recovery)
          const irrigationEvents = [];
          
          for (let dIdx = 0; dIdx < uniqueDrops.length; dIdx++) {
            const drop = uniqueDrops[dIdx];
            const dropIndex = drop.index;
            
            // 1. Find START: Look backwards to find where water level was HIGH (before irrigation)
            let startIndex = dropIndex;
            let highestYBefore = drop.y;
            
            for (let j = dropIndex - 1; j >= Math.max(0, dropIndex - 20); j--) {
              const currentY = smoothedY[j];
              if (currentY < highestYBefore) {
                highestYBefore = currentY;
                startIndex = j;
              }
            }
            
            // 2. Find END: Look forward to find where water level RECOVERS (after irrigation)
            let endIndex = dropIndex;
            let highestYAfter = drop.y;
            
            for (let j = dropIndex + 1; j < Math.min(finalCoords.length, dropIndex + 30); j++) {
              const currentY = smoothedY[j];
              // Find where water level is high again (recovered from irrigation)
              if (currentY < highestYAfter) {
                highestYAfter = currentY;
                endIndex = j;
              }
            }
            
            // Validate
            const startValid = startIndex < dropIndex;
            const endValid = endIndex > dropIndex;
            
            if (startValid && endValid) {
              irrigationEvents.push({
                startIndex: startIndex,
                startX: finalCoords[startIndex].x,
                startY: finalCoords[startIndex].y,
                endIndex: endIndex,
                endX: finalCoords[endIndex].x,
                endY: finalCoords[endIndex].y,
                dropAmount: drop.dropAmount,
                dropPercent: drop.dropPercent
              });
              
              console.log(`✅ [BROWSER] Irrigation ${dIdx + 1}: Start idx=${startIndex} (X=${Math.round(finalCoords[startIndex].x)}), End idx=${endIndex} (X=${Math.round(finalCoords[endIndex].x)}), drop=${drop.dropPercent}%`);
            } else {
              console.log(`⚠️ [BROWSER] Irrigation ${dIdx + 1}: Could not find valid start/end points, skipping`);
            }
          }
          
          results.push({
            message: `Found ${irrigationEvents.length} valid irrigation events with start/end points`
          });
          
          if (irrigationEvents.length === 0) {
            console.error('❌ [BROWSER] No valid irrigation events found');
            return {
              needsFirstClick: false,
              needsLastClick: false,
              error: 'No valid irrigation events',
              debug: results
            };
          }
          
          // FIRST irrigation = START of first event
          // LAST irrigation = END of last event
          const firstEvent = irrigationEvents[0];
          const lastEvent = irrigationEvents[irrigationEvents.length - 1];
          
          const spikes = [
            {
              index: firstEvent.startIndex,
              x: firstEvent.startX,
              y: firstEvent.startY,
              dropAmount: firstEvent.dropAmount,
              dropPercent: firstEvent.dropPercent,
              type: 'FIRST_START'
            },
            {
              index: lastEvent.endIndex,
              x: lastEvent.endX,
              y: lastEvent.endY,
              dropAmount: lastEvent.dropAmount,
              dropPercent: lastEvent.dropPercent,
              type: 'LAST_END'
            }
          ];
          
          console.log(`📌 [BROWSER] Using FIRST irrigation START (idx=${firstEvent.startIndex}) and LAST irrigation END (idx=${lastEvent.endIndex})`);
          
          
          // Get chart container for coordinate conversion
          const chartContainer = document.querySelector('.highcharts-container');
          const containerRect = chartContainer.getBoundingClientRect();
          
          const firstPoint = spikes[0]; // FIRST irrigation START
          const lastPoint = spikes[1]; // LAST irrigation END
          
          // Calculate X-axis separation between first start and last end
          const xSeparation = Math.abs(lastPoint.x - firstPoint.x);
          const totalXRange = finalCoords[finalCoords.length - 1].x - finalCoords[0].x;
          const separationPercent = (xSeparation / totalXRange) * 100;
          
          console.log(`📊 [BROWSER] First (START) vs Last (END) separation: ${Math.round(separationPercent)}%`);
          
          // IMPORTANT: Click ABOVE the line (lower Y) to hit Highcharts clickable area
          const clickOffsetY = 15; // pixels above the chart line
          
          results.push({
            message: `Selecting: FIRST START at idx=${firstPoint.index}, LAST END at idx=${lastPoint.index}`
          });
          
          results.push({
            message: `Separation: ${Math.round(xSeparation)}px (${Math.round(separationPercent)}% of chart)`
          });
          console.log(`📏 [BROWSER] First-Last separation: ${Math.round(xSeparation)}px (${Math.round(separationPercent)}% of chart)`);
          
          results.push({ 
            message: `Click offset: ${clickOffsetY}px ABOVE chart line (Highcharts clickable area)`
          });
          
          // Convert SVG coordinates to screen coordinates
          const firstX = containerRect.left + firstPoint.x;
          const firstY = containerRect.top + firstPoint.y - clickOffsetY;
          const lastX = containerRect.left + lastPoint.x;
          const lastY = containerRect.top + lastPoint.y - clickOffsetY;
          
          console.log(`🎯 [BROWSER] Final click coordinates:`);
          console.log(`   → FIRST (START): idx=${firstPoint.index} Screen(${Math.round(firstX)}, ${Math.round(firstY)}) SVG(${Math.round(firstPoint.x)}, ${Math.round(firstPoint.y)})`);
          console.log(`   → LAST (END): idx=${lastPoint.index} Screen(${Math.round(lastX)}, ${Math.round(lastY)}) SVG(${Math.round(lastPoint.x)}, ${Math.round(lastPoint.y)})`);
          
          // Return coordinates for Playwright to click
          // ALWAYS click both points - they are different (START vs END)
          return {
            needsFirstClick: needs.needsFirstClick,
            needsLastClick: needs.needsLastClick, // Always click last - it's different from first
            firstCoords: needs.needsFirstClick ? { 
              x: Math.round(firstX), 
              y: Math.round(firstY), 
              svgX: Math.round(firstPoint.x), 
              svgY: Math.round(firstPoint.y), 
              drop: firstPoint.dropAmount,
              type: 'START'
            } : null,
            lastCoords: needs.needsLastClick ? { 
              x: Math.round(lastX), 
              y: Math.round(lastY), 
              svgX: Math.round(lastPoint.x), 
              svgY: Math.round(lastPoint.y), 
              drop: lastPoint.dropAmount,
              type: 'END'
            } : null,
            singleEvent: false, // Never single - we have START and END
            separationPercent: Math.round(separationPercent),
            debug: results
          };
            
            return results;
          }, tableStatus);
          
        // Check if HSSP detection failed
        if (clickResults.error) {
          console.log(`     ⚠️  HSSP detection failed: ${clickResults.error}`);
          console.log(`        → No irrigation points found for this date`);
          console.log(`        → Tables will remain empty\n`);
          
          // Store empty data
          const dateData = {
            date: displayedDate,
            firstIrrigationTime: null,
            lastIrrigationTime: null,
            extractedAt: new Date().toISOString(),
            error: clickResults.error
          };
          farmDateData.push(dateData);
          
          // Take screenshot
          const errorScreenshot = path.join(CONFIG.screenshotDir, `farm-${farmIdx + 1}-date-${dateIdx}-no-data-${timestamp}.png`);
          await page.screenshot({ path: errorScreenshot, fullPage: true });
          console.log(`     📸 Screenshot: ${errorScreenshot}\n`);
          
          // ✅ Direct URL navigation handles date change - no button click needed
          continue; // Skip to next date
        }
        
        // Display debug info
        if (clickResults.debug) {
          clickResults.debug.forEach(msg => {
            if (msg.message) console.log(`     → ${msg.message}`);
          });
        }
        
        // Show separation info
        if (clickResults.separationPercent !== undefined) {
          console.log(`     ✅ First (START) and Last (END) separated by ${clickResults.separationPercent}% of chart`);
        }
        
        // CHART LEARNING MODE: Show detected points and allow user correction
        if (CONFIG.chartLearningMode && clickResults.firstCoords && clickResults.lastCoords) {
          console.log(`\n     🎓 CHART LEARNING MODE ACTIVE`);
          console.log(`        Algorithm will click at:`);
          console.log(`        → FIRST: Screen(${clickResults.firstCoords.x}, ${clickResults.firstCoords.y})`);
          console.log(`        → LAST: Screen(${clickResults.lastCoords.x}, ${clickResults.lastCoords.y})`);
          
          // Take screenshot BEFORE showing markers
          const beforeScreenshot = path.join(CONFIG.screenshotDir, `learning-before-${Date.now()}.png`);
          await page.screenshot({ path: beforeScreenshot, fullPage: false });
          console.log(`        📸 Chart screenshot: ${beforeScreenshot}`);
          
          // Draw BIG visible indicators on the page using HTML overlays
          await page.evaluate((first, last) => {
            // Create instruction banner at top
            const banner = document.createElement('div');
            banner.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              text-align: center;
              font-size: 20px;
              font-weight: bold;
              z-index: 1000000;
              box-shadow: 0 4px 6px rgba(0,0,0,0.3);
              font-family: Arial, sans-serif;
            `;
            banner.innerHTML = `
              🎓 LEARNING MODE ACTIVE 🎓<br>
              <span style="font-size: 16px; font-weight: normal;">
                🟢 Green circle = Algorithm's FIRST point | 🔴 Red circle = Algorithm's LAST point<br>
                ✅ Correct? Just wait 30 seconds | ❌ Wrong? Click correct spots (Yellow then Orange)
              </span>
            `;
            document.body.appendChild(banner);
            
            // Create overlay container
            const overlay = document.createElement('div');
            overlay.id = 'learning-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 999999;';
            
            // Draw FIRST point marker (GREEN) - HUGE and visible
            const firstMarker = document.createElement('div');
            firstMarker.style.cssText = `
              position: absolute;
              left: ${first.x - 50}px;
              top: ${first.y - 50}px;
              width: 100px;
              height: 100px;
              border: 8px solid lime;
              border-radius: 50%;
              background: rgba(0, 255, 0, 0.3);
              pointer-events: none;
              animation: pulse 1s infinite;
              box-shadow: 0 0 30px rgba(0, 255, 0, 0.8);
            `;
            
            // Add label with arrow
            const firstLabel = document.createElement('div');
            firstLabel.innerHTML = '↓ FIRST START ↓';
            firstLabel.style.cssText = `
              position: absolute;
              left: ${first.x - 70}px;
              top: ${first.y - 80}px;
              background: lime;
              color: black;
              padding: 10px 15px;
              border-radius: 8px;
              font-weight: bold;
              font-size: 18px;
              pointer-events: none;
              box-shadow: 0 4px 8px rgba(0,0,0,0.3);
              font-family: Arial, sans-serif;
            `;
            
            // Draw LAST point marker (RED) - HUGE and visible
            const lastMarker = document.createElement('div');
            lastMarker.style.cssText = `
              position: absolute;
              left: ${last.x - 50}px;
              top: ${last.y - 50}px;
              width: 100px;
              height: 100px;
              border: 8px solid red;
              border-radius: 50%;
              background: rgba(255, 0, 0, 0.3);
              pointer-events: none;
              animation: pulse 1s infinite;
              box-shadow: 0 0 30px rgba(255, 0, 0, 0.8);
            `;
            
            // Add label with arrow
            const lastLabel = document.createElement('div');
            lastLabel.innerHTML = '↓ LAST END ↓';
            lastLabel.style.cssText = `
              position: absolute;
              left: ${last.x - 65}px;
              top: ${last.y - 80}px;
              background: red;
              color: white;
              padding: 10px 15px;
              border-radius: 8px;
              font-weight: bold;
              font-size: 18px;
              pointer-events: none;
              box-shadow: 0 4px 8px rgba(0,0,0,0.3);
              font-family: Arial, sans-serif;
            `;
            
            // Add pulsing animation
            const style = document.createElement('style');
            style.textContent = `
              @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.2); opacity: 0.7; }
              }
            `;
            
            document.head.appendChild(style);
            overlay.appendChild(firstMarker);
            overlay.appendChild(firstLabel);
            overlay.appendChild(lastMarker);
            overlay.appendChild(lastLabel);
            document.body.appendChild(overlay);
            
            // Setup click recorder
            window.learningClicks = [];
            const clickHandler = (e) => {
              window.learningClicks.push({
                svgX: e.clientX,
                svgY: e.clientY,
                screenX: e.clientX,
                screenY: e.clientY
              });
              
              // Visual feedback for user clicks
              const userMarker = document.createElement('div');
              userMarker.style.cssText = `
                position: absolute;
                left: ${e.clientX - 20}px;
                top: ${e.clientY - 20}px;
                width: 40px;
                height: 40px;
                border: 4px solid ${window.learningClicks.length === 1 ? 'yellow' : 'orange'};
                border-radius: 50%;
                background: rgba(255, 255, 0, 0.3);
                pointer-events: none;
                z-index: 999999;
              `;
              overlay.appendChild(userMarker);
              
              console.log(`✅ [BROWSER] Recorded user click #${window.learningClicks.length}: (${Math.round(e.clientX)}, ${Math.round(e.clientY)})`);
            };
            document.addEventListener('click', clickHandler, true);
            window.removeClickHandler = () => {
              document.removeEventListener('click', clickHandler, true);
              if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
              }
            };
          }, clickResults.firstCoords, clickResults.lastCoords);
          
          // Add countdown timer
          await page.evaluate(() => {
            const timer = document.createElement('div');
            timer.id = 'countdown-timer';
            timer.style.cssText = `
              position: fixed;
              top: 100px;
              right: 20px;
              background: rgba(0, 0, 0, 0.8);
              color: white;
              padding: 20px 30px;
              border-radius: 10px;
              font-size: 48px;
              font-weight: bold;
              z-index: 1000001;
              font-family: 'Arial', monospace;
              box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            `;
            timer.textContent = '30';
            document.body.appendChild(timer);
            
            let countdown = 30;
            const interval = setInterval(() => {
              countdown--;
              timer.textContent = countdown;
              if (countdown <= 0) {
                clearInterval(interval);
                timer.textContent = 'GO!';
                timer.style.background = 'rgba(0, 255, 0, 0.8)';
                timer.style.color = 'black';
              } else if (countdown <= 10) {
                timer.style.background = 'rgba(255, 0, 0, 0.8)';
                timer.style.fontSize = '60px';
              }
            }, 1000);
          });
          
          // ⚡ FAST: Markers appear instantly via JavaScript
          console.log(`\n        🟢 🔴 LOOK AT THE BROWSER WINDOW! 🔴 🟢`);
          console.log(`        ═══════════════════════════════════════`);
          console.log(`        You should see:`);
          console.log(`        • Purple banner at top with instructions`);
          console.log(`        • HUGE green circle (100px) = FIRST START`);
          console.log(`        • HUGE red circle (100px) = LAST END`);
          console.log(`        • Big countdown timer (top-right corner)`);
          console.log(`\n        📋 WHAT TO DO:`);
          console.log(`        ✅ Circles correct? → Just wait for countdown`);
          console.log(`        ❌ Circles wrong? → Click correct spots before timer ends`);
          console.log(`           (Yellow circle = your FIRST, Orange = your LAST)`);
          console.log(`\n        ⏱️  Waiting 20 seconds for corrections...`);
          
          // Wait 20 seconds for user to make corrections (must keep this for human interaction)
          await page.waitForTimeout(20000);
          
          // Collect user corrections
          const userCorrections = await page.evaluate(() => {
            const clicks = window.learningClicks || [];
            if (window.removeClickHandler) window.removeClickHandler();
            return clicks;
          });
          
          // Save training data
          const trainingEntry = {
            timestamp: new Date().toISOString(),
            date: displayedDate,
            farm: currentFarm.name,
            algorithmDetection: {
              first: { svgX: clickResults.firstCoords.svgX, svgY: clickResults.firstCoords.svgY },
              last: { svgX: clickResults.lastCoords.svgX, svgY: clickResults.lastCoords.svgY }
            },
            userCorrections: userCorrections.length > 0 ? {
              first: userCorrections[0] || null,
              last: userCorrections[1] || null
            } : null,
            feedback: userCorrections.length === 0 ? 'User accepted algorithm detection' : `User made ${userCorrections.length} corrections`
          };
          
          // Append to training file
          let trainingData = [];
          if (fs.existsSync(TRAINING_FILE)) {
            trainingData = JSON.parse(fs.readFileSync(TRAINING_FILE));
          }
          trainingData.push(trainingEntry);
          fs.writeFileSync(TRAINING_FILE, JSON.stringify(trainingData, null, 2));
          
          if (userCorrections.length > 0) {
            console.log(`\n     📝 Recorded ${userCorrections.length} user corrections`);
            console.log(`        Saved to training/training-data.json`);
            
            // Calculate differences
            if (userCorrections.length >= 1) {
              const firstDiffX = userCorrections[0].svgX - clickResults.firstCoords.svgX;
              const firstDiffY = userCorrections[0].svgY - clickResults.firstCoords.svgY;
              console.log(`        First point offset: X=${Math.round(firstDiffX)}px, Y=${Math.round(firstDiffY)}px`);
            }
            if (userCorrections.length >= 2) {
              const lastDiffX = userCorrections[1].svgX - clickResults.lastCoords.svgX;
              const lastDiffY = userCorrections[1].svgY - clickResults.lastCoords.svgY;
              console.log(`        Last point offset: X=${Math.round(lastDiffX)}px, Y=${Math.round(lastDiffY)}px\n`);
            }
          } else {
            console.log(`\n     ✅ User accepted algorithm detection (no corrections)\n`);
          }
        }
        
        // Now perform REAL Playwright mouse clicks for more reliable interaction
        if (clickResults.needsFirstClick && clickResults.firstCoords) {
          let coords = clickResults.firstCoords;
          
          // Apply learned corrections if available
          if (learnedOffsets.count > 0 && !CONFIG.chartLearningMode) {
            const correctedX = coords.x + learnedOffsets.firstX;
            const correctedY = coords.y + learnedOffsets.firstY;
            console.log(`     🎓 Applying learned correction: (${learnedOffsets.firstX.toFixed(1)}, ${learnedOffsets.firstY.toFixed(1)})`);
            coords = { ...coords, x: Math.round(correctedX), y: Math.round(correctedY) };
          }
          
          console.log(`     ✅ Clicking FIRST irrigation time (START of irrigation)`);
          console.log(`        → Screen Coord: (${coords.x}, ${coords.y}) - 15px ABOVE line`);
          console.log(`        → SVG Line Coord: (${coords.svgX}, ${coords.svgY})`);
          console.log(`        → Type: ${coords.type || 'START'}`);
          
          // Focus first input field
          await page.click('input[type="time"]:nth-of-type(1)');
          
          // ⚡ FAST: Click chart immediately
          await page.mouse.click(coords.x, coords.y);
          // Brief wait for UI to register click before second click
          await page.waitForTimeout(500);
          
          // 📊 Track chart click
          runStats.chartsClicked++;
        }
        
        if (clickResults.needsLastClick && clickResults.lastCoords) {
          let coords = clickResults.lastCoords;
          
          // Apply learned corrections if available
          if (learnedOffsets.count > 0 && !CONFIG.chartLearningMode) {
            const correctedX = coords.x + learnedOffsets.lastX;
            const correctedY = coords.y + learnedOffsets.lastY;
            console.log(`     🎓 Applying learned correction: (${learnedOffsets.lastX.toFixed(1)}, ${learnedOffsets.lastY.toFixed(1)})`);
            coords = { ...coords, x: Math.round(correctedX), y: Math.round(correctedY) };
          }
          
          console.log(`     ✅ Clicking LAST irrigation time (END of irrigation)`);
          console.log(`        → Screen Coord: (${coords.x}, ${coords.y}) - 15px ABOVE line`);
          console.log(`        → SVG Line Coord: (${coords.svgX}, ${coords.svgY})`);
          console.log(`        → Type: ${coords.type || 'END'}`);
          
          // Focus LAST input field
          const timeInputs = await page.$$('input[type="time"]');
          if (timeInputs.length > 1) {
            await timeInputs[timeInputs.length - 1].click();
          }
          
          // ⚡ FAST: Click chart immediately
          await page.mouse.click(coords.x, coords.y);
          // Brief wait for table update
          await page.waitForTimeout(500);
          
          // 📊 Track chart click
          runStats.chartsClicked++;
        }
        
        // ⚡ FAST: Tables update instantly after clicks
        
      } else {
          console.log('     ✅ Some tables already have data, minimal clicks needed\n');
        }
        
        // ⚡ FAST: Brief wait for UI update
        await page.waitForTimeout(500);
        
        // Take screenshot after clicking
        const step6Screenshot = path.join(CONFIG.screenshotDir, `farm-${farmIdx + 1}-date-${dateIdx}-after-clicks-${timestamp}.png`);
        await page.screenshot({ path: step6Screenshot, fullPage: true });
        console.log(`     📸 Screenshot: ${step6Screenshot}\n`);
        
        // Extract final table values
        console.log('     📊 Extracting irrigation data from tables...');
      
      // ⚡ FAST: Extract data immediately
      const finalData = await page.evaluate(() => {
        const results = {
          firstIrrigationTime: null,
          lastIrrigationTime: null,
          debug: []
        };
        
        console.log('📊 [BROWSER] Extracting irrigation time data from tables...');
        
        // Strategy 1: Look for time input fields (type="time")
        const timeInputs = Array.from(document.querySelectorAll('input[type="time"]'));
        results.debug.push(`Found ${timeInputs.length} time input fields`);
        console.log(`📊 [BROWSER] Found ${timeInputs.length} time input fields`);
        
        // For each time input, look backwards in the DOM to find its label
        timeInputs.forEach((input, idx) => {
          const value = input.value;
          results.debug.push(`Time input ${idx + 1}: value="${value || 'EMPTY'}"`);
          
          // Find the parent container
          let container = input.closest('div');
          if (container) {
            // Look for text content in the same container or its siblings
            const containerText = container.textContent || '';
            results.debug.push(`Container text: "${containerText.substring(0, 50)}..."`);
            
            // Check if this is the "first irrigation time" field
            if (containerText.includes('첫 급액') || containerText.includes('첫급액')) {
              results.firstIrrigationTime = value;
              results.debug.push(`✅ Matched FIRST time: "${value}"`);
              console.log(`✅ [BROWSER] Found FIRST irrigation time: "${value}"`);
            }
            // Check if this is the "last irrigation time" field
            else if (containerText.includes('마지막 급액') || containerText.includes('마지막급액')) {
              results.lastIrrigationTime = value;
              results.debug.push(`✅ Matched LAST time: "${value}"`);
              console.log(`✅ [BROWSER] Found LAST irrigation time: "${value}"`);
            }
          }
        });
        
        // If still not found, fallback to generic search
        if (!results.firstIrrigationTime || !results.lastIrrigationTime) {
          results.debug.push('Trying fallback strategy...');
          // Strategy 2: Look for table cells with time format
          const allText = Array.from(document.querySelectorAll('td, div, span, p'));
          allText.forEach((elem, idx) => {
          const text = elem.textContent.trim();
          
          // If we find the label
          if (text.includes('구역 1 첫 급액') && text.includes('시간')) {
            results.debug.push(`Found first label: "${text}"`);
            
            // Look in siblings, parent, or nearby elements
            const parent = elem.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children);
              siblings.forEach(sib => {
                const sibText = sib.textContent.trim();
                if (sibText.match(/\d{2}:\d{2}/) && !sibText.includes('급액')) {
                  results.firstIrrigationTime = sibText;
                  results.debug.push(`Found first time in sibling: "${sibText}"`);
                }
              });
            }
            
            // Try next element
            const next = allText[idx + 1];
            if (next && next.textContent.match(/\d{2}:\d{2}/)) {
              results.firstIrrigationTime = next.textContent.trim();
              results.debug.push(`Found first time in next element: "${next.textContent.trim()}"`);
            }
          }
          
          if (text.includes('구역 1 마지막 급액') && text.includes('시간')) {
            results.debug.push(`Found last label: "${text}"`);
            
            const parent = elem.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children);
              siblings.forEach(sib => {
                const sibText = sib.textContent.trim();
                if (sibText.match(/\d{2}:\d{2}/) && !sibText.includes('급액')) {
                  results.lastIrrigationTime = sibText;
                  results.debug.push(`Found last time in sibling: "${sibText}"`);
                }
              });
            }
            
            const next = allText[idx + 1];
            if (next && next.textContent.match(/\d{2}:\d{2}/)) {
              results.lastIrrigationTime = next.textContent.trim();
              results.debug.push(`Found last time in next element: "${next.textContent.trim()}"`);
            }
          }
          }); // End forEach
        
          // Strategy 3: If still not found, look for ANY elements with time format in the right panel
          if (!results.firstIrrigationTime || !results.lastIrrigationTime) {
            const timeElements = allText.filter(elem => {
              const text = elem.textContent.trim();
              return text.match(/^\d{2}:\d{2}$/);
            });
            
            results.debug.push(`Found ${timeElements.length} elements with time format`);
            
            if (timeElements.length >= 2) {
              // Assume first time-format element is "첫 급액시간"
              if (!results.firstIrrigationTime) {
                results.firstIrrigationTime = timeElements[0].textContent.trim();
                results.debug.push(`Using first time element: "${results.firstIrrigationTime}"`);
              }
              // Assume last time-format element is "마지막 급액시간"
              if (!results.lastIrrigationTime) {
                results.lastIrrigationTime = timeElements[timeElements.length - 1].textContent.trim();
                results.debug.push(`Using last time element: "${results.lastIrrigationTime}"`);
              }
            }
          } // End Strategy 3 if block
        } // End fallback if block
        
        console.log('📋 [BROWSER] Extraction complete:');
        console.log(`   → First time: ${results.firstIrrigationTime || 'NOT FOUND'}`);
        console.log(`   → Last time: ${results.lastIrrigationTime || 'NOT FOUND'}`);
        
        return results;
      });
      
        console.log(`  → Debug info: ${finalData.debug.join(' | ')}`);
        console.log(`  → 첫 급액시간 1: ${finalData.firstIrrigationTime || 'NOT FOUND'}`);
        console.log(`  → 마지막 급액시간 1: ${finalData.lastIrrigationTime || 'NOT FOUND'}\n`);
        
        // Add this date's data to collection
        const dateData = {
          date: displayedDate,
          firstIrrigationTime: finalData.firstIrrigationTime || null,
          lastIrrigationTime: finalData.lastIrrigationTime || null,
          extractedAt: new Date().toISOString()
        };
        farmDateData.push(dateData);
        
        // 📊 Track statistics
        runStats.datesProcessed++;
        if (finalData.firstIrrigationTime || finalData.lastIrrigationTime) {
          runStats.successCount++;
          console.log(`     ✅ Data collected for ${displayedDate}\n`);
        } else {
          console.log(`     ⚠️  No irrigation time data found for this date\n`);
        }
        
        // Update date range
        if (!runStats.dateRange.start) runStats.dateRange.start = displayedDate;
        runStats.dateRange.end = displayedDate;
        
      } catch (error) {
        console.log(`     ⚠️  Error in data extraction: ${error.message}\n`);
      }
      
      // Take screenshot after processing this date
      const dateScreenshot = path.join(CONFIG.screenshotDir, `farm-${farmIdx + 1}-date-${dateIdx}-${timestamp}.png`);
      await page.screenshot({ path: dateScreenshot, fullPage: true });
      console.log(`     📸 Screenshot: ${dateScreenshot}\n`);
      
      // ✅ NO NEED TO CLICK "Next Period" - We navigate directly via URL on next iteration
      
    } // End of date loop
    
    // Add all dates data for this farm to collection
    const farmData = {
      farmName: currentFarm.name,
      farmIndex: farmIdx + 1,
      totalDates: farmDateData.length,
      datesWithData: farmDateData.filter(d => d.firstIrrigationTime || d.lastIrrigationTime).length,
      dates: farmDateData
    };
    allFarmData.push(farmData);
    
    // 📊 Track farm completion
    runStats.farmsCompleted++;
    
    console.log(`\n  ✅ Finished Farm "${currentFarm.name}"`);
    console.log(`     → Processed ${farmDateData.length} dates`);
    console.log(`     → Data found for ${farmData.datesWithData} dates\n`);
    
    // 🛡️ END OF ROBUST TRY BLOCK - Catch any errors and continue to next farm
    } catch (farmError) {
      console.log(`\n  ❌ Error processing farm "${currentFarm.name}": ${farmError.message}`);
      console.log(`     → Stack: ${farmError.stack?.split('\n')[1] || 'N/A'}`);
      console.log(`     → Continuing to next farm...\n`);
      
      if (dashboard) {
        dashboard.log(`Error on ${currentFarm.name}: ${farmError.message}`, 'error');
      }
      
      runStats.errorCount = (runStats.errorCount || 0) + 1;
      
      // Take error screenshot
      try {
        const errorScreenshot = path.join(CONFIG.screenshotDir, `error-farm-${farmIdx + 1}-${Date.now()}.png`);
        await page.screenshot({ path: errorScreenshot, fullPage: true });
        console.log(`     📸 Error screenshot: ${errorScreenshot}\n`);
      } catch (ssErr) {
        console.log(`     ⚠️  Could not save error screenshot\n`);
      }
      
      // Continue to next farm (this will automatically happen when the catch block ends)
      continue;
    }
      
    } // End farm loop
    
    // Save all collected farm data
    console.log('\n💾 Saving all farm data...');
    const allDataFile = path.join(CONFIG.outputDir, `all-farms-data-${timestamp}.json`);
    const summaryData = {
      extractedAt: new Date().toISOString(),
      manager: CONFIG.targetName,
      dateRange: {
        description: '5 days ago to today',
        totalDays: totalDaysToCheck,
        method: 'Direct URL navigation with date parameter'
      },
      totalFarms: allFarmData.length,
      farmsWithData: allFarmData.filter(f => f.datesWithData > 0).length,
      totalDatesProcessed: allFarmData.reduce((sum, f) => sum + f.totalDates, 0),
      totalDatesWithData: allFarmData.reduce((sum, f) => sum + f.datesWithData, 0),
      farms: allFarmData
    };
    fs.writeFileSync(allDataFile, JSON.stringify(summaryData, null, 2));
    console.log(`✅ Saved data for ${allFarmData.length} farms to: ${allDataFile}\n`);
    
    // Step 8: Final screenshot
    const finalScreenshot = path.join(CONFIG.screenshotDir, `8-final-state-${timestamp}.png`);
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    console.log(`📸 Final screenshot saved: ${finalScreenshot}\n`);
    
    // Success summary
    console.log('✅ Multi-Farm Data Extraction Complete!');
    console.log('\n📋 Summary:');
    console.log(`   • Total farms processed: ${allFarmData.length}`);
    console.log(`   • Farms with data: ${summaryData.farmsWithData}`);
    console.log(`   • Manager: ${CONFIG.targetName}`);
    
    // Show summary table
    console.log('\n📊 Farm Details:');
    allFarmData.forEach((farm, idx) => {
      const status = farm.datesWithData > 0 ? '✅' : '⚠️';
      console.log(`   ${status} [${idx + 1}] ${farm.farmName}`);
      console.log(`      Dates processed: ${farm.totalDates} | Data found: ${farm.datesWithData}`);
      
      // Show first few dates as examples
      const sampleDates = farm.dates.slice(0, 3);
      sampleDates.forEach((dateData, dIdx) => {
        const first = dateData.firstIrrigationTime || '--:--';
        const last = dateData.lastIrrigationTime || '--:--';
        const dateStatus = (dateData.firstIrrigationTime || dateData.lastIrrigationTime) ? '✓' : '✗';
        console.log(`        ${dateStatus} ${dateData.date}: First ${first} | Last ${last}`);
      });
      
      if (farm.dates.length > 3) {
        console.log(`        ... and ${farm.dates.length - 3} more dates`);
      }
    });
    
    console.log('\n📋 What Was Accomplished:');
    console.log('   1. ✅ Navigated to report page');
    console.log(`   2. ✅ Selected "${CONFIG.targetName}" manager`);
    console.log(`   3. ✅ Processed ${allFarmData.length} farms`);
    console.log(`   4. ✅ Checked ${summaryData.dateRange.totalDays} days per farm (last 5 days)`);
    console.log(`   5. ✅ Total dates processed: ${summaryData.totalDatesProcessed}`);
    console.log(`   6. ✅ Dates with data: ${summaryData.totalDatesWithData}`);
    console.log('   7. ✅ Skipped dates with pre-filled tables (efficient!)');
    console.log('   8. ✅ Used HSSP algorithm for irrigation point detection');
    console.log('   9. ✅ Extracted data and saved to JSON');
    console.log('   10. ✅ Captured screenshots of the process\n');
    
    // 📊 Save Run Statistics to History
    console.log('📊 Saving run statistics to history...');
    runStats.endTime = Date.now();
    runStats.duration = Math.round((runStats.endTime - runStats.startTime) / 1000); // seconds
    runStats.successRate = runStats.datesProcessed > 0 
      ? Math.round((runStats.successCount / runStats.datesProcessed) * 100) 
      : 0;
    
    const historyFile = path.join('./history', 'run_logs.json');
    let historyData = [];
    
    try {
      if (fs.existsSync(historyFile)) {
        const fileContent = fs.readFileSync(historyFile, 'utf-8');
        historyData = JSON.parse(fileContent);
      }
    } catch (err) {
      console.log(`   ⚠️  Could not read existing history: ${err.message}`);
      historyData = [];
    }
    
    historyData.push(runStats);
    
    try {
      fs.writeFileSync(historyFile, JSON.stringify(historyData, null, 2));
      console.log(`✅ Run statistics saved to: ${historyFile}`);
      console.log(`   → Farms: ${runStats.farmsCompleted}/${runStats.totalFarmsTargeted}`);
      console.log(`   → Charts Clicked: ${runStats.chartsClicked}`);
      console.log(`   → Success Rate: ${runStats.successRate}%`);
      console.log(`   → Duration: ${runStats.duration}s\n`);
      
      if (dashboard) {
        dashboard.log(`Run stats: ${runStats.farmsCompleted} farms, ${runStats.chartsClicked} clicks, ${runStats.successRate}% success`, 'success');
      }
    } catch (err) {
      console.log(`   ⚠️  Could not save history: ${err.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error during automation:', error);
    console.error('   Stack trace:', error.stack);
    
    if (dashboard) {
      dashboard.updateStatus('❌ Error occurred', 'error');
      dashboard.log(`Error: ${error.message}`, 'error');
    }
    
    // 🚨 SAVE CRASH REPORT for AI analysis
    try {
      const errorName = error.message.includes('Login') ? 'LoginFailed' : 
                        error.message.includes('timeout') ? 'Timeout' :
                        error.message.includes('Farm') ? 'FarmProcessingError' : 'AutomationError';
      await saveCrashReport(page, errorName, error);
      if (dashboard) {
        dashboard.log('Crash report saved to crash-reports/ folder', 'info');
      }
    } catch (crashErr) {
      console.log(`   ⚠️ Could not save crash report: ${crashErr.message}`);
    }
    
    // Also take simple error screenshot (backup)
    try {
      const errorScreenshot = path.join(CONFIG.screenshotDir, `error-${Date.now()}.png`);
      await takeScreenshot(page, errorScreenshot);
      console.log(`📸 Error screenshot saved: ${errorScreenshot}`);
    } catch (screenshotError) {
      console.log('   Could not save error screenshot');
    }
    
  } finally {
    // Keep browser open for inspection
    console.log('\n🔚 Automation complete. Browser will stay open for inspection...');
    console.log('   → Check the browser DevTools Console tab to see webpage logs');
    console.log('   → Close the browser manually when done');
    console.log('   → Dashboard will remain accessible');
    console.log('   → Close terminal to stop everything\n');
    
    if (dashboard) {
      dashboard.updateStatus('✅ Automation Complete', 'running');
      dashboard.updateStep('Completed successfully', 100);
      dashboard.log('Automation finished. Browser staying open for inspection.', 'success');
    }
    
    // await browser.close(); // Commented out - close manually to inspect results
    // Note: Dashboard server will keep running until terminal is closed
  }
}

// Run the automation
main().catch(error => {
  console.error('Fatal error:', error);
  if (globalDashboard) {
    globalDashboard.log(`Fatal error: ${error.message}`, 'error');
    globalDashboard.updateStatus('❌ Fatal Error', 'error');
  }
  process.exit(1);
});

