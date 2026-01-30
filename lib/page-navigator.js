/**
 * Page Navigator - Navigation with diagnostics and readiness detection
 */

import { TIMING } from '../config.js';

/**
 * Navigate to URL with timing diagnostics and retry logic
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
 */
export async function waitForPageReady(page, options = {}) {
  const {
    waitForChart = false,
    waitForFarmList = false,
    timeout = 10000
  } = options;

  const checks = [];

  if (waitForChart) {
    checks.push(
      page.waitForSelector('.highcharts-root, .highcharts-container', {
        state: 'visible',
        timeout
      }).catch(() => null)
    );
  }

  if (waitForFarmList) {
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

/**
 * Click date navigation button (next/previous)
 */
export async function clickDateButton(page, direction = 'next') {
  const ariaLabel = direction === 'next' ? '다음 기간' : '이전 기간';
  return await page.evaluate((label) => {
    const button = document.querySelector(`button[aria-label="${label}"]`);
    if (button) {
      button.click();
      return true;
    }
    return false;
  }, ariaLabel);
}

/**
 * Get current displayed date from page
 */
export async function getCurrentDate(page) {
  return await page.evaluate(() => {
    const allElements = document.querySelectorAll('div, span, p, button');
    for (const el of allElements) {
      const text = el.textContent || '';
      const dateMatch = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
      if (dateMatch) {
        return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
    }
    return null;
  });
}
