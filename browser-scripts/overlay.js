/**
 * Browser-side Overlay Functions
 * This code runs in browser context via page.evaluate() or page.addScriptTag()
 *
 * Functions:
 * - createOverlay(pts, stats) - Create the visual overlay with draggable markers
 * - removeOverlay() - Remove the overlay from DOM
 * - getCorrectedPositions() - Get corrected positions after user drags markers
 */

// Initialize global state
window.__irrigationCorrected = null;
window.__irrigationOriginal = null;
window._overlayConfirmed = null;

// DEBUG: Global call counter for tracing
window.__debugCallCount = 0;

/**
 * DEBUG LOGGER - Traces all function calls with timestamps and stack traces
 */
function debugLog(functionName, message, data = null) {
  window.__debugCallCount++;
  const callNum = window.__debugCallCount;
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = `[DEBUG #${callNum}] [${timestamp}] [${functionName}]`;
  
  console.log(`%c${prefix} ${message}`, 'color: #00ff00; font-weight: bold;');
  if (data !== null) {
    console.log(`%c  → Data:`, 'color: #00ff00;', data);
  }
  
  // Print abbreviated stack trace
  const stack = new Error().stack.split('\n').slice(2, 5).join('\n  ');
  console.log(`%c  → Stack:\n  ${stack}`, 'color: #888;');
}

/**
 * Create the visual confirmation overlay with draggable vertical lines
 */
