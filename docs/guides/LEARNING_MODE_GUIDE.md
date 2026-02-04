# 🎓 Learning Mode User Guide

## What is Learning Mode?

Learning Mode allows you to train the AI algorithm by showing it the **correct** irrigation points when it makes mistakes. The more you correct it, the more accurate it becomes!

---

## How to Start Learning Mode

### 1. Run the automation:
```bash
npm start
```

### 2. Open Dashboard:
```
http://localhost:3456
```

### 3. Configure Settings:
- **Manager**: Select your manager
- **Start From**: Choose which farm to start from
- **Mode**: Select **"Learning Mode (Train)"** ← IMPORTANT!
- **Max Farms**: Choose how many farms to train on

### 4. Click **"🚀 Start Automation"**

---

## What Happens During Learning Mode

### When the chart appears, you'll see:

```
┌─────────────────────────────────────────────────────────────┐
│  🎓 LEARNING MODE ACTIVE 🎓                                │
│  🟢 Green circle = Algorithm's FIRST point                  │
│  🔴 Red circle = Algorithm's LAST point                     │
│  ✅ Correct? Just wait 30 seconds                          │
│  ❌ Wrong? Click correct spots (Yellow then Orange)        │
└─────────────────────────────────────────────────────────────┘

                                                    ┌────────┐
                                                    │   30   │ ← Countdown
                                                    └────────┘

        ↓ FIRST START ↓
        ( 🟢 )  ← Algorithm thinks THIS is the start
        
        
                                    ↓ LAST END ↓
                                    ( 🔴 )  ← Algorithm thinks THIS is the end
```

---

## What You Should Do

### ✅ If the circles are CORRECT:
**→ Do nothing! Just wait 30 seconds**
- The countdown timer will reach 0
- System records: "User accepted algorithm detection"
- No corrections needed
- Algorithm confidence increases

### ❌ If the circles are WRONG:
**→ Click the CORRECT spots before timer ends:**

1. **First Click** (Yellow marker): Click where irrigation **actually starts** (HSSP)
2. **Second Click** (Orange marker): Click where irrigation **actually ends** (last peak)

```
Your corrections will appear as:
( 🟡 ) ← Your FIRST click (Yellow)
( 🟠 ) ← Your LAST click (Orange)
```

---

## What Gets Saved

After each farm, the system saves:

```json
{
  "timestamp": "2026-01-03T...",
  "farm": "Farm Name",
  "algorithmDetection": {
    "first": { "svgX": 285, "svgY": 195 },
    "last": { "svgX": 1240, "svgY": 820 }
  },
  "userCorrections": {
    "first": { "svgX": 290, "svgY": 200 },  ← Your corrections
    "last": { "svgX": 1235, "svgY": 815 }
  }
}
```

Saved to: `training/training-data.json`

---

## How Learning Works

### The Algorithm Learns from Your Corrections:

1. **Detects Pattern**: Calculates average offset between:
   - Algorithm's guess
   - Your correct clicks

2. **Applies Learning**: In Normal Mode, automatically adjusts:
   ```
   Corrected Point = Algorithm Point + Average Offset
   ```

3. **Improves Over Time**:
   - **0 sessions** (🌱): No learning yet
   - **1-4 sessions** (🌿): Early learning phase
   - **5-19 sessions** (🌳): Getting better!
   - **20+ sessions** (🏆): Well trained & accurate!

---

## Example Training Session

### Farm #1:
```
Algorithm shows:  🟢 (x=280, y=190)  🔴 (x=1200, y=800)
You click:        🟡 (x=285, y=195)  🟠 (x=1195, y=805)
Offset learned:   +5px, +5px         -5px, +5px
```

### Farm #2:
```
Algorithm shows:  🟢 (x=300, y=210)  🔴 (x=1300, y=850)
You click:        🟡 (x=308, y=215)  🟠 (x=1292, y=855)
Offset learned:   +8px, +5px         -8px, +5px
```

### After 2 sessions:
```
Average offset:
  First: +6.5px, +5px
  Last:  -6.5px, +5px
```

**Dashboard shows**: ±8.2px accuracy for first point!

---

## Tips for Best Results

### ✅ DO:
- Train on **multiple farms** (at least 10-20 sessions)
- Train on **different dates** to see variety
- Be **consistent** with your clicks
- Click **exactly** where irrigation starts/ends
- Accept correct detections (don't click if algorithm is right!)

### ❌ DON'T:
- Rush through - take your time
- Click randomly if unsure
- Train on only one farm
- Skip corrections when algorithm is clearly wrong

---

## After Training

### Switch to Normal Mode:

1. Open dashboard
2. Select **"Normal (Extract Data)"** mode
3. Start automation

Now the system will **automatically apply** your learned corrections!

Check **Learning Progress** section in dashboard to see:
- Total training sessions
- Average accuracy
- Learning status (🌱→🌿→🌳→🏆)

---

## Troubleshooting

### "I don't see the markers!"
- Make sure browser window is visible
- Check if Learning Mode is selected in dashboard
- Look for purple banner at top of page

### "Timer runs out before I can click"
- It's okay! System will accept algorithm's guess
- Next farm you'll be faster
- 30 seconds is plenty of time

### "I clicked wrong spots by accident"
- No problem! Continue training on next farms
- Algorithm uses average, so one mistake won't hurt

### "Learning Progress shows 0 sessions"
- Check `training/training-data.json` exists
- Make sure you clicked during at least one session
- Refresh dashboard after training

---

## Files Created

```
training/
  └── training-data.json          ← All training sessions

screenshots/
  └── learning-before-*.png       ← Before-correction screenshots
  └── learning-after-*.png        ← After-correction screenshots (with markers)
```

---

## Summary

**Learning Mode = Teaching the AI**

1. System shows where it **thinks** irrigation starts/ends (🟢🔴)
2. You show where irrigation **actually** starts/ends (🟡🟠)
3. System learns from the difference
4. After enough training, system becomes accurate!

**Goal**: Train until dashboard shows 🏆 "Well trained" status!

---

## Questions?

Check the dashboard **Learning Progress** section to monitor improvement in real-time!


