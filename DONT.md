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

*Last updated: 2026-01-26*
