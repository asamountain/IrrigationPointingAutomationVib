# Claude AI Instructions - IrrigationReportAutomation

## ⚠️ CRITICAL: DO NOT MODIFY These Features

This document contains instructions for AI assistants working on this codebase. The features documented below are **LOCKED** and must **NEVER** be changed without explicit user approval.

---

## 🔐 LOCKED FEATURE #1: Enter/Space Keyboard Save Functionality

### Summary
When users drag the RED (first) or BLUE (last) vertical bar markers on the irrigation chart to adjust timestamps, pressing **ENTER** or **SPACE** must save the timestamps to both the input table fields AND the API.

### Why This Is Critical
- Users drag vertical lines to visually set irrigation times
- After dragging, pressing ENTER or SPACE saves the data
- ESC key skips without saving
- This is the **ONLY** way users can confirm their visual adjustments
- Breaking this feature makes the entire visual confirmation mode useless

### Files Containing This Logic

#### 1. `browser-scripts/overlay.js` - Function: `setupConfirmationListener()`
```javascript
// CRITICAL KEYBOARD HANDLER - DO NOT MODIFY
if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
  // Saves to API and confirms
  saveIrrigationData().then(() => resolve(true));
}
```

#### 2. `src/core/visualConfirmation.js` - Function: `waitForUserConfirmation()`
```javascript
// CRITICAL KEYBOARD HANDLER - DO NOT MODIFY  
if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
  // Confirms the visual selection
  browserResolve(true);
}
```

### What MUST Be Preserved
1. ✅ `e.key === 'Enter'` - Enter key triggers save
2. ✅ `e.key === ' '` - Space key triggers save (e.key returns ' ' for spacebar)
3. ✅ `e.code === 'Space'` - Fallback for Space key detection
4. ✅ `e.preventDefault()` - Prevents Space from scrolling the page
5. ✅ `e.stopPropagation()` - Prevents event bubbling to Highcharts
6. ✅ `saveIrrigationData()` call in overlay.js
7. ✅ `window._overlayConfirmed = true` flag setting

### What MUST NOT Be Changed
- ❌ Do NOT remove Enter key support
- ❌ Do NOT remove Space key support  
- ❌ Do NOT change the key detection logic
- ❌ Do NOT remove preventDefault/stopPropagation
- ❌ Do NOT change how `saveIrrigationData()` is called
- ❌ Do NOT change the Promise resolution flow

### UI Text Consistency
The info box in the overlay must always show:
```
Press ENTER or SPACE to save (저장)
Press ESC to skip this date
```

---

## Implementation History

| Date | Change | Reason |
|------|--------|--------|
| 2026-02-06 | Added Space key support alongside Enter | Users reported Space key not working for save |
| 2026-02-06 | Added e.preventDefault() for Space | Prevents page scrolling when Space is pressed |
| 2026-02-06 | Created claude.md | Document critical features that must not be changed |

---

## For AI Assistants (Claude, Copilot, etc.)

When working on this codebase:

1. **READ THIS FILE FIRST** before making changes to keyboard handling
2. **DO NOT refactor** the keyboard event handlers in the locked files
3. **DO NOT simplify** the key detection logic (all three checks are needed)
4. **DO NOT remove** the save functionality from Enter/Space keys
5. **WARN the user** if they request changes that would affect locked features
6. **PRESERVE** comments marked with "CRITICAL" or "DO NOT MODIFY"

If a user explicitly asks to modify a locked feature:
1. Quote this document
2. Explain why the feature is locked
3. Ask for explicit confirmation before proceeding
4. Document any changes in this file's history table

---

## Contact

If you have questions about why these features are locked, refer to:
- The original user request that created this protection
- Git history showing bugs caused by modifying these features
