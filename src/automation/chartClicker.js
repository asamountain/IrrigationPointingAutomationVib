/**
 * Chart Clicker Module
 * Handles mouse clicking operations on Highcharts
 * 
 * Focuses input fields and performs precise chart clicks
 */

import { log } from '../utils.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 🖱️ CHART CLICKING OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Click the FIRST irrigation point on the chart
 * @param {Page} page - Playwright page
 * @param {object} coords - {x, y, svgX, svgY, type}
 * @param {object} options - {applyOffset: boolean, offset: {x, y}}
 * @returns {Promise<boolean>}
 */
export async function clickFirstIrrigationPoint(page, coords, options = {}) {
  const { applyOffset = false, offset = { x: 0, y: 0 } } = options;
  
  try {
    let finalCoords = coords;
    
    // Apply learned corrections if specified
    if (applyOffset) {
      const correctedX = coords.x + offset.x;
      const correctedY = coords.y + offset.y;
      log(`   🎓 Applying learned correction: (${offset.x.toFixed(1)}, ${offset.y.toFixed(1)})`, 'info');
      finalCoords = { ...coords, x: Math.round(correctedX), y: Math.round(correctedY) };
    }
    
    log(`✅ Clicking FIRST irrigation time (START of irrigation)`, 'step');
    log(`   → Screen Coord: (${finalCoords.x}, ${finalCoords.y}) - 15px ABOVE line`, 'info');
    log(`   → SVG Line Coord: (${finalCoords.svgX}, ${finalCoords.svgY})`, 'info');
    log(`   → Type: ${finalCoords.type || 'START'}`, 'info');
    
    // Focus first time input field
    await page.click('input[type="time"]:nth-of-type(1)');
    
    // Click chart at calculated position
    await page.mouse.click(finalCoords.x, finalCoords.y);
    
    // Brief wait for UI to register click
    await page.waitForTimeout(500);
    
    return true;
    
  } catch (error) {
    log(`Error clicking first irrigation point: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Click the LAST irrigation point on the chart
 * @param {Page} page - Playwright page
 * @param {object} coords - {x, y, svgX, svgY, type}
 * @param {object} options - {applyOffset: boolean, offset: {x, y}}
 * @returns {Promise<boolean>}
 */
export async function clickLastIrrigationPoint(page, coords, options = {}) {
  const { applyOffset = false, offset = { x: 0, y: 0 } } = options;
  
  try {
    let finalCoords = coords;
    
    // Apply learned corrections if specified
    if (applyOffset) {
      const correctedX = coords.x + offset.x;
      const correctedY = coords.y + offset.y;
      log(`   🎓 Applying learned correction: (${offset.x.toFixed(1)}, ${offset.y.toFixed(1)})`, 'info');
      finalCoords = { ...coords, x: Math.round(correctedX), y: Math.round(correctedY) };
    }
    
    log(`✅ Clicking LAST irrigation time (END of irrigation)`, 'step');
    log(`   → Screen Coord: (${finalCoords.x}, ${finalCoords.y}) - 15px ABOVE line`, 'info');
    log(`   → SVG Line Coord: (${finalCoords.svgX}, ${finalCoords.svgY})`, 'info');
    log(`   → Type: ${finalCoords.type || 'END'}`, 'info');
    
    // Focus LAST time input field
    const timeInputs = await page.$$('input[type="time"]');
    if (timeInputs.length > 1) {
      await timeInputs[timeInputs.length - 1].click();
    }
    
    // Click chart at calculated position
    await page.mouse.click(finalCoords.x, finalCoords.y);
    
    // Brief wait for table update
    await page.waitForTimeout(500);
    
    return true;
    
  } catch (error) {
    log(`Error clicking last irrigation point: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Focus a specific time input field by index
 * @param {Page} page - Playwright page
 * @param {number} index - 0-based index (0 = first, -1 = last)
 * @returns {Promise<boolean>}
 */
export async function focusTimeInput(page, index = 0) {
  try {
    const timeInputs = await page.$$('input[type="time"]');
    
    if (timeInputs.length === 0) {
      log('No time input fields found', 'warning');
      return false;
    }
    
    if (index === -1) {
      // Focus last input
      await timeInputs[timeInputs.length - 1].click();
    } else if (index >= 0 && index < timeInputs.length) {
      // Focus specific index
      await timeInputs[index].click();
    } else {
      log(`Invalid time input index: ${index}`, 'warning');
      return false;
    }
    
    return true;
    
  } catch (error) {
    log(`Error focusing time input: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Verify that a chart click was registered (table was updated)
 * @param {Page} page - Playwright page
 * @param {string} fieldType - 'first' or 'last'
 * @returns {Promise<boolean>}
 */
export async function verifyClickRegistered(page, fieldType = 'first') {
  try {
    // Wait a moment for table to update
    await page.waitForTimeout(500);
    
    const hasValue = await page.evaluate((type) => {
      const timeInputs = Array.from(document.querySelectorAll('input[type="time"]'));
      
      if (type === 'first' && timeInputs.length > 0) {
        return timeInputs[0].value !== '';
      } else if (type === 'last' && timeInputs.length > 1) {
        return timeInputs[timeInputs.length - 1].value !== '';
      }
      
      return false;
    }, fieldType);
    
    return hasValue;
    
  } catch (error) {
    log(`Error verifying click: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Create click tracking data for checkpoint
 * @param {string} type - 'FIRST' or 'LAST'
 * @param {object} coords - {x, y, svgX, svgY}
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @returns {object} - Checkpoint data
 */
export function createClickCheckpoint(type, coords, dateString) {
  return {
    type,
    screenX: coords.x,
    screenY: coords.y,
    svgX: coords.svgX,
    svgY: coords.svgY,
    date: dateString,
    timestamp: new Date().toISOString()
  };
}
