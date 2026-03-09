/**
 * Date Navigator Module
 * Handles date navigation using button clicks (not URL parameters)
 * 
 * CRITICAL: Date parameter in URL is IGNORED by the SPA
 * Only button clicks ("이전 기간", "다음 기간") actually change the date
 * 
 * Pattern: Always process T-5 → T-0 (oldest to newest)
 */

import { log } from '../utils.js';

/**
 * Wait until the displayed date changes from prevDate.
 * Replaces fixed waitForTimeout(300) after each button click.
 */
async function waitForDateChange(page, prevDate, timeout = 2000) {
  try {
    await page.waitForFunction(
      (prev) => {
        const btn = Array.from(document.querySelectorAll('button.chakra-button'))
          .find(b => b.textContent.includes('년') && b.textContent.includes('일'));
        return btn && btn.textContent.trim() !== prev;
      },
      prevDate,
      { timeout }
    );
  } catch {
    // Fallback: date didn't change in time, continue anyway
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📅 DATE NAVIGATION - BUTTON BASED ONLY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Navigate to starting date by clicking "이전 기간" (Previous period) button N times
 * @param {Page} page - Playwright page
 * @param {number} daysBack - Number of days to go back (e.g., 5 for T-5)
 * @returns {Promise<boolean>}
 */
export async function navigateToStartDate(page, daysBack = 5) {
  log(`⏪ Navigating to T-${daysBack} (going back ${daysBack} days)...`, 'step');
  
  try {
    for (let i = 0; i < daysBack; i++) {
      const prevDate = await getCurrentDisplayedDate(page);
      const clicked = await page.evaluate(() => {
        const prevButton = document.querySelector('button[aria-label="이전 기간"]');
        if (prevButton) {
          prevButton.click();
          return true;
        }
        return false;
      });

      if (!clicked) {
        log(`Failed to click "이전 기간" button on iteration ${i + 1}`, 'error');
        return false;
      }

      await waitForDateChange(page, prevDate);
    }
    
    log(`✅ Reached T-${daysBack} (${daysBack} clicks back)`, 'success');
    return true;
    
  } catch (error) {
    log(`Error navigating to start date: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Advance to next date by clicking "다음 기간" (Next period) button once
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>}
 */
export async function advanceToNextDate(page) {
  try {
    const prevDate = await getCurrentDisplayedDate(page);
    const clicked = await page.evaluate(() => {
      const nextButton = document.querySelector('button[aria-label="다음 기간"]');
      if (nextButton) {
        nextButton.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      await waitForDateChange(page, prevDate);
      return true;
    }

    log('Failed to click "다음 기간" button', 'warning');
    return false;

  } catch (error) {
    log(`Error advancing to next date: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Read the currently displayed date from the date picker
 * @param {Page} page - Playwright page
 * @returns {Promise<string>} - Date string (e.g., "2026년 1월 20일 (월)")
 */
export async function getCurrentDisplayedDate(page) {
  try {
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
    
    return displayedDate;
    
  } catch (error) {
    log(`Error reading displayed date: ${error.message}`, 'error');
    return 'Unknown Date';
  }
}

/**
 * Calculate target date by subtracting dayOffset from today
 * @param {Date} baseDate - Base date (usually today)
 * @param {number} dayOffset - Days to subtract (e.g., 5 for T-5)
 * @returns {object} - {date: Date, dateString: string, koreanDate: string}
 */
export function calculateTargetDate(baseDate, dayOffset) {
  const targetDate = new Date(baseDate);
  targetDate.setDate(baseDate.getDate() - dayOffset);
  
  // Format as YYYY-MM-DD
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
  
  return {
    date: targetDate,
    dateString,
    koreanDate
  };
}

/**
 * Verify page is ready for date processing
 * @param {Page} page - Playwright page
 * @param {object} options - Verification options
 * @returns {Promise<boolean>}
 */
export async function verifyDatePageReady(page, options = {}) {
  const { waitForChart = true } = options;
  
  try {
    // Wait for date picker to be present
    await page.waitForSelector('button[aria-label="이전 기간"]', { 
      state: 'visible', 
      timeout: 5000 
    });
    
    if (waitForChart) {
      // Wait for chart container
      await page.waitForSelector('.highcharts-container', {
        state: 'visible',
        timeout: 5000
      });
    }
    
    return true;
    
  } catch (error) {
    log(`Page readiness check failed: ${error.message}`, 'warning');
    return false;
  }
}
