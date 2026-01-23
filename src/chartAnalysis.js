/**
 * Chart Analysis Module
 * HSSP Algorithm for detecting irrigation events from moisture sensor data
 * 
 * The algorithm uses:
 * 1. Rolling window analysis to detect sustained moisture rises
 * 2. Local minimum (valley) traceback to find irrigation start points
 * 3. Daytime filtering (07:00-17:00) for valid events
 */

import { log, logSubsection, delay } from './utils.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 ALGORITHM PARAMETERS
// ═══════════════════════════════════════════════════════════════════════════════

const HSSP_PARAMS = {
  SURGE_WINDOW: 5,        // Compare with N minutes ago (catches slow rises)
  SURGE_THRESHOLD_PERCENT: 0.015, // 1.5% of Y range as minimum threshold
  SURGE_THRESHOLD_MIN: 0.02,      // Absolute minimum threshold
  LOOKBACK_WINDOW: 20,    // Look back N minutes to find valley
  DEBOUNCE_MINUTES: 30,   // Minimum minutes between events
  MIN_SEPARATION_PERCENT: 0.05,   // Events must be 5% of data apart
  DAYTIME_START: 7,       // Start of valid irrigation hours
  DAYTIME_END: 17,        // End of valid irrigation hours
  MIN_DATA_POINTS: 10     // Minimum data points required
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌊 HSSP ALGORITHM - Rolling Window Valley Detection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze data points to find irrigation events using HSSP algorithm
 * @param {Array<{x: number, y: number}>} dataPoints - Normalized data points
 * @returns {Array<{index: number, x: number, y: number, time: string, rise: number}>}
 */
export function detectIrrigationEvents(dataPoints) {
  logSubsection('HSSP Algorithm - Rolling Window Valley Detection');
  
  if (!dataPoints || dataPoints.length < HSSP_PARAMS.MIN_DATA_POINTS) {
    log(`Insufficient data points: ${dataPoints?.length || 0} (need ${HSSP_PARAMS.MIN_DATA_POINTS})`, 'warning');
    return [];
  }
  
  log(`Analyzing ${dataPoints.length} data points...`, 'step');
  
  // Calculate Y range statistics
  const yValues = dataPoints.map(p => p.y);
  const maxY = Math.max(...yValues);
  const minY = Math.min(...yValues);
  const yRange = maxY - minY;
  
  log(`Y range: ${minY.toFixed(2)} to ${maxY.toFixed(2)} (span: ${yRange.toFixed(2)})`, 'info');
  
  // Calculate adaptive surge threshold
  const surgeThreshold = Math.max(
    HSSP_PARAMS.SURGE_THRESHOLD_MIN,
    yRange * HSSP_PARAMS.SURGE_THRESHOLD_PERCENT
  );
  
  log(`Surge threshold: ${surgeThreshold.toFixed(4)}`, 'info');
  log(`Lookback window: ${HSSP_PARAMS.LOOKBACK_WINDOW} minutes`, 'info');
  
  const allEvents = [];
  let lastEventIndex = -HSSP_PARAMS.DEBOUNCE_MINUTES;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SCAN: Detect sustained rises with rolling window
  // ═══════════════════════════════════════════════════════════════════════════
  
  for (let i = HSSP_PARAMS.SURGE_WINDOW; i < dataPoints.length - 5; i++) {
    const currentVal = dataPoints[i].y;
    const pastVal = dataPoints[i - HSSP_PARAMS.SURGE_WINDOW].y;
    const diff = currentVal - pastVal;
    
    // DETECT: Sustained rise (comparing SURGE_WINDOW minutes)
    if (diff > surgeThreshold && i > lastEventIndex + HSSP_PARAMS.DEBOUNCE_MINUTES) {
      log(`Sustained rise at index ${i} (5-min rise: ${diff.toFixed(4)})`, 'step');
      
      // FIND VALLEY: Scan lookback window for ABSOLUTE MINIMUM
      let minVal = currentVal;
      let valleyIndex = i;
      const startSearch = Math.max(0, i - HSSP_PARAMS.LOOKBACK_WINDOW);
      
      for (let j = i; j >= startSearch; j--) {
        if (dataPoints[j].y <= minVal) {
          minVal = dataPoints[j].y;
          valleyIndex = j;
        }
      }
      
      // VALIDATE: Must be in daytime (07:00 - 17:00)
      const eventTimestamp = dataPoints[valleyIndex].x;
      const eventDate = new Date(eventTimestamp);
      const eventHour = eventDate.getHours();
      const eventMinute = eventDate.getMinutes();
      const isDaytime = eventHour >= HSSP_PARAMS.DAYTIME_START && 
                        eventHour <= HSSP_PARAMS.DAYTIME_END;
      
      const timeStr = `${String(eventHour).padStart(2, '0')}:${String(eventMinute).padStart(2, '0')}`;
      
      if (isDaytime) {
        allEvents.push({
          index: valleyIndex,
          x: dataPoints[valleyIndex].x,
          y: dataPoints[valleyIndex].y,
          peakIndex: i,
          rise: currentVal - dataPoints[valleyIndex].y,
          time: timeStr,
          hour: eventHour,
          minute: eventMinute
        });
        
        lastEventIndex = valleyIndex;
        i = Math.max(i, valleyIndex + 15); // Skip forward to avoid double-detection
        log(`✅ Valley at ${timeStr} (index ${valleyIndex})`, 'success');
      } else {
        log(`⏭️ Valley at ${timeStr} rejected (outside ${HSSP_PARAMS.DAYTIME_START}:00-${HSSP_PARAMS.DAYTIME_END}:00)`, 'warning');
      }
    }
  }
  
  log(`Raw detections: ${allEvents.length} events`, 'info');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DE-DUPLICATE: Keep events that are sufficiently separated
  // ═══════════════════════════════════════════════════════════════════════════
  
  const uniqueEvents = [];
  const minSeparation = dataPoints.length * HSSP_PARAMS.MIN_SEPARATION_PERCENT;
  
  for (const event of allEvents) {
    let isDuplicate = false;
    
    for (let j = 0; j < uniqueEvents.length; j++) {
      const existing = uniqueEvents[j];
      
      if (Math.abs(event.index - existing.index) < minSeparation) {
        isDuplicate = true;
        
        // Keep the one with larger rise (more significant irrigation)
        if (event.rise > existing.rise) {
          uniqueEvents[j] = event;
          log(`Replaced duplicate: kept event at ${event.time} (larger rise)`, 'info');
        }
        break;
      }
    }
    
    if (!isDuplicate) {
      uniqueEvents.push(event);
    }
  }
  
  // Sort by index (chronological order)
  uniqueEvents.sort((a, b) => a.index - b.index);
  
  log(`Final events: ${uniqueEvents.length} irrigation detections`, 'success');
  
  return uniqueEvents;
}

/**
 * Get first and last irrigation events
 * @param {Array} events - Detected irrigation events
 * @returns {{first: object|null, last: object|null}}
 */
export function getFirstAndLastEvents(events) {
  if (!events || events.length === 0) {
    return { first: null, last: null };
  }
  
  return {
    first: events[0],
    last: events[events.length - 1]
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📈 SVG CHART INTERACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Click a specific point on the Highcharts SVG chart
 * @param {Page} page - Playwright page
 * @param {number} dataIndex - Index of the data point to click
 * @param {object} chartBounds - Chart container bounding box
 * @param {number} totalPoints - Total number of data points
 * @returns {Promise<boolean>}
 */
export async function clickChartPoint(page, dataIndex, chartBounds, totalPoints) {
  try {
    // Calculate approximate X position based on data index
    const xPercent = dataIndex / totalPoints;
    const clickX = chartBounds.x + (chartBounds.width * xPercent);
    
    // Click at chart midpoint Y (the point will snap to nearest data)
    const clickY = chartBounds.y + (chartBounds.height / 2);
    
    log(`Clicking chart at (${Math.round(clickX)}, ${Math.round(clickY)})`, 'step');
    
    await page.mouse.click(clickX, clickY);
    await delay(300);
    
    return true;
  } catch (e) {
    log(`Chart click failed: ${e.message}`, 'error');
    return false;
  }
}

/**
 * Get chart container bounds from the page
 * @param {Page} page - Playwright page
 * @returns {Promise<{x: number, y: number, width: number, height: number}|null>}
 */
export async function getChartBounds(page) {
  return await page.evaluate(() => {
    // Try multiple selectors for chart container
    const selectors = [
      '.highcharts-container',
      '.highcharts-root',
      '[data-highcharts-chart]',
      'svg.highcharts-root'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      }
    }
    
    return null;
  });
}

/**
 * Wait for chart to be fully rendered
 * @param {Page} page - Playwright page
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
export async function waitForChartRender(page, timeout = 5000) {
  try {
    log('Waiting for chart SVG to render...', 'step');
    
    await page.waitForSelector(
      '.highcharts-series-0 path.highcharts-graph, .highcharts-root path',
      { state: 'visible', timeout }
    );
    
    // Additional buffer for animation completion
    await delay(500);
    
    log('Chart render complete', 'success');
    return true;
  } catch (e) {
    log(`Chart render wait failed: ${e.message}`, 'warning');
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 CLICK IRRIGATION POINTS IN CHART
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Click first and last irrigation points on the chart
 * @param {Page} page - Playwright page
 * @param {Array} dataPoints - All data points
 * @param {object} firstEvent - First irrigation event
 * @param {object} lastEvent - Last irrigation event
 * @param {object} options - Options for clicking behavior
 * @returns {Promise<{firstClicked: boolean, lastClicked: boolean}>}
 */
export async function clickIrrigationPoints(page, dataPoints, firstEvent, lastEvent, options = {}) {
  const { needsFirst = true, needsLast = true } = options;
  const result = { firstClicked: false, lastClicked: false };
  
  logSubsection('Clicking Chart Points');
  
  // Get chart bounds
  const chartBounds = await getChartBounds(page);
  if (!chartBounds) {
    log('Could not find chart container', 'error');
    return result;
  }
  
  log(`Chart bounds: ${chartBounds.width}x${chartBounds.height} at (${chartBounds.x}, ${chartBounds.y})`, 'info');
  
  // Click first event
  if (needsFirst && firstEvent) {
    log(`Clicking FIRST irrigation point: ${firstEvent.time}`, 'step');
    result.firstClicked = await clickChartPoint(page, firstEvent.index, chartBounds, dataPoints.length);
    await delay(500);
  }
  
  // Click last event
  if (needsLast && lastEvent) {
    log(`Clicking LAST irrigation point: ${lastEvent.time}`, 'step');
    result.lastClicked = await clickChartPoint(page, lastEvent.index, chartBounds, dataPoints.length);
    await delay(500);
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 HIGHCHARTS API INTERACTION (IN-BROWSER)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Click chart points using Highcharts API (executed in browser context)
 * @param {Page} page - Playwright page
 * @param {number} firstIndex - Index of first irrigation point
 * @param {number} lastIndex - Index of last irrigation point
 * @param {object} options - Click options
 * @returns {Promise<{firstClicked: boolean, lastClicked: boolean}>}
 */
export async function clickViaHighchartsAPI(page, firstIndex, lastIndex, options = {}) {
  const { needsFirst = true, needsLast = true } = options;
  
  return await page.evaluate(({ firstIdx, lastIdx, clickFirst, clickLast }) => {
    const results = { firstClicked: false, lastClicked: false };
    
    // Access Highcharts global
    if (!window.Highcharts || !window.Highcharts.charts) {
      console.error('[Browser] Highcharts not available');
      return results;
    }
    
    // Find the chart
    const chart = window.Highcharts.charts.find(c => c !== undefined);
    if (!chart || !chart.series || !chart.series[0]) {
      console.error('[Browser] Chart series not found');
      return results;
    }
    
    const dataPoints = chart.series[0].data;
    
    // Click first point
    if (clickFirst && firstIdx >= 0 && firstIdx < dataPoints.length) {
      const point = dataPoints[firstIdx];
      if (point) {
        point.select(true, false);
        point.firePointEvent('click');
        results.firstClicked = true;
        console.log(`[Browser] Clicked first point at index ${firstIdx}`);
      }
    }
    
    // Click last point
    if (clickLast && lastIdx >= 0 && lastIdx < dataPoints.length) {
      const point = dataPoints[lastIdx];
      if (point) {
        // Deselect first point if needed
        if (results.firstClicked) {
          dataPoints[firstIdx].select(false, false);
        }
        point.select(true, false);
        point.firePointEvent('click');
        results.lastClicked = true;
        console.log(`[Browser] Clicked last point at index ${lastIdx}`);
      }
    }
    
    return results;
  }, { 
    firstIdx: firstIndex, 
    lastIdx: lastIndex, 
    clickFirst: needsFirst, 
    clickLast: needsLast 
  });
}

export default {
  HSSP_PARAMS,
  detectIrrigationEvents,
  getFirstAndLastEvents,
  clickChartPoint,
  getChartBounds,
  waitForChartRender,
  clickIrrigationPoints,
  clickViaHighchartsAPI
};
