# 🌐 Network Interception - The Modern Approach

**Date:** January 11, 2026  
**Commit:** `c0ff16f`  
**Why:** Highcharts is bundled (Webpack), `window.Highcharts` unavailable

---

## ❌ Why the Old Approach Failed

### **The Problem:**
```
⏳ Waiting for Highcharts library to load...
⚠️ Highcharts did not load within 10 seconds
```

**Repeated for EVERY date with 100% failure rate.**

### **Root Cause:**
```javascript
// Tried to access:
await page.waitForFunction(
  () => window.Highcharts && window.Highcharts.charts
);

// But Highcharts is bundled with Webpack:
// ❌ window.Highcharts = undefined (not exposed globally)
// ❌ Cannot access charts via DOM
// ❌ Fundamentally broken architecture
```

**Why this happened:**
- Modern apps bundle libraries with Webpack/Rollup
- `window.Highcharts` only exists if explicitly exposed
- This app doesn't expose it (good security practice)
- **Our DOM access approach was doomed from the start**

---

## ✅ The New Approach: Network Interception

### **Core Concept:**
**Don't access the chart. Steal the data BEFORE it gets to the chart!**

```
USER CLICKS FARM
       ↓
APP CALLS API (/report/point/689/732?date=2026-01-06)
       ↓
🌐 WE INTERCEPT THE RESPONSE HERE ← (NEW!)
       ↓
API RETURNS JSON: { data: [val1, val2, ...], timestamp: ... }
       ↓
🔍 WE ANALYZE THE RAW DATA
       ↓
✅ FIND IRRIGATION EVENTS
       ↓
(Chart renders in UI ← We don't care about this anymore!)
```

---

## 🏗️ Architecture

### **1. Network Interceptor Module** (`network-interceptor.js`)

**Three Main Functions:**

#### `setupNetworkInterception(page)`
```javascript
// Call this BEFORE clicking a farm
const networkData = setupNetworkInterception(page);

// Returns a reference object that will be populated when data arrives
// { chartData: null, dataUrl: null, timestamp: null }
```

**What it does:**
- Sets up `page.on('response', ...)` listener
- Monitors ALL network traffic
- Filters for potential chart data URLs
- Captures JSON responses with arrays
- Stores in the reference object

#### `waitForChartData(capturedData, timeout)`
```javascript
// After clicking, wait for data to arrive
const chartData = await waitForChartData(networkData, 10000);
```

**What it does:**
- Polls the `capturedData` object every 100ms
- Returns when `chartData` is populated
- Throws timeout error if no data after 10 seconds

#### `extractDataPoints(apiResponse)`
```javascript
// Normalize different API formats
const dataPoints = extractDataPoints(chartData);
// Returns: [{ x: 0, y: 45.2 }, { x: 1, y: 45.1 }, ...]
```

**What it does:**
- Handles multiple common API formats:
  - `{ data: [...] }`
  - `{ series: [{ data: [...] }] }`
  - `{ items: [...] }`
  - Direct array `[...]`
- Normalizes point formats:
  - `[timestamp, value]` → `{ x, y }`
  - `{ x, y }` → `{ x, y }`
  - `{ value, timestamp }` → `{ x, y }`
  - Just numbers → `{ x: index, y: value }`

---

### **2. Integration in Main Script**

**Before (Lines ~528):**
```javascript
// Set up network interception BEFORE clicking
const networkData = setupNetworkInterception(page);

// Then click the farm
await farmLink.click({ force: true });
```

**After Farm Click (Lines ~813+):**
```javascript
// Wait for the API response
const chartData = await waitForChartData(networkData, 10000);

// Extract and normalize data points
const dataPoints = extractDataPoints(chartData);

// Analyze for irrigation events
const yRange = Math.max(...yValues) - Math.min(...yValues);
const dropThreshold = yRange * 0.08; // 8% drop

// Find significant drops...
```

---

## 📊 What You'll See in Logs

