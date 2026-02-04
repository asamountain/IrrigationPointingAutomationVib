/**
 * Farm Selector Module
 * Handles manager selection and farm list extraction
 */

/**
 * Select manager from the UI with enforced switching
 * 
 * @param {Page} page - Playwright page instance
 * @param {string} managerName - Manager name to select
 * @param {Object} dashboard - Dashboard server instance for status updates
 * @returns {Promise<void>}
 */
export async function selectManager(page, managerName, dashboard) {
  console.log(`\n🎯 Step 3: Selecting Manager "${managerName}" (Enforced Switching)...`);
  if (dashboard) {
    dashboard.updateStatus(`🎯 Selecting manager: ${managerName}`, 'running');
  }
  
  try {
    // Wait for manager selector to be visible
    console.log('  → Waiting for manager selector to appear...');
    await page.waitForSelector('.chakra-segment-group__itemText', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Define precise locator using Chakra UI class + exact text match
    const managerButton = page.locator('.chakra-segment-group__itemText', { 
      hasText: new RegExp(`^${managerName}$`) 
    });
    
    // Check if the button exists
    const buttonCount = await managerButton.count();
    console.log(`  → Found ${buttonCount} button(s) matching "${managerName}"`);
    
    if (buttonCount > 0) {
      // Primary: Force click on the Playwright locator
      console.log(`  → Clicking "${managerName}" button...`);
      try {
        await managerButton.first().click({ force: true, timeout: 5000 });
        console.log(`  ✅ Playwright click successful`);
      } catch (clickError) {
        // Fallback: Use native JavaScript click
        console.log(`  ⚠️  Playwright click failed, using JS fallback...`);
        const jsClicked = await page.evaluate((targetManager) => {
          const spans = Array.from(document.querySelectorAll('.chakra-segment-group__itemText'));
          const targetSpan = spans.find(span => span.textContent.trim() === targetManager);
          if (targetSpan) {
            // Click the span itself
            targetSpan.click();
            // Also try clicking parent label if exists
            const parentLabel = targetSpan.closest('label');
            if (parentLabel) parentLabel.click();
            return true;
          }
          return false;
        }, managerName);
        
        if (jsClicked) {
          console.log(`  ✅ JavaScript fallback click successful`);
        } else {
          console.log(`  ❌ JavaScript fallback also failed`);
        }
      }
      
      // CRITICAL: Wait for UI state change
      console.log(`  → Waiting for UI state confirmation...`);
      try {
        await page.waitForFunction((targetManager) => {
          const spans = Array.from(document.querySelectorAll('.chakra-segment-group__itemText'));
          const targetSpan = spans.find(span => span.textContent.trim() === targetManager);
          if (targetSpan) {
            const parentLabel = targetSpan.closest('label');
            if (parentLabel) {
              return parentLabel.getAttribute('data-state') === 'checked';
            }
          }
          return false;
        }, managerName, { timeout: 3000 });
        console.log(`  ✅ UI confirmed: "${managerName}" is now selected`);
      } catch (waitError) {
        console.log(`  ⚠️  UI state change not detected, continuing anyway...`);
      }
      
      // CRITICAL: Wait for network idle (table reload with new farm IDs)
      console.log(`  → Waiting for network to idle (table reload)...`);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        console.log('  ⚠️  Network not fully idle, continuing...');
      });
      
      // Safety buffer for AJAX reload (3 seconds)
      console.log(`  → Safety buffer (3s for farm list reload)...`);
      await page.waitForTimeout(3000);
      console.log(`  ✅ Manager selection complete\n`);
      
    } else {
      console.log(`  ⚠️  Could not find "${managerName}" button using .chakra-segment-group__itemText`);
      console.log(`  → Proceeding with default manager selection...\n`);
    }
  } catch (error) {
    console.log(`  ⚠️  Error selecting manager: ${error.message}`);
    console.log(`  → Proceeding anyway...\n`);
  }
  
  // Wait for Farm List Content
  console.log('  → Waiting for farm list to appear...');
  await page.waitForSelector('div.css-nd8svt a', { 
    state: 'visible',
    timeout: 30000 
  });
  console.log('  ✅ Farm list loaded\n');
}

/**
 * Extract farm list from the page
 * 
 * @param {Page} page - Playwright page instance
 * @param {Object} dashboard - Dashboard server instance for status updates
 * @returns {Promise<Array>} - Array of farm objects { index, name, href }
 */
export async function extractFarmList(page, dashboard) {
  console.log('🏭 Step 4: Extracting farm list...');
  if (dashboard) {
    dashboard.updateStatus('📋 Loading farms...', 'running');
  }
  
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
  
  return farmList;
}

/**
 * Calculate farm processing range based on config
 * 
 * @param {Array} farmList - Full farm list
 * @param {Object} config - { startFrom, maxFarms }
 * @returns {Object} - { farmsToProcess, startIndex, endIndex, totalFarms }
 */
export function calculateFarmRange(farmList, config) {
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
  
  return {
    farmsToProcess,
    startIndex,
    endIndex,
    totalFarms
  };
}
