# Debug Guide - Visual Overlay Not Appearing

## Debug Logs Added

I've added comprehensive debug logging to trace the code execution path. Here's what to look for when you run the automation:

## Expected Debug Output (When Working Correctly)

```
📊 Analyzing 1440 data points for irrigation events...
🔍 DEBUG: Starting irrigation detection algorithm...
   → Y range: 45.23 to 67.89 (span: 22.66)
   → Surge window: 5 minutes
   → Surge threshold: 0.0340 (sustained rise detection)
   → Lookback window: 20 minutes (valley search)
✅ Found 2 irrigation events
   → First event at index 245
   → Last event at index 678
🎯 Now attempting to click chart at these positions...

🔍 DEBUG: Checking visual confirmation mode...
   → CONFIG.visualConfirmationMode = true
✅ DEBUG: Visual confirmation mode is ENABLED
🔍 DEBUG: Calculating screen coords for indices 245 and 678...
🔍 DEBUG: Screen coords result: { first: {...}, last: {...} }
✅ DEBUG: Screen coordinates successfully calculated
👁️ DEBUG: About to show overlay with data: {...}

👁️ VISUAL CONFIRMATION MODE
══════════════════════════════════════════════════════════════════
🔴 RED circle = FIRST click (last flat point BEFORE rise)
🔵 BLUE circle = LAST click (PEAK of curve)
══════════════════════════════════════════════════════════════════

📍 FIRST click planned at: 08:30
📍 LAST click planned at: 15:45

⏳ Waiting for user confirmation...
   → Press ENTER in browser to confirm
   → Press ESC in browser to skip

[OVERLAY APPEARS IN BROWSER]
[YOU PRESS ENTER OR ESC]

🔍 DEBUG: User confirmation result: true (or false)
✅ User confirmed, proceeding with clicks...
```

## Diagnostic Scenarios

### Scenario 1: No Irrigation Detected
If you see:
```
✅ Found 0 irrigation events
   → No irrigation detected for this date
```

**Cause**: Algorithm didn't detect any irrigation events  
**Solution**: This is normal if there's no irrigation that day. The overlay won't appear.

### Scenario 2: Visual Confirmation Mode Disabled
If you see:
```
🔍 DEBUG: Checking visual confirmation mode...
   → CONFIG.visualConfirmationMode = false
⏭️ DEBUG: Visual confirmation mode is DISABLED, skipping overlay
```

**Cause**: Feature is turned off in CONFIG  
**Solution**: Set `visualConfirmationMode: true` in line 29 of `irrigation-playwright.js`

### Scenario 3: Screen Coordinates Failed
If you see:
```
✅ DEBUG: Visual confirmation mode is ENABLED
🔍 DEBUG: Calculating screen coords...
🔍 DEBUG: Screen coords result: null
⚠️ DEBUG: Could not calculate screen coordinates for overlay
   → screenCoords: null
```

**Cause**: Highcharts API not accessible or chart not rendered  
**Solution**: 
- Ensure browser is visible (not headless)
- Check if chart is fully loaded before detection
- Verify Highcharts is available in browser

### Scenario 4: Code Never Reaches Detection
If you DON'T see:
```
📊 Analyzing X data points...
🔍 DEBUG: Starting irrigation detection algorithm...
```

**Cause**: Code exits before reaching the detection section  
**Possible reasons**:
- Network data not captured
- Data points insufficient (< 10 points)
- Browser crashed or closed
- Timeout error before analysis

**Solution**: Check earlier logs for errors like:
- "⚠️ Network data capture timed out"
- "⚠️ Insufficient data points"
- "Target page, context or browser has been closed"

### Scenario 5: Overlay Injection Fails
If you see the debug logs but overlay doesn't appear visually:
```
👁️ DEBUG: About to show overlay with data: {...}
[No visual overlay appears]
```

**Cause**: Browser-side JavaScript error  
**Solution**:
- Open browser DevTools (F12) and check Console tab
- Look for JavaScript errors in red
- Verify chart container exists on page

## How to Debug

### Step 1: Run Automation with Debug Logs
```bash
npm start
```

### Step 2: Watch Terminal Output
Look for the debug log lines marked with 🔍 DEBUG

### Step 3: Check Browser Console
1. When browser opens, press **F12**
2. Go to **Console** tab
3. Look for errors in red

### Step 4: Identify Which Scenario Matches
Compare your terminal output to the scenarios above

### Step 5: Apply the Solution
Follow the solution for your specific scenario

## Quick Fixes

### Fix 1: Enable Visual Confirmation
Edit line 29 in `irrigation-playwright.js`:
```javascript
visualConfirmationMode: true  // Make sure this is true
```

### Fix 2: Verify Browser is Visible
Check that headless mode is OFF (should be false):
```javascript
const browser = await chromium.launch({
  headless: false  // Must be false to see overlay
});
```

### Fix 3: Ensure Chart is Loaded
The code already waits for chart render, but you can increase the timeout:
```javascript
await page.waitForTimeout(1000); // Increase from 500 to 1000
```

### Fix 4: Check Network Data
If network data isn't being captured, check:
- Is the farm page actually loading?
- Is the chart API being called?
- Are there network errors?

## Testing After Fixes

1. Save your changes
2. Run: `npm start`
3. Watch for the debug logs
4. Verify overlay appears in browser
5. Test ENTER and ESC keys

## Still Not Working?

If you've tried everything and the overlay still doesn't appear:

1. **Test in isolation**: Run `node test-visual-confirmation.js` to verify the overlay code works
2. **Check file changes**: Make sure all edits were saved
3. **Restart terminal**: Close and reopen terminal, then run again
4. **Check browser version**: Ensure Playwright browser is up to date: `npx playwright install chromium`

## Next Steps

Once you identify which scenario matches your situation from the debug logs, we can:
1. Fix the specific issue preventing the overlay
2. Verify the fix works
3. Remove debug logs (or keep them for troubleshooting)

---

**Run the automation now** and share which debug logs you see (or don't see) in the terminal output!