function createOverlay(pts, stats) {
  debugLog('createOverlay', 'STARTING overlay creation', { pts, stats });
  
  // Remove existing overlay
  const existing = document.getElementById('irrigation-click-overlay');
  if (existing) existing.remove();

  // Initialize corrected positions storage
  window.__irrigationCorrected = {
    first: { screenX: pts.first?.screenX, screenY: pts.first?.screenY, wasDragged: false },
    last: { screenX: pts.last?.screenX, screenY: pts.last?.screenY, wasDragged: false },
    firstTime: pts.first?.time || null,
    lastTime: pts.last?.time || null,
    nodeId: pts.nodeId || null
  };
  window.__irrigationOriginal = {
    first: { screenX: pts.first?.screenX, screenY: pts.first?.screenY },
    last: { screenX: pts.last?.screenX, screenY: pts.last?.screenY }
  };

  // Find chart container
  const chartContainer = document.querySelector('.highcharts-container, .highcharts-root')?.parentElement;
  if (!chartContainer) {
    debugLog('createOverlay', 'ERROR: Cannot find chart container');
    return;
  }

  // CRITICAL: Disable ALL Highcharts click events by intercepting them
  // The website's Highcharts click handler updates BOTH input fields
  debugLog('createOverlay', 'Disabling Highcharts click handlers...');
  const charts = window.Highcharts?.charts || [];
  charts.forEach((chart, idx) => {
    if (chart) {
      debugLog('createOverlay', `Disabling chart ${idx}`, { 
        hasPlotOptions: !!chart.options?.plotOptions,
        hasClickHandler: !!chart.options?.plotOptions?.series?.point?.events?.click
      });
      // Store original click handlers and disable them
      chart._originalPlotOptionsClick = chart.options?.plotOptions?.series?.point?.events?.click;
      if (chart.options?.plotOptions?.series?.point?.events) {
        chart.options.plotOptions.series.point.events.click = null;
      }
      // Disable pointer events on chart container
      if (chart.container) {
        chart.container.style.pointerEvents = 'none';
        debugLog('createOverlay', `Chart ${idx} pointer events disabled`);
      }
    }
  });

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'irrigation-click-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 99999;
  `;
  
  debugLog('createOverlay', 'Overlay container created, Highcharts handlers already disabled');

  // Create info box
  const infoBox = createInfoBox(pts, stats);

  // Get chart bounds
  const chartPlot = document.querySelector('.highcharts-plot-background');
  const chartBounds = chartPlot ? chartPlot.getBoundingClientRect() : { top: 300, height: 200, left: 500, width: 400 };
  const lineTop = chartBounds.top || 300;
  const lineHeight = chartBounds.height || 200;
  const chartLeft = chartBounds.left || 500;
  const chartWidth = chartBounds.width || 400;
  
  debugLog('createOverlay', 'Chart bounds calculated', { chartLeft, chartWidth, lineTop, lineHeight });

  // Time calculation helpers
  const startHour = 2, endHour = 20;
  const totalMinutes = (endHour - startHour) * 60;

  function xPositionToTime(xPos) {
    const relativeX = xPos - chartLeft;
    const percentage = Math.max(0, Math.min(1, relativeX / chartWidth));
    const minutesFromStart = Math.round(percentage * totalMinutes);
    const totalMinutesFromMidnight = startHour * 60 + minutesFromStart;
    const hours = Math.floor(totalMinutesFromMidnight / 60);
    const minutes = totalMinutesFromMidnight % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // Add FIRST marker (RED)
  if (pts.first?.screenX && pts.first?.screenY) {
    const { marker, label } = createMarker('first', pts.first, lineTop, lineHeight);
    makeDraggable(marker, label, 'first', xPositionToTime, pts, chartLeft, chartWidth);
    overlay.appendChild(marker);
    overlay.appendChild(label);
  }

  // Add LAST marker (BLUE)
  if (pts.last?.screenX && pts.last?.screenY) {
    const { marker, label } = createMarker('last', pts.last, lineTop, lineHeight);
    makeDraggable(marker, label, 'last', xPositionToTime, pts, chartLeft, chartWidth);
    overlay.appendChild(marker);
    overlay.appendChild(label);
  }

  overlay.appendChild(infoBox);
  document.body.appendChild(overlay);

  // DO NOT sync initial times - let user drag to set them
  // The website already has its own values, we only update when user drags
  console.log('[BROWSER] Overlay created - chart clicks BLOCKED, drag vertical lines to set times');
}

/**
 * Create the info box with learning stats
 */
function createInfoBox(pts, stats) {
  const infoBox = document.createElement('div');
  infoBox.id = 'irrigation-info-box';
  infoBox.style.cssText = `
    position: fixed; bottom: 10px; left: 10px;
    background: rgba(0, 0, 0, 0.9); color: white;
    padding: 15px 20px; border-radius: 8px;
    font-family: 'Consolas', monospace; font-size: 14px;
    z-index: 100000; pointer-events: auto; min-width: 300px;
    border: 2px solid #4CAF50; cursor: move; user-select: none;
  `;

  // Make draggable
  infoBox.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origLeft = infoBox.offsetLeft, origTop = infoBox.offsetTop;
    infoBox.style.bottom = 'auto';
    infoBox.style.top = origTop + 'px';
    infoBox.style.left = origLeft + 'px';

    function onMove(e) {
      infoBox.style.left = (origLeft + e.clientX - startX) + 'px';
      infoBox.style.top = (origTop + e.clientY - startY) + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  const learningInfo = stats ? `
    <div style="margin-bottom: 10px; padding: 8px; background: rgba(76, 175, 80, 0.2); border-radius: 4px;">
      <div style="color: #4CAF50; font-size: 11px;">🧠 LEARNING MODE ACTIVE</div>
      <div style="color: #888; font-size: 11px;">Corrections: ${stats.totalCorrections || 0} | Bias: ±${Math.round(stats.avgOffset || 0)}px</div>
    </div>
  ` : '';

  infoBox.innerHTML = `
    <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #4CAF50; cursor: move;">
      👁️ Visual Confirmation Mode <span style="font-size: 10px; color: #888;">(drag to move)</span>
    </div>
    ${learningInfo}
    <div id="first-marker-info" style="margin-bottom: 8px;">
      <span style="color: #FF4444; font-size: 18px;">|</span> FIRST: <span id="first-time">${pts.first?.time || 'N/A'}</span>
      <span style="color: #888; font-size: 11px;" id="first-coords">(${Math.round(pts.first?.screenX || 0)}, ${Math.round(pts.first?.screenY || 0)})</span>
    </div>
    <div id="last-marker-info" style="margin-bottom: 12px;">
      <span style="color: #4444FF; font-size: 18px;">|</span> LAST: <span id="last-time">${pts.last?.time || 'N/A'}</span>
      <span style="color: #888; font-size: 11px;" id="last-coords">(${Math.round(pts.last?.screenX || 0)}, ${Math.round(pts.last?.screenY || 0)})</span>
    </div>
    <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 5px;">
      <div style="color: #FFD700; font-size: 12px; margin-bottom: 5px;">🖱️ Drag vertical lines to set time</div>
      <div style="color: #4CAF50; font-weight: bold;">Press ENTER to save (저장)</div>
      <div style="color: #FF9800;">Press ESC to skip this date</div>
    </div>
  `;
  return infoBox;
}

/**
 * Create a vertical line marker
 */
function createMarker(type, point, lineTop, lineHeight) {
  const isFirst = type === 'first';
  const color = isFirst ? '#FF4444' : '#4444FF';
  const bgColor = isFirst ? 'rgba(255, 68, 68, 0.8)' : 'rgba(68, 68, 255, 0.8)';

  const marker = document.createElement('div');
  marker.id = `${type}-marker`;
  marker.style.cssText = `
    position: fixed; left: ${point.screenX - 2}px; top: ${lineTop}px;
    width: 4px; height: ${lineHeight}px; background: ${bgColor};
    border-left: 2px solid ${color}; border-right: 2px solid ${color};
    cursor: ew-resize; pointer-events: auto;
  `;

  const label = document.createElement('div');
  label.id = `${type}-label`;
  label.style.cssText = `
    position: fixed; left: ${point.screenX + 8}px; top: ${lineTop - 25}px;
    background: ${color}; color: white; padding: 3px 8px; border-radius: 4px;
    font-size: 12px; font-weight: bold; font-family: sans-serif;
    pointer-events: none; white-space: nowrap;
  `;
  label.textContent = `${isFirst ? 'FIRST' : 'LAST'}: ${point.time}`;

  return { marker, label };
}

/**
 * Make a marker draggable - COMPLETELY ISOLATED from Highcharts events
 * CRITICAL: Do NOT trigger any Highcharts click events - they update BOTH inputs!
 */
function makeDraggable(marker, label, markerType, xPositionToTime, pts) {
  debugLog('makeDraggable', `Setting up draggable for ${markerType} marker`);
  
  marker.style.cursor = 'ew-resize';
  marker.style.pointerEvents = 'auto';

  // Block ALL chart click events while our overlay is active
  function blockChartClicks(e) {
    debugLog('blockChartClicks', `BLOCKED event: ${e.type}`);
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }

  marker.addEventListener('mousedown', (e) => {
    debugLog('makeDraggable.mousedown', `MOUSEDOWN on ${markerType} marker`, { 
      clientX: e.clientX, 
      clientY: e.clientY,
      target: e.target.id 
    });
    
    // CRITICAL: Block event from reaching Highcharts
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    marker.style.cursor = 'grabbing';

    const startX = e.clientX;
    const origLeft = parseFloat(marker.style.left);
    const labelOrigLeft = parseFloat(label.style.left);
    
    debugLog('makeDraggable.mousedown', `Drag started`, { startX, origLeft, labelOrigLeft });

    // Temporarily block ALL clicks on the chart container
    const chartContainer = document.querySelector('.highcharts-container');
    if (chartContainer) {
      chartContainer.style.pointerEvents = 'none';
      debugLog('makeDraggable.mousedown', 'Disabled chart pointer events');
    }

    let moveCount = 0;
    function onMove(e) {
      moveCount++;
      e.preventDefault();
      e.stopPropagation();
      
      const dx = e.clientX - startX;
      const newLeft = origLeft + dx;
      marker.style.left = newLeft + 'px';
      label.style.left = (labelOrigLeft + dx) + 'px';

      const newX = newLeft + 2;
      const timeStr = xPositionToTime(newX);
      const newY = pts.first?.screenY || pts.last?.screenY || 0;

      label.textContent = `${markerType === 'first' ? 'FIRST' : 'LAST'}: ${timeStr}`;
      
      // Log every 10th move to avoid flooding
      if (moveCount % 10 === 1) {
        debugLog('makeDraggable.onMove', `DRAG MOVE #${moveCount} for ${markerType}`, { 
          dx, newLeft, timeStr,
          markerType
        });
      }
      
      // Update ONLY the correct input field
      debugLog('makeDraggable.onMove', `CALLING updateTimeInput("${markerType}", "${timeStr}")`);
      updateTimeInput(markerType, timeStr);

      if (markerType === 'first') {
        window.__irrigationCorrected.first = { screenX: newX, screenY: newY, wasDragged: true, time: timeStr };
        const coordsEl = document.getElementById('first-coords');
        const timeEl = document.getElementById('first-time');
        if (coordsEl) coordsEl.textContent = `${timeStr} ✏️`;
        if (timeEl) timeEl.textContent = timeStr;
      } else {
        window.__irrigationCorrected.last = { screenX: newX, screenY: newY, wasDragged: true, time: timeStr };
        const coordsEl = document.getElementById('last-coords');
        const timeEl = document.getElementById('last-time');
        if (coordsEl) coordsEl.textContent = `${timeStr} ✏️`;
        if (timeEl) timeEl.textContent = timeStr;
      }
    }

    function onUp(e) {
      debugLog('makeDraggable.onUp', `MOUSEUP on ${markerType} marker after ${moveCount} moves`);
      
      e.preventDefault();
      e.stopPropagation();
      
      marker.style.cursor = 'ew-resize';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      // Re-enable chart clicks after drag completes
      if (chartContainer) {
        chartContainer.style.pointerEvents = 'auto';
        debugLog('makeDraggable.onUp', 'Re-enabled chart pointer events');
      }

      const finalX = parseFloat(marker.style.left) + 2;
      const finalTime = xPositionToTime(finalX);
      
      debugLog('makeDraggable.onUp', `Final position for ${markerType}`, { finalX, finalTime });
      
      // Final update to the correct input field ONLY
      debugLog('makeDraggable.onUp', `FINAL CALL to updateTimeInput("${markerType}", "${finalTime}")`);
      updateTimeInput(markerType, finalTime);

      // DO NOT trigger Highcharts click - it updates BOTH inputs!
      // The website's Highcharts click handler fills both fields simultaneously
      // We only need to update our target input field directly
      
      debugLog('makeDraggable.onUp', `✅ Drag COMPLETE for ${markerType}: ${finalTime}`);
      label.style.background = markerType === 'first' ? '#FF8800' : '#8888FF';
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  
  // Also block click events on the marker (in case of accidental clicks)
  marker.addEventListener('click', (e) => {
    debugLog('makeDraggable.click', `BLOCKED click on ${markerType} marker`);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  });
}

