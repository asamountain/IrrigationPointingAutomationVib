/**
 * Updated Network Interceptor - Looks for "node." keys
 * Based on actual app structure discovered in Webpack bundle
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
      const resourceType = response.request().resourceType();
      const status = response.status();

      // Filter: Only check fetch/xhr requests with 200 status
      if ((resourceType !== 'fetch' && resourceType !== 'xhr') || status !== 200) {
        return;
      }

      const contentType = response.headers()['content-type'] || '';
      if (!contentType.includes('application/json')) {
        return;
      }

      // Try to parse as JSON
      try {
        const data = await response.json();
        
        // ✅ THE SECRET SAUCE: Look for "node." keys (discovered in source code)
        const nodeKeys = Object.keys(data).filter(key => key.startsWith('node.'));
        
        if (nodeKeys.length > 0) {
          console.log(`✅ [NETWORK] Found "node." data! URL: ${url.substring(Math.max(0, url.length - 80))}`);
          console.log(`   → Node keys: ${nodeKeys.join(', ')}`);
          
          capturedData.chartData = data;
          capturedData.dataUrl = url;
          capturedData.timestamp = Date.now();
        }
      } catch (jsonError) {
        // Not JSON or parse failed, ignore
      }
    } catch (err) {
      // Ignore errors from closed responses
    }
  });

  return capturedData;
}

export async function waitForChartData(capturedData, timeoutMs = 15000) {
  const startTime = Date.now();
  
  console.log('  ⏳ Waiting for sensor data (looking for "node." keys)...');
  
  while (Date.now() - startTime < timeoutMs) {
    if (capturedData.chartData) {
      console.log(`  ✅ Sensor data captured after ${Date.now() - startTime}ms\n`);
      return capturedData.chartData;
    }
    await new Promise(resolve => setTimeout(resolve, 100)); // Poll every 100ms
  }
  
  throw new Error(`Timeout: No sensor data with "node." keys found within ${timeoutMs}ms`);
}

export function extractDataPoints(apiResponse) {
  console.log('🔍 [NETWORK] Analyzing API response for sensor data...');
  
  // Find the "node." key
  const nodeKeys = Object.keys(apiResponse).filter(key => key.startsWith('node.'));
  
  if (nodeKeys.length === 0) {
    console.log('⚠️  [NETWORK] No "node." keys found in response');
    return null;
  }
  
  console.log(`   → Found ${nodeKeys.length} node key(s): ${nodeKeys.join(', ')}`);
  
  // Get the first node's data
  const nodeKey = nodeKeys[0];
  const nodeData = apiResponse[nodeKey];
  
  if (!Array.isArray(nodeData)) {
    console.log(`⚠️  [NETWORK] Node data is not an array: ${typeof nodeData}`);
    return null;
  }
  
  console.log(`   → Node "${nodeKey}" has ${nodeData.length} entries`);
  
  // 🔍 DEBUG: Show actual data structure
  if (nodeData.length > 0) {
    console.log("🔍 [DEBUG] DATA STRUCTURE ANALYSIS:");
    console.log(`   → Type: ${Array.isArray(nodeData) ? 'Array' : typeof nodeData}`);
    console.log(`   → Length: ${nodeData.length}`);
    console.log(`   → First 3 items:`);
    for (let i = 0; i < Math.min(3, nodeData.length); i++) {
      console.log(`      [${i}]:`, JSON.stringify(nodeData[i]));
    }
    console.log(`   → Last item:`);
    console.log(`      [${nodeData.length - 1}]:`, JSON.stringify(nodeData[nodeData.length - 1]));
    console.log("-------------------------------------");
  }
  
  // Look for sensor keys (slabwgt, slabvwc, etc.)
  if (nodeData.length === 0) {
    console.log('⚠️  [NETWORK] Node data array is empty');
    return null;
  }
  
  // 🔧 FIX: Find first non-empty entry (skip empty objects)
  let firstEntry = null;
  let skipCount = 0;
  for (let i = 0; i < Math.min(20, nodeData.length); i++) {
    const entry = nodeData[i];
    if (entry && Object.keys(entry).length > 0) {
      firstEntry = entry;
      skipCount = i;
      break;
    }
  }
  
  if (!firstEntry) {
    console.log('⚠️  [NETWORK] All entries are empty objects');
    return null;
  }
  
  if (skipCount > 0) {
    console.log(`   → Skipped ${skipCount} empty entries, using entry [${skipCount}]`);
  }
  
  // 🔧 FIX: Look for sensor keys with dynamic suffixes (slabwgt_1, calslabvwc_1, etc.)
  const allKeys = Object.keys(firstEntry);
  console.log(`   → Keys in first valid entry: ${allKeys.join(', ')}`);
  
  const sensorKeys = allKeys.filter(k => {
    const lower = k.toLowerCase();
    return (lower.includes('slabwgt') || 
            lower.includes('slabvwc') || 
            lower.includes('calslabvwc')) && 
           k !== 'timestamp' && k !== 't' && k !== 'time';
  });
  
  console.log(`   → Available sensors: ${sensorKeys.join(', ')}`);
  
  // Prefer weight sensors (slabwgt_*)
  let targetSensor = sensorKeys.find(k => k.toLowerCase().includes('wgt'));
  if (!targetSensor) {
    targetSensor = sensorKeys[0]; // Fall back to first available
  }
  
  if (!targetSensor) {
    console.log('⚠️  [NETWORK] No recognized sensor data found');
    console.log(`   → Available keys: ${allKeys.join(', ')}`);
    return null;
  }
  
  console.log(`   → Using sensor: "${targetSensor}"`);
  
  // Extract data points
  const dataPoints = nodeData.map((entry, idx) => {
    const value = entry[targetSensor];
    if (value === null || value === undefined) {
      return null;
    }
    
    // Try to get timestamp if available
    const timestamp = entry.timestamp || entry.time || entry.t || idx;
    
    return {
      x: timestamp,
      y: parseFloat(value),
      index: idx
    };
  }).filter(p => p !== null);
  
  console.log(`✅ [NETWORK] Extracted ${dataPoints.length} data points from "${targetSensor}"`);
  if (dataPoints.length > 0) {
    const sample = dataPoints[Math.floor(dataPoints.length / 2)];
    console.log(`   → Sample (middle): [${sample.index}] = {x: ${sample.x}, y: ${sample.y}}`);
  }
  
  return dataPoints;
}
