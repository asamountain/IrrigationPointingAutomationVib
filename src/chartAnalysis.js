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
import logger from './logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 ALGORITHM PARAMETERS
// ═══════════════════════════════════════════════════════════════════════════════

const HSSP_PARAMS = {
  SURGE_WINDOW: 10,       // Compare with 10 minutes ago (more stable, was 5)
  SURGE_THRESHOLD_PERCENT: 0.05,  // 5% of Y range as minimum threshold (was 1.5% - too sensitive)
  SURGE_THRESHOLD_MIN: 0.1,       // Absolute minimum threshold (was 0.02 - caught noise)
  MIN_RISE_ABSOLUTE: 0.05,        // Minimum absolute rise to consider (NEW)
  LOOKBACK_WINDOW: 30,    // Look back 30 minutes to find valley (was 20)
  DEBOUNCE_MINUTES: 60,   // Minimum 60 minutes between events (was 30)
  MIN_SEPARATION_PERCENT: 0.05,   // Events must be 5% of data apart
  DAYTIME_START: 7,       // Start of valid irrigation hours
  DAYTIME_END: 17,        // End of valid irrigation hours
  MIN_DATA_POINTS: 10,    // Minimum data points required
  MIN_VALLEY_DEPTH: 0.03  // Valley must be at least this much lower than surge (NEW)
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
  const timerId = logger.functionEntry('detectIrrigationEvents', {
    dataPointCount: dataPoints?.length || 0,
    params: HSSP_PARAMS
  });
  
  logSubsection('HSSP Algorithm - Rolling Window Valley Detection');
  
  // Log algorithm run
  logger.chartInteraction('algorithmRun', {
    dataPoints: dataPoints?.length || 0,
    algorithm: 'HSSP',
    params: HSSP_PARAMS
  });
  
  if (!dataPoints || dataPoints.length < HSSP_PARAMS.MIN_DATA_POINTS) {
    log(`Insufficient data points: ${dataPoints?.length || 0} (need ${HSSP_PARAMS.MIN_DATA_POINTS})`, 'warning');
    logger.warning('Insufficient data points for analysis', {
      received: dataPoints?.length || 0,
      required: HSSP_PARAMS.MIN_DATA_POINTS
    });
    logger.functionExit(timerId, []);
    return [];
  }
  
  log(`Analyzing ${dataPoints.length} data points...`, 'step');
  
  // Calculate Y range statistics
  const yValues = dataPoints.map(p => p.y);
  const maxY = Math.max(...yValues);
  const minY = Math.min(...yValues);
  const yRange = maxY - minY;
  
  log(`Y range: ${minY.toFixed(2)} to ${maxY.toFixed(2)} (span: ${yRange.toFixed(2)})`, 'info');
  
  // Calculate adaptive surge threshold (use higher of multiple criteria)
  const surgeThreshold = Math.max(
    HSSP_PARAMS.SURGE_THRESHOLD_MIN,
    yRange * HSSP_PARAMS.SURGE_THRESHOLD_PERCENT,
    HSSP_PARAMS.MIN_RISE_ABSOLUTE
  );
  
  log(`Surge threshold: ${surgeThreshold.toFixed(4)} (5% of range or min 0.1)`, 'info');
  log(`Lookback window: ${HSSP_PARAMS.LOOKBACK_WINDOW} minutes`, 'info');
  log(`Time filter: ${HSSP_PARAMS.DAYTIME_START}:00 - ${HSSP_PARAMS.DAYTIME_END}:00`, 'info');
  
  logger.debug('Algorithm parameters calculated', {
    yRange: { min: minY, max: maxY, span: yRange },
    surgeThreshold,
    lookbackWindow: HSSP_PARAMS.LOOKBACK_WINDOW,
    timeFilter: { start: HSSP_PARAMS.DAYTIME_START, end: HSSP_PARAMS.DAYTIME_END }
  });
  
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
      log(`Checking surge at index ${i} (10-min rise: ${diff.toFixed(4)})`, 'step');
      
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
      
      // Calculate total rise from valley to current point
      const totalRise = currentVal - minVal;
      
      // VALIDATE: Must be in daytime (07:00 - 17:00)
      const eventTimestamp = dataPoints[valleyIndex].x;
      const eventDate = new Date(eventTimestamp);
      const eventHour = eventDate.getHours();
      const eventMinute = eventDate.getMinutes();
      const isDaytime = eventHour >= HSSP_PARAMS.DAYTIME_START && 
                        eventHour <= HSSP_PARAMS.DAYTIME_END;
      
      // Check if rise is significant enough
      const isSignificantRise = totalRise >= HSSP_PARAMS.MIN_VALLEY_DEPTH;
      
      const timeStr = `${String(eventHour).padStart(2, '0')}:${String(eventMinute).padStart(2, '0')}`;
      
      if (!isDaytime) {
        log(`⏭️ REJECTED: ${timeStr} is outside ${HSSP_PARAMS.DAYTIME_START}:00-${HSSP_PARAMS.DAYTIME_END}:00`, 'warning');
        logger.debug('Event rejected: outside daytime hours', {
          time: timeStr,
          hour: eventHour,
          allowedHours: { start: HSSP_PARAMS.DAYTIME_START, end: HSSP_PARAMS.DAYTIME_END }
        });
      } else if (!isSignificantRise) {
        log(`⏭️ REJECTED: totalRise ${totalRise.toFixed(4)} < min ${HSSP_PARAMS.MIN_VALLEY_DEPTH}`, 'warning');
        logger.debug('Event rejected: insufficient rise', {
          time: timeStr,
          totalRise,
          minRequired: HSSP_PARAMS.MIN_VALLEY_DEPTH
        });
      } else {
        const event = {
          index: valleyIndex,
          x: dataPoints[valleyIndex].x,
          y: dataPoints[valleyIndex].y,
          peakIndex: i,
          rise: totalRise,
          time: timeStr,
          hour: eventHour,
          minute: eventMinute
        };
        allEvents.push(event);
        
        lastEventIndex = valleyIndex;
        i = Math.max(i, valleyIndex + 15); // Skip forward to avoid double-detection
        log(`✅ ACCEPTED: Valley at ${timeStr} (index ${valleyIndex}), rise: ${totalRise.toFixed(4)}`, 'success');
        
        logger.chartInteraction('detection', {
          accepted: true,
          time: timeStr,
          index: valleyIndex,
          rise: totalRise,
          eventNumber: allEvents.length
        });
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
  
  // Log final detection summary
  const detectionSummary = {
    totalDataPoints: dataPoints.length,
    rawDetections: allEvents.length,
    uniqueEvents: uniqueEvents.length,
    events: uniqueEvents.map(e => ({ time: e.time, index: e.index, rise: e.rise }))
  };
  
  logger.chartInteraction('detection', {
    count: uniqueEvents.length,
    summary: detectionSummary
  });
  
  logger.functionExit(timerId, detectionSummary);
  
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
  const timerId = logger.functionEntry('clickIrrigationPoints', {
    totalPoints: dataPoints?.length || 0,
    firstEventTime: firstEvent?.time,
    lastEventTime: lastEvent?.time,
    options
  });
  
  const { needsFirst = true, needsLast = true } = options;
  const result = { firstClicked: false, lastClicked: false };
  
  logSubsection('Clicking Chart Points');
  
  // Get chart bounds
  const chartBounds = await getChartBounds(page);
  if (!chartBounds) {
    log('Could not find chart container', 'error');
    logger.error('Could not find chart container for clicking');
    logger.functionExit(timerId, result, { error: 'No chart container' });
    return result;
  }
  
  log(`Chart bounds: ${chartBounds.width}x${chartBounds.height} at (${chartBounds.x}, ${chartBounds.y})`, 'info');
  logger.debug('Chart bounds acquired', chartBounds);
  
  // Click first event
  if (needsFirst && firstEvent) {
    log(`Clicking FIRST irrigation point: ${firstEvent.time}`, 'step');
    result.firstClicked = await clickChartPoint(page, firstEvent.index, chartBounds, dataPoints.length);
    
    logger.chartInteraction('pointClick', {
      type: 'first',
      index: firstEvent.index,
      time: firstEvent.time,
      success: result.firstClicked,
      coordinates: {
        x: chartBounds.x + (chartBounds.width * (firstEvent.index / dataPoints.length)),
        y: chartBounds.y + (chartBounds.height / 2)
      }
    });
    
    await delay(500);
  }
  
  // Click last event
  if (needsLast && lastEvent) {
    log(`Clicking LAST irrigation point: ${lastEvent.time}`, 'step');
    result.lastClicked = await clickChartPoint(page, lastEvent.index, chartBounds, dataPoints.length);
    
    logger.chartInteraction('pointClick', {
      type: 'last',
      index: lastEvent.index,
      time: lastEvent.time,
      success: result.lastClicked,
      coordinates: {
        x: chartBounds.x + (chartBounds.width * (lastEvent.index / dataPoints.length)),
        y: chartBounds.y + (chartBounds.height / 2)
      }
    });
    
    await delay(500);
  }
  
  logger.functionExit(timerId, result);
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
  const timerId = logger.functionEntry('clickViaHighchartsAPI', {
    firstIndex,
    lastIndex,
    options
  });
  
  const { needsFirst = true, needsLast = true } = options;
  
  const results = await page.evaluate(({ firstIdx, lastIdx, clickFirst, clickLast }) => {
    const results = { firstClicked: false, lastClicked: false, error: null };
    
    // Access Highcharts global
    if (!window.Highcharts || !window.Highcharts.charts) {
      console.error('[Browser] Highcharts not available');
      results.error = 'Highcharts not available';
      return results;
    }
    
    // Find the chart
    const chart = window.Highcharts.charts.find(c => c !== undefined);
    if (!chart || !chart.series || !chart.series[0]) {
      console.error('[Browser] Chart series not found');
      results.error = 'Chart series not found';
      return results;
    }
    
    const dataPoints = chart.series[0].data;
    results.totalPoints = dataPoints.length;
    
    // Click first point
    if (clickFirst && firstIdx >= 0 && firstIdx < dataPoints.length) {
      const point = dataPoints[firstIdx];
      if (point) {
        point.select(true, false);
        point.firePointEvent('click');
        results.firstClicked = true;
        results.firstPointData = { x: point.x, y: point.y };
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
        results.lastPointData = { x: point.x, y: point.y };
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
  
  // Log the Highcharts API click results
  if (results.error) {
    logger.error('Highcharts API click failed', { error: results.error });
  } else {
    if (results.firstClicked) {
      logger.chartInteraction('pointClick', {
        type: 'first',
        method: 'HighchartsAPI',
        index: firstIndex,
        success: true,
        pointData: results.firstPointData
      });
    }
    if (results.lastClicked) {
      logger.chartInteraction('pointClick', {
        type: 'last',
        method: 'HighchartsAPI',
        index: lastIndex,
        success: true,
        pointData: results.lastPointData
      });
    }
  }
  
  logger.functionExit(timerId, { firstClicked: results.firstClicked, lastClicked: results.lastClicked });
  
  return { firstClicked: results.firstClicked, lastClicked: results.lastClicked };
}

/**
 * Detect first/last irrigation times using TCN when trained, HSSP otherwise.
 * Falls back to HSSP if the model is untrained (< 3 samples) or unavailable.
 *
 * @param {Array<{x: number, y: number}>} dataPoints
 * @param {object|null} tcnModel - TF.js LayersModel or null
 * @param {number} trainingCount - Number of confirmed corrections so far
 * @returns {Promise<{ firstTime: string|null, lastTime: string|null, method: string }>}
 */
export async function detectWithTCN(dataPoints, tcnModel, trainingCount) {
  if (!tcnModel || trainingCount < 3) {
    const events = detectIrrigationEvents(dataPoints);
    const { first, last } = getFirstAndLastEvents(events);
    return {
      firstTime: first?.time ?? null,
      lastTime: last?.time ?? null,
      method: 'hssp'
    };
  }

  const { prepareSequence, normToTimeString } = await import('./ml/tcnModel.js');
  const xs = prepareSequence(dataPoints);
  const pred = tcnModel.predict(xs);
  const values = await pred.data();
  xs.dispose();
  pred.dispose();

  return {
    firstTime: normToTimeString(values[0]),
    lastTime: normToTimeString(values[1]),
    method: 'tcn'
  };
}

export default {
  HSSP_PARAMS,
  detectIrrigationEvents,
  getFirstAndLastEvents,
  detectWithTCN,
  clickChartPoint,
  getChartBounds,
  waitForChartRender,
  clickIrrigationPoints,
  clickViaHighchartsAPI
};
