# 🔍 How to Verify Learning is Working

## Quick Answer

**3 Ways to Verify:**
1. Check `training/training-data.json` file
2. Watch the Dashboard "Learning Progress" section
3. Compare accuracy before/after training

---

## Method 1: Check Training Data File

### Location
```
training/training-data.json
```

### What to Look For

If learning is working, this file will contain entries like:

```json
[
  {
    "timestamp": "2026-01-03T12:34:56.789Z",
    "date": "2026년 01월 03일",
    "farm": "Farm A",
    "algorithmDetection": {
      "first": { "svgX": 280, "svgY": 195 },
      "last": { "svgX": 1200, "svgY": 820 }
    },
    "userCorrections": {
      "first": { "svgX": 285, "svgY": 200 },
      "last": { "svgX": 1195, "svgY": 815 }
    },
    "feedback": "User made 2 corrections"
  }
]
```

### How to Check

**Terminal:**
```bash
cd /Users/test/Coding/IrrigationPointingAutomationVib
cat training/training-data.json
```

**Or open in VS Code:**
```
training/training-data.json
```

### What Each Field Means

| Field | Meaning |
|-------|---------|
| `timestamp` | When the training happened |
| `farm` | Which farm was being trained |
| `algorithmDetection` | Where the AI thought the points were |
| `userCorrections` | Where YOU clicked (the correct answer) |
| `feedback` | What happened (accepted or corrected) |

### Signs Learning is Working ✅

1. **File exists** → Learning mode has been run
2. **Multiple entries** → Multiple training sessions
3. **`userCorrections` is NOT null** → You made corrections
4. **Different coordinates** → Algorithm learned the offset

### Example Analysis

```json
{
  "algorithmDetection": { "first": { "svgX": 280, "svgY": 195 } },
  "userCorrections": { "first": { "svgX": 285, "svgY": 200 } }
}
```

**Analysis:**
- Algorithm was **5 pixels to the left** (280 vs 285)
- Algorithm was **5 pixels above** (195 vs 200)
- **Offset learned**: +5px X, +5px Y

---

## Method 2: Dashboard Learning Progress

### Location
Open dashboard: `http://localhost:3456`

Look for the **"🎓 Learning Progress"** section.

### What to Monitor

#### **Training Sessions**
```
Training Sessions: 12
Manual corrections applied
```
- **0** = No training yet
- **1-4** = Early learning
- **5-19** = Improving
- **20+** = Well trained

#### **First Point Accuracy**
```
First Point Accuracy: ±8.2px
Avg offset: (+5.3, +3.1)
```
- Shows average error in pixels
- Lower is better!
- Offset shows direction (positive = right/down)

#### **Last Point Accuracy**
```
Last Point Accuracy: ±6.5px
Avg offset: (-4.2, +2.8)
```
- Same as first point
- Should decrease with training

#### **Learning Status**
```
Status: 🌳
Improving
```

| Icon | Status | Sessions | Meaning |
|------|--------|----------|---------|
| 🌱 | Ready to learn | 0 | No training |
| 🌿 | Early learning | 1-4 | Just started |
| 🌳 | Improving | 5-19 | Getting better |
| 🏆 | Well trained | 20+ | Highly accurate |

### Auto-Refresh
The dashboard updates **every 10 seconds** automatically.

---

## Method 3: Compare Before/After Accuracy

### Step 1: Run Without Learning

**Normal Mode:**
1. Start automation in Normal Mode
2. Check extracted times in `data/all-farms-data-*.json`
3. Manually verify 5-10 farms by looking at charts
4. Count how many are **incorrect**

**Example:**
```
10 farms checked:
- 4 correct ✅
- 6 wrong ❌
Accuracy: 40%
```

### Step 2: Train in Learning Mode

**Learning Mode:**
1. Start automation in Learning Mode
2. Correct 10-20 farms
3. Check `training/training-data.json` has entries

### Step 3: Run Again in Normal Mode

**Normal Mode (After Training):**
1. Start automation in Normal Mode
2. Check same farms
3. Count how many are **correct** now

**Example:**
```
10 farms checked:
- 9 correct ✅
- 1 wrong ❌
Accuracy: 90%
```

### Success Indicator
```
Before Training:  40% accuracy
After Training:   90% accuracy
Improvement:      +50% ✅
```

---

## Detailed Verification Steps

### 1. Check File Exists
```bash
ls -lh training/training-data.json
```

**Expected output:**
```
-rw-r--r-- 1 user staff 15K Jan  3 12:34 training-data.json
```

If file doesn't exist → Learning mode not run yet

### 2. Count Training Sessions
```bash
cat training/training-data.json | grep timestamp | wc -l
```

**Expected output:**
```
12
```

Shows number of training sessions

### 3. Count Corrections
```bash
cat training/training-data.json | grep userCorrections | grep -v null | wc -l
```

