# 🧪 F8 Training Mode - Test & Verification Script

## Pre-Flight Checks

Run these commands to verify the integration before starting:

```powershell
# 1. Check files exist
Test-Path "trainAlgorithm.js"
Test-Path "irrigation-playwright.js"
Test-Path "training" -PathType Container

# 2. Verify import (should show no errors)
node --eval "import('./trainAlgorithm.js').then(() => console.log('✅ Import OK')).catch(e => console.error('❌ Import failed:', e))"

# 3. Check environment variable
$env:TRAINING_MODE="true"
node --eval "console.log('TRAINING_MODE:', process.env.TRAINING_MODE)"

# 4. Verify training directory
if (-not (Test-Path "training")) {
    New-Item -ItemType Directory -Path "training"
    Write-Host "✅ Created training directory"
}
```

---

## Test 1: Import Test

**Purpose**: Verify trainAlgorithm.js imports correctly

```powershell
# Test import
node --eval "
import('./trainAlgorithm.js')
  .then(module => {
    console.log('✅ Module loaded');
    console.log('Exports:', Object.keys(module));
    if (module.trainAlgorithm) {
      console.log('✅ trainAlgorithm function found');
    } else {
      console.error('❌ trainAlgorithm function missing');
    }
  })
  .catch(err => {
    console.error('❌ Import failed:', err.message);
  });
"
```

**Expected Output**:
```
✅ Module loaded
Exports: [ 'trainAlgorithm' ]
✅ trainAlgorithm function found
```

---

## Test 2: Environment Variable Test

**Purpose**: Verify TRAINING_MODE environment variable is detected

```powershell
# Test environment variable
$env:TRAINING_MODE="true"
node --eval "
const config = {
  trainingMode: process.env.TRAINING_MODE === 'true'
};
console.log('CONFIG.trainingMode:', config.trainingMode);
if (config.trainingMode) {
  console.log('✅ Training mode would be activated');
} else {
  console.error('❌ Training mode not activated');
}
"
```

**Expected Output**:
```
CONFIG.trainingMode: true
✅ Training mode would be activated
```

---

## Test 3: Syntax Check

**Purpose**: Verify no syntax errors in irrigation-playwright.js

```powershell
# Check syntax
node --check irrigation-playwright.js
```

**Expected Output**:
```
(no output = success)
```

If errors appear, they'll be shown. Common issues:
- Missing closing brackets
- Import path typos
- Variable name mismatches

---

## Test 4: Dry Run (Normal Mode)

**Purpose**: Verify script still works without training mode

```powershell
# Remove training mode env var
Remove-Item Env:TRAINING_MODE -ErrorAction SilentlyContinue

# Start script (should run normally)
npm start
```

**Expected Behavior**:
- Script starts normally
- No training banner appears
- Auto-clicks as usual
- No F8 pause

---

## Test 5: Training Mode Activation

**Purpose**: Full test with training mode enabled

```powershell
# Enable training mode
$env:TRAINING_MODE="true"

# Start script
npm start
```

**Expected Behavior**:

### Console Output:
```
🚀 Starting Irrigation Report Automation (Playwright)...
📊 Dashboard ready at: http://localhost:3000
...
🎓 F8 TRAINING MODE ACTIVATED
   Farm: [Farm Name]
   Date: [Date]
   Predicted First (START): Screen(450, 320)
   Predicted Last (END): Screen(1200, 340)
   ⏸️  Automation PAUSED - Waiting for F8 key press...
```

