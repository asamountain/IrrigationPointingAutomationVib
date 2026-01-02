# Quick Reference Guide

**TL;DR:** How to use Playwright Codegen + Chart Learning Mode

---

## 🎯 The Problem You Identified

**Playwright Codegen CAN'T record clicks on chart SVG paths** ❌
```xml
<!-- This is NOT a clickable element to Codegen -->
<g class="highcharts-plot-bands-0">
  <path d="M 120,250 L 180,260..." />
</g>
```

**But our algorithm CAN detect and click these points** ✅
- Parses SVG path coordinates
- Detects irrigation events
- Clicks using `page.mouse.click(x, y)`

---

## ✅ The Solution: Hybrid Approach

### **Use Codegen for UI** 
Buttons, forms, navigation - standard elements

### **Use Algorithm for Charts**
SVG paths, coordinate-based clicks

---

## 🚀 Usage

### **1. Normal Production Run**
```powershell
npm start
```
→ Fully automatic, uses algorithm for everything

---

### **2. Learn UI Navigation (Codegen)**
```powershell
npx playwright codegen https://admin.iofarm.com
```

**What to do:**
- Login manually
- Click buttons (Previous/Next period)
- Select farms from list
- **STOP before clicking chart**

**Copy the generated code** (useful for improving UI navigation)

**Example output:**
```javascript
await page.click('button[aria-label="이전 기간"]');
await page.click('label:has-text("승진")');
// ... etc
```

---

### **3. Train Chart Detection (Learning Mode)**
```powershell
$env:CHART_LEARNING="true"
npm start
```

**What happens:**
1. Script runs normally
2. At each chart, it shows:
   - 🟢 **Green circle** = Algorithm's FIRST point
   - 🔴 **Red circle** = Algorithm's LAST point
3. Browser **pauses** (DevTools opens)
4. You have 2 options:
   - ✅ **Correct**: Just press **F8** to continue
   - ❌ **Wrong**: Click the correct points, THEN press **F8**
5. Script records your corrections
6. Saves to `training/training-data.json`

**Visual Example:**
```
Chart:
  🟢 ← Algorithm thinks this is FIRST
  🔴 ← Algorithm thinks this is LAST

If wrong:
  1. Click where FIRST should actually be
  2. Click where LAST should actually be
  3. Press F8
  
Your clicks appear as:
  🟢 (lime) = Your FIRST correction
  🟠 (orange) = Your LAST correction
```

---

### **4. Analyze Training Data**
```powershell
npm run analyze
```

**What it does:**
- Reads all training sessions
- Calculates average offsets
- Shows accuracy percentage
- **Suggests code adjustments**

**Example output:**
```
📊 Analyzing Training Data...

📁 Found 10 training sessions

✅ Accepted (no corrections): 7
📝 Corrected: 3

═══════════════════════════════════════
📈 ANALYSIS RESULTS
═══════════════════════════════════════

🟢 FIRST Point Corrections:
   Average X offset: +8.3px
   Average Y offset: -2.1px
   Based on 3 corrections

   ⚠️ Significant systematic bias detected!
   💡 Recommendation: Adjust algorithm

🔴 LAST Point Corrections:
   Average X offset: +5.7px
   Average Y offset: -1.8px
   Based on 3 corrections

📊 Overall Accuracy:
   70.0% of detections accepted without corrections

═══════════════════════════════════════
🔧 SUGGESTED CODE ADJUSTMENTS
═══════════════════════════════════════

For FIRST point detection, add this adjustment:
```javascript
// In irrigation-playwright.js, after detecting firstPoint:
firstPoint.x += 8.3; // User correction offset
firstPoint.y += -2.1; // User correction offset
```
```

---

## 📊 Workflow

```
┌─────────────────────────────────────────┐
│ 1. Normal Run (npm start)              │
│    → Too many errors? Go to step 2     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 2. Learning Mode                        │
│    $env:CHART_LEARNING="true"; npm start│
│    → Correct 10-20 charts manually      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 3. Analyze (npm run analyze)           │
│    → Get offset suggestions             │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 4. Apply Corrections (edit script)     │
│    → Add offset adjustments to code     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 5. Test (npm start)                    │
│    → Improved accuracy!                 │
└─────────────────────────────────────────┘
```

---

## 📁 File Structure

```
IrrigationReportAutomation/
├── irrigation-playwright.js   # Main script (with learning mode)
├── analyze-training.js         # Training data analyzer
├── ALGORITHM.md                # Algorithm documentation with Mermaid diagrams
├── HYBRID-LEARNING.md          # Full hybrid approach documentation
├── LEARN-FROM-USER.md          # Learning methods guide
├── QUICK-REFERENCE.md          # This file (quick guide)
└── training/
    └── training-data.json      # Recorded corrections
```

---

## 🎯 Key Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Normal run |
| `npx playwright codegen URL` | Learn UI navigation |
| `$env:CHART_LEARNING="true"; npm start` | Train chart detection |
| `npm run analyze` | Analyze training data |

---

## 💡 Pro Tips

1. **Codegen is for UI, not charts**
   - Use it to learn button selectors
   - Don't expect it to record chart clicks

2. **Train on 10-20 charts**
   - More data = better analysis
   - Different farms = better generalization

3. **Look for systematic bias**
   - If algorithm is consistently off by X pixels
   - That means we can auto-correct it!

4. **Preserve what works**
   - Current chart-click system works ✅
   - Just needs fine-tuning with user corrections

---

## 🚀 Getting Started

**First time? Start here:**

1. Read `ALGORITHM.md` to understand how detection works
2. Run `npm start` to see current accuracy
3. If needed, run learning mode on a few farms
4. Analyze and improve

**Already familiar? Jump to:**

- `HYBRID-LEARNING.md` for full documentation
- `LEARN-FROM-USER.md` for all learning methods

---

**The hybrid approach gives you the best of both worlds!** 🎉