/**
 * DISABLED: triggerHighchartsClick
 * 
 * This function was causing the bug where both input fields were updated simultaneously.
 * The website's Highcharts click handler updates BOTH 첫 급액 시간 and 마지막 급액 시간
 * fields whenever any point on the chart is clicked.
 * 
 * We now update the input fields DIRECTLY via updateTimeInput() instead.
 * This function is kept as a no-op for compatibility but does nothing.
 */
function triggerHighchartsClick(finalX, markerType) {
  // DO NOT trigger Highcharts click events!
  // The website's built-in handler updates BOTH input fields when a chart point is clicked.
  // We only want to update ONE field at a time based on which marker was dragged.
  console.log(`[BROWSER] ⚠️ triggerHighchartsClick disabled - using direct input update instead`);
  return;
}

/**
 * Update time input fields on the page
 * CRITICAL: Only update the field corresponding to the marker type
 * RED bar (first) -> only "첫 급액 시간" field (input index 0)
 * BLUE bar (last) -> only "마지막 급액 시간" field (input index 1)
 * 
 * SIMPLE INDEX-BASED APPROACH: The page always has exactly 2 time inputs
 * Input 0 = 첫 급액 시간 (First irrigation time) -> RED bar
 * Input 1 = 마지막 급액 시간 (Last irrigation time) -> BLUE bar
 */
