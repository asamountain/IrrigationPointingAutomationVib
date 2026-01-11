/**
 * Network Interception Module
 * Captures chart data from API responses instead of DOM access
 */

/**
 * Set up network monitoring to capture chart data
 * Call this BEFORE navigating to a farm
 */
export function setupNetworkInterception(page) {
  const capturedData = {
    chartData: null,
    dataUrl: null,
    timestamp: null
  };

  // Listen to all responses
  page.on('response', async (response) => {
    try {
      const url = response.url();
      const method = response.request().method();
      const status = response.status();

      // Look for API calls that might contain chart data
      const isPotentialDataUrl = 
        (url.includes('/report/point') || 
         url.includes('/api/') ||
         url.includes('/data/')) &&
        method === 'GET' &&
        status === 200;

      if (isPotentialDataUrl) {
        console.log(`🔍 [NETWORK] Intercepted: ${url.substring(url.length - 80)}`);
        
        const contentType = response.headers()['content-type'] || '';
        
        if (contentType.includes('application/json')) {
          try {
            const data = await response.json();
            
            // Check if this looks like chart data
            const hasChartData = 
              (data.data && Array.isArray(data.data)) ||
              (data.series && Array.isArray(data.series)) ||
              (data.items && Array.isArray(data.items)) ||
              (Array.isArray(data) && data.length > 100); // Large array likely chart data
            
            if (hasChartData) {
              console.log(`✅ [NETWORK] Found chart data! URL: ${url}`);
              console.log(`   → Data structure: ${Object.keys(data).join(', ')}`);
              
              capturedData.chartData = data;
              capturedData.dataUrl = url;
              capturedData.timestamp = Date.now();
            }
          } catch (jsonError) {
            // Not JSON or parse failed, ignore
          }
        }
      }
    } catch (err) {
      // Ignore errors from closed responses
    }
  });

  return capturedData;
}

/**
 * Wait for chart data to be captured via network
 */
export async function waitForChartData(capturedData, timeoutMs = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (capturedData.chartData) {
      console.log(`✅ [NETWORK] Chart data captured after ${Date.now() - startTime}ms`);
      return capturedData.chartData;
    }
    await new Promise(resolve => setTimeout(resolve, 100)); // Poll every 100ms
  }
  
  throw new Error(`Timeout: No chart data captured within ${timeoutMs}ms`);
}

/**
 * Extract data points from various API response formats
 */
export function extractDataPoints(apiResponse) {
  console.log('🔍 [NETWORK] Analyzing API response structure...');
  
  // Try different common formats
  let dataPoints = null;
  
  // Format 1: { data: [...] }
  if (apiResponse.data && Array.isArray(apiResponse.data)) {
    dataPoints = apiResponse.data;
    console.log(`   → Format: { data: [...] } with ${dataPoints.length} points`);
  }
  // Format 2: { series: [{ data: [...] }] }
  else if (apiResponse.series && Array.isArray(apiResponse.series) && apiResponse.series[0]?.data) {
    dataPoints = apiResponse.series[0].data;
    console.log(`   → Format: { series: [{ data: [...] }] } with ${dataPoints.length} points`);
  }
  // Format 3: { items: [...] }
  else if (apiResponse.items && Array.isArray(apiResponse.items)) {
    dataPoints = apiResponse.items;
    console.log(`   → Format: { items: [...] } with ${dataPoints.length} points`);
  }
  // Format 4: Direct array
  else if (Array.isArray(apiResponse)) {
    dataPoints = apiResponse;
    console.log(`   → Format: Direct array with ${dataPoints.length} points`);
  }
  
  if (!dataPoints) {
    console.log('⚠️  [NETWORK] Could not identify data array in response');
    console.log(`   → Available keys: ${Object.keys(apiResponse).join(', ')}`);
    return null;
  }
  
  // Normalize data points to { x, y } format
  const normalizedPoints = dataPoints.map((point, idx) => {
    // Format: [timestamp, value]
    if (Array.isArray(point) && point.length >= 2) {
      return { x: point[0], y: point[1], index: idx };
    }
    // Format: { x, y }
    else if (typeof point === 'object' && 'y' in point) {
      return { x: point.x !== undefined ? point.x : idx, y: point.y, index: idx };
    }
    // Format: { value, timestamp }
    else if (typeof point === 'object' && 'value' in point) {
      return { x: point.timestamp || point.time || idx, y: point.value, index: idx };
    }
    // Format: just numbers
    else if (typeof point === 'number') {
      return { x: idx, y: point, index: idx };
    }
    
    return null;
  }).filter(p => p !== null);
  
  console.log(`✅ [NETWORK] Normalized ${normalizedPoints.length} data points`);
  if (normalizedPoints.length > 0) {
    console.log(`   → Sample: [0] = {x: ${normalizedPoints[0].x}, y: ${normalizedPoints[0].y}}`);
  }
  
  return normalizedPoints;
}
