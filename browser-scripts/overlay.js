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

/**
 * Create the visual confirmation overlay with draggable vertical lines
 */
function createOverlay(pts, stats) {
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
    console.error('Cannot find chart container for overlay');
    return;
  }

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'irrigation-click-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 99999;
  `;

  // Create info box
  const infoBox = createInfoBox(pts, stats);

  // Get chart bounds
  const chartPlot = document.querySelector('.highcharts-plot-background');
  const chartBounds = chartPlot ? chartPlot.getBoundingClientRect() : { top: 300, height: 200, left: 500, width: 400 };
  const lineTop = chartBounds.top || 300;
  const lineHeight = chartBounds.height || 200;
  const chartLeft = chartBounds.left || 500;
  const chartWidth = chartBounds.width || 400;

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

  // Sync initial times to input fields
  if (pts.first?.time) updateTimeInput('first', pts.first.time);
  if (pts.last?.time) updateTimeInput('last', pts.last.time);
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
 * Make a marker draggable with Highcharts event triggering
 */
function makeDraggable(marker, label, markerType, xPositionToTime, pts) {
  marker.style.cursor = 'ew-resize';
  marker.style.pointerEvents = 'auto';

  marker.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    marker.style.cursor = 'grabbing';

    const startX = e.clientX;
    const origLeft = parseFloat(marker.style.left);
    const labelOrigLeft = parseFloat(label.style.left);

    function onMove(e) {
      const dx = e.clientX - startX;
      const newLeft = origLeft + dx;
      marker.style.left = newLeft + 'px';
      label.style.left = (labelOrigLeft + dx) + 'px';

      const newX = newLeft + 2;
      const timeStr = xPositionToTime(newX);
      const newY = pts.first?.screenY || pts.last?.screenY || 0;

      label.textContent = `${markerType === 'first' ? 'FIRST' : 'LAST'}: ${timeStr}`;
      updateTimeInput(markerType, timeStr);

      if (markerType === 'first') {
        window.__irrigationCorrected.first = { screenX: newX, screenY: newY, wasDragged: true, time: timeStr };
        document.getElementById('first-coords').textContent = `${timeStr} ✏️`;
        document.getElementById('first-time').textContent = timeStr;
      } else {
        window.__irrigationCorrected.last = { screenX: newX, screenY: newY, wasDragged: true, time: timeStr };
        document.getElementById('last-coords').textContent = `${timeStr} ✏️`;
        document.getElementById('last-time').textContent = timeStr;
      }
    }

    function onUp() {
      marker.style.cursor = 'ew-resize';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      const finalX = parseFloat(marker.style.left) + 2;
      const finalTime = xPositionToTime(finalX);
      updateTimeInput(markerType, finalTime);

      // Trigger Highcharts click event after drag
      triggerHighchartsClick(finalX, markerType);

      label.style.background = markerType === 'first' ? '#FF8800' : '#8888FF';
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/**
 * Trigger Highcharts click event at position (makes dragging work like manual clicks)
 */
function triggerHighchartsClick(finalX, markerType) {
  try {
    const chart = Highcharts.charts.find(c => c && c.renderTo);
    if (!chart) return;

    const chartRect = chart.container.getBoundingClientRect();
    const plotX = finalX - chartRect.left - chart.plotLeft;

    const splySeriesIndex = chart.series.findIndex(s => s.name && s.name.includes('SPLY'));
    const series = splySeriesIndex >= 0 ? chart.series[splySeriesIndex] : chart.series[0];

    if (!series?.points?.length) return;

    let nearestPoint = null, minDistance = Infinity;
    for (const point of series.points) {
      const distance = Math.abs(point.plotX - plotX);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    }

    if (nearestPoint && minDistance < 50) {
      console.log(`[BROWSER] 🎯 Triggering Highcharts click at ${nearestPoint.category || nearestPoint.x} (distance: ${minDistance.toFixed(1)}px)`);
      chart.getSelectedPoints().forEach(p => p.select(false, false));
      nearestPoint.select(true, false);
      nearestPoint.firePointEvent('click');
      console.log(`[BROWSER] ✅ Highcharts click event fired for ${markerType}`);
    }
  } catch (err) {
    console.error('[BROWSER] Error triggering Highcharts event:', err);
  }
}

/**
 * Update time input fields on the page
 */
function updateTimeInput(markerType, timeStr) {
  const allTimeInputs = document.querySelectorAll('input[type="time"]');
  let updatedCount = 0;

  for (const input of allTimeInputs) {
    const container = input.closest('div')?.parentElement?.parentElement ||
                      input.closest('div')?.parentElement || input.closest('div');
    const containerText = container?.textContent || '';

    if (markerType === 'first' && containerText.includes('첫 급액')) {
      triggerReactUpdate(input, timeStr);
      updatedCount++;
    } else if (markerType === 'last' && containerText.includes('마지막 급액')) {
      triggerReactUpdate(input, timeStr);
      updatedCount++;
    }
  }

  if (markerType === 'first') {
    window.__irrigationCorrected.firstTime = timeStr;
  } else {
    window.__irrigationCorrected.lastTime = timeStr;
  }

  console.log(`[BROWSER] Updated ${updatedCount} ${markerType} input fields to: ${timeStr}`);
}

/**
 * Trigger React state update for controlled inputs
 */
function triggerReactUpdate(input, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Remove the overlay from DOM
 */
function removeOverlay() {
  const overlay = document.getElementById('irrigation-click-overlay');
  if (overlay) overlay.remove();
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
