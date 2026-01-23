/**
 * Module Index - Export all automation modules
 * 
 * Usage:
 *   import { launchBrowser, selectManager, detectIrrigationEvents } from './src/index.js';
 */

// Browser management
export {
  launchBrowser,
  closeBrowser,
  getBrowser,
  getContext,
  isBrowserConnected,
  createCrashReport
} from './browser.js';

// Authentication
export {
  isLoggedIn,
  performLogin,
  waitForManualLogin,
  ensureLoggedIn
} from './auth.js';

// Navigation (includes STRICT manager selection fix)
export {
  selectManager,
  checkReportCount,
  getFarmList,
  navigateToFarm,
  selectDate
} from './navigation.js';

// Chart Analysis (HSSP Algorithm)
export {
  HSSP_PARAMS,
  detectIrrigationEvents,
  getFirstAndLastEvents,
  clickChartPoint,
  getChartBounds,
  waitForChartRender,
  clickIrrigationPoints,
  clickViaHighchartsAPI
} from './chartAnalysis.js';

// Utilities
export {
  log,
  logSection,
  logSubsection,
  delay,
  getTimestamp,
  ensureDir,
  saveJSON,
  loadJSON,
  buildUrlWithManager,
  extractFarmIds,
  formatDateISO,
  formatDateKorean,
  getDateRange
} from './utils.js';
