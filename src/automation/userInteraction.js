/**
 * User Interaction Module
 * Learning mode visual overlays and user correction collection
 * 
 * Shows green/red circles for algorithm predictions
 * Waits for user to click corrections (yellow/orange)
 */

import fs from 'fs';
import path from 'path';
import { log } from '../utils.js';

const TRAINING_FILE = path.join(process.cwd(), 'training', 'training-data.json');

// ═══════════════════════════════════════════════════════════════════════════════
// 🎓 LEARNING MODE - VISUAL OVERLAY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Show learning mode overlay with visual markers
 * @param {Page} page - Playwright page
 * @param {object} firstCoords - {x, y} First point coordinates
 * @param {object} lastCoords - {x, y} Last point coordinates
 * @returns {Promise<boolean>}
 */
export async function showLearningOverlay(page, firstCoords, lastCoords) {
  log('🎓 CHART LEARNING MODE ACTIVE', 'step');
  log(`   Algorithm will click at:`, 'info');
  log(`   → FIRST: Screen(${firstCoords.x}, ${firstCoords.y})`, 'info');
  log(`   → LAST: Screen(${lastCoords.x}, ${lastCoords.y})`, 'info');
  
  try {
    // Draw BIG visible indicators on the page using HTML overlays
    await page.evaluate((first, last) => {
      // Create instruction banner at top
      const banner = document.createElement('div');
      banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        text-align: center;
        font-size: 20px;
        font-weight: bold;
        z-index: 1000000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
      `;
      banner.innerHTML = `
        🎓 LEARNING MODE ACTIVE 🎓<br>
        <span style="font-size: 16px; font-weight: normal;">
          🟢 Green circle = Algorithm's FIRST point | 🔴 Red circle = Algorithm's LAST point<br>
          ✅ Correct? Just wait 30 seconds | ❌ Wrong? Click correct spots (Yellow then Orange)
        </span>
      `;
      document.body.appendChild(banner);
      
      // Create overlay container
      const overlay = document.createElement('div');
      overlay.id = 'learning-overlay';
      overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 999999;';
      
      // Draw FIRST point marker (GREEN) - HUGE and visible
      const firstMarker = document.createElement('div');
      firstMarker.style.cssText = `
        position: absolute;
        left: ${first.x - 50}px;
        top: ${first.y - 50}px;
        width: 100px;
        height: 100px;
        border: 8px solid lime;
        border-radius: 50%;
        background: rgba(0, 255, 0, 0.3);
        pointer-events: none;
        animation: pulse 1s infinite;
        box-shadow: 0 0 30px rgba(0, 255, 0, 0.8);
      `;
      
      // Add label with arrow
      const firstLabel = document.createElement('div');
      firstLabel.innerHTML = '↓ FIRST START ↓';
      firstLabel.style.cssText = `
        position: absolute;
        left: ${first.x - 70}px;
        top: ${first.y - 80}px;
        background: lime;
        color: black;
        padding: 10px 15px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 18px;
        pointer-events: none;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
      `;
      
      // Draw LAST point marker (RED) - HUGE and visible
      const lastMarker = document.createElement('div');
      lastMarker.style.cssText = `
        position: absolute;
        left: ${last.x - 50}px;
        top: ${last.y - 50}px;
        width: 100px;
        height: 100px;
        border: 8px solid red;
        border-radius: 50%;
        background: rgba(255, 0, 0, 0.3);
        pointer-events: none;
        animation: pulse 1s infinite;
        box-shadow: 0 0 30px rgba(255, 0, 0, 0.8);
      `;
      
      // Add label with arrow
      const lastLabel = document.createElement('div');
      lastLabel.innerHTML = '↓ LAST END ↓';
      lastLabel.style.cssText = `
        position: absolute;
        left: ${last.x - 65}px;
        top: ${last.y - 80}px;
        background: red;
        color: white;
        padding: 10px 15px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 18px;
        pointer-events: none;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
      `;
      
      // Add pulsing animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
        }
      `;
      
      document.head.appendChild(style);
      overlay.appendChild(firstMarker);
      overlay.appendChild(firstLabel);
      overlay.appendChild(lastMarker);
      overlay.appendChild(lastLabel);
      document.body.appendChild(overlay);
      
      // Setup click recorder
      window.learningClicks = [];
      const clickHandler = (e) => {
        window.learningClicks.push({
          svgX: e.clientX,
          svgY: e.clientY,
          screenX: e.clientX,
          screenY: e.clientY
        });
        
        // Visual feedback for user clicks
        const userMarker = document.createElement('div');
        userMarker.style.cssText = `
          position: absolute;
          left: ${e.clientX - 20}px;
          top: ${e.clientY - 20}px;
          width: 40px;
          height: 40px;
          border: 4px solid ${window.learningClicks.length === 1 ? 'yellow' : 'orange'};
          border-radius: 50%;
          background: rgba(255, 255, 0, 0.3);
          pointer-events: none;
          z-index: 999999;
        `;
        overlay.appendChild(userMarker);
        
        console.log(`✅ [BROWSER] Recorded user click #${window.learningClicks.length}: (${Math.round(e.clientX)}, ${Math.round(e.clientY)})`);
      };
      document.addEventListener('click', clickHandler, true);
      window.removeClickHandler = () => {
        document.removeEventListener('click', clickHandler, true);
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        if (banner && banner.parentNode) {
          banner.parentNode.removeChild(banner);
        }
      };
    }, firstCoords, lastCoords);
    
    return true;
    
  } catch (error) {
    log(`Error showing learning overlay: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Add countdown timer to page
 * @param {Page} page - Playwright page
 * @param {number} seconds - Countdown duration
 * @returns {Promise<boolean>}
 */
export async function addCountdownTimer(page, seconds = 30) {
  try {
    await page.evaluate((secs) => {
      const timer = document.createElement('div');
      timer.id = 'countdown-timer';
      timer.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px 30px;
        border-radius: 10px;
        font-size: 48px;
        font-weight: bold;
        z-index: 1000001;
        font-family: 'Arial', monospace;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      `;
      timer.textContent = secs.toString();
      document.body.appendChild(timer);
      
      let countdown = secs;
      const interval = setInterval(() => {
        countdown--;
        timer.textContent = countdown;
        if (countdown <= 0) {
          clearInterval(interval);
          timer.textContent = 'GO!';
          timer.style.background = 'rgba(0, 255, 0, 0.8)';
          timer.style.color = 'black';
        } else if (countdown <= 10) {
          timer.style.background = 'rgba(255, 0, 0, 0.8)';
          timer.style.fontSize = '60px';
        }
      }, 1000);
    }, seconds);
    
    return true;
    
  } catch (error) {
    log(`Error adding countdown timer: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Collect user corrections after waiting period
 * @param {Page} page - Playwright page
 * @param {number} timeout - Wait time in milliseconds
 * @returns {Promise<Array>} - Array of user clicks
 */
export async function collectUserCorrections(page, timeout = 20000) {
  log(`⏱️  Waiting ${timeout / 1000} seconds for corrections...`, 'step');
  
  try {
    // Wait for user input
    await page.waitForTimeout(timeout);
    
    // Collect clicks and cleanup
    const userCorrections = await page.evaluate(() => {
      const clicks = window.learningClicks || [];
      if (window.removeClickHandler) window.removeClickHandler();
      return clicks;
    });
    
    if (userCorrections.length > 0) {
      log(`📝 Recorded ${userCorrections.length} user corrections`, 'success');
    } else {
      log(`✅ User accepted algorithm detection (no corrections)`, 'success');
    }
    
    return userCorrections;
    
  } catch (error) {
    log(`Error collecting user corrections: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Save training data to JSON file
 * @param {object} entry - Training entry
 * @returns {Promise<boolean>}
 */
export async function saveTrainingData(entry) {
  try {
    // Ensure training directory exists
    const trainingDir = path.dirname(TRAINING_FILE);
    if (!fs.existsSync(trainingDir)) {
      fs.mkdirSync(trainingDir, { recursive: true });
    }
    
    // Read existing data
    let trainingData = [];
    if (fs.existsSync(TRAINING_FILE)) {
      trainingData = JSON.parse(fs.readFileSync(TRAINING_FILE, 'utf8'));
    }
    
    // Append new entry
    trainingData.push(entry);
    
    // Write back to file
    fs.writeFileSync(TRAINING_FILE, JSON.stringify(trainingData, null, 2));
    
    log(`Saved to training/training-data.json`, 'info');
    return true;
    
  } catch (error) {
    log(`Error saving training data: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Load learned offsets from training data
 * @returns {object} - {count, firstX, firstY, lastX, lastY}
 */
export function loadLearnedOffsets() {
  try {
    if (!fs.existsSync(TRAINING_FILE)) {
      return { count: 0, firstX: 0, firstY: 0, lastX: 0, lastY: 0 };
    }
    
    const trainingData = JSON.parse(fs.readFileSync(TRAINING_FILE, 'utf8'));
    
    // Calculate average offsets from user corrections
    let totalFirstX = 0, totalFirstY = 0;
    let totalLastX = 0, totalLastY = 0;
    let count = 0;
    
    trainingData.forEach(entry => {
      if (entry.userCorrections && entry.algorithmDetection) {
        if (entry.userCorrections.first && entry.algorithmDetection.first) {
          totalFirstX += entry.userCorrections.first.svgX - entry.algorithmDetection.first.svgX;
          totalFirstY += entry.userCorrections.first.svgY - entry.algorithmDetection.first.svgY;
        }
        if (entry.userCorrections.last && entry.algorithmDetection.last) {
          totalLastX += entry.userCorrections.last.svgX - entry.algorithmDetection.last.svgX;
          totalLastY += entry.userCorrections.last.svgY - entry.algorithmDetection.last.svgY;
        }
        count++;
      }
    });
    
    if (count === 0) {
      return { count: 0, firstX: 0, firstY: 0, lastX: 0, lastY: 0 };
    }
    
    return {
      count,
      firstX: totalFirstX / count,
      firstY: totalFirstY / count,
      lastX: totalLastX / count,
      lastY: totalLastY / count
    };
    
  } catch (error) {
    log(`Error loading learned offsets: ${error.message}`, 'error');
    return { count: 0, firstX: 0, firstY: 0, lastX: 0, lastY: 0 };
  }
}

/**
 * Create training entry object
 * @param {object} data - {date, farm, algorithmDetection, userCorrections}
 * @returns {object} - Training entry
 */
export function createTrainingEntry(data) {
  const { date, farm, algorithmDetection, userCorrections } = data;
  
  return {
    timestamp: new Date().toISOString(),
    date,
    farm,
    algorithmDetection,
    userCorrections: userCorrections.length > 0 ? {
      first: userCorrections[0] || null,
      last: userCorrections[1] || null
    } : null,
    feedback: userCorrections.length === 0 
      ? 'User accepted algorithm detection' 
      : `User made ${userCorrections.length} corrections`
  };
}
