# DONT.md - Prohibited Patterns

## ❌ NEVER DO THESE THINGS

---

### 1. Never Process Dates in Reverse Order

```
❌ WRONG: T-0 → T-1 → T-2 → T-3 → T-4 → T-5
✅ RIGHT: T-5 → T-4 → T-3 → T-2 → T-1 → T-0
```

**Why:** The button-based navigation requires going backwards first, then forwards.

---

### 2. Never Use URL Date Parameter

```javascript
// ❌ WRONG - The page IGNORES this parameter
const url = `https://admin.iofarm.com/report/point/123/?date=2026-01-20`;

// ✅ RIGHT - Use button clicks
await page.click('button[aria-label="이전 기간"]');
await page.click('button[aria-label="다음 기간"]');
```

**Why:** The SPA ignores the `date` URL parameter. Only button clicks change the date.

---

### 3. Never Construct Duplicate URL Parameters

```javascript
// ❌ WRONG - Creates duplicate manager=
const url = currentFarm.href + '?manager=' + encodeURIComponent(name);
// Result: ?manager=승진?manager=%EC%8A%B9%EC%A7%84

// ✅ RIGHT - Use URL class
const url = new URL(currentFarm.href, baseUrl);
url.searchParams.set('manager', name);
```

**Why:** String concatenation doesn't handle existing query parameters.

---

### 4. Never Click Before 07:00

```
❌ WRONG: Clicking at 06:45 (in the yellow zone)
✅ RIGHT: Only click points AFTER 07:00
```

**Why:** The yellow zone before 07:00 contains system noise, not real irrigation.

---

### 5. Never Skip Visual Confirmation in Learning Mode

```javascript
// ❌ WRONG - Clicking without user review
await clickIrrigationPoint(x, y);

// ✅ RIGHT - Show overlay, wait for confirmation
await showClickOverlay(points);
await waitForUserConfirmation();
await clickIrrigationPoint(x, y);
```

**Why:** User must verify click positions before execution.

---

### 6. Never Navigate Without Waiting for Page Ready

```javascript
// ❌ WRONG - Fixed delay
await page.goto(url);
await page.waitForTimeout(2000);

// ✅ RIGHT - Wait for actual readiness
await page.goto(url);
await waitForPageReady(page);
await waitForChartData(page);
```

**Why:** Fixed delays cause "too fast" issues. Wait for actual page state.

---

### 7. Never Assume Chart Data is Loaded

```javascript
// ❌ WRONG - Assuming chart exists
const chart = await page.$('.chart');
const points = extractPoints(chart);

// ✅ RIGHT - Verify data is present
await page.waitForSelector('.chart svg path');
const hasData = await verifyChartHasData(page);
if (!hasData) throw new Error('No chart data');
```

**Why:** Chart container may exist but be empty.

---

### 8. Never Overwrite Checkpoint Without Backup

```javascript
// ❌ WRONG - Direct overwrite
fs.writeFileSync('checkpoint.json', newData);

// ✅ RIGHT - Backup first
const backup = `checkpoint_${Date.now()}.json`;
fs.copyFileSync('checkpoint.json', backup);
fs.writeFileSync('checkpoint.json', newData);
```

**Why:** Corrupted checkpoints lose all progress.

---

## Quick Reference

| Action | ❌ Don't | ✅ Do |
|--------|---------|------|
| Date order | T-0 → T-5 | T-5 → T-0 |
| Date navigation | URL param | Button clicks |
| URL construction | String concat | URL class |
| Click timing | Before 07:00 | After 07:00 |
| Page wait | Fixed delay | Event-based |

---

## PROTECTED CORE FUNCTIONALITY - DO NOT MODIFY

The following core functionality is **stable and working**. Do not change these sections unless absolutely necessary.

---

### 1. Farm List Looping Logic

**File:** `irrigation-playwright.js` - `main()` function

The farm iteration and switching logic works correctly. This includes:
- Reading farms from `farms.json`
- Iterating through each farm in order
- Navigating to each farm's page
- Checkpoint saving/restoration

---

### 2. Date Navigation (T-5 to T-0)

**File:** `irrigation-playwright.js`

The date navigation using button clicks (not URL parameters) works correctly:
- Goes backwards 5 days first
- Then forwards day by day
- Uses `button[aria-label="이전 기간"]` and `button[aria-label="다음 기간"]`

---

### 3. HSSP Irrigation Detection Algorithm

**File:** `src/chartAnalysis.js` - `detectIrrigationEvents()` function

The algorithm parameters are tuned and working (updated 2026-01-28):

| Parameter | Value | Purpose |
|-----------|-------|---------|
| SURGE_WINDOW | 10 | Compare with 10 minutes ago (more stable) |
| SURGE_THRESHOLD_PERCENT | 0.05 | 5% of Y range triggers detection |
| SURGE_THRESHOLD_MIN | 0.1 | Absolute minimum threshold |
| MIN_RISE_ABSOLUTE | 0.05 | Minimum absolute rise |
| LOOKBACK_WINDOW | 30 | Look back 30 minutes for valley |
| DEBOUNCE_MINUTES | 60 | Minimum 60 min between events |
| MIN_VALLEY_DEPTH | 0.03 | Valley must be this much lower |
| DAYTIME_START | 7 | Only 7AM onwards |
| DAYTIME_END | 17 | Only until 5PM |

---

### 4. Table Validation and Refresh

**File:** `irrigation-playwright.js`

Functions that work correctly:
- `checkForEmptyCells(page)` - Detects empty cells (excluding rightmost column)
- `clickTableRefresh(page)` - Clicks "표 새로고침" button
- `attemptTableRefresh(page, maxRetries)` - Retry logic (up to 3 times)

---

### 5. Report Generation and Sending

**File:** `irrigation-playwright.js`

Functions that work correctly:
- `sendReport()` - Sends irrigation report to server
- `recordNoIrrigationReport()` - Creates JSON when no irrigation detected

---

### Protected Functions Quick Reference

| Function | File | Status |
|----------|------|--------|
| `main()` | irrigation-playwright.js | PROTECTED |
| `detectIrrigationEvents()` | src/chartAnalysis.js | PROTECTED |
| `checkForEmptyCells()` | irrigation-playwright.js | PROTECTED |
| `attemptTableRefresh()` | irrigation-playwright.js | PROTECTED |
| `sendReport()` | irrigation-playwright.js | PROTECTED |
| `recordNoIrrigationReport()` | irrigation-playwright.js | PROTECTED |

---

*Last updated: 2026-01-28*
