/**
 * Training Data Manager - Learn from user corrections
 */

import fs from 'fs';
import { PATHS } from '../config.js';

const TRAINING_FILE = PATHS.TRAINING_FILE;

/**
 * Load training data from JSON file
 */
export function loadTrainingData() {
  try {
    if (fs.existsSync(TRAINING_FILE)) {
      const data = JSON.parse(fs.readFileSync(TRAINING_FILE, 'utf8'));
      return data;
    }
  } catch (err) {
    console.log(`⚠️ Could not load training data: ${err.message}`);
  }

  return {
    version: 1,
    corrections: [],
    statistics: {
      totalCorrections: 0,
      avgFirstOffset: 0,
      avgLastOffset: 0,
      lastUpdated: null
    },
    learnedAdjustments: {
      firstIndexBias: 0,
      lastIndexBias: 0
    }
  };
}

/**
 * Save training data to JSON file
 */
export function saveTrainingData(data) {
  try {
    fs.writeFileSync(TRAINING_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`  💾 Training data saved (${data.statistics.totalCorrections} corrections)`);
  } catch (err) {
    console.log(`  ❌ Could not save training data: ${err.message}`);
  }
}

/**
 * Save a correction to the training data
 */
export function saveCorrection(predicted, corrected, metadata = {}) {
  const training = loadTrainingData();

  const firstOffsetX = (corrected.firstScreenX || 0) - (predicted.firstScreenX || 0);
  const lastOffsetX = (corrected.lastScreenX || 0) - (predicted.lastScreenX || 0);

  if (Math.abs(firstOffsetX) < 5 && Math.abs(lastOffsetX) < 5) {
    console.log('  ℹ️ No significant correction detected, skipping save');
    return;
  }

  const correction = {
    timestamp: new Date().toISOString(),
    predicted: {
      firstScreenX: predicted.firstScreenX,
      lastScreenX: predicted.lastScreenX,
      firstIndex: predicted.firstIndex,
      lastIndex: predicted.lastIndex
    },
    corrected: {
      firstScreenX: corrected.firstScreenX,
      lastScreenX: corrected.lastScreenX
    },
    delta: {
      firstOffsetX: Math.round(firstOffsetX),
      lastOffsetX: Math.round(lastOffsetX)
    },
    metadata: {
      totalDataPoints: metadata.totalDataPoints || 0,
      chartWidth: metadata.chartWidth || 0
    }
  };

  training.corrections.push(correction);
  updateTrainingStatistics(training);
  saveTrainingData(training);

  console.log(`  🧠 Correction saved: first=${firstOffsetX > 0 ? '+' : ''}${Math.round(firstOffsetX)}px, last=${lastOffsetX > 0 ? '+' : ''}${Math.round(lastOffsetX)}px`);
}

/**
 * Update training statistics based on all corrections
 */
export function updateTrainingStatistics(training) {
  const corrections = training.corrections;

  if (corrections.length === 0) {
    training.statistics = {
      totalCorrections: 0,
      avgFirstOffset: 0,
      avgLastOffset: 0,
      lastUpdated: new Date().toISOString()
    };
    training.learnedAdjustments = { firstIndexBias: 0, lastIndexBias: 0 };
    return;
  }

  let totalFirstOffset = 0;
  let totalLastOffset = 0;
  let totalWeight = 0;

  corrections.forEach((c, i) => {
    const weight = 1 + (i / corrections.length);
    totalFirstOffset += (c.delta.firstOffsetX || 0) * weight;
    totalLastOffset += (c.delta.lastOffsetX || 0) * weight;
    totalWeight += weight;
  });

  const avgFirstOffset = totalWeight > 0 ? totalFirstOffset / totalWeight : 0;
  const avgLastOffset = totalWeight > 0 ? totalLastOffset / totalWeight : 0;

  training.statistics = {
    totalCorrections: corrections.length,
    avgFirstOffset: Math.round(avgFirstOffset * 10) / 10,
    avgLastOffset: Math.round(avgLastOffset * 10) / 10,
    avgOffset: Math.round((Math.abs(avgFirstOffset) + Math.abs(avgLastOffset)) / 2),
    lastUpdated: new Date().toISOString()
  };

  if (corrections.length >= 5) {
    training.learnedAdjustments = {
      firstIndexBias: Math.round(avgFirstOffset),
      lastIndexBias: Math.round(avgLastOffset)
    };
  } else {
    training.learnedAdjustments = { firstIndexBias: 0, lastIndexBias: 0 };
  }
}

/**
 * Apply learned adjustments to predicted screen coordinates
 */
export function applyLearnedAdjustments(firstScreenX, lastScreenX) {
  const training = loadTrainingData();

  if (training.statistics.totalCorrections < 5) {
    return { firstScreenX, lastScreenX, adjustmentsApplied: false };
  }

  const adjustedFirst = firstScreenX + training.learnedAdjustments.firstIndexBias;
  const adjustedLast = lastScreenX + training.learnedAdjustments.lastIndexBias;

  console.log(`  🧠 Applied learned adjustments: first${training.learnedAdjustments.firstIndexBias >= 0 ? '+' : ''}${training.learnedAdjustments.firstIndexBias}px, last${training.learnedAdjustments.lastIndexBias >= 0 ? '+' : ''}${training.learnedAdjustments.lastIndexBias}px`);

  return {
    firstScreenX: adjustedFirst,
    lastScreenX: adjustedLast,
    adjustmentsApplied: true,
    bias: training.learnedAdjustments
  };
}

/**
 * Get training statistics for display in overlay
 */
export function getTrainingStats() {
  const training = loadTrainingData();
  return training.statistics;
}
