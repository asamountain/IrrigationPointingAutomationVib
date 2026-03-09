# 🎓 F8 Training Mode - Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    IRRIGATION AUTOMATION SCRIPT                          │
│                      WITH F8 TRAINING MODE                               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ START: Launch Script                                                     │
└─────────────────┬───────────────────────────────────────────────────────┘
                  │
                  ▼
         ╔════════════════════╗
         ║ Environment Check   ║
         ╚════════╤═══════════╝
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
   TRAINING=true      TRAINING not set
        │                   │
        │                   └──────────────┐
        │                                  │
        ▼                                  ▼
┌───────────────────┐              ┌──────────────────┐
│ Training Mode ON  │              │ Normal Mode      │
│ (F8 Control)      │              │ (Automatic)      │
└─────────┬─────────┘              └────────┬─────────┘
          │                                 │
          │        FARM LOOP STARTS         │
          └────────────┬────────────────────┘
                       │
                       ▼
        ╔══════════════════════════════╗
        ║  Navigate to Farm & Date     ║
        ╚═════════════╤════════════════╝
                      │
                      ▼
        ╔══════════════════════════════╗
        ║  Algorithm Analyzes Chart    ║
        ║  - Detect irrigation events  ║
        ║  - Find START valley (first) ║
        ║  - Find END peak (last)      ║
        ╚═════════════╤════════════════╝
                      │
                      ▼
        ╔══════════════════════════════╗
        ║  Calculate Click Coordinates ║
        ║  - FIRST: (x1, y1)          ║
        ║  - LAST: (x2, y2)           ║
        ╚═════════════╤════════════════╝
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
   [TRAINING MODE?]          [NORMAL MODE]
         │                         │
         YES                       NO
         │                         │
         ▼                         └──────────┐
┌─────────────────────────────┐              │
│ 🎓 trainAlgorithm()         │              │
│                             │              │
│ ┌─────────────────────────┐ │              │
│ │ Inject Visual UI:       │ │              │
│ │ ┌─────────────────────┐ │ │              │
│ │ │ 🎓 LEARNING MODE    │ │ │              │
│ │ │ Press [F8] to Resume│ │ │              │
│ │ └─────────────────────┘ │ │              │
│ │                         │ │              │
│ │ 🟢 Predicted START      │ │              │
│ │                         │ │              │
│ │    [Chart Area]         │ │              │
│ │                         │ │              │
│ │ 🔴 Predicted END        │ │              │
│ └─────────────────────────┘ │              │
│                             │              │
│ PAUSE & WAIT FOR USER       │              │
│ - Click START (optional)    │              │
│ - Click END (optional)      │              │
│ - Press F8 to continue      │              │
└───────────┬─────────────────┘              │
            │                                │
            ▼                                │
    ┌───────────────┐                       │
    │ F8 Pressed?   │                       │
    │ (waitFor)     │                       │
    └───────┬───────┘                       │
            │                                │
            ▼                                │
    ┌───────────────────┐                   │
    │ Retrieve Clicks   │                   │
    │ - 0 clicks: OK    │                   │
    │ - 2 clicks: Apply │                   │
    └────────┬──────────┘                   │
             │                               │
             ▼                               │
    ┌──────────────────────┐                │
    │ Calculate Offsets    │                │
    │ offset = user - pred │                │
    └────────┬─────────────┘                │
             │                               │
             ▼                               │
    ┌──────────────────────┐                │
    │ Apply to Coordinates │                │
    │ x1 += offset.first.x │                │
    │ y1 += offset.first.y │                │
    │ x2 += offset.last.x  │                │
    │ y2 += offset.last.y  │                │
    └────────┬─────────────┘                │
             │                               │
             ▼                               │
    ┌──────────────────────┐                │
    │ Save Training Data   │                │
    │ training-data.json   │                │
    └────────┬─────────────┘                │
             │                               │
             └───────────┬───────────────────┘
                         │
                         ▼
        ╔════════════════════════════════╗
        ║  Perform Actual Clicks         ║
        ║  (with corrections if applied) ║
        ║  - Click FIRST at (x1, y1)     ║
        ║  - Click LAST at (x2, y2)      ║
        ╚═══════════════╤════════════════╝
                        │
                        ▼
        ╔════════════════════════════════╗
        ║  Verify Table Data Updated     ║
        ╚═══════════════╤════════════════╝
                        │
                        ▼
        ╔════════════════════════════════╗
        ║  Take Screenshot               ║
        ╚═══════════════╤════════════════╝
                        │
                        ▼
               ┌────────────────┐
               │ More Dates?    │
               └────┬───────┬───┘
                    │       │
                   YES      NO
                    │       │
                    │       ▼
                    │  ┌─────────────┐
                    │  │ More Farms? │
                    │  └───┬─────┬───┘
                    │      │     │
                    │     YES    NO
                    │      │     │
                    └──────┘     │
                                 ▼
                    ┌────────────────────┐
                    │ Generate Summary   │
                    │ - Farms processed  │
                    │ - Charts clicked   │
                    │ - Training saved   │
                    └──────────┬─────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │  END: Script Done  │
                    └────────────────────┘


