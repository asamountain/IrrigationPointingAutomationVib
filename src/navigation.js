/**
 * Navigation Module
 * Manager selection and farm iteration with STRICT exact matching
 * 
 * KEY FIX: Uses exact matching to prevent '승진' from matching '진우'
 */

import { log, logSubsection, delay, buildUrlWithManager } from './utils.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 👤 MANAGER SELECTION - STRICT EXACT MATCHING (5 STRATEGIES)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Select a manager using STRICT exact matching
 * Prevents partial match issues like '승진' matching '진우'
 * 
 * @param {Page} page - Playwright page
 * @param {string} managerName - Exact manager name (e.g., '승진')
 * @returns {Promise<boolean>} - True if selection successful
 */
export async function selectManager(page, managerName) {
  logSubsection(`Selecting Manager: "${managerName}" (STRICT EXACT MATCH)`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 1: Regex Exact Match with label.filter()
  // Uses ^name$ regex to ensure exact text matching
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    log(`Strategy 1: Regex exact match ^${managerName}$`, 'step');
    
    // Create regex that matches exactly the manager name
    const exactRegex = new RegExp(`^${managerName}$`);
    
    // Find label with exact text
    const labels = page.locator('label').filter({ hasText: exactRegex });
    const count = await labels.count();
    
    if (count === 1) {
      // Found exactly one match - click the radio inside it
      const radio = labels.locator('input[type="radio"]');
      if (await radio.count() > 0) {
        await radio.click();
        log(`✅ Strategy 1 SUCCESS: Selected "${managerName}" via regex exact match`, 'success');
        await delay(500);
        return true;
      }
    } else if (count > 1) {
      log(`Strategy 1: Found ${count} matches, need more precision`, 'warning');
    } else {
      log(`Strategy 1: No match found for regex ^${managerName}$`, 'warning');
    }
  } catch (e) {
    log(`Strategy 1 failed: ${e.message}`, 'warning');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 2: Direct value attribute matching
  // input[type="radio"][value="승진"] - exact value attribute
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    log(`Strategy 2: value attribute exact match`, 'step');
    
    // Escape special characters for CSS selector
    const escapedName = CSS.escape(managerName);
    const radio = page.locator(`input[type="radio"][value="${escapedName}"]`);
    
    if (await radio.count() === 1) {
      await radio.click();
      log(`✅ Strategy 2 SUCCESS: Selected via value="${managerName}"`, 'success');
      await delay(500);
      return true;
    }
  } catch (e) {
    log(`Strategy 2 failed: ${e.message}`, 'warning');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 3: Playwright getByRole with exact: true
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    log(`Strategy 3: getByRole('radio') with exact: true`, 'step');
    
    const radio = page.getByRole('radio', { name: managerName, exact: true });
    
    if (await radio.count() === 1) {
      await radio.click();
      log(`✅ Strategy 3 SUCCESS: Selected via getByRole exact`, 'success');
      await delay(500);
      return true;
    }
  } catch (e) {
    log(`Strategy 3 failed: ${e.message}`, 'warning');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 4: CSS :text-is() pseudo-selector (exact match)
  // label:has(span:text-is("승진"))
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    log(`Strategy 4: :text-is() exact match`, 'step');
    
    // Try with span inside label
    let label = page.locator(`label:has(span:text-is("${managerName}"))`);
    
    if (await label.count() === 0) {
      // Try direct text in label
      label = page.locator(`label:text-is("${managerName}")`);
    }
    
    if (await label.count() === 1) {
      const radio = label.locator('input[type="radio"]');
      if (await radio.count() > 0) {
        await radio.click();
        log(`✅ Strategy 4 SUCCESS: Selected via :text-is()`, 'success');
        await delay(500);
        return true;
      }
    }
  } catch (e) {
    log(`Strategy 4 failed: ${e.message}`, 'warning');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 5: JavaScript strict equality (===) with evaluate
  // Iterates all labels, compares textContent.trim() === managerName
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    log(`Strategy 5: JavaScript === strict equality`, 'step');
    
    const result = await page.evaluate((targetName) => {
      const labels = document.querySelectorAll('label');
      
      for (const label of labels) {
        const text = label.textContent.trim();
        
        // STRICT EQUALITY - prevents '승진' from matching '진우'
        if (text === targetName) {
          const radio = label.querySelector('input[type="radio"]');
          if (radio) {
            radio.click();
            return { success: true, matchedText: text };
          }
        }
        
        // Also check span text
        const span = label.querySelector('span');
        if (span && span.textContent.trim() === targetName) {
          const radio = label.querySelector('input[type="radio"]');
          if (radio) {
            radio.click();
            return { success: true, matchedText: span.textContent.trim() };
          }
        }
      }
      
      return { success: false, foundLabels: Array.from(labels).map(l => l.textContent.trim()) };
    }, managerName);
    
    if (result.success) {
      log(`✅ Strategy 5 SUCCESS: Selected via JS === "${result.matchedText}"`, 'success');
      await delay(500);
      return true;
    } else {
      log(`Strategy 5: No exact match. Available labels: ${result.foundLabels.join(', ')}`, 'warning');
    }
  } catch (e) {
    log(`Strategy 5 failed: ${e.message}`, 'warning');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ALL STRATEGIES FAILED
  // ═══════════════════════════════════════════════════════════════════════════
  log(`❌ FAILED: Could not select manager "${managerName}" with any strategy`, 'error');
  log('Please check if the manager name is correct and visible on the page', 'warning');
  
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 REPORT COUNT CHECK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a report has already been sent (리포트 수 > 0)
 * @param {Page} page - Playwright page
 * @returns {Promise<{alreadySent: boolean, reportCount: number}>}
 */
export async function checkReportCount(page) {
  try {
    log('Checking report count (리포트 수)...', 'step');
    
    // Find the cell with "리포트 수" header
    const result = await page.evaluate(() => {
      // Look for table cells or elements containing the report count
      const allCells = document.querySelectorAll('td, th, span, div');
      
      for (const cell of allCells) {
        const text = cell.textContent;
        if (text && text.includes('리포트 수')) {
          // Look for a number in the same row or nearby
          const row = cell.closest('tr');
          if (row) {
            const cells = row.querySelectorAll('td');
            for (const td of cells) {
              const numMatch = td.textContent.trim().match(/^\d+$/);
              if (numMatch) {
                return { found: true, count: parseInt(numMatch[0]) };
              }
            }
          }
        }
      }
      
      return { found: false, count: 0 };
    });
    
    if (result.found) {
      log(`Report count: ${result.count}`, 'info');
      return { alreadySent: result.count > 0, reportCount: result.count };
    }
    
    // If can't find report count, assume not sent
    log('Could not find report count, assuming not sent', 'warning');
    return { alreadySent: false, reportCount: 0 };
    
  } catch (e) {
    log(`Error checking report count: ${e.message}`, 'warning');
    return { alreadySent: false, reportCount: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌾 FARM ITERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get list of farms from the sidebar or table
 * @param {Page} page - Playwright page
 * @returns {Promise<Array<{name: string, url: string, id: string}>>}
 */
export async function getFarmList(page) {
  log('Extracting farm list...', 'step');
  
  const farms = await page.evaluate(() => {
    const farmItems = [];
    
    // Strategy 1: Look for links with /report/point/
    const links = document.querySelectorAll('a[href*="/report/point/"]');
    
    for (const link of links) {
      const href = link.getAttribute('href');
      const match = href.match(/\/report\/point\/(\d+)\/(\d+)/);
      
      if (match) {
        farmItems.push({
          name: link.textContent.trim() || `Farm ${match[1]}`,
          url: href,
          farmId: match[1],
          sectionId: match[2]
        });
      }
    }
    
    // Strategy 2: Look for table rows with farm data
    if (farmItems.length === 0) {
      const rows = document.querySelectorAll('tr');
      for (const row of rows) {
        const nameCell = row.querySelector('td:first-child');
        const linkCell = row.querySelector('a');
        
        if (nameCell && linkCell) {
          const href = linkCell.getAttribute('href') || '';
          const match = href.match(/\/report\/point\/(\d+)\/(\d+)/);
          
          if (match) {
            farmItems.push({
              name: nameCell.textContent.trim(),
              url: href,
              farmId: match[1],
              sectionId: match[2]
            });
          }
        }
      }
    }
    
    return farmItems;
  });
  
  log(`Found ${farms.length} farms`, 'info');
  return farms;
}

/**
 * Navigate to a specific farm with forced manager parameter
 * @param {Page} page - Playwright page
 * @param {string} farmUrl - Farm URL (relative or absolute)
 * @param {string} managerName - Manager name to force in URL
 * @returns {Promise<boolean>}
 */
export async function navigateToFarm(page, farmUrl, managerName) {
  log(`Navigating to farm: ${farmUrl}`, 'step');
  
  // Build URL with forced manager parameter
  const fullUrl = buildUrlWithManager(farmUrl, managerName);
  log(`Full URL with manager: ${fullUrl}`, 'info');
  
  try {
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1000);
    
    // Verify manager parameter is correct
    const currentUrl = new URL(page.url());
    const urlManager = currentUrl.searchParams.get('manager');
    
    if (urlManager !== managerName) {
      log(`⚠️ URL manager mismatch! Expected: ${managerName}, Got: ${urlManager}`, 'warning');
      
      // Force reload with correct manager
      currentUrl.searchParams.set('manager', managerName);
      await page.goto(currentUrl.toString(), { waitUntil: 'networkidle' });
      await delay(500);
    }
    
    log('Navigation successful', 'success');
    return true;
    
  } catch (e) {
    log(`Navigation failed: ${e.message}`, 'error');
    return false;
  }
}

/**
 * Select a date in the calendar
 * @param {Page} page - Playwright page
 * @param {Date|string} date - Date to select
 * @returns {Promise<boolean>}
 */
export async function selectDate(page, date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const dateStr = dateObj.toISOString().split('T')[0];
  
  log(`Selecting date: ${dateStr}`, 'step');
  
  try {
    // Try different date picker selectors
    const dateSelectors = [
      `input[type="date"]`,
      `input[name*="date"]`,
      `.date-picker input`,
      `[data-date="${dateStr}"]`
    ];
    
    for (const selector of dateSelectors) {
      const dateInput = await page.$(selector);
      if (dateInput) {
        await dateInput.fill(dateStr);
        await delay(500);
        log(`Date selected: ${dateStr}`, 'success');
        return true;
      }
    }
    
    // Try clicking on calendar day
    const dayNumber = dateObj.getDate();
    const dayButton = page.locator(`button:text-is("${dayNumber}"), td:text-is("${dayNumber}")`).first();
    
    if (await dayButton.count() > 0) {
      await dayButton.click();
      await delay(500);
      log(`Date clicked: ${dateStr}`, 'success');
      return true;
    }
    
    log('Could not find date picker', 'warning');
    return false;
    
  } catch (e) {
    log(`Error selecting date: ${e.message}`, 'error');
    return false;
  }
}

export default {
  selectManager,
  checkReportCount,
  getFarmList,
  navigateToFarm,
  selectDate
};
