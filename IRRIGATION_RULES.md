# Irrigation Click Point Rules - PERMANENT REFERENCE

## Overview
This document defines the **EXACT** rules for identifying irrigation click points on the water sensor chart.
These rules are FIXED and must NOT be changed.

---

## FIRST Click (Start of Irrigation)

```
                    ╭────╮
                   ╱      ╲
                  ╱        ──────
    ────────────●╱
                ↑
         FIRST CLICK HERE
```

### Rule:
**The very last "flat" point BEFORE the curve starts rising**

### Constraints:
- Must be **AFTER 07:00** (the "yellow zone" on the chart)
- Look for the valley/baseline before any sustained rise
- This is NOT the point where the rise begins - it's the last stable point before it

### Algorithm:
1. Find a sustained rise (multiple consecutive increasing points)
2. Trace back to find where the rise started
3. The FIRST click is the point just BEFORE the rise begins (the valley)

---

## LAST Click (End of Irrigation)

```
         LAST CLICK HERE
                ↓
                ╭●───╮
               ╱      ╲
              ╱        ──────
    ─────────╱
```

### Rule:
**The PEAK - highest point of the curve**

### Special Case:
- If the peak is too sharp/sudden (spike), click **3 seconds AFTER** the peak
- This accounts for sensor lag and ensures we capture the full irrigation event

### Algorithm:
1. After finding the sustained rise, continue scanning for the peak
2. The peak is where values stop increasing and start decreasing
3. If peak duration < 3 seconds, offset the LAST click by 3 seconds

---

## Date Processing Direction

```
    T-5 → T-4 → T-3 → T-2 → T-1 → T-0
    ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
         ONLY THIS DIRECTION
         (Oldest to Newest)
```

### Rule:
**ALWAYS process from T-5 (oldest) to T-0 (today)**

### Why:
- The UI navigation buttons work this way
- Click "이전 기간" 5 times to reach T-5
- Then click "다음 기간" after each date is processed

### NEVER:
- Process T-0 → T-5 (newest to oldest)
- Skip dates in the sequence

---

## Navigation Method

### DO:
```javascript
// Use button clicks for date navigation
await page.click('button[aria-label="이전 기간"]');  // Go to previous date
await page.click('button[aria-label="다음 기간"]');  // Go to next date
```

### DON'T:
```javascript
// URL date parameter does NOT work - page ignores it
url.searchParams.set('date', '2026-01-20');  // ❌ WILL BE IGNORED
```

---

## Visual Confirmation Mode

Before clicking, the automation SHOULD:
1. Draw colored circles on the chart at planned click positions
2. Display time labels for each point
3. Wait for user confirmation (Enter key) before executing
4. Show RED circle for FIRST click, BLUE circle for LAST click

---

## Summary Table

| Click | Definition | Constraint | Fallback |
|-------|------------|------------|----------|
| FIRST | Last flat point before rise | After 07:00 | Valley detection |
| LAST | Peak of the curve | - | +3 seconds if too sharp |

---

*This document was created on 2026-01-26 and should NOT be modified.*