function updateTimeInput(markerType, timeStr) {
  console.log(`%c[BROWSER] 🎯 updateTimeInput() INDEX-BASED VERSION 2.0`, 'color: #00FF00; font-weight: bold; font-size: 14px;');
  console.log(`[DEBUG] [updateTimeInput] ═══════════════════════════════════════`);
  console.log(`[DEBUG] [updateTimeInput] CALLED with markerType="${markerType}", timeStr="${timeStr}"`);
  
  // Get ALL time inputs on the page
  const allTimeInputs = document.querySelectorAll('input[type="time"]');
  
  const inputsInfo = Array.from(allTimeInputs).map((input, i) => 
    `input[${i}]: value="${input.value}", class="${input.className}"`
  ).join(' | ');
  console.log(`[DEBUG] [updateTimeInput] Found ${allTimeInputs.length} time inputs: ${inputsInfo}`);
  
  if (allTimeInputs.length < 2) {
    console.log(`[DEBUG] [updateTimeInput] ❌ ERROR: Expected 2 inputs, found ${allTimeInputs.length}`);
    return;
  }
  
  let targetInput = null;
  let targetIndex = -1;
  
  // RED bar (first) -> ONLY update input index 0 (첫 급액 시간)
  if (markerType === 'first') {
    targetInput = allTimeInputs[0];
    targetIndex = 0;
    console.log(`[DEBUG] [updateTimeInput] 🔴 RED bar -> Will update input[0] ONLY`);
  }
  // BLUE bar (last) -> ONLY update input index 1 (마지막 급액 시간)
  else if (markerType === 'last') {
    targetInput = allTimeInputs[1];
    targetIndex = 1;
    console.log(`[DEBUG] [updateTimeInput] 🔵 BLUE bar -> Will update input[1] ONLY`);
  }
  
  if (targetInput) {
    const oldValue = targetInput.value;
    console.log(`[DEBUG] [updateTimeInput] BEFORE: input[${targetIndex}] = "${oldValue}"`);
    
    // Log the other input's value to check if it changes
    const otherIndex = targetIndex === 0 ? 1 : 0;
    const otherValueBefore = allTimeInputs[otherIndex]?.value;
    console.log(`[DEBUG] [updateTimeInput] OTHER input[${otherIndex}] BEFORE = "${otherValueBefore}" (should NOT change)`);
    
    triggerReactUpdate(targetInput, timeStr);
    
    // Check values AFTER the update
    const newValue = targetInput.value;
    const otherValueAfter = allTimeInputs[otherIndex]?.value;
    
    console.log(`[DEBUG] [updateTimeInput] AFTER: input[${targetIndex}] = "${newValue}" (was "${oldValue}")`);
    console.log(`[DEBUG] [updateTimeInput] OTHER input[${otherIndex}] AFTER = "${otherValueAfter}" (was "${otherValueBefore}")`);
    
    // Check if other input changed
    if (otherValueBefore !== otherValueAfter) {
      console.log(`%c[BROWSER] 🚨 BUG DETECTED: OTHER INPUT CHANGED FROM "${otherValueBefore}" TO "${otherValueAfter}"`, 'color: #FF0000; font-weight: bold; font-size: 16px;');
      console.log(`[DEBUG] [updateTimeInput] 🚨🚨🚨 BUG DETECTED: OTHER INPUT CHANGED FROM "${otherValueBefore}" TO "${otherValueAfter}" 🚨🚨🚨`);
    } else {
      console.log(`%c[BROWSER] ✅ SUCCESS: Only input[${targetIndex}] updated to "${newValue}", input[${otherIndex}] unchanged`, 'color: #00FF00; font-weight: bold;');
      console.log(`[DEBUG] [updateTimeInput] ✅ SUCCESS: Other input[${otherIndex}] unchanged (still "${otherValueAfter}")`);
    }
    
  } else {
    console.log(`[DEBUG] [updateTimeInput] ❌ ERROR: Could not find target input for ${markerType}`);
  }

  // Store in corrected data
  if (markerType === 'first') {
    window.__irrigationCorrected.firstTime = timeStr;
  } else {
    window.__irrigationCorrected.lastTime = timeStr;
  }
  
  console.log(`[DEBUG] [updateTimeInput] COMPLETE for ${markerType}`);
  console.log(`[DEBUG] [updateTimeInput] ═══════════════════════════════════════`);
}

