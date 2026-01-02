# Learning from User Interactions

**How to teach the automation by showing it what to do**

---

## 🎯 Method 1: Playwright Codegen (Built-in Recorder)

### **What it does:**
- Records your mouse clicks, keyboard inputs, and navigation
- Generates Playwright code automatically
- Can learn the exact selectors you interact with

### **How to use:**

```powershell
# Start recording mode
npx playwright codegen https://admin.iofarm.com

# Or record with existing browser state
npx playwright codegen --save-storage=auth.json https://admin.iofarm.com
```

### **What happens:**
1. Browser opens with "Playwright Inspector" window
2. You interact with the site (click, type, navigate)
3. Playwright Inspector shows generated code in real-time
4. Copy the code and paste into your script

### **Example Output:**
```javascript
// Playwright watches you and generates this:
await page.click('button[aria-label="이전 기간"]');
await page.click('input[type="time"]:nth-of-type(1)');
await page.mouse.click(450, 250);
```

---

## 🎓 Method 2: Visual Training (Screenshot + Click Recording)

### **Concept:**
Record where you click on charts, then use those coordinates to train better detection.

### **Implementation:**

#### **Step 1: Add Recording Mode to Script**
```javascript
const LEARNING_MODE = true; // Set to true to record clicks

if (LEARNING_MODE) {
  // Save screenshot BEFORE user clicks
  await page.screenshot({ path: 'training/before-click.png' });
  
  // Wait for user to click manually
  console.log('⏸️  LEARNING MODE: Click the irrigation START point...');
  await page.pause(); // Pauses for user interaction
  
  // Record where they clicked
  const clickedPoint = await page.evaluate(() => {
    return { x: lastClickX, y: lastClickY };
  });
  
  // Save training data
  fs.appendFileSync('training-data.json', JSON.stringify({
    screenshot: 'before-click.png',
    userClick: clickedPoint,
    timestamp: new Date()
  }));
}
```

#### **Step 2: User Demonstrates**
1. Script pauses at each chart
2. You manually click the correct START point
3. Script records the click coordinates
4. You manually click the correct END point
5. Script records that too

#### **Step 3: Learn Patterns**
```javascript
// Analyze training data to find patterns
const trainingData = JSON.parse(fs.readFileSync('training-data.json'));

// Find what features your clicks had in common:
// - Y-value range where you clicked
// - X-position relative to drops
// - Proximity to peaks/valleys
```

---

## 🤖 Method 3: Interactive Correction Mode

### **Concept:**
Algorithm makes a guess, you correct it, algorithm learns.

### **Implementation:**

```javascript
// Algorithm detects points
const detectedFirst = { x: 120, y: 250 };
const detectedLast = { x: 410, y: 255 };

// Show on screen with highlighting
await page.evaluate((first, last) => {
  // Draw circles at detected points
  const svg = document.querySelector('.highcharts-container svg');
  
  // First point (green)
  const circle1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle1.setAttribute('cx', first.x);
  circle1.setAttribute('cy', first.y);
  circle1.setAttribute('r', '10');
  circle1.setAttribute('fill', 'green');
  circle1.setAttribute('opacity', '0.5');
  svg.appendChild(circle1);
  
  // Last point (red)
  const circle2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle2.setAttribute('cx', last.x);
  circle2.setAttribute('cy', last.y);
  circle2.setAttribute('r', '10');
  circle2.setAttribute('fill', 'red');
  circle2.setAttribute('opacity', '0.5');
  svg.appendChild(circle2);
}, detectedFirst, detectedLast);

// Ask user: "Is this correct?"
console.log('🤔 Algorithm detected these points. Press:');
console.log('   Y = Correct, continue');
console.log('   N = Wrong, let me show you');

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const answer = await new Promise(resolve => {
  readline.question('Correct? (Y/N): ', resolve);
});

if (answer.toLowerCase() === 'n') {
  console.log('👉 Please click the CORRECT first point...');
  await page.pause();
  
  const userFirst = await page.evaluate(() => {
    return { x: lastClickX, y: lastClickY };
  });
  
  // Record correction
  fs.appendFileSync('corrections.json', JSON.stringify({
    algorithmGuess: detectedFirst,
    userCorrection: userFirst,
    date: new Date()
  }));
  
  // Algorithm can learn: "I was off by X pixels in Y direction"
}
```

