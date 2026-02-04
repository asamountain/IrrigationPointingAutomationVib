/**
 * Visual Confirmation Module
 * Shows draggable vertical lines on charts for user verification in visual mode
 * Handles user keyboard input (Enter/Escape) for confirmation/skip
 */

import fs from 'fs';
import path from 'path';

/**
 * Show visual overlay on chart with DRAGGABLE VERTICAL LINES
 * RED line = FIRST click (첫 급액 시간) - drag to adjust
 * BLUE line = LAST click (마지막 급액 시간) - drag to adjust
 * 
 * Uses browser-scripts/overlay.js for draggable functionality
 * 
 * @param {Page} page - Playwright page
 * @param {Object} points - {first: {x, y, time, screenX, screenY}, last: {x, y, time, screenX, screenY}, nodeId}
 * @param {Object} stats - Learning stats (optional)
 * @returns {Promise<boolean>} - true if user confirmed, false if skipped
 */
export async function showClickOverlay(page, points, stats = null) {
  console.log('\n  👁️  VISUAL CONFIRMATION MODE - DRAGGABLE VERTICAL LINES');
  console.log('  ══════════════════════════════════════════════════════════════════');
  console.log('  🔴 RED line = FIRST irrigation time (첫 급액 시간) - DRAG to adjust');
  console.log('  🔵 BLUE line = LAST irrigation time (마지막 급액 시간) - DRAG to adjust');
  console.log('  ══════════════════════════════════════════════════════════════════\n');
  
  // Load the external overlay script with draggable functionality
  const overlayScriptPath = path.resolve('./browser-scripts/overlay.js');
  
  try {
    // Read the overlay script content
    const overlayScript = fs.readFileSync(overlayScriptPath, 'utf8');
    
    // Inject the overlay script into the page
    await page.evaluate((scriptContent) => {
      // Remove any existing overlay
      const existing = document.getElementById('irrigation-click-overlay');
      if (existing) existing.remove();
      
      // Execute the overlay script to define all functions
      eval(scriptContent);
    }, overlayScript);
    
    // Call createOverlay with points and stats
    await page.evaluate((pts, learningStats) => {
      if (typeof createOverlay === 'function') {
        createOverlay(pts, learningStats);
        console.log('[BROWSER] ✅ Draggable overlay created successfully');
      } else {
        console.error('[BROWSER] ❌ createOverlay function not found');
      }
    }, points, stats);
    
    console.log('  📍 FIRST (RED) line at: ' + (points.first?.time || 'N/A'));
    console.log('  📍 LAST (BLUE) line at: ' + (points.last?.time || 'N/A'));
    console.log('\n  🖱️  DRAG vertical lines to adjust times');
    console.log('  ⏳ Waiting for user confirmation...');
    console.log('     → Press ENTER to save (저장)');
    console.log('     → Press ESC to skip this date\n');
    
    return true;
  } catch (error) {
    console.error('  ❌ Error loading overlay script:', error.message);
    
    // Fallback: use simple inline overlay if external script fails
    console.log('  ⚠️  Falling back to simple overlay...');
    await page.evaluate((pts) => {
      const existing = document.getElementById('irrigation-click-overlay');
      if (existing) existing.remove();
      
      const overlay = document.createElement('div');
      overlay.id = 'irrigation-click-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
      
      const infoBox = document.createElement('div');
      infoBox.style.cssText = 'position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.85);color:white;padding:15px;border-radius:8px;font-family:monospace;z-index:100000;';
      infoBox.innerHTML = `
        <div style="color:#4CAF50;font-weight:bold;">👁️ Visual Confirmation (Simple Mode)</div>
        <div style="margin-top:10px;">🔴 FIRST: ${pts.first?.time || 'N/A'}</div>
        <div>🔵 LAST: ${pts.last?.time || 'N/A'}</div>
        <div style="margin-top:10px;border-top:1px solid #444;padding-top:10px;">
          <div style="color:#4CAF50;">Press ENTER to confirm</div>
          <div style="color:#FF9800;">Press ESC to skip</div>
        </div>
      `;
      overlay.appendChild(infoBox);
      document.body.appendChild(overlay);
    }, points);
    
    return true;
  }
}

/**
 * Remove the visual overlay from the page
 */
export async function removeClickOverlay(page) {
  await page.evaluate(() => {
    const overlay = document.getElementById('irrigation-click-overlay');
    if (overlay) overlay.remove();
  });
}

/**
 * Wait for user keyboard confirmation (Enter = confirm, Escape = skip)
 * @param {Page} page - Playwright page
 * @param {number} timeout - Max wait time in ms (default 100 seconds)
 * @returns {Promise<boolean>} - true if confirmed, false if skipped/timeout
 */
export async function waitForUserConfirmation(page, timeout = 100000) {
  return new Promise(async (resolve) => {
    let resolved = false;
    
    // Set up keyboard listener in browser
    await page.evaluate((timeoutMs) => {
      return new Promise((browserResolve) => {
        window._overlayConfirmed = null;
        
        const handler = (e) => {
          if (e.key === 'Enter') {
            window._overlayConfirmed = true;
            document.removeEventListener('keydown', handler);
            browserResolve(true);
          } else if (e.key === 'Escape') {
            window._overlayConfirmed = false;
            document.removeEventListener('keydown', handler);
            browserResolve(false);
          }
        };
        
        document.addEventListener('keydown', handler);
        
        // Timeout fallback
        setTimeout(() => {
          document.removeEventListener('keydown', handler);
          if (window._overlayConfirmed === null) {
            window._overlayConfirmed = true; // Auto-confirm on timeout
          }
          browserResolve(window._overlayConfirmed);
        }, timeoutMs);
      });
    }, timeout).then(async (result) => {
      if (!resolved) {
        resolved = true;
        await removeClickOverlay(page);
        if (result) {
          console.log('  ✅ Confirmed (Enter pressed or auto-confirmed)');
        } else {
          console.log('  ⏭️  Skipped (Escape pressed)');
        }
        resolve(result);
      }
    });
  });
}
