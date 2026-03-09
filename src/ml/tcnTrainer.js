/**
 * TCN Online Trainer
 * Fine-tunes the TCN model every time the user confirms a corrected bar position.
 */

import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import path from 'path';
import { prepareSequence, saveModel } from './tcnModel.js';

export const TRAINING_COUNT_PATH = './training/tcn-training-count.json';

// Chart time range: 02:00 to 20:00 = 1080 minutes total
const CHART_START_MINUTES = 2 * 60;
const CHART_TOTAL_MINUTES = (20 - 2) * 60;

/**
 * Read the persisted training sample count (defaults to 0 if file missing).
 */
export function getTrainingCount() {
  try {
    if (fs.existsSync(TRAINING_COUNT_PATH)) {
      const data = JSON.parse(fs.readFileSync(TRAINING_COUNT_PATH, 'utf8'));
      return typeof data.count === 'number' ? data.count : 0;
    }
  } catch (_) {}
  return 0;
}

/**
 * Increment the persisted training count and return the new value.
 */
export function incrementTrainingCount() {
  const count = getTrainingCount() + 1;
  fs.writeFileSync(
    TRAINING_COUNT_PATH,
    JSON.stringify({ count, updatedAt: new Date().toISOString() })
  );
  return count;
}

/**
 * Convert a bar's screen X position to a [0, 1] norm using chart pixel bounds.
 * @param {number} screenX
 * @param {{ left: number, width: number }} chartBounds
 * @returns {number}
 */
export function screenXToNorm(screenX, chartBounds) {
  const norm = (screenX - chartBounds.left) / chartBounds.width;
  return Math.max(0, Math.min(1, norm));
}

/**
 * Fine-tune the model on a single user-corrected sample, then save weights.
 *
 * @param {object} model - TF.js LayersModel
 * @param {Array<{x: number, y: number}>} dataPoints - Raw chart data
 * @param {{ first: { screenX: number }, last: { screenX: number } }} correctedPositions
 * @param {{ left: number, width: number }} chartBounds
 */
export async function trainOnCorrection(model, dataPoints, correctedPositions, chartBounds) {
  if (!model || !dataPoints?.length || !correctedPositions || !chartBounds) {
    console.log('  ⚠️  TCN training skipped: missing required data');
    return;
  }

  const firstNorm = screenXToNorm(correctedPositions.corrected?.first?.screenX ?? chartBounds.left, chartBounds);
  const lastNorm  = screenXToNorm(correctedPositions.corrected?.last?.screenX  ?? chartBounds.left, chartBounds);

  console.log(`  🧠 TCN fine-tuning: corrected screenX first=${correctedPositions.corrected?.first?.screenX}, last=${correctedPositions.corrected?.last?.screenX}`);
  console.log(`  🧠 TCN fine-tuning: firstNorm=${firstNorm.toFixed(3)}, lastNorm=${lastNorm.toFixed(3)}`);

  const xs = prepareSequence(dataPoints);
  const ys = tf.tensor2d([[firstNorm, lastNorm]]);

  try {
    await model.fit(xs, ys, { epochs: 10, verbose: 0 });
    await saveModel(model);
    const newCount = incrementTrainingCount();
    console.log(`  ✅ TCN fine-tuned — total samples: ${newCount}`);
  } finally {
    xs.dispose();
    ys.dispose();
  }
}
