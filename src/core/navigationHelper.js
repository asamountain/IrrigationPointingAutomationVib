/**
 * Navigation Helper Module
 * Provides adaptive page navigation with timing diagnostics and event-based readiness checks
 * Replaces fixed delays with smart waiting for actual UI/API signals
 */

// Timing constants
const TIMING = {
  PAGE_LOAD_MIN_EXPECTED: 500,  // Minimum expected load time (ms)
  TOO_FAST_THRESHOLD: 200,       // Suspiciously fast load (ms)
  MAX_RETRIES: 3,                // Maximum retry attempts
  RETRY_DELAYS: [1000, 2000, 3000] // Exponential backoff delays
};

/**
 * Navigate to URL with timing diagnostics and retry logic
 * Detects "too fast" loads that might indicate silent failures
 */
export async function navigateWithDiagnostics(page, url, options = {}) {
  const { expectedMinTime = TIMING.PAGE_LOAD_MIN_EXPECTED, retries = TIMING.MAX_RETRIES } = options;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const startTime = Date.now();
    
    try {
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });
      
      const loadTime = Date.now() - startTime;
      
      // Check response status
      if (!response) {
        console.log(`     ⚠️ Navigation returned null response (attempt ${attempt + 1})`);
        if (attempt < retries) {
          const delay = TIMING.RETRY_DELAYS[attempt];
          console.log(`     🔄 Retrying in ${delay}ms...`);
          await page.waitForTimeout(delay);
          continue;
        }
        throw new Error('Navigation returned null response after all retries');
      }
      
      const status = response.status();
      if (status >= 400) {
        console.log(`     ⚠️ HTTP ${status} error (attempt ${attempt + 1})`);
        if (attempt < retries) {
          const delay = TIMING.RETRY_DELAYS[attempt];
          console.log(`     🔄 Retrying in ${delay}ms...`);
          await page.waitForTimeout(delay);
          continue;
        }
        throw new Error(`HTTP ${status} error after all retries`);
      }
      
      // Timing diagnostics
      if (loadTime < TIMING.TOO_FAST_THRESHOLD) {
        console.log(`     ⚡ Suspiciously fast load: ${loadTime}ms (expected >${expectedMinTime}ms)`);
        // Check for error indicators on page
        const hasError = await page.locator('text=/error|오류|실패|too fast|rate limit/i').first().isVisible({ timeout: 1000 }).catch(() => false);
        if (hasError) {
          console.log(`     ⚠️ Error indicator found on page (attempt ${attempt + 1})`);
          if (attempt < retries) {
            const delay = TIMING.RETRY_DELAYS[attempt];
            console.log(`     🔄 Retrying in ${delay}ms...`);
            await page.waitForTimeout(delay);
            continue;
          }
        }
      }
      
      // Success
      console.log(`     ✅ Page loaded in ${loadTime}ms (HTTP ${status})`);
      return { response, loadTime, status, attempt };
      
    } catch (error) {
      console.log(`     ❌ Navigation error: ${error.message} (attempt ${attempt + 1})`);
      if (attempt < retries) {
        const delay = TIMING.RETRY_DELAYS[attempt];
        console.log(`     🔄 Retrying in ${delay}ms...`);
        await page.waitForTimeout(delay);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Wait for page to be truly ready by checking for specific signals
 * Instead of fixed delays, wait for actual UI/API events
 */
export async function waitForPageReady(page, options = {}) {
  const { 
    waitForChart = false,
    waitForFarmList = false,
    timeout = 10000 
  } = options;
  
  const checks = [];
  
  if (waitForChart) {
    // Wait for Highcharts SVG to be visible
    checks.push(
      page.waitForSelector('.highcharts-root, .highcharts-container', { 
        state: 'visible', 
        timeout 
      }).catch(() => null)
    );
  }
  
  if (waitForFarmList) {
    // Wait for farm list container
    checks.push(
      page.waitForSelector('div.css-nd8svt a[href*="/report/point/"]', { 
        state: 'visible', 
        timeout 
      }).catch(() => null)
    );
  }
  
  // Always wait for loading spinners to disappear
  checks.push(
    page.waitForSelector('.chakra-spinner, [class*="loading"], [class*="spinner"]', {
      state: 'hidden',
      timeout: 5000
    }).catch(() => null)
  );
  
  await Promise.all(checks);
}
