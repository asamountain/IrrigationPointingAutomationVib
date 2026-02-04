/**
 * Authentication Module
 * Handles login detection, credential entry, and dual-path authentication
 * Intelligently detects whether already authenticated or login required
 */

import path from 'path';

/**
 * Smart authentication detection and login
 * Handles both authenticated and unauthenticated states
 * 
 * @param {Page} page - Playwright page instance
 * @param {Object} credentials - { username, password, screenshotDir }
 * @returns {Promise<Object>} - { success: boolean, state: string }
 */
export async function handleAuthentication(page, credentials) {
  const { username, password, screenshotDir } = credentials;
  
  console.log(' Authentication: Checking state...');
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  
  // Navigate to root
  console.log('   Navigating to root URL...');
  await page.goto('https://admin.iofarm.com/', { 
    waitUntil: 'domcontentloaded', 
    timeout: 30000 
  });
  
  // Wait for React to render
  console.log('   Waiting for page to stabilize (networkidle)...');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    console.log('    Network not fully idle after 15s, continuing...');
  });
  
  const currentUrl = page.url();
  console.log(`   Landed at: ${currentUrl}`);
  
  // Take screenshot for debugging
  const authScreenshot = path.join(screenshotDir, `auth-check-${timestamp}.png`);
  await page.screenshot({ path: authScreenshot, fullPage: true });
  console.log(`   Auth state screenshot: ${authScreenshot}`);
  
  // Detect current state
  const pageState = await detectPageState(page);
  console.log(`   Detected state: ${pageState || 'unknown'}`);
  
  // Handle based on state
  if (pageState === 'dashboard') {
    console.log('   Already authenticated (Dashboard detected)');
    return { success: true, state: 'already_authenticated' };
    
  } else if (pageState === 'login_form') {
    console.log('   Found login form, entering credentials...');
    
    // Perform login
    const loginResult = await performLogin(page, { username, password });
    
    if (loginResult.success) {
      console.log('   Login successful! Dashboard appeared.');
      return { success: true, state: 'logged_in' };
    } else {
      throw new Error(` Login failed: ${loginResult.error}`);
    }
    
  } else {
    // Unknown state - take debug screenshot
    const debugScreenshot = path.join(screenshotDir, `debug-auth-state-${timestamp}.png`);
    await page.screenshot({ path: debugScreenshot, fullPage: true });
    console.log(`   Unknown page state. Debug screenshot: ${debugScreenshot}`);
    throw new Error(` Unknown page state - neither login form nor dashboard detected. Check: ${debugScreenshot}`);
  }
}

/**
 * Detect current page state (login form vs dashboard)
 * Uses dual-path race detection
 * 
 * @param {Page} page - Playwright page instance
 * @returns {Promise<string>} - 'login_form', 'dashboard', or null
 */
async function detectPageState(page) {
  console.log('   Detecting page state (Login Form vs Dashboard)...');
  
  const DETECTION_TIMEOUT = 10000;
  
  // Path A: Login form selectors
  const loginFormPromise = (async () => {
    await Promise.race([
      page.waitForSelector('input[name="email"]', { state: 'visible', timeout: DETECTION_TIMEOUT }),
      page.waitForSelector('input[type="email"]', { state: 'visible', timeout: DETECTION_TIMEOUT }),
      page.waitForSelector('input[placeholder*="이메일"]', { state: 'visible', timeout: DETECTION_TIMEOUT }),
      page.waitForSelector('input[placeholder*="email" i]', { state: 'visible', timeout: DETECTION_TIMEOUT })
    ]);
    return 'login_form';
  })();
  
  // Path B: Dashboard/authenticated state selectors
  const dashboardPromise = (async () => {
    await Promise.race([
      page.waitForSelector('text=로그아웃', { state: 'visible', timeout: DETECTION_TIMEOUT }),
      page.waitForSelector('text=Logout', { state: 'visible', timeout: DETECTION_TIMEOUT }),
      page.waitForSelector('div.css-nd8svt', { state: 'visible', timeout: DETECTION_TIMEOUT }),
      page.waitForSelector('a[href*="/report/point/"]', { state: 'visible', timeout: DETECTION_TIMEOUT })
    ]);
    return 'dashboard';
  })();
  
  try {
    const result = await Promise.race([
      loginFormPromise.catch(() => null),
      dashboardPromise.catch(() => null)
    ]);
    
    if (result) return result;
    
    // If neither resolved quickly, wait and check manually
    await page.waitForTimeout(2000);
    const hasLoginField = await page.locator('input[type="email"], input[name="email"], input[placeholder*="이메일"]').first().isVisible().catch(() => false);
    const hasDashboard = await page.locator('text=로그아웃, div.css-nd8svt').first().isVisible().catch(() => false);
    
    if (hasLoginField) return 'login_form';
    if (hasDashboard) return 'dashboard';
    
  } catch (e) {
    // Detection failed
  }
  
  return null;
}

/**
 * Perform login with credentials
 * 
 * @param {Page} page - Playwright page instance
 * @param {Object} credentials - { username, password }
 * @returns {Promise<Object>} - { success: boolean, error?: string }
 */
async function performLogin(page, { username, password }) {
  // Fill email (try multiple selectors)
  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[placeholder*="이메일"]',
    'input[placeholder*="email" i]'
  ];
  
  let emailFilled = false;
  for (const selector of emailSelectors) {
    try {
      const field = page.locator(selector).first();
      if (await field.isVisible({ timeout: 500 })) {
        await field.fill(username);
        console.log(`   Email entered: ${username}`);
        emailFilled = true;
        break;
      }
    } catch (e) { continue; }
  }
  
  if (!emailFilled) {
    return { success: false, error: 'Could not find email input field' };
  }
  
  // Fill password
  console.log('   Password: ********');
  await page.fill('input[type="password"]', password);
  
  // Click login button
  console.log('   Clicking login button...');
  const loginClicked = await page.locator('button[type="submit"], button:has-text("로그인"), button:has-text("Login")').first().click().then(() => true).catch(() => false);
  if (!loginClicked) {
    await page.keyboard.press('Enter');
  }
  
  // Wait for dashboard to appear (confirms login success)
  console.log('   Waiting for dashboard to appear...');
  try {
    await Promise.race([
      page.waitForSelector('text=로그아웃', { state: 'visible', timeout: 15000 }),
      page.waitForSelector('div.css-nd8svt', { state: 'visible', timeout: 15000 }),
      page.waitForSelector('a[href*="/report/point/"]', { state: 'visible', timeout: 15000 })
    ]);
    return { success: true };
  } catch (loginError) {
    // Check for error message
    const hasError = await page.locator('text=/invalid|incorrect|error|실패|오류/i').first().isVisible().catch(() => false);
    if (hasError) {
      return { success: false, error: 'Invalid credentials' };
    }
    return { success: false, error: 'Dashboard did not appear' };
  }
}

/**
 * Ensure we're at the /report page
 * 
 * @param {Page} page - Playwright page instance
 * @returns {Promise<void>}
 */
export async function ensureAtReportPage(page) {
  const finalUrl = page.url();
  if (!finalUrl.includes('/report')) {
    console.log('\n   Not at /report page, navigating there...');
    await page.goto('https://admin.iofarm.com/report', { 
      waitUntil: 'load', 
      timeout: 20000 
    });
    console.log(`   Navigated to: ${page.url()}`);
  } else {
    console.log('\n   Already at /report page');
  }
}