/**
 * Authentication Module
 * Handles login and session management for admin.iofarm.com
 */

import { log, delay } from './utils.js';

const LOGIN_URL = 'https://admin.iofarm.com/login';
const DEFAULT_TIMEOUT = 30000;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 LOGIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if user is already logged in
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>}
 */
export async function isLoggedIn(page) {
  const url = page.url();
  
  // If not on login page, likely logged in
  if (!url.includes('/login')) {
    return true;
  }
  
  // Check for login form elements
  const loginForm = await page.$('input[type="password"]');
  return !loginForm;
}

/**
 * Perform robust login with multiple detection strategies
 * @param {Page} page - Playwright page
 * @param {object} credentials - Login credentials
 * @param {string} credentials.username - Username
 * @param {string} credentials.password - Password
 * @returns {Promise<boolean>} - True if login successful
 */
export async function performLogin(page, credentials) {
  const { username, password } = credentials;
  
  log('Starting login process...', 'info');
  
  try {
    // Navigate to login page
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: DEFAULT_TIMEOUT });
    
    // Wait for page to be ready
    await delay(1000);
    
    // Check if already logged in (might redirect)
    if (await isLoggedIn(page)) {
      log('Already logged in!', 'success');
      return true;
    }
    
    // Strategy 1: Find username input
    const usernameSelectors = [
      'input[name="username"]',
      'input[type="text"]',
      'input[placeholder*="아이디"]',
      'input[placeholder*="ID"]',
      '#username',
      'input.login-input'
    ];
    
    let usernameInput = null;
    for (const selector of usernameSelectors) {
      usernameInput = await page.$(selector);
      if (usernameInput) break;
    }
    
    if (!usernameInput) {
      log('Could not find username input', 'error');
      return false;
    }
    
    // Strategy 2: Find password input
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      '#password'
    ];
    
    let passwordInput = null;
    for (const selector of passwordSelectors) {
      passwordInput = await page.$(selector);
      if (passwordInput) break;
    }
    
    if (!passwordInput) {
      log('Could not find password input', 'error');
      return false;
    }
    
    // Clear and fill inputs
    await usernameInput.click({ clickCount: 3 });
    await usernameInput.type(username, { delay: 50 });
    
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type(password, { delay: 50 });
    
    // Strategy 3: Find and click login button
    const loginButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("로그인")',
      'button:has-text("Login")',
      'input[type="submit"]',
      '.login-btn',
      'button.submit'
    ];
    
    let loginButton = null;
    for (const selector of loginButtonSelectors) {
      try {
        loginButton = await page.$(selector);
        if (loginButton) break;
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (loginButton) {
      await loginButton.click();
    } else {
      // Try pressing Enter
      await page.keyboard.press('Enter');
    }
    
    // Wait for navigation
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await delay(2000);
    
    // Verify login success
    const loginSuccess = await isLoggedIn(page);
    
    if (loginSuccess) {
      log('Login successful!', 'success');
    } else {
      log('Login may have failed - still on login page', 'warning');
    }
    
    return loginSuccess;
    
  } catch (error) {
    log(`Login error: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Wait for user to manually login
 * @param {Page} page - Playwright page
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
export async function waitForManualLogin(page, timeoutMs = 120000) {
  log('Waiting for manual login...', 'info');
  log('Please log in manually in the browser window', 'warning');
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await isLoggedIn(page)) {
      log('Manual login detected!', 'success');
      return true;
    }
    await delay(1000);
  }
  
  log('Manual login timeout', 'error');
  return false;
}

/**
 * Ensure user is logged in (auto or manual)
 * @param {Page} page - Playwright page
 * @param {object} config - Configuration with optional credentials
 * @returns {Promise<boolean>}
 */
export async function ensureLoggedIn(page, config = {}) {
  // First check if already logged in
  if (await isLoggedIn(page)) {
    log('Already logged in', 'success');
    return true;
  }
  
  // Try auto login if credentials provided
  if (config.username && config.password) {
    const autoLoginSuccess = await performLogin(page, config);
    if (autoLoginSuccess) return true;
  }
  
  // Fall back to manual login
  return await waitForManualLogin(page);
}

export default {
  isLoggedIn,
  performLogin,
  waitForManualLogin,
  ensureLoggedIn
};
