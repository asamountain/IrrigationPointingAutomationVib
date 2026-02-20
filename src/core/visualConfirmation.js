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
    
    if (!createResult.success) {
      console.log('  ❌ createOverlay FAILED:', createResult.error);
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
  
  // Focus the page body to ensure keyboard events are captured
  await page.evaluate(() => {
    document.body.focus();
    document.body.click();
  });
  
  return new Promise((resolve) => {
    console.log('  👁️  WAITING FOR USER INPUT (ENTER=confirm, ESC=skip)...');
    
    // Set up keyboard listener in browser
    page.evaluate((timeoutMs) => {
      return new Promise((browserResolve) => {
        console.log('[BROWSER] Setting up keyboard listener, timeout:', timeoutMs, 'ms');
        window._overlayConfirmed = null;
        
        const handler = (e) => {
          console.log('[BROWSER] Key pressed:', e.key);
          if (e.key === 'Enter') {
            console.log('[BROWSER] ENTER pressed - confirming');
            window._overlayConfirmed = true;
            document.removeEventListener('keydown', handler);
            browserResolve(true);
          } else if (e.key === 'Escape') {
            console.log('[BROWSER] ESC pressed - skipping');
            window._overlayConfirmed = false;
            document.removeEventListener('keydown', handler);
            browserResolve(false);
          }
        };
        
        document.addEventListener('keydown', handler);
        console.log('[BROWSER] Keyboard listener attached, waiting for ENTER or ESC...');
        
        // Timeout fallback - DO NOT auto-confirm, just skip
        setTimeout(() => {
          if (window._overlayConfirmed === null) {
            console.log('[BROWSER] Timeout reached - skipping (no auto-confirm)');
            document.removeEventListener('keydown', handler);
            browserResolve(false); // Skip on timeout, don't auto-confirm
          }
        }, timeoutMs);
      });
    }, timeout).then((result) => {
      if (result) {
        console.log('  ✅ User pressed ENTER - confirmed');
      } else {
        console.log('  ⏭️  User pressed ESC or timeout - skipped');
      }
      resolve(result);
    }).catch((err) => {
      console.log('  ❌ Keyboard listener error:', err.message);
      resolve(false); // On error, skip
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
    timeout = 300000
  } = options;
  
  const result = {
    confirmed: false,
    skipped: false,
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
    
    // Calculate default bar positions at 1/3 and 2/3 of chart
    const defaultFirstX = chartBounds.left + chartBounds.width * 0.33;
    const defaultLastX = chartBounds.left + chartBounds.width * 0.66;
    const defaultY = chartBounds.top + chartBounds.height * 0.5;
    
    // Prepare overlay data
    const overlayData = {
      first: {
        screenX: defaultFirstX,
        screenY: defaultY,
        time: firstTime || '??:??',
        x: 0,
        y: 0
      },
      last: {
        screenX: defaultLastX,
        screenY: defaultY,
        time: lastTime || '??:??',
        x: 0,
        y: 0
      },
      nodeId: nodeId
    };
    
    // Step 3: Show draggable overlay
    console.log(`  ⏳ Step 3/5: Showing overlay bars...`);
    console.log(`     📍 RED bar (FIRST): time=${overlayData.first.time}, X=${Math.round(defaultFirstX)}, Y=${Math.round(defaultY)}`);
    console.log(`     📍 BLUE bar (LAST): time=${overlayData.last.time}, X=${Math.round(defaultLastX)}, Y=${Math.round(defaultY)}`);
    
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
    console.log(`     👉 Or DRAG the bars first, then press ENTER`);
    console.log(`  ════════════════════════════════════════════════════════\n`);
    
    const userConfirmed = await waitForUserConfirmation(page, timeout);
    
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

    // Remove overlay before clicking the save button
    await removeClickOverlay(page);

    // Click the website's own save button so its React handlers fire
    // and the success tooltips appear.
    // The drag already updated the input fields; clicking the button triggers the website's save flow.
    console.log(`  Clicking 저장 button to save...`);
    try {
      // Wait briefly for React to enable the button after our input updates
      await page.waitForTimeout(300);

      const saveBtn = page.locator('button.chakra-button', { hasText: '저장' }).first();
      const isEnabled = await saveBtn.isEnabled().catch(() => false);

      if (isEnabled) {
        await saveBtn.click();
        console.log(`  ✅ 저장 button clicked - waiting for success tooltip...`);
        // Wait for tooltip to appear
        await page.waitForTimeout(2000);
        result.clicked = true;
      } else {
        console.log(`  ⚠️  저장 button is still disabled - input update may not have reached React`);
      }
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
