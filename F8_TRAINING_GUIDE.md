# 🎓 F8 Training Mode - Integration Guide

## Overview
This guide shows you how to integrate the F8-controlled training system into your irrigation-playwright.js script.

---

## Step 1: Add Import Statement

**Location**: Top of `irrigation-playwright.js` (around line 15)

**Add this line**:
```javascript
import { trainAlgorithm } from './trainAlgorithm.js';
```

**Full context**:
```javascript
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import DashboardServer from './dashboard-server.js';
import { setupNetworkInterception, waitForChartData, extractDataPoints } from './network-interceptor.js';
import { trainAlgorithm } from './trainAlgorithm.js';  // ← ADD THIS LINE
```

---

## Step 2: Add Environment Variable Check

**Location**: Around line 25 in CONFIG object

**Add this property**:
```javascript
const CONFIG = {
  url: 'https://admin.iofarm.com/report/',
  username: 'admin@admin.com',
  password: 'jojin1234!!',
  targetName: '승진',
  outputDir: './data',
  screenshotDir: './screenshots',
  chartLearningMode: false,
  watchMode: false,
  trainingMode: process.env.TRAINING_MODE === 'true'  // ← ADD THIS LINE
};
```

---

## Step 3: Integrate Training Call in Main Loop

**Location**: Around line 2658 - RIGHT AFTER clickResults are determined and BEFORE actual clicking

**Find this section**:
```javascript
        // Show separation info
        if (clickResults.separationPercent !== undefined) {
          console.log(`     ✅ First (START) and Last (END) separated by ${clickResults.separationPercent}% of chart`);
        }
        
        // CHART LEARNING MODE: Show detected points and allow user correction
        if (CONFIG.chartLearningMode && clickResults.firstCoords && clickResults.lastCoords) {
```

**REPLACE with**:
```javascript
        // Show separation info
        if (clickResults.separationPercent !== undefined) {
          console.log(`     ✅ First (START) and Last (END) separated by ${clickResults.separationPercent}% of chart`);
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // 🎓 F8 TRAINING MODE: Pause and allow manual point correction
        // ═══════════════════════════════════════════════════════════════════════
        if (CONFIG.trainingMode && clickResults.firstCoords && clickResults.lastCoords) {
          console.log(`\n     🎓 F8 TRAINING MODE ACTIVATED`);
          
          const trainingResult = await trainAlgorithm(
            page,
            farm.name,
            currentDateStr,
            clickResults.firstCoords,
            clickResults.lastCoords
          );
          
          // If user provided corrections, apply them
          if (trainingResult.hasCorrections && trainingResult.offsets) {
            console.log(`     🔧 Applying user corrections to coordinates...`);
            
            // Update first coordinates
            clickResults.firstCoords.x += trainingResult.offsets.first.x;
            clickResults.firstCoords.y += trainingResult.offsets.first.y;
            
            // Update last coordinates
            clickResults.lastCoords.x += trainingResult.offsets.last.x;
            clickResults.lastCoords.y += trainingResult.offsets.last.y;
            
            console.log(`     ✅ Coordinates adjusted with user feedback\n`);
          } else {
            console.log(`     ✅ Algorithm prediction accepted\n`);
          }
        }
        
        // CHART LEARNING MODE: Show detected points and allow user correction
        if (CONFIG.chartLearningMode && clickResults.firstCoords && clickResults.lastCoords) {
```

---

## Step 4: How to Use

### Start Training Mode:
```powershell
# Windows PowerShell
$env:TRAINING_MODE="true"; npm start
```

```bash
# Linux/Mac
TRAINING_MODE=true npm start
```

### Workflow:
1. Script navigates to farm and date automatically
2. Algorithm analyzes chart and predicts irrigation points
3. **Script PAUSES** - Banner appears at top:
   ```
   🎓 LEARNING MODE 🎓
   Click correct points: Start=Green, End=Red
   Press [F8] to Resume ⏩
   ```
4. You see:
   - 🟢 **Green dashed circle** = Algorithm's FIRST prediction (START)
   - 🔴 **Red dashed circle** = Algorithm's LAST prediction (END)
5. **If prediction is correct**: Just press **F8** (no clicks needed)
6. **If prediction is wrong**: 
   - Click the correct START point (yellow dot appears)
   - Click the correct END point (red dot appears)
   - Press **F8** to resume
7. Script saves your corrections to `training/training-data.json`
8. Script continues to next date/farm automatically

---

## Step 5: Verify Integration

After adding the code, verify with:

```powershell
# Test import
node -e "import('./trainAlgorithm.js').then(() => console.log('✅ Import OK'))"

# Check environment variable
$env:TRAINING_MODE="true"; node -e "console.log('TRAINING_MODE:', process.env.TRAINING_MODE)"
```