/**
 * Trigger React state update for controlled inputs
 * CRITICAL: Use bubbles:false to prevent website handlers from catching these events
 */
function triggerReactUpdate(input, value) {
  debugLog('triggerReactUpdate', `CALLED`, { 
    inputId: input.id,
    inputClass: input.className,
    oldValue: input.value,
    newValue: value
  });
  
  // Store old value for comparison
  const oldValue = input.value;

  // Step 1: Prime the React value tracker BEFORE changing the native value.
  // This tells React "the previous value was X" so it detects the transition X -> newValue.
  const tracker = input._valueTracker;
  if (tracker) {
    tracker.setValue(oldValue);
  }

  // Step 2: Set the native DOM value (bypasses React's setter)
  debugLog('triggerReactUpdate', 'Step 1: Using nativeInputValueSetter');
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  nativeInputValueSetter.call(input, value);
  debugLog('triggerReactUpdate', `After nativeInputValueSetter: input.value = "${input.value}"`);

  // Step 3: Dispatch with bubbles:true so React's document-level delegation catches it.
  // Highcharts handlers are already disabled (chart.container.style.pointerEvents = 'none'
  // and chart click handlers nulled out in createOverlay), so bubbling is safe here.
  debugLog('triggerReactUpdate', 'Step 2: Dispatching events with bubbles=true for React delegation');
  input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  debugLog('triggerReactUpdate', 'Dispatched input and change events (bubbles=true)');

  console.log(`[BROWSER] triggerReactUpdate: Set input value to "${value}" (was "${oldValue}")`);
}

