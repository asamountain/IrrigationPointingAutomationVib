/**
 * Configuration constants for Irrigation Report Automation
 */

export const CONFIG = {
  url: 'https://admin.iofarm.com/report/',
  username: 'admin@admin.com',
  password: 'jojin1234!!',
  targetName: '승진',
  outputDir: './data',
  screenshotDir: './screenshots',
  chartLearningMode: false,
  watchMode: false,
  trainingMode: process.env.TRAINING_MODE === 'true',
  visualConfirmationMode: true
};

export const TIMING = {
  API_RESPONSE_TIMEOUT: 15000,
  PAGE_LOAD_MIN_EXPECTED: 1500,
  TOO_FAST_THRESHOLD: 500,
  RETRY_DELAYS: [1000, 3000, 5000, 10000],
  MAX_RETRIES: 3
};

export const PATHS = {
  TRAINING_FILE: './training/training-data.json',
  CHECKPOINT_FILE: './history/checkpoint.json',
  CRASH_REPORTS_DIR: './crash-reports'
};

// Ensure directories exist
import fs from 'fs';
[CONFIG.outputDir, CONFIG.screenshotDir, './training', './history', PATHS.CRASH_REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