═══════════════════════════════════════════════════════════════════════════

KEY DECISION POINTS:

1️⃣  TRAINING_MODE Environment Variable
   ├─ true → Enable F8 training pause
   └─ false/unset → Skip training, auto-click

2️⃣  F8 Key Press
   ├─ Pressed → Resume automation
   └─ (Waits indefinitely until pressed)

3️⃣  User Clicks
   ├─ 0 clicks → Use algorithm prediction as-is
   ├─ 1 click → Ignore (need 2 points)
   └─ 2+ clicks → Calculate offsets and apply corrections

═══════════════════════════════════════════════════════════════════════════

USER EXPERIENCE TIMELINE (Training Mode):

T+0s    Script starts, navigates to farm
T+5s    Chart loads, algorithm analyzes data
T+6s    Coordinates calculated
T+7s    🎓 BANNER APPEARS - Script PAUSES
        ↓
        User reviews predicted points...
        ↓
T+10s   User clicks START (yellow dot)
T+12s   User clicks END (red dot)
T+15s   User presses F8
        ↓
T+16s   Offsets calculated and applied
T+17s   Training data saved
T+18s   Actual clicks performed
T+20s   Script continues to next date/farm

═══════════════════════════════════════════════════════════════════════════

TRAINING DATA FLOW:

Algorithm           User             System
   │                 │                 │
   ├─ Predict ───────┤                 │
   │                 │                 │
   │                 ├─ Review ────────┤
   │                 │                 │
   │                 ├─ Click START ───┤
   │                 ├─ Click END ─────┤
   │                 ├─ Press F8 ──────┤
   │                 │                 │
   │                 │                 ├─ Calculate Offset
   │                 │                 ├─ Save to JSON
   │                 │                 ├─ Apply Correction
   │                 │                 │
   └─────────────────┴─────────────────┘
```

---

## Code Execution Path

### Normal Mode
```javascript
// 1. Analyze
const clickResults = analyzeChart();

// 2. Click (no pause)
await page.mouse.click(clickResults.firstCoords.x, clickResults.firstCoords.y);
await page.mouse.click(clickResults.lastCoords.x, clickResults.lastCoords.y);
```

### Training Mode
```javascript
// 1. Analyze
const clickResults = analyzeChart();

// 2. PAUSE for training
if (CONFIG.trainingMode) {
  const training = await trainAlgorithm(page, farm, date, 
    clickResults.firstCoords, clickResults.lastCoords);
  
  // 3. Apply corrections
  if (training.hasCorrections) {
    clickResults.firstCoords.x += training.offsets.first.x;
    clickResults.lastCoords.x += training.offsets.last.x;
  }
}

// 4. Click (with corrections)
await page.mouse.click(clickResults.firstCoords.x, clickResults.firstCoords.y);
await page.mouse.click(clickResults.lastCoords.x, clickResults.lastCoords.y);
```

---

## State Machine

```
┌──────────────┐
│   INITIAL    │
└──────┬───────┘
       │
       ▼
┌──────────────┐     TRAINING_MODE=true
│  ANALYZING   ├────────────────────────┐
└──────┬───────┘                        │
       │ TRAINING_MODE=false            │
       │                                ▼
       │                        ┌──────────────┐
       │                        │   PAUSED     │
       │                        │ (Waiting F8) │
       │                        └──────┬───────┘
       │                               │ F8 pressed
       │                               ▼
       │                        ┌──────────────┐
       │                        │  CORRECTING  │
       │                        └──────┬───────┘
       │                               │
       └───────────────┬───────────────┘
                       │
                       ▼
               ┌──────────────┐
               │   CLICKING   │
               └──────┬───────┘
                      │
                      ▼
               ┌──────────────┐
               │   COMPLETE   │
               └──────────────┘
```