---

## 📊 Method 4: Analyze Historical Corrections

### **Concept:**
After running for a while, analyze patterns in corrections to improve algorithm.

```javascript
// Load all corrections
const corrections = JSON.parse(fs.readFileSync('corrections.json'));

// Analyze patterns
const analysis = {
  avgXOffset: 0,
  avgYOffset: 0,
  commonFeatures: []
};

corrections.forEach(correction => {
  const xDiff = correction.userCorrection.x - correction.algorithmGuess.x;
  const yDiff = correction.userCorrection.y - correction.algorithmGuess.y;
  
  analysis.avgXOffset += xDiff;
  analysis.avgYOffset += yDiff;
});

analysis.avgXOffset /= corrections.length;
analysis.avgYOffset /= corrections.length;

console.log('📈 Learning Results:');
console.log(`   Algorithm is consistently off by ${analysis.avgXOffset}px horizontally`);
console.log(`   Algorithm is consistently off by ${analysis.avgYOffset}px vertically`);

// Apply correction to future detections
detectedPoints.forEach(point => {
  point.x += analysis.avgXOffset;
  point.y += analysis.avgYOffset;
});
```

---

## 🎯 Recommended Approach

### **Phase 1: Initial Learning (Week 1)**
1. Use **Codegen** to learn exact selectors
2. Run script in **LEARNING_MODE** for 5-10 farms
3. Manually click correct points while recording

### **Phase 2: Validation (Week 2)**
1. Use **Interactive Correction Mode**
2. Algorithm highlights its guesses
3. You confirm or correct each one
4. Build corrections database

### **Phase 3: Improvement (Week 3)**
1. Analyze correction patterns
2. Adjust algorithm parameters automatically
3. Calculate confidence scores
4. Only pause for low-confidence detections

### **Phase 4: Autonomous (Week 4+)**
1. Algorithm runs fully automatic
2. Flags uncertain cases for review
3. Continues learning from any corrections
4. Gradually improves accuracy

---

## 🛠️ Quick Start: Add Learning Mode

Add this to your current script:

```javascript
// At top of file
const LEARNING_MODE = process.env.LEARNING_MODE === 'true';

// Before clicking detected points
if (LEARNING_MODE) {
  console.log('📚 LEARNING MODE: Pausing for manual correction...');
  console.log('   1. Check if green/red circles are correct');
  console.log('   2. If wrong, press F8 to pause and click correct points');
  console.log('   3. Press F8 again to continue');
  
  await page.pause(); // Playwright Dev Tools will open
}
```

Run with:
```powershell
$env:LEARNING_MODE="true"; npm start
```

---

## 📝 Training Data Format

```json
{
  "farmName": "진우승진농장",
  "date": "2026-01-02",
  "chartScreenshot": "training/farm1-date1.png",
  "algorithmDetection": {
    "first": { "x": 120, "y": 250, "confidence": 0.75 },
    "last": { "x": 410, "y": 255, "confidence": 0.82 }
  },
  "userCorrection": {
    "first": { "x": 115, "y": 248 },
    "last": { "x": 415, "y": 253 }
  },
  "feedback": "Algorithm was 5px off horizontally"
}
```

---

## 🚀 Next Steps

1. **Try Codegen first** - Easiest way to see how Playwright records
2. **Add LEARNING_MODE flag** - Let you pause and correct
3. **Record 10-20 examples** - Build training dataset
4. **Analyze patterns** - Find systematic biases
5. **Auto-adjust parameters** - Make algorithm smarter

---

**The algorithm can definitely learn from you! 🎓**

