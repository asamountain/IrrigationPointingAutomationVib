/**
 * Irrigation Report Automation - Modular Entry Point
 * 
 * Purpose: Automate data extraction from admin.iofarm.com 관수리포트 menu
 * 
 * Architecture:
 *   - main.js (this file) - Entry point and orchestration
 *   - src/auth.js - Login handling
 *   - src/navigation.js - Manager selection & farm iteration (with STRICT matching)
 *   - src/chartAnalysis.js - HSSP algorithm & SVG parsing
 *   - src/browser.js - Browser launching
 *   - src/utils.js - Shared helpers
 */

import { launchBrowser, closeBrowser, createCrashReport } from './src/browser.js';
import { ensureLoggedIn } from './src/auth.js';
import { selectManager, getFarmList, navigateToFarm, checkReportCount } from './src/navigation.js';
import { detectIrrigationEvents, getFirstAndLastEvents, waitForChartRender, clickViaHighchartsAPI } from './src/chartAnalysis.js';
import { log, logSection, delay, getDateRange, saveJSON, getTimestamp, ensureDir } from './src/utils.js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config'; // Load .env

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  baseUrl: process.env.ADMIN_URL || 'https://admin.iofarm.com/report/',
  username: process.env.ADMIN_EMAIL || 'admin@admin.com',
  password: process.env.ADMIN_PASSWORD || 'jojin1234!!',
  manager: '승진',  // Default manager - uses STRICT exact matching
  outputDir: './data',
  screenshotDir: './screenshots',
  crashDir: './crash-reports'
};

// Ensure directories exist
[CONFIG.outputDir, CONFIG.screenshotDir, CONFIG.crashDir].forEach(ensureDir);

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 MAIN AUTOMATION FLOW
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  logSection('Irrigation Report Automation - Modular Version');
  
  let browser = null;
  let page = null;
  
  try {
    // ════════════════════════════════════════════════════════════════
    // STEP 1: Launch Browser
    // ════════════════════════════════════════════════════════════════
    log('Launching browser...', 'info');
    const browserResult = await launchBrowser({ headless: false });
    browser = browserResult.browser;
    page = browserResult.page;
    
    // ════════════════════════════════════════════════════════════════
    // STEP 2: Navigate & Login
    // ════════════════════════════════════════════════════════════════
    log(`Navigating to ${CONFIG.baseUrl}`, 'info');
    await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });
    
    const loggedIn = await ensureLoggedIn(page, {
      username: CONFIG.username,
      password: CONFIG.password
    });
    
    if (!loggedIn) {
      throw new Error('Login failed');
    }
    
    // ════════════════════════════════════════════════════════════════
    // STEP 3: Select Manager (STRICT EXACT MATCHING)
    // ════════════════════════════════════════════════════════════════
    log(`Selecting manager: "${CONFIG.manager}"`, 'info');
    
    const managerSelected = await selectManager(page, CONFIG.manager);
    
    if (!managerSelected) {
      throw new Error(`Failed to select manager: ${CONFIG.manager}`);
    }
    
    // ════════════════════════════════════════════════════════════════
    // STEP 4: Get Farm List
    // ════════════════════════════════════════════════════════════════
    await delay(1000);
    const farms = await getFarmList(page);
    
    if (farms.length === 0) {
      log('No farms found', 'warning');
      return;
    }
    
    log(`Found ${farms.length} farms to process`, 'success');
    
    // ════════════════════════════════════════════════════════════════
    // STEP 5: Process Each Farm
    // ════════════════════════════════════════════════════════════════
    const results = {
      timestamp: getTimestamp(),
      manager: CONFIG.manager,
      farms: []
    };
    
    for (let i = 0; i < farms.length; i++) {
      const farm = farms[i];
      
      logSection(`Farm ${i + 1}/${farms.length}: ${farm.name}`);
      
      // Navigate with forced manager parameter
      const navSuccess = await navigateToFarm(page, farm.url, CONFIG.manager);
      
      if (!navSuccess) {
        log(`Failed to navigate to ${farm.name}`, 'error');
        continue;
      }
      
      // Check if report already sent
      const { alreadySent, reportCount } = await checkReportCount(page);
      
      if (alreadySent) {
        log(`Report already sent (count: ${reportCount}), skipping`, 'warning');
        results.farms.push({
          name: farm.name,
          id: farm.farmId,
          status: 'skipped',
          reason: 'already_sent',
          reportCount
        });
        continue;
      }
      
      // Wait for chart to render
      const chartReady = await waitForChartRender(page);
      
      if (!chartReady) {
        log('Chart did not render', 'warning');
        results.farms.push({
          name: farm.name,
          id: farm.farmId,
          status: 'skipped',
          reason: 'chart_not_ready'
        });
        continue;
      }
      
      // Take screenshot
      const screenshot = path.join(CONFIG.screenshotDir, `farm-${farm.farmId}-${getTimestamp()}.png`);
      await page.screenshot({ path: screenshot });
      
      results.farms.push({
        name: farm.name,
        id: farm.farmId,
        status: 'processed',
        screenshot
      });
    }
    
    // ════════════════════════════════════════════════════════════════
    // STEP 6: Save Results
    // ════════════════════════════════════════════════════════════════
    const outputFile = path.join(CONFIG.outputDir, `run-${getTimestamp()}.json`);
    saveJSON(outputFile, results);
    log(`Results saved to ${outputFile}`, 'success');
    
    logSection('Automation Complete');
    log(`Processed ${results.farms.length} farms`, 'success');
    
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    
    // Save crash report
    if (page) {
      await createCrashReport(page, error.message);
    }
    
    throw error;
    
  } finally {
    // Cleanup
    if (browser) {
      log('Closing browser...', 'info');
      await closeBrowser();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 CLI ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Irrigation Report Automation - Modular Version
===============================================

Usage: node main.js [options]

Options:
  --manager <name>    Set the manager name (default: 승진)
  --max-farms <n>     Maximum farms to process (default: all)
  --headless          Run in headless mode
  --help, -h          Show this help

Examples:
  node main.js                           # Run with defaults
  node main.js --manager 승진            # Explicit manager
  node main.js --max-farms 5             # Process only 5 farms
  node main.js --headless                # Headless mode
`);
  process.exit(0);
}

// Parse --manager argument
const managerIdx = args.indexOf('--manager');
if (managerIdx !== -1 && args[managerIdx + 1]) {
  CONFIG.manager = args[managerIdx + 1];
  log(`Manager set to: ${CONFIG.manager}`, 'info');
}

// Run main
main().catch(error => {
  console.error('Automation failed:', error);
  process.exit(1);
});
