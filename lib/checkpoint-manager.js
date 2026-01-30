/**
 * Checkpoint Manager - Save/Load/Clear run progress for resume functionality
 */

import fs from 'fs';
import { PATHS } from '../config.js';

const CHECKPOINT_FILE = PATHS.CHECKPOINT_FILE;

/**
 * Save checkpoint after each date processing
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
    lastClickedPoints: data.clickedPoints || null,
    resumeInfo: {
      nextFarm: data.dateIndex >= data.totalDates - 1 ? data.farmIndex + 1 : data.farmIndex,
      nextDate: data.dateIndex >= data.totalDates - 1 ? 0 : data.dateIndex + 1
    },
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