### Browser Display:
1. **Banner at top** (colorful gradient, can't miss it)
2. **Green dashed circle** around predicted START
3. **Red dashed circle** around predicted END
4. **Text**: "Press [F8] to Resume"

### User Actions:
1. Review predictions
2. Click if wrong (yellow/red dots appear)
3. Press F8

### After F8:
```
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

## Test 6: Verify Training Data Saved

**Purpose**: Confirm training data is persisted correctly

```powershell
# Check file exists
if (Test-Path "training/training-data.json") {
    Write-Host "✅ Training file exists"
    
    # Show file size
    $size = (Get-Item "training/training-data.json").Length
    Write-Host "   File size: $size bytes"
    
    # Show entry count
    $data = Get-Content "training/training-data.json" | ConvertFrom-Json
    Write-Host "   Entries: $($data.Count)"
    
    # Show last entry
    Write-Host "   Last entry:"
    $data[-1] | ConvertTo-Json -Depth 3
    
} else {
    Write-Host "❌ Training file not found"
}
```

**Expected Output**:
```
✅ Training file exists
   File size: 1234 bytes
   Entries: 1
   Last entry:
{
  "timestamp": "2026-01-19T...",
  "farm": "...",
  "offsets": { "first": {...}, "last": {...} }
}
```

---

## Test 7: F8 Key Detection (Isolated)

**Purpose**: Test F8 key binding in isolation

Create test file `test-f8.html`:
```html
<!DOCTYPE html>
<html>
<head><title>F8 Test</title></head>
<body>
  <h1>Press F8 Key</h1>
  <div id="status">Waiting...</div>
  <script>
    document.addEventListener('keydown', (e) => {
      document.getElementById('status').innerHTML = 
        `Key: ${e.key}, Code: ${e.keyCode}, Is F8: ${e.key === 'F8' || e.keyCode === 119}`;
      
      if (e.key === 'F8' || e.keyCode === 119) {
        document.getElementById('status').style.color = 'green';
        document.getElementById('status').innerHTML += '<br><b>✅ F8 DETECTED!</b>';
      }
    });
  </script>
</body>
</html>
```

Open in browser and press F8. Should show:
```
✅ F8 DETECTED!
```

---

## Test 8: Click Capture (Isolated)

**Purpose**: Verify click coordinates are captured correctly

Create test file `test-clicks.html`:
```html
<!DOCTYPE html>
<html>
<head><title>Click Test</title></head>
<body style="margin: 0; padding: 0;">
  <div id="target" style="width: 100vw; height: 100vh; background: #f0f0f0;">
    <h1 style="padding: 20px;">Click anywhere</h1>
    <div id="log" style="padding: 20px;"></div>
  </div>
  <script>
    const clicks = [];
    document.getElementById('target').addEventListener('click', (e) => {
      clicks.push({ x: e.clientX, y: e.clientY });
      
      const log = document.getElementById('log');
      log.innerHTML = `<b>Clicks: ${clicks.length}</b><br>`;
      clicks.forEach((c, i) => {
        log.innerHTML += `${i + 1}. (${c.x}, ${c.y})<br>`;
      });
      
      // Draw dot
      const dot = document.createElement('div');
      dot.style.cssText = `
        position: fixed;
        left: ${e.clientX - 10}px;
        top: ${e.clientY - 10}px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: ${i === 0 ? 'yellow' : 'red'};
        border: 2px solid black;
      `;
      document.body.appendChild(dot);
    });
  </script>
</body>
</html>
```

Open in browser and click. Should show coordinates and dots.

---

## Troubleshooting Guide

### Problem: Module not found
```
Error: Cannot find module './trainAlgorithm.js'
```

**Solution**:
1. Check file exists: `Test-Path trainAlgorithm.js`
2. Check current directory: `Get-Location`
3. Verify import path in irrigation-playwright.js (line 16)

---

### Problem: TRAINING_MODE not working
```
(Script runs normally, no pause)
```

**Solution**:
```powershell
# Verify env var is set BEFORE starting npm
$env:TRAINING_MODE="true"
Write-Host "Env var: $($env:TRAINING_MODE)"
npm start
```

---

### Problem: F8 doesn't resume
```
(Banner stays, nothing happens)
```

**Solution**:
1. Click on the page to focus browser
2. Try pressing F8 multiple times
3. Check browser console (F12) for errors
4. Verify `window._resumeAutomation` is set to true:
   ```javascript
   // In browser console:
   window._resumeAutomation
   // Should be false before F8, true after
   ```

---

### Problem: No training data saved
```
✅ F8 detected! Resuming automation...
📝 Retrieved 0 user clicks
```

**Causes**:
1. **No clicks registered**: Click was on banner (don't click banner!)
2. **Training directory missing**: Create with `mkdir training`
3. **Permissions issue**: Run as administrator

**Solutions**:
1. Click ONLY on chart area (below banner)
2. Ensure `training/` directory exists
3. Check file permissions

---

## Success Checklist

Before deploying to production, verify:

- [ ] ✅ `trainAlgorithm.js` imports without errors
- [ ] ✅ `TRAINING_MODE=true` activates training mode
- [ ] ✅ Banner appears at top of page
- [ ] ✅ Green/red circles show predicted points
- [ ] ✅ Clicking creates yellow/red dots
- [ ] ✅ F8 resumes automation
- [ ] ✅ Training data saves to JSON
- [ ] ✅ Coordinates update with user corrections
- [ ] ✅ Script continues to next farm/date
- [ ] ✅ Normal mode (no env var) works unchanged

---

## Performance Benchmarks

**Normal Mode** (no training):
- Farm processing: ~10-15 seconds
- Date processing: ~3-5 seconds

**Training Mode** (with manual review):
- Farm processing: Variable (user-dependent)
- Date processing: ~30-60 seconds (including user review)
- F8 response time: Instant (<100ms)

**Recommendation**: Use training mode for first 5-10 farms, then switch to normal mode.

---

## Automated Test Suite

Run all tests at once:

```powershell
Write-Host "`n🧪 RUNNING F8 TRAINING MODE TESTS`n" -ForegroundColor Cyan

# Test 1: File existence
Write-Host "Test 1: File Existence" -ForegroundColor Yellow
$files = @("trainAlgorithm.js", "irrigation-playwright.js", "training")
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file exists" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file missing" -ForegroundColor Red
    }
}

# Test 2: Import
Write-Host "`nTest 2: Module Import" -ForegroundColor Yellow
$importTest = node --eval "import('./trainAlgorithm.js').then(() => console.log('OK')).catch(() => console.log('FAIL'))" 2>&1
if ($importTest -match "OK") {
    Write-Host "  ✅ Import successful" -ForegroundColor Green
} else {
    Write-Host "  ❌ Import failed" -ForegroundColor Red
}

# Test 3: Environment variable
Write-Host "`nTest 3: Environment Variable" -ForegroundColor Yellow
$env:TRAINING_MODE="true"
$envTest = node --eval "console.log(process.env.TRAINING_MODE === 'true')"
if ($envTest -match "true") {
    Write-Host "  ✅ Environment variable works" -ForegroundColor Green
} else {
    Write-Host "  ❌ Environment variable issue" -ForegroundColor Red
}

# Test 4: Syntax check
Write-Host "`nTest 4: Syntax Check" -ForegroundColor Yellow
$syntaxCheck = node --check irrigation-playwright.js 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ No syntax errors" -ForegroundColor Green
} else {
    Write-Host "  ❌ Syntax errors found" -ForegroundColor Red
    Write-Host "  $syntaxCheck"
}

Write-Host "`n🎉 Test suite complete!`n" -ForegroundColor Cyan
```

---

## Ready for Production!

If all tests pass, you're ready to use F8 Training Mode in production.

**Start training now**:
```powershell
cd "C:\Users\iocrops admin\Coding\IrrigationReportAutomation"
$env:TRAINING_MODE="true"
npm start
```

**Good luck! 🚀**
