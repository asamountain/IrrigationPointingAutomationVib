/**
 * TCN (Temporal Convolutional Network) Model
 * Predicts first/last irrigation times from moisture sensor time-series data.
 *
 * Uses @tensorflow/tfjs (pure JS) — no native bindings, works on any platform.
 * Weights are persisted as plain JSON so no file:// IOHandler is needed.
 *
 * Input:  [1440, 1] — one moisture value per minute, normalized to [0, 1]
 * Output: [firstNorm, lastNorm] — normalized positions in chart range 02:00–20:00
 */

import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TCN_MODEL_PATH = path.resolve(__dirname, '../../training/tcn-model');
export const MAX_SEQ_LENGTH = 1440;

// Chart time range: 02:00 to 20:00 = 1080 minutes total
const CHART_START_MINUTES = 2 * 60;    // 120
const CHART_TOTAL_MINUTES = (20 - 2) * 60; // 1080

/**
 * Build and compile the model.
 * Stacked Conv1D + MaxPool1D blocks provide multi-scale temporal coverage.
 */
export function createTCNModel() {
  const input = tf.input({ shape: [MAX_SEQ_LENGTH, 1] });

  let x = input;
  x = tf.layers.conv1d({ filters: 32, kernelSize: 3, padding: 'same', activation: 'relu' }).apply(x);
  x = tf.layers.maxPool1d({ poolSize: 2 }).apply(x);  // → [720, 32]
  x = tf.layers.conv1d({ filters: 32, kernelSize: 3, padding: 'same', activation: 'relu' }).apply(x);
  x = tf.layers.maxPool1d({ poolSize: 2 }).apply(x);  // → [360, 32]
  x = tf.layers.conv1d({ filters: 64, kernelSize: 3, padding: 'same', activation: 'relu' }).apply(x);
  x = tf.layers.maxPool1d({ poolSize: 2 }).apply(x);  // → [180, 64]
  x = tf.layers.conv1d({ filters: 64, kernelSize: 3, padding: 'same', activation: 'relu' }).apply(x);
  x = tf.layers.maxPool1d({ poolSize: 2 }).apply(x);  // → [90, 64]

  x = tf.layers.globalAveragePooling1d().apply(x);
  x = tf.layers.dense({ units: 32, activation: 'relu' }).apply(x);
  const output = tf.layers.dense({ units: 2, activation: 'sigmoid' }).apply(x);

  const model = tf.model({ inputs: input, outputs: output });
  model.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });
  return model;
}

/**
 * Save model weights to JSON (platform-independent, no native bindings needed).
 */
export async function saveModel(model) {
  fs.mkdirSync(TCN_MODEL_PATH, { recursive: true });

  const weightData = [];
  for (const layer of model.layers) {
    const weights = layer.getWeights();
    if (weights.length > 0) {
      const arrays = await Promise.all(
        weights.map(async w => ({
          shape: w.shape,
          dtype: w.dtype,
          data: Array.from(await w.data())
        }))
      );
      weightData.push({ layerName: layer.name, weights: arrays });
    }
  }

  fs.writeFileSync(
    path.join(TCN_MODEL_PATH, 'weights.json'),
    JSON.stringify(weightData)
  );
}

/**
 * Load saved weights into a fresh model instance.
 * Returns null if no saved weights exist.
 */
export async function loadSavedWeights() {
  const weightsPath = path.join(TCN_MODEL_PATH, 'weights.json');
  if (!fs.existsSync(weightsPath)) return null;

  const model = createTCNModel();
  const weightData = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));

  for (const { layerName, weights } of weightData) {
    try {
      const layer = model.getLayer(layerName);
      const tensors = weights.map(w => tf.tensor(w.data, w.shape, w.dtype));
      layer.setWeights(tensors);
      tensors.forEach(t => t.dispose());
    } catch (_) {
      // Layer may not match if architecture changed — skip gracefully
    }
  }

  return model;
}

/**
 * Load saved weights if they exist, otherwise create a fresh model (cold start).
 */
export async function loadOrCreateModel() {
  const weightsPath = path.join(TCN_MODEL_PATH, 'weights.json');
  if (fs.existsSync(weightsPath)) {
    try {
      const model = await loadSavedWeights();
      console.log('  🧠 TCN model loaded from disk');
      return model;
    } catch (e) {
      console.log(`  ⚠️  Could not load TCN weights (${e.message}), creating fresh`);
    }
  }
  console.log('  🧠 Creating fresh TCN model (cold start)');
  return createTCNModel();
}

/**
 * Convert raw dataPoints to a normalized [1, MAX_SEQ_LENGTH, 1] input tensor.
 */
export function prepareSequence(dataPoints) {
  const yValues = dataPoints.map(p => p.y);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const yRange = maxY - minY || 1;

  const seq = new Float32Array(MAX_SEQ_LENGTH);
  const len = Math.min(yValues.length, MAX_SEQ_LENGTH);
  for (let i = 0; i < len; i++) {
    seq[i] = (yValues[i] - minY) / yRange;
  }

  return tf.tensor(seq, [1, MAX_SEQ_LENGTH, 1]);
}

/**
 * Convert a [0, 1] norm to "HH:MM" within 02:00–20:00.
 */
export function normToTimeString(norm) {
  const totalMin = Math.round(Math.max(0, Math.min(1, norm)) * CHART_TOTAL_MINUTES);
  const absMin = totalMin + CHART_START_MINUTES;
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Convert "HH:MM" (or "HH:MM AM/PM") to a [0, 1] norm within 02:00–20:00.
 */
export function timeStringToNorm(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!parts) return null;
  let hours = parseInt(parts[1]);
  const minutes = parseInt(parts[2]);
  if (/pm/i.test(timeStr) && hours < 12) hours += 12;
  if (/am/i.test(timeStr) && hours === 12) hours = 0;
  const minutesFromStart = hours * 60 + minutes - CHART_START_MINUTES;
  return Math.max(0, Math.min(1, minutesFromStart / CHART_TOTAL_MINUTES));
}
