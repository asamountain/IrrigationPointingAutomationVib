/**
 * Browser-side Highcharts Utilities
 * This code runs in browser context via page.evaluate()
 *
 * Functions:
 * - calculateScreenCoordinates(firstIdx, lastIdx, totalPoints) - Calculate screen positions from data indices
 * - findNearestPoint(screenX) - Find nearest Highcharts point to screen position
 * - triggerPointClick(point, markerType) - Trigger click event on a Highcharts point
 */

/**
 * Calculate screen coordinates for chart points
 * Uses Highcharts API (preferred) or SVG fallback
 */
function calculateScreenCoordinates(firstIdx, lastIdx, totalPoints) {
  console.log(`[BROWSER] calculateScreenCoordinates: firstIdx=${firstIdx}, lastIdx=${lastIdx}`);

  const result = { first: null, last: null, debug: {}, method: 'unknown' };

  // METHOD 1: Try Highcharts API (most accurate)
  let chart = null;
  if (window.Highcharts && window.Highcharts.charts) {
    chart = window.Highcharts.charts.find(c => c !== undefined);
  }

  if (chart && chart.series && chart.series[0] && chart.series[0].data) {
    const dataPoints = chart.series[0].data;
    console.log(`[BROWSER] Using Highcharts API: ${dataPoints.length} data points`);
    result.method = 'highcharts';

    const chartContainer = document.querySelector('.highcharts-container');
    if (chartContainer) {
      const containerRect = chartContainer.getBoundingClientRect();

      // Get first point
      if (firstIdx >= 0 && firstIdx < dataPoints.length) {
        const p = dataPoints[firstIdx];
        if (p && p.plotX !== undefined && p.plotY !== undefined) {
          result.first = {
            screenX: containerRect.left + p.plotX + chart.plotLeft,
            screenY: containerRect.top + p.plotY + chart.plotTop,
            x: p.x, y: p.y,
            time: p.category || new Date(p.x).toTimeString().slice(0, 5)
          };
        }
      }

      // Get last point
      if (lastIdx >= 0 && lastIdx < dataPoints.length) {
        const p = dataPoints[lastIdx];
        if (p && p.plotX !== undefined && p.plotY !== undefined) {
          result.last = {
            screenX: containerRect.left + p.plotX + chart.plotLeft,
            screenY: containerRect.top + p.plotY + chart.plotTop,
            x: p.x, y: p.y,
            time: p.category || new Date(p.x).toTimeString().slice(0, 5)
          };
        }
      }

      if (result.first && result.last) {
        console.log(`[BROWSER] Highcharts coords: first=(${result.first.screenX}, ${result.first.screenY}), last=(${result.last.screenX}, ${result.last.screenY})`);
        return result;
      }
    }
  }

  // METHOD 2: SVG-based calculation (fallback)
  console.log('[BROWSER] Highcharts not available, using SVG fallback');
  result.method = 'svg-fallback';

  const chartContainer = document.querySelector('.highcharts-container') ||
                         document.querySelector('[data-highcharts-chart]');

  if (!chartContainer) {
    console.error('[BROWSER] No chart container found for SVG fallback');
    return { error: 'Chart container not found' };
  }

  const containerRect = chartContainer.getBoundingClientRect();
  console.log(`[BROWSER] Container: ${containerRect.width}x${containerRect.height} at (${containerRect.left}, ${containerRect.top})`);

  // Estimate plot area
  const plotLeft = containerRect.left + 60;
  const plotTop = containerRect.top + 30;
  const plotWidth = containerRect.width - 100;
  const plotHeight = containerRect.height - 80;

  const firstXPercent = firstIdx / totalPoints;
  const lastXPercent = lastIdx / totalPoints;

  const firstScreenX = plotLeft + (plotWidth * firstXPercent);
  const lastScreenX = plotLeft + (plotWidth * lastXPercent);
  const middleY = plotTop + (plotHeight / 2);

  result.first = { screenX: firstScreenX, screenY: middleY, time: 'N/A', x: firstIdx, y: 0 };
  result.last = { screenX: lastScreenX, screenY: middleY, time: 'N/A', x: lastIdx, y: 0 };

  console.log(`[BROWSER] SVG fallback coords: first=(${firstScreenX.toFixed(0)}, ${middleY.toFixed(0)}), last=(${lastScreenX.toFixed(0)}, ${middleY.toFixed(0)})`);

  return result;
}

/**
 * Find the nearest Highcharts point to a screen X position
 */
function findNearestPoint(screenX, seriesName = 'SPLY') {
  try {
    const chart = Highcharts.charts.find(c => c && c.renderTo);
    if (!chart) return null;

    const chartRect = chart.container.getBoundingClientRect();
    const plotX = screenX - chartRect.left - chart.plotLeft;

    const seriesIndex = chart.series.findIndex(s => s.name && s.name.includes(seriesName));
    const series = seriesIndex >= 0 ? chart.series[seriesIndex] : chart.series[0];

    if (!series?.points?.length) return null;

    let nearestPoint = null, minDistance = Infinity;
    for (const point of series.points) {
      const distance = Math.abs(point.plotX - plotX);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    }

    return { point: nearestPoint, distance: minDistance };
  } catch (err) {
    console.error('[BROWSER] Error finding nearest point:', err);
    return null;
  }
}

/**
 * Trigger a click event on a Highcharts point
 */
function triggerPointClick(point, markerType) {
  try {
    const chart = Highcharts.charts.find(c => c && c.renderTo);
    if (!chart || !point) return false;

    console.log(`[BROWSER] 🎯 Triggering click on point at ${point.category || point.x}`);

    // Deselect any previously selected points
    chart.getSelectedPoints().forEach(p => p.select(false, false));

    // Select and trigger click event
    point.select(true, false);
    point.firePointEvent('click');

    console.log(`[BROWSER] ✅ Highcharts click event fired for ${markerType}`);
    return true;
  } catch (err) {
    console.error('[BROWSER] Error triggering point click:', err);
    return false;
  }
}

/**
 * Get chart information
 */
function getChartInfo() {
  try {
    const chart = Highcharts.charts.find(c => c && c.renderTo);
    if (!chart) return null;

    return {
      plotLeft: chart.plotLeft,
      plotTop: chart.plotTop,
      plotWidth: chart.plotWidth,
      plotHeight: chart.plotHeight,
      seriesCount: chart.series.length,
      pointCount: chart.series[0]?.data?.length || 0
    };
  } catch (err) {
    return null;
  }
}

// Export for use by Playwright
if (typeof window !== 'undefined') {
  window.calculateScreenCoordinates = calculateScreenCoordinates;
  window.findNearestPoint = findNearestPoint;
  window.triggerPointClick = triggerPointClick;
  window.getChartInfo = getChartInfo;
}