/**
 * Remove the overlay from DOM and restore chart functionality
 */
function removeOverlay() {
  const overlay = document.getElementById('irrigation-click-overlay');
  if (overlay) overlay.remove();
  
  // Restore Highcharts click handlers and pointer events
  const charts = window.Highcharts?.charts || [];
  charts.forEach(chart => {
    if (chart) {
      // Restore original click handler if we saved it
      if (chart._originalPlotOptionsClick && chart.options?.plotOptions?.series?.point?.events) {
        chart.options.plotOptions.series.point.events.click = chart._originalPlotOptionsClick;
      }
      // Re-enable pointer events
      if (chart.container) {
        chart.container.style.pointerEvents = 'auto';
      }
    }
  });
  
  console.log('[BROWSER] Overlay removed, chart clicks restored');
}

/**
 * Get corrected positions after user drags markers
 */
function getCorrectedPositions() {
  const corrected = window.__irrigationCorrected;
  const original = window.__irrigationOriginal;

  if (!corrected || !original) {
    return { original: null, corrected: null, wasCorrected: false };
  }

  return {
    original,
    corrected: {
      first: { screenX: corrected.first?.screenX, screenY: corrected.first?.screenY },
      last: { screenX: corrected.last?.screenX, screenY: corrected.last?.screenY }
    },
    wasCorrected: corrected.first?.wasDragged || corrected.last?.wasDragged,
    firstWasDragged: corrected.first?.wasDragged || false,
    lastWasDragged: corrected.last?.wasDragged || false
  };
}