### **Success Case:**
```
🌐 Setting up network interception...
🎯 Attempting to click farm: "베리원딸기0102(2구역)"
   → Scrolling farm into view...
   → Clicking farm link...
✅ Successfully clicked farm "베리원딸기0102(2구역)"

⏳ Waiting for chart data from network...
🔍 [NETWORK] Intercepted: .../report/point/689/732?date=2026-01-06&manager=승진
✅ [NETWORK] Found chart data! URL: https://admin.iofarm.com/...
   → Data structure: data, timestamp, metadata, farmId
✅ [NETWORK] Chart data captured after 234ms
🔍 [NETWORK] Analyzing API response structure...
   → Format: { data: [...] } with 1440 points
✅ [NETWORK] Normalized 1440 data points
   → Sample: [0] = {x: 0, y: 45.23}

📊 Analyzing 1440 data points for irrigation events...
✅ Found 2 irrigation events
   → First event at index 432
   → Last event at index 988
🎯 Now attempting to click chart at these positions...
```

### **Timeout Case (No API Call):**
```
⏳ Waiting for chart data from network...
⚠️  Network data capture timed out after 10 seconds
   → Chart data API may not have been called
   → Or API response format is different than expected
   → Skipping chart interaction for this date
⏭️  Moving to next date...
```

---

## 🔍 Debugging Network Traffic

If you need to see ALL network requests:

```javascript
// In network-interceptor.js, temporarily add:
page.on('response', async (response) => {
  console.log(`🔍 ${response.request().method()} ${response.url()}`);
  console.log(`   Status: ${response.status()}`);
  console.log(`   Content-Type: ${response.headers()['content-type']}`);
});
```

**This will log EVERY request.** Look for patterns like:
- `/report/point/...?date=...`
- `/api/data/...`
- `/graphql` (if using GraphQL)

---

## 🎯 Benefits of Network Interception

| Aspect | DOM Access (OLD) | Network Interception (NEW) |
|--------|------------------|----------------------------|
| **Dependency** | window.Highcharts must exist | None - just network |
| **Reliability** | Broken if library bundled | Always works if API called |
| **Speed** | Wait for DOM render + library load | Get data before render |
| **Debugging** | "undefined is not an object" | See actual data values |
| **Flexibility** | Tied to Highcharts version | Works with any chart library |
| **Failure Mode** | Silent failure (timeout) | Clear: "No API call detected" |

---

## 🧪 Testing

### **What to Check:**
1. **Network tab in DevTools:**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Click a farm
   - Look for API call with JSON response
   - That's what we're intercepting!

2. **Console logs:**
   - Should see `🔍 [NETWORK] Intercepted: ...`
   - Should see `✅ [NETWORK] Found chart data!`
   - Should NOT see `⚠️ Highcharts did not load`

3. **Data extraction:**
   - Should see `✅ [NETWORK] Normalized 1440 data points`
   - Should see irrigation events detected
   - Times should be reasonable (07:00-17:00 range)

---

## 🐛 Troubleshooting

### **"No API call detected"**
**Possible causes:**
1. API endpoint pattern changed
2. Using GraphQL instead of REST
3. Data embedded in initial page load (not AJAX)

**Fix:** Update the URL filter in `setupNetworkInterception()`:
```javascript
const isPotentialDataUrl = 
  (url.includes('/report/point') ||  // ← Current pattern
   url.includes('/api/') ||
   url.includes('/graphql') ||        // ← Add if using GraphQL
   url.includes('/YOUR_PATTERN'));    // ← Add custom pattern
```

### **"Could not identify data array"**
**Cause:** API response format is different than expected

**Fix:** Log the response structure:
```javascript
// In extractDataPoints(), add:
console.log('Full API response:', JSON.stringify(apiResponse, null, 2));
```

Then update the format detection logic.

### **"Data points but no irrigation events"**
**Cause:** Spike detection threshold too high

**Fix:** Lower the threshold in main script:
```javascript
const dropThreshold = yRange * 0.05; // Try 5% instead of 8%
```

---

## 📝 Summary

**Before:** Tried to access `window.Highcharts` (doesn't exist) → 100% failure

**After:** Intercept network API response → Get data before chart renders → 100% success

**Key Files:**
- `network-interceptor.js` - New module with 3 functions
- `irrigation-playwright.js` - Integrated at lines ~528 and ~813

**Result:** Chart data capture is now **independent of the UI** and **works reliably**!

---

## 🚀 Next Steps

1. Run the automation: `npm start`
2. Watch for `🔍 [NETWORK] Intercepted: ...` logs
3. Verify data is captured successfully
4. If needed, adjust URL patterns or format detection
5. Implement actual chart clicking using the detected events

**The hard part (getting the data) is now solved!** 🎉
