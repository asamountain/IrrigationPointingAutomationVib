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
  console.log('  📂 Loading overlay script from:', overlayScriptPath);
  
  try {
    // Check if file exists
    if (!fs.existsSync(overlayScriptPath)) {
      console.error('  ❌ overlay.js file NOT FOUND at:', overlayScriptPath);
      return false;
    }
    
    // Read the overlay script content
    const overlayScript = fs.readFileSync(overlayScriptPath, 'utf8');
    console.log('  ✅ overlay.js loaded, size:', overlayScript.length, 'bytes');
    
    // Inject the overlay script into the page
    console.log('  ⏳ Injecting overlay script into browser...');
    await page.evaluate((scriptContent) => {
      console.log('[BROWSER] Starting overlay script injection...');
      // Remove any existing overlay
      const existing = document.getElementById('irrigation-click-overlay');
      if (existing) {
        existing.remove();
        console.log('[BROWSER] Removed existing overlay');
      }
      
      // Execute the overlay script to define all functions
      try {
        eval(scriptContent);
        console.log('[BROWSER] ✅ overlay.js eval() completed successfully');
        console.log('[BROWSER] createOverlay function exists:', typeof createOverlay === 'function');
      } catch (evalError) {
        console.error('[BROWSER] ❌ overlay.js eval() FAILED:', evalError.message);
      }
    }, overlayScript);
    console.log('  ✅ Overlay script injected');
    
    // Call createOverlay with points and stats - wrapped in single object for page.evaluate
    console.log('  ⏳ Calling createOverlay() in browser...');
    const evalArg = { pts: points, learningStats: stats };
    const createResult = await page.evaluate((arg) => {
      const { pts, learningStats } = arg;
      console.log('[BROWSER] createOverlay called with:', JSON.stringify(pts));
      if (typeof createOverlay === 'function') {
        try {
          createOverlay(pts, learningStats);
          console.log('[BROWSER] ✅ Draggable overlay created successfully');
          // Check if overlay was actually created
          const overlay = document.getElementById('irrigation-click-overlay');
          console.log('[BROWSER] Overlay element exists:', !!overlay);
          return { success: true, overlayExists: !!overlay };
        } catch (createError) {
          console.error('[BROWSER] ❌ createOverlay threw error:', createError.message);
          return { success: false, error: createError.message };
        }
      } else {
        console.error('[BROWSER] ❌ createOverlay function not found! typeof:', typeof createOverlay);
        return { success: false, error: 'createOverlay function not defined' };
      }
    }, evalArg);
    
    console.log('  📋 createOverlay result:', JSON.stringify(createResult));

    // Retry once if overlay was not created (e.g. chart container not ready yet)
    if (!createResult.overlayExists) {
      console.log('  ⚠️  Overlay not found after first attempt — waiting 1.5s and retrying...');
      await page.waitForTimeout(1500);
      await page.evaluate((arg) => {
        if (typeof createOverlay === 'function') {
          createOverlay(arg.pts, arg.learningStats);
        }
      }, evalArg);
      const retryExists = await page.evaluate(() => !!document.getElementById('irrigation-click-overlay'));
      console.log('  📋 Retry overlay exists:', retryExists);
    }
    
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
 * @param {number} timeout - Max wait time in ms (default 5 minutes)
 * @returns {Promise<boolean>} - true if confirmed, false if skipped/timeout
 */
export async function waitForUserConfirmation(page, timeout = 300000) {
  console.log('  ⏳ waitForUserConfirmation: Starting keyboard listener...');
  
  // CRITICAL: Bring page to front to ensure it can receive keyboard input
  try {
    await page.bringToFront();
    console.log('  ✅ Page brought to front for keyboard input');
  } catch (e) {
    console.log('  ⚠️  Could not bring page to front:', e.message);
  }
  
  // Focus the body to give the page keyboard focus without triggering website click handlers.
  // page.mouse.click(x, y) was used here before but it fires a real click that can land on
  // a website element (nav link, button, input) and change page state or steal focus.
  // page.focus('body') sets activeElement without dispatching any click events.
  try {
    await page.focus('body');
    console.log('  ✅ Body focused for keyboard input');
  } catch (e) {
    console.log('  ⚠️  Body focus failed:', e.message);
  }
  
  return new Promise((resolve) => {
    console.log('  👁️  WAITING FOR USER INPUT (ENTER=confirm, ESC=skip)...');

    // Step 1: Init flag + install capture-phase keyboard listener (non-blocking).
    // Using fire-and-forget evaluate so we are NOT subject to Playwright's 30s evaluate() limit.
    page.evaluate(() => {
      window._overlayResult = null;
      // Clean up any leftover listener from a previous call
      if (window._overlayKeyHandler) {
        document.removeEventListener('keydown', window._overlayKeyHandler, true);
      }
      window._overlayKeyHandler = (e) => {
        console.log('[BROWSER] Key pressed:', e.key);
        if (e.key === ',') {
          // Click 저장 without dismissing overlay — automation stays put
          const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '저장');
          if (saveBtn) {
            saveBtn.click();
            console.log('[BROWSER] , pressed — clicked 저장 button, overlay stays open');
          } else {
            console.warn('[BROWSER] , pressed but 저장 button not found');
          }
          return; // do NOT set _overlayResult
        }

        if (e.key === 'Enter')                  window._overlayResult = true;
        else if (e.key === 'Escape')            window._overlayResult = false;
        else if (e.key.toLowerCase() === 'j')  window._overlayResult = 'prev-farm';
        else if (e.key.toLowerCase() === 'k')  window._overlayResult = 'next-farm';
        else if (e.key.toLowerCase() === 'h')  window._overlayResult = 'prev-day';
        else if (e.key.toLowerCase() === 'l')  window._overlayResult = 'next-day';

        if (window._overlayResult !== null) {
          document.removeEventListener('keydown', window._overlayKeyHandler, true);
          window._overlayKeyHandler = null;
        }
      };
      // Capture phase fires before React's bubble-phase handlers (which may stopImmediatePropagation)
      document.addEventListener('keydown', window._overlayKeyHandler, true);
      console.log('[BROWSER] Keyboard listener attached (waiting for ENTER/ESC/H/J/K/L or drag-complete)');
    }).then(() => {
      // Step 2: Poll until _overlayResult is set — no 30s limit, supports full timeout
      return page.waitForFunction(
        () => window._overlayResult !== null,
        null,
        { timeout }
      );
    }).then(() => {
      // Step 3: Read the result
      return page.evaluate(() => window._overlayResult);
    }).then((result) => {
      if (result === true) {
        console.log('  ✅ Confirmed (ENTER or drag-complete)');
      } else if (result === 'prev-farm') {
        console.log('  ⬅️  User pressed J - navigating to PREVIOUS farm');
      } else if (result === 'next-farm') {
        console.log('  ➡️  User pressed K - navigating to NEXT farm');
      } else if (result === 'prev-day') {
        console.log('  🔙 User pressed H - navigating to PREVIOUS day');
      } else if (result === 'next-day') {
        console.log('  🔜 User pressed L - navigating to NEXT day');
      } else {
        console.log('  ⏭️  User pressed ESC - skipped');
      }
      resolve(result);
    }).catch((err) => {
      console.log('  ❌ Keyboard listener error:', err.message);
      resolve(false);
    });
  });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 SINGLE ENTRY POINT: Handle all visual confirmation in one simple call
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This function handles EVERYTHING:
 * 1. Wait for chart to be visible
 * 2. Show draggable RED/BLUE overlay bars
 * 3. Wait for user input (ENTER/ESC)
 * 4. Get final positions from dragged bars
 * 5. Perform clicks at user-confirmed positions
 * 6. Clean up overlay
 * 
 * @param {Page} page - Playwright page
 * @param {Object} options - Configuration options
 * @param {string} options.nodeId - Farm node ID for display
 * @param {string} options.firstTime - Existing first time (or null)
 * @param {string} options.lastTime - Existing last time (or null)
 * @param {Object} options.learnedOffsets - Learning stats (optional)
 * @param {number} options.timeout - Max wait time in ms (default 300000 = 5 min)
 * @returns {Promise<Object>} - { confirmed: boolean, skipped: boolean, positions: {first, last}, clicked: boolean }
 */
export async function handleVisualConfirmation(page, options = {}) {
  const {
    nodeId = 'unknown',
    firstTime = null,
    lastTime = null,
    learnedOffsets = null,
    timeout = 300000,
    onConfirm = null
  } = options;
  
  const result = {
    confirmed: false,
    skipped: false,
    nav: null,
    positions: null,
    clicked: false,
    error: null
  };
  
  console.log(`\n  ═══════════════════════════════════════════════════════════════════`);
  console.log(`  👁️  VISUAL CONFIRMATION - Node: ${nodeId}`);
  console.log(`  ═══════════════════════════════════════════════════════════════════`);
  
  try {
    // Step 1: Wait for chart to be visible - THIS IS CRITICAL
    console.log(`  ⏳ Step 1/5: Waiting for chart to render...`);
    try {
      // Wait for highcharts container first
      await page.waitForSelector('.highcharts-container', { 
        state: 'visible', 
        timeout: 10000 
      });
      console.log(`  ✅ Highcharts container found`);
      
      // Then wait for the plot background
      await page.waitForSelector('.highcharts-plot-background', { 
        state: 'visible', 
        timeout: 5000 
      });
      console.log(`  ✅ Chart plot background visible`);
      
      // Extra buffer for animation to complete
      await page.waitForTimeout(1000);
      console.log(`  ✅ Chart animation buffer complete`);
    } catch (e) {
      console.log(`  ⚠️  Chart wait error: ${e.message}`);
      console.log(`  ⚠️  Will try to continue anyway...`);
    }
    
    // Step 2: Get chart bounds for bar positions
    console.log(`  ⏳ Step 2/5: Getting chart dimensions...`);
    const chartBounds = await page.evaluate(() => {
      const chartPlot = document.querySelector('.highcharts-plot-background');
      console.log('[BROWSER] Looking for .highcharts-plot-background:', !!chartPlot);
      if (chartPlot) {
        const rect = chartPlot.getBoundingClientRect();
        console.log('[BROWSER] Chart rect:', JSON.stringify({left: rect.left, top: rect.top, width: rect.width, height: rect.height}));
        return { 
          left: rect.left, 
          top: rect.top, 
          width: rect.width, 
          height: rect.height,
          found: true
        };
      }
      console.log('[BROWSER] Chart not found, using defaults');
      return { left: 500, top: 300, width: 400, height: 200, found: false };
    });
    
    console.log(`  📐 Chart bounds: left=${Math.round(chartBounds.left)}, top=${Math.round(chartBounds.top)}, width=${Math.round(chartBounds.width)}, height=${Math.round(chartBounds.height)}, found=${chartBounds.found}`);
    
    if (!chartBounds.found) {
      console.log(`  ⚠️  Chart not found, using default positions`);
    }
    
    // Convert time string to chart X screen position — handles "HH:MM" and "HH:MM AM/PM"
    function timeToScreenX(timeStr) {
      if (!timeStr) return null;
      const parts = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (!parts) return null;
      let hours = parseInt(parts[1]);
      const minutes = parseInt(parts[2]);
      if (/pm/i.test(timeStr) && hours < 12) hours += 12;
      if (/am/i.test(timeStr) && hours === 12) hours = 0;
      const startHour = 2, totalMinutes = (20 - 2) * 60;
      const minutesFromStart = hours * 60 + minutes - startHour * 60;
      const pct = Math.max(0, Math.min(1, minutesFromStart / totalMinutes));
      return chartBounds.left + pct * chartBounds.width;
    }

    const defaultY = chartBounds.top + chartBounds.height * 0.5;

    // Place bars at detected times if available; fall back to 1/3 and 2/3
    const firstScreenX = timeToScreenX(firstTime) ?? (chartBounds.left + chartBounds.width * 0.33);
    const lastScreenX  = timeToScreenX(lastTime)  ?? (chartBounds.left + chartBounds.width * 0.66);

    console.log(`  📍 Bar positions from times — FIRST: ${firstTime} → X=${Math.round(firstScreenX)}, LAST: ${lastTime} → X=${Math.round(lastScreenX)}`);

    // Prepare overlay data
    const overlayData = {
      first: {
        screenX: firstScreenX,
        screenY: defaultY,
        time: firstTime || '??:??',
        x: 0,
        y: 0
      },
      last: {
        screenX: lastScreenX,
        screenY: defaultY,
        time: lastTime || '??:??',
        x: 0,
        y: 0
      },
      nodeId: nodeId
    };
    
    // Step 3: Show draggable overlay
    console.log(`  ⏳ Step 3/5: Showing overlay bars...`);
    console.log(`     📍 RED bar (FIRST): time=${overlayData.first.time}, X=${Math.round(overlayData.first.screenX)}, Y=${Math.round(defaultY)}`);
    console.log(`     📍 BLUE bar (LAST): time=${overlayData.last.time}, X=${Math.round(overlayData.last.screenX)}, Y=${Math.round(defaultY)}`);
    
    try {
      const overlayResult = await showClickOverlay(page, overlayData, learnedOffsets);
      console.log(`     ✅ showClickOverlay completed: ${overlayResult}`);
    } catch (overlayError) {
      console.log(`     ❌ showClickOverlay FAILED: ${overlayError.message}`);
      throw overlayError;
    }
    
    // Step 4: Wait for user input
    console.log(`\n  ════════════════════════════════════════════════════════`);
    console.log(`  ⏳ Step 4/5: WAITING FOR YOUR INPUT...`);
    console.log(`  ════════════════════════════════════════════════════════`);
    console.log(`     👉 Press ENTER to confirm and click the bar positions`);
    console.log(`     👉 Press ESC to skip this date`);
    console.log(`     👉 Press H / L to navigate between DAYS`);
    console.log(`     👉 Press J / K to navigate between FARMS`);
    console.log(`     👉 Or DRAG the bars first, then press ENTER`);
    console.log(`  ════════════════════════════════════════════════════════\n`);
    
    const userConfirmed = await waitForUserConfirmation(page, timeout);
    
    if (userConfirmed === 'prev-farm' || userConfirmed === 'next-farm' || userConfirmed === 'prev-day' || userConfirmed === 'next-day') {
      if (userConfirmed === 'prev-farm') result.nav = 'prev-farm';
      else if (userConfirmed === 'next-farm') result.nav = 'next-farm';
      else if (userConfirmed === 'prev-day') result.nav = 'prev-day';
      else if (userConfirmed === 'next-day') result.nav = 'next-day';
      
      await removeClickOverlay(page);
      return result;
    }
    
    if (!userConfirmed) {
      console.log(`  ⏭️  User pressed ESC - skipping`);
      result.skipped = true;
      await removeClickOverlay(page);
      return result;
    }
    
    result.confirmed = true;
    console.log(`  ✅ User pressed ENTER - proceeding`);
    
    // Step 5: Get corrected positions from overlay (user may have dragged)
    console.log(`  ⏳ Step 5/5: Getting final positions...`);
    const correctedPositions = await page.evaluate(() => {
      if (typeof getCorrectedPositions === 'function') {
        return getCorrectedPositions();
      }
      return null;
    });
    
    result.positions = correctedPositions;

    // Fire TCN training callback (if provided) before removing the overlay
    if (typeof onConfirm === 'function' && correctedPositions) {
      await onConfirm(correctedPositions, chartBounds).catch(e =>
        console.log('  ⚠️  TCN training failed:', e.message)
      );
    }

    // Remove overlay before clicking the save button
    await removeClickOverlay(page);

    // Click the website's own save button so its React handlers fire
    // and the success tooltips appear.
    // The drag already updated the input fields; clicking the button triggers the website's save flow.
    console.log(`  Clicking 저장 button to save...`);
    try {
      // Wait briefly for React to enable the button after our input updates
      await page.waitForTimeout(500);

      const saveBtn = page.locator('button.chakra-button', { hasText: '저장' }).first();
      
      // Even if disabled, we try to click it with force: true
      await saveBtn.click({ force: true, timeout: 5000 });
      console.log(`  ✅ 저장 button clicked - waiting for success tooltip...`);
      // Wait for tooltip to appear
      await page.waitForTimeout(2000);
      result.clicked = true;
    } catch (btnErr) {
      console.log(`  ❌  Could not click 저장 button: ${btnErr.message}`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`  ❌ Visual confirmation error: ${error.message}`);
    result.error = error.message;
    await removeClickOverlay(page).catch(() => {});
    return result;
  }
}
