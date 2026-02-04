/**
 * Checkpoint Manager Module
 * Handles save/load/clear of checkpoint state for resume functionality
 * Provides date-level granularity with click tracking
 */

import fs from 'fs';

const CHECKPOINT_FILE = './checkpoint.json';

/**
 * Save checkpoint after each date processing
 * Includes: farm index, date index, farm name, click coordinates for debugging
 */
export function saveCheckpoint(data) {
  const checkpoint = {
    savedAt: new Date().toISOString(),
    farmIndex: data.farmIndex,
    farmName: data.farmName,
    dateIndex: data.dateIndex,
    dateString: data.dateString,
    totalFarms: data.totalFarms,
    totalDates: data.totalDates,
    // Click tracking for accuracy verification
    lastClickedPoints: data.clickedPoints || null,
    // Resume info
    resumeInfo: {
      nextFarm: data.dateIndex >= data.totalDates - 1 ? data.farmIndex + 1 : data.farmIndex,
      nextDate: data.dateIndex >= data.totalDates - 1 ? 0 : data.dateIndex + 1
    },
    // Run context
    manager: data.manager,
    mode: data.mode
  };
  
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    console.log(`     💾 Checkpoint saved: Farm ${data.farmIndex + 1}, Date ${data.dateIndex + 1}`);
  } catch (err) {
    console.log(`     ⚠️ Failed to save checkpoint: ${err.message}`);
  }
}

/**
 * Load checkpoint for resume functionality
 * @returns {Object|null} checkpoint data or null if not found
 */
export function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
      return data;
    }
  } catch (err) {
    console.log(`⚠️ Could not load checkpoint: ${err.message}`);
  }
  return null;
}

/**
 * Clear checkpoint (call after successful completion)
 */
export function clearCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
      console.log('✅ Checkpoint cleared (run completed successfully)');
    }
  } catch (err) {
    console.log(`⚠️ Could not clear checkpoint: ${err.message}`);
  }
}
