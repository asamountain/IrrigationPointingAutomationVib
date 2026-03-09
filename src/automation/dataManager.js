/**
 * Data Manager Module
 * Save farm data, run statistics, and history tracking
 * 
 * Handles JSON output, statistics reporting, and optional CSV export
 */

import fs from 'fs';
import path from 'path';
import { log } from '../utils.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 💾 DATA SAVING OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save farm data to JSON file
 * @param {Array} farmData - Array of farm date data
 * @param {string} outputDir - Output directory path
 * @param {string} farmName - Farm name for filename
 * @returns {Promise<string>} - Path to saved file
 */
export async function saveFarmData(farmData, outputDir, farmName) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const safeFilename = farmName.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const filename = `${safeFilename}_${timestamp}.json`;
    const filepath = path.join(outputDir, filename);
    
    // Write JSON file
    fs.writeFileSync(filepath, JSON.stringify(farmData, null, 2));
    
    log(`💾 Saved farm data: ${filename}`, 'success');
    return filepath;
    
  } catch (error) {
    log(`Error saving farm data: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Save run statistics to JSON file
 * @param {object} stats - Run statistics object
 * @param {string} outputDir - Output directory path
 * @returns {Promise<string>} - Path to saved file
 */
export async function saveRunStatistics(stats, outputDir) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `run-statistics_${timestamp}.json`;
    const filepath = path.join(outputDir, filename);
    
    // Add completion timestamp
    stats.completedAt = new Date().toISOString();
    
    // Write JSON file
    fs.writeFileSync(filepath, JSON.stringify(stats, null, 2));
    
    log(`📊 Saved run statistics: ${filename}`, 'success');
    return filepath;
    
  } catch (error) {
    log(`Error saving run statistics: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Add entry to history log
 * @param {object} data - History entry data
 * @param {string} historyDir - History directory path
 * @returns {Promise<boolean>}
 */
export async function addToHistory(data, historyDir) {
  try {
    // Ensure history directory exists
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    
    const historyFile = path.join(historyDir, 'history.json');
    
    // Read existing history
    let history = [];
    if (fs.existsSync(historyFile)) {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    }
    
    // Add new entry
    history.push({
      timestamp: new Date().toISOString(),
      ...data
    });
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history = history.slice(-100);
    }
    
    // Write back
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    
    return true;
    
  } catch (error) {
    log(`Error adding to history: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Export farm data to CSV format
 * @param {Array} farmData - Array of farm date data
 * @param {string} outputDir - Output directory path
 * @param {string} farmName - Farm name for filename
 * @returns {Promise<string>} - Path to saved file
 */
export async function exportToCSV(farmData, outputDir, farmName) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const safeFilename = farmName.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const filename = `${safeFilename}_${timestamp}.csv`;
    const filepath = path.join(outputDir, filename);
    
    // Generate CSV content
    const headers = ['Date', 'First Irrigation Time', 'Last Irrigation Time', 'Extracted At'];
    const rows = farmData.map(entry => [
      entry.date || '',
      entry.firstIrrigationTime || '',
      entry.lastIrrigationTime || '',
      entry.extractedAt || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Write CSV file
    fs.writeFileSync(filepath, csvContent, 'utf8');
    
    log(`📄 Saved CSV export: ${filename}`, 'success');
    return filepath;
    
  } catch (error) {
    log(`Error exporting to CSV: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Initialize run statistics object
 * @param {object} config - Configuration object
 * @returns {object} - Statistics object
 */
export function initializeRunStats(config = {}) {
  return {
    startedAt: new Date().toISOString(),
    manager: config.manager || 'Unknown',
    mode: config.chartLearningMode ? 'learning' : (config.watchMode ? 'watch' : 'normal'),
    farmsProcessed: 0,
    datesProcessed: 0,
    successCount: 0,
    skipCount: 0,
    errorCount: 0,
    chartsClicked: 0,
    dateRange: {
      start: null,
      end: null
    }
  };
}

/**
 * Print run summary to console
 * @param {object} stats - Run statistics object
 */
export function printRunSummary(stats) {
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RUN SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Manager: ${stats.manager}`);
  console.log(`Mode: ${stats.mode}`);
  console.log(`Duration: ${stats.startedAt} → ${stats.completedAt || 'In Progress'}`);
  console.log(`\nFarms Processed: ${stats.farmsProcessed}`);
  console.log(`Dates Processed: ${stats.datesProcessed}`);
  console.log(`  ✅ Success: ${stats.successCount}`);
  console.log(`  ⏭️  Skipped: ${stats.skipCount}`);
  console.log(`  ❌ Errors: ${stats.errorCount}`);
  console.log(`\nChart Clicks: ${stats.chartsClicked}`);
  console.log(`Date Range: ${stats.dateRange.start || 'N/A'} → ${stats.dateRange.end || 'N/A'}`);
  console.log('═'.repeat(70) + '\n');
}

/**
 * Create date data entry
 * @param {object} data - Date data
 * @returns {object} - Formatted date entry
 */
export function createDateDataEntry(data) {
  const {
    date,
    firstIrrigationTime = null,
    lastIrrigationTime = null,
    alreadyFilled = false,
    error = null
  } = data;
  
  return {
    date,
    firstIrrigationTime,
    lastIrrigationTime,
    extractedAt: new Date().toISOString(),
    alreadyFilled,
    ...(error && { error })
  };
}

/**
 * Validate output directory and create if needed
 * @param {string} dirPath - Directory path
 * @returns {boolean}
 */
export function ensureOutputDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      log(`Created output directory: ${dirPath}`, 'info');
    }
    return true;
  } catch (error) {
    log(`Error creating output directory: ${error.message}`, 'error');
    return false;
  }
}