/**
 * Setup keyboard listener for confirmation (Enter/Escape)
 */
function setupConfirmationListener(timeoutMs) {
  return new Promise((resolve) => {
    window._overlayConfirmed = null;

    const handler = (e) => {
      if (e.key === 'Enter') {
        window._overlayConfirmed = true;
        document.removeEventListener('keydown', handler);
        saveIrrigationData().then(() => resolve(true));
      } else if (e.key === 'Escape') {
        window._overlayConfirmed = false;
        document.removeEventListener('keydown', handler);
        resolve(false);
      }
    };

    document.addEventListener('keydown', handler);

    setTimeout(() => {
      document.removeEventListener('keydown', handler);
      if (window._overlayConfirmed === null) {
        window._overlayConfirmed = true;
      }
      resolve(window._overlayConfirmed);
    }, timeoutMs);
  });
}

/**
 * Save irrigation data via PUT API
 */
async function saveIrrigationData() {
  const nodeId = window.__irrigationCorrected?.nodeId;
  const firstTime = window.__irrigationCorrected?.firstTime;
  const lastTime = window.__irrigationCorrected?.lastTime;

  // Extract date from page
  let dateParam = null;
  const allElements = document.querySelectorAll('div, span, p, button');
  for (const el of allElements) {
    const text = el.textContent || '';
    const dateMatch = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (dateMatch) {
      dateParam = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      break;
    }
  }

  function timeToUnixTimestamp(timeStr, dateStr) {
    const dateObj = new Date(dateStr + 'T' + timeStr + ':00+09:00');
    return Math.floor(dateObj.getTime() / 1000);
  }

  console.log(`[BROWSER] Saving: nodeId=${nodeId}, date=${dateParam}, first=${firstTime}, last=${lastTime}`);

  if (!nodeId || !dateParam || !firstTime || !lastTime) {
    console.log('[BROWSER] ⚠️ Missing required data for API call');
    return;
  }

  const apiUrl = `https://newapis.iofarm.com/pipeline/manual/node/${nodeId}?category=IRRIGATION&date=${dateParam}`;
  const payload = {
    category: "IRRIGATION",
    date: dateParam,
    manuals: {
      "FirstSplyTime_1_cmp1": timeToUnixTimestamp(firstTime, dateParam),
      "LastSplyTime_1_cmp1": timeToUnixTimestamp(lastTime, dateParam)
    }
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log(`[BROWSER] API Response: ${response.status} - ${responseText}`);

    if (response.ok) {
      console.log('[BROWSER] ✅ Save API call successful');

      // Verify saved data
      const verifyResponse = await fetch(apiUrl, { credentials: 'include' });
      const savedData = await verifyResponse.json();
      console.log('[BROWSER] 📋 Verified saved data:', JSON.stringify(savedData));
    } else {
      console.error(`[BROWSER] ❌ Save failed: ${response.status}`);
    }
  } catch (err) {
    console.error('[BROWSER] ❌ Save API call failed:', err);
  }
}

// Export for use by Playwright
if (typeof window !== 'undefined') {
  window.createOverlay = createOverlay;
  window.removeOverlay = removeOverlay;
  window.getCorrectedPositions = getCorrectedPositions;
  window.setupConfirmationListener = setupConfirmationListener;
  window.saveIrrigationData = saveIrrigationData;
}
