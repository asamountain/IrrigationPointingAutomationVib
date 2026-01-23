/**
 * Shared Utilities Module
 * Common helpers for logging, delays, and formatting
 */

import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 LOGGING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a formatted log message with timestamp
 * @param {string} message - The message to log
 * @param {string} level - Log level: 'info', 'success', 'warning', 'error'
 */
export function log(message, level = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = {
    info: '📋',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    step: '📍'
  }[level] || '📋';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Log a section header
 * @param {string} title - Section title
 */
export function logSection(title) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🎯 ${title}`);
  console.log(`${'═'.repeat(70)}\n`);
}

/**
 * Log a subsection header
 * @param {string} title - Subsection title
 */
export function logSubsection(title) {
  console.log(`\n  ${'─'.repeat(60)}`);
  console.log(`  📌 ${title}`);
  console.log(`  ${'─'.repeat(60)}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⏱️ TIMING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a timestamp string for filenames
 * @returns {string} - ISO timestamp safe for filenames
 */
export function getTimestamp() {
  return new Date().toISOString().replace(/:/g, '-').split('.')[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📁 FILE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ensure a directory exists, create if not
 * @param {string} dirPath - Directory path
 */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Save JSON data to file
 * @param {string} filePath - File path
 * @param {object} data - Data to save
 */
export function saveJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Load JSON data from file
 * @param {string} filePath - File path
 * @returns {object|null} - Parsed JSON or null if not found
 */
export function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔗 URL UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a URL with forced manager parameter
 * @param {string} baseUrl - The base URL (with or without query params)
 * @param {string} managerName - The manager name to force
 * @param {object} additionalParams - Additional query parameters
 * @returns {string} - The constructed URL
 */
export function buildUrlWithManager(baseUrl, managerName, additionalParams = {}) {
  // Remove any existing query string
  const cleanUrl = baseUrl.split('?')[0];
  const url = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://admin.iofarm.com${cleanUrl}`);
  
  // Force the manager parameter
  url.searchParams.set('manager', managerName);
  
  // Add any additional parameters
  for (const [key, value] of Object.entries(additionalParams)) {
    url.searchParams.set(key, value);
  }
  
  return url.toString();
}

/**
 * Extract farm IDs from a URL path
 * @param {string} urlOrPath - URL or path like /report/point/583/765
 * @returns {{farmId: string, sectionId: string}|null}
 */
export function extractFarmIds(urlOrPath) {
  const match = urlOrPath.match(/\/report\/point\/(\d+)\/(\d+)/);
  if (match) {
    return { farmId: match[1], sectionId: match[2] };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📅 DATE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format a date as YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string}
 */
export function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date in Korean locale
 * @param {Date} date - Date object
 * @returns {string}
 */
export function formatDateKorean(date) {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  });
}

/**
 * Get an array of dates from N days ago to today
 * @param {number} daysBack - Number of days to go back
 * @returns {Array<{date: Date, dateString: string, koreanDate: string, dayOffset: number}>}
 */
export function getDateRange(daysBack = 5) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dates = [];
  for (let offset = daysBack; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    
    dates.push({
      date,
      dateString: formatDateISO(date),
      koreanDate: formatDateKorean(date),
      dayOffset: offset
    });
  }
  
  return dates;
}

export default {
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
};