**Expected output:**
```
8
```

Shows how many times you actually corrected the algorithm

### 4. Check Average Offsets

Open `training/training-data.json` and calculate manually:

```javascript
// For first point:
Session 1: Algorithm(280, 195) → User(285, 200) → Offset(+5, +5)
Session 2: Algorithm(300, 210) → User(308, 215) → Offset(+8, +5)
Session 3: Algorithm(290, 205) → User(295, 210) → Offset(+5, +5)

Average Offset: (+6, +5)
```

This offset will be **automatically applied** in Normal Mode!

---

## Real-World Example

### Before Training
```json
// data/all-farms-data-2026-01-03T10-00-00.json
{
  "farms": [
    {
      "farmName": "Farm A",
      "dates": [
        {
          "date": "2026-01-03",
          "firstIrrigationTime": "10:30 AM",  ← Wrong!
          "lastIrrigationTime": "10:50 AM"    ← Wrong!
        }
      ]
    }
  ]
}
```

Manual check: Actually 10:35 AM and 10:55 AM

### After 10 Training Sessions
```json
// training/training-data.json shows:
"Average offset: First(+5px, +3px), Last(-5px, +2px)"
```

### After Training
```json
// data/all-farms-data-2026-01-03T12-00-00.json
{
  "farms": [
    {
      "farmName": "Farm A",
      "dates": [
        {
          "date": "2026-01-03",
          "firstIrrigationTime": "10:35 AM",  ← Correct! ✅
          "lastIrrigationTime": "10:55 AM"    ← Correct! ✅
        }
      ]
    }
  ]
}
```

---

## Troubleshooting

### "training-data.json doesn't exist"
**Problem:** Learning mode never run  
**Solution:** 
1. Start automation
2. Select "Learning Mode (Train)" in dashboard
3. Process at least 1 farm

### "File exists but empty array []"
**Problem:** Learning mode run but no corrections made  
**Solution:**
- You accepted all algorithm detections (didn't click)
- This is OK if algorithm was correct!
- Try correcting at least 1 farm to see the system working

### "userCorrections is always null"
**Problem:** You're waiting 30 seconds but not clicking  
**Solution:**
- If algorithm is **wrong**, click the correct spots
- Yellow circle = first click
- Orange circle = second click

### "Dashboard shows 0 sessions"
**Problem:** File not being read correctly  
**Solution:**
1. Refresh dashboard (F5)
2. Check file permissions:
   ```bash
   chmod 644 training/training-data.json
   ```

### "Accuracy not improving"
**Possible reasons:**
1. Not enough training (need 10-20 sessions minimum)
2. Inconsistent corrections (click different spots each time)
3. Different farm types (offset varies by farm)

**Solution:** Train on same farm type, be consistent

---

## Console Output to Watch

When learning is working, you'll see:

### At Startup (Normal Mode)
```
🎓 Loaded learning data from 12 training sessions
   → Applying corrections: First(+5.3, +3.1), Last(-4.2, +2.8)
```

### During Learning Mode
```
🎓 CHART LEARNING MODE ACTIVE
🟢 🔴 LOOK AT THE BROWSER WINDOW! 🔴 🟢
⏱️  Waiting 30 seconds for corrections...
✅ [BROWSER] Recorded user click #1: (285, 200)
✅ [BROWSER] Recorded user click #2: (1195, 815)
```

### After Training Session
```
✅ Saved training entry to: training/training-data.json
   → Algorithm detected: (280, 195) and (1200, 820)
   → User corrected: (285, 200) and (1195, 815)
```

---

## Summary Checklist

To verify learning is working:

- [ ] `training/training-data.json` exists
- [ ] File has multiple entries (not empty array)
- [ ] Some entries have `userCorrections` (not all null)
- [ ] Dashboard shows training sessions > 0
- [ ] Dashboard shows accuracy values (not ±0px)
- [ ] Dashboard status upgraded (🌱→🌿→🌳→🏆)
- [ ] Console shows "Loaded learning data from X sessions" at startup
- [ ] Console shows "Applying corrections: First(...), Last(...)"
- [ ] Extracted data is more accurate than before training

---

## Expected Learning Curve

| Sessions | Accuracy | Status | Next Step |
|----------|----------|--------|-----------|
| 0 | ~40% | 🌱 | Start training |
| 1-4 | ~50-60% | 🌿 | Keep training |
| 5-10 | ~70-80% | 🌳 | Almost there |
| 10-20 | ~85-95% | 🌳 | Fine-tuning |
| 20+ | ~95%+ | 🏆 | Use Normal Mode |

---

## Questions?

If after following all steps above, you still don't see learning working:
1. Check all files/folders have correct permissions
2. Run `npm start` from project root directory
3. Ensure you're clicking during Learning Mode (not just waiting)
4. Verify browser window is visible (markers won't show if minimized)