---

## Training Data Format

The system saves to `training/training-data.json`:

```json
[
  {
    "timestamp": "2026-01-19T10:30:00.000Z",
    "farm": "해비치농장",
    "date": "2026-01-18",
    "algorithmPrediction": {
      "first": { "x": 450, "y": 320, "svgX": 7.5, "svgY": 45.2 },
      "last": { "x": 1200, "y": 340, "svgX": 16.8, "svgY": 42.1 }
    },
    "userCorrections": {
      "first": { "x": 455, "y": 315 },
      "last": { "x": 1195, "y": 335 }
    },
    "offsets": {
      "first": { "x": 5, "y": -5 },
      "last": { "x": -5, "y": -5 }
    },
    "feedback": "User provided 2 clicks"
  }
]
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **F8** | Resume automation (completes training) |
| **Click** | Mark correct irrigation point |

---

## Troubleshooting

### Issue: F8 doesn't work
**Solution**: Make sure the browser window has focus (click somewhere on the page first)

### Issue: Clicks don't register
**Solution**: 
- Don't click on the banner (black bar at top)
- Click directly on the chart area
- Dots should appear immediately when you click

### Issue: Script doesn't pause
**Solution**: 
- Verify `TRAINING_MODE=true` is set: `echo $env:TRAINING_MODE`
- Check import statement is correct
- Look for error messages in console

### Issue: Training file not created
**Solution**: 
- Ensure `training/` directory exists: `mkdir training`
- Check file permissions
- Verify you clicked at least 2 points before pressing F8

---

## Advanced: Using with Learned Offsets

The training data you create can be used to automatically correct future predictions:

```javascript
// Load training data
const trainingData = JSON.parse(fs.readFileSync('./training/training-data.json'));

// Calculate average offsets
const avgOffsetFirst = {
  x: trainingData.reduce((sum, entry) => sum + entry.offsets.first.x, 0) / trainingData.length,
  y: trainingData.reduce((sum, entry) => sum + entry.offsets.first.y, 0) / trainingData.length
};

// Apply to predictions automatically
predictedFirst.x += avgOffsetFirst.x;
predictedFirst.y += avgOffsetFirst.y;
```

---

## Complete Code Snippet

Here's the complete integration in one place:

```javascript
// At top of file (line ~15)
import { trainAlgorithm } from './trainAlgorithm.js';

// In CONFIG object (line ~25)
const CONFIG = {
  // ... other properties ...
  trainingMode: process.env.TRAINING_MODE === 'true'
};

// In main loop, after clickResults determined (line ~2658)
if (CONFIG.trainingMode && clickResults.firstCoords && clickResults.lastCoords) {
  console.log(`\n     🎓 F8 TRAINING MODE ACTIVATED`);
  
  const trainingResult = await trainAlgorithm(
    page,
    farm.name,
    currentDateStr,
    clickResults.firstCoords,
    clickResults.lastCoords
  );
  
  if (trainingResult.hasCorrections && trainingResult.offsets) {
    clickResults.firstCoords.x += trainingResult.offsets.first.x;
    clickResults.firstCoords.y += trainingResult.offsets.first.y;
    clickResults.lastCoords.x += trainingResult.offsets.last.x;
    clickResults.lastCoords.y += trainingResult.offsets.last.y;
    console.log(`     ✅ Coordinates adjusted with user feedback\n`);
  }
}
```

---

## Success Indicators

When working correctly, you should see:

```
🎓 ════════════════════════════════════════
🎓   TRAINING MODE: F8 TO RESUME
🎓 ════════════════════════════════════════

   Farm: 해비치농장
   Date: 2026-01-18
   Predicted First (START): Screen(450, 320)
   Predicted Last (END): Screen(1200, 340)

   ⏸️  Automation PAUSED - Waiting for F8 key press...
   → Click the correct irrigation points on the chart
   → Press F8 when ready to continue

   ✅ F8 detected! Resuming automation...

   📝 Retrieved 2 user clicks
   📊 Offsets calculated:
      FIRST: X=5.0px, Y=-5.0px
      LAST: X=-5.0px, Y=-5.0px
   💾 Training data saved to: ./training/training-data.json
   📈 Total training entries: 1

🎓 ✅ Training complete. Resuming automation...
```

---

## Next Steps

1. Run the script in training mode for 10-20 farms
2. Review `training/training-data.json` to see patterns in offsets
3. Calculate average offsets and apply them automatically in normal mode
4. Gradually reduce reliance on training mode as algorithm improves

**Happy Training! 🎓**
