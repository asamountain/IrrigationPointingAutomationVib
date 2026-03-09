/**
 * 🎓 TRAINING MODE: F8-Controlled Learning System
 * Purpose: Pause automation to manually teach correct irrigation points
 * 
 * Press F8 to resume automation after clicking correct points
 */

import fs from 'fs';
import path from 'path';

const TRAINING_FILE = './training/training-data.json';

/**
 * Train the algorithm by allowing manual point selection
 * 
 * @param {Page} page - Playwright page object
 * @param {string} farmName - Name of current farm
 * @param {string} date - Current date being processed
 * @param {Object} predictedFirst - Algorithm's first point prediction {x, y, svgX, svgY}
 * @param {Object} predictedLast - Algorithm's last point prediction {x, y, svgX, svgY}
 * @returns {Promise<Object>} - User corrections and offsets
 */
export async function trainAlgorithm(page, farmName, date, predictedFirst, predictedLast) {
  console.log('\n🎓 ════════════════════════════════════════');
  console.log('🎓   TRAINING MODE: F8 TO RESUME');
  console.log('🎓 ════════════════════════════════════════\n');
  
  console.log(`   Farm: ${farmName}`);
  console.log(`   Date: ${date}`);
  console.log(`   Predicted First (START): Screen(${predictedFirst.x}, ${predictedFirst.y})`);
  console.log(`   Predicted Last (END): Screen(${predictedLast.x}, ${predictedLast.y})\n`);
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Inject Visual Interface (Banner + Click Listener + F8 Handler)
  // ═══════════════════════════════════════════════════════════════════════
  
  await page.evaluate((first, last) => {
    // Reset state
    window._userClicks = [];
    window._resumeAutomation = false;
    
    // ─────────────────────────────────────────────────────────────────────
    // 1A. CREATE BANNER
    // ─────────────────────────────────────────────────────────────────────
    const banner = document.createElement('div');
    banner.id = 'training-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      background: linear-gradient(135deg, #FF6B6B 0%, #FFD93D 50%, #6BCF7F 100%);
      color: #000;
      padding: 25px;
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      z-index: 2147483647;
      box-shadow: 0 8px 16px rgba(0,0,0,0.4);
      font-family: 'Arial', sans-serif;
      border-bottom: 5px solid #333;
      animation: bannerPulse 2s ease-in-out infinite;
    `;
    banner.innerHTML = `
      🎓 LEARNING MODE 🎓<br>
      <span style="font-size: 18px; font-weight: normal; color: #333;">
        Click correct points: <span style="color: #00ff00; font-weight: bold;">Start=Green</span>, 
        <span style="color: #ff0000; font-weight: bold;">End=Red</span>
      </span><br>
      <span style="font-size: 22px; color: #fff; background: #000; padding: 5px 15px; border-radius: 5px; margin-top: 10px; display: inline-block;">
        Press [F8] to Resume ⏩
      </span>
    `;
    
    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes bannerPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }
      @keyframes dotPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(banner);
    
    // ─────────────────────────────────────────────────────────────────────
    // 1B. SHOW PREDICTED POINTS (for reference)
    // ─────────────────────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'training-overlay';
    overlay.style.cssText = `
      position: fixed; 
      top: 0; 
      left: 0; 
      width: 100vw; 
      height: 100vh; 
      pointer-events: none; 
      z-index: 2147483646;
    `;
    
    // First point (GREEN)
    const firstDot = document.createElement('div');
    firstDot.style.cssText = `
      position: absolute;
      left: ${first.x - 30}px;
      top: ${first.y - 30}px;
      width: 60px;
      height: 60px;
      border: 6px dashed #00ff00;
      border-radius: 50%;
      background: rgba(0, 255, 0, 0.2);
      pointer-events: none;
      box-shadow: 0 0 20px rgba(0, 255, 0, 0.6);
    `;
    overlay.appendChild(firstDot);
    
    const firstLabel = document.createElement('div');
    firstLabel.innerHTML = '🟢 FIRST (Predicted)';
    firstLabel.style.cssText = `
      position: absolute;
      left: ${first.x - 70}px;
      top: ${first.y - 60}px;
      background: #00ff00;
      color: #000;
      padding: 8px 12px;
      border-radius: 5px;
      font-size: 14px;
      font-weight: bold;
      pointer-events: none;
    `;
    overlay.appendChild(firstLabel);
    
    // Last point (RED)
    const lastDot = document.createElement('div');
    lastDot.style.cssText = `
      position: absolute;
      left: ${last.x - 30}px;
      top: ${last.y - 30}px;
      width: 60px;
      height: 60px;
      border: 6px dashed #ff0000;
      border-radius: 50%;
      background: rgba(255, 0, 0, 0.2);
      pointer-events: none;
      box-shadow: 0 0 20px rgba(255, 0, 0, 0.6);
    `;
    overlay.appendChild(lastDot);
    
    const lastLabel = document.createElement('div');
    lastLabel.innerHTML = '🔴 LAST (Predicted)';
    lastLabel.style.cssText = `
      position: absolute;
      left: ${last.x - 70}px;
      top: ${last.y - 60}px;
      background: #ff0000;
      color: #fff;
      padding: 8px 12px;
      border-radius: 5px;
      font-size: 14px;
      font-weight: bold;
      pointer-events: none;
    `;
    overlay.appendChild(lastLabel);
    
    document.body.appendChild(overlay);
    
    // ─────────────────────────────────────────────────────────────────────
    // 1C. CLICK LISTENER (on entire document)
    // ─────────────────────────────────────────────────────────────────────
    window._clickHandler = function(event) {
      // Ignore clicks on banner
      if (event.target.closest('#training-banner')) return;
      
      const clickNum = window._userClicks.length + 1;
      const color = clickNum === 1 ? '#FFD700' : clickNum === 2 ? '#FF6347' : '#00BFFF';
      const label = clickNum === 1 ? 'START' : clickNum === 2 ? 'END' : `#${clickNum}`;
      
      // Save click coordinates
      window._userClicks.push({
        x: event.clientX,
        y: event.clientY,
        timestamp: Date.now(),
        label: label
      });
      
      console.log(`[TRAINING] Click #${clickNum}: (${event.clientX}, ${event.clientY}) - ${label}`);
      
      // Draw visual feedback dot
      const dot = document.createElement('div');
      dot.style.cssText = `
        position: fixed;
        left: ${event.clientX - 15}px;
        top: ${event.clientY - 15}px;
        width: 30px;
        height: 30px;
        border: 4px solid ${color};
        border-radius: 50%;
        background: ${color}AA;
        z-index: 2147483645;
        pointer-events: none;
        animation: dotPulse 1s ease-in-out infinite;
        box-shadow: 0 0 15px ${color};
      `;
      
      const labelDiv = document.createElement('div');
      labelDiv.innerHTML = label;
      labelDiv.style.cssText = `
        position: fixed;
        left: ${event.clientX - 25}px;
        top: ${event.clientY + 20}px;
        background: ${color};
        color: #000;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 12px;
        font-weight: bold;
        z-index: 2147483645;
        pointer-events: none;
      `;
      
      document.body.appendChild(dot);
      document.body.appendChild(labelDiv);
      
      // Update banner with click count
      const banner = document.getElementById('training-banner');
      if (banner && clickNum <= 2) {
        const clickInfo = document.createElement('div');
        clickInfo.style.cssText = `
          font-size: 16px; 
          color: ${color}; 
          margin-top: 5px;
          font-weight: bold;
        `;
        clickInfo.textContent = `✓ ${label} clicked (${clickNum}/2)`;
        banner.appendChild(clickInfo);
      }
    };
    
    document.addEventListener('click', window._clickHandler, true);
    
    // ─────────────────────────────────────────────────────────────────────
    // 1D. F8 KEY HANDLER (Resume Automation)
    // ─────────────────────────────────────────────────────────────────────
    window._keyHandler = function(event) {
      if (event.key === 'F8' || event.keyCode === 119) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('[TRAINING] F8 pressed! Resuming automation...');
        window._resumeAutomation = true;
        
        // Update banner
        const banner = document.getElementById('training-banner');
        if (banner) {
          banner.style.background = 'linear-gradient(135deg, #00ff00 0%, #00aa00 100%)';
          banner.innerHTML = `
            ✅ RESUMED - Processing clicks...<br>
            <span style="font-size: 18px;">Automation continuing...</span>
          `;
        }
        
        // Remove handlers
        document.removeEventListener('click', window._clickHandler, true);
        document.removeEventListener('keydown', window._keyHandler, true);
      }
    };
    
    document.addEventListener('keydown', window._keyHandler, true);
    
    console.log('[TRAINING] ✅ Training UI injected. Waiting for F8...');
    
  }, predictedFirst, predictedLast);
  
  console.log('   ⏸️  Automation PAUSED - Waiting for F8 key press...');
  console.log('   → Click the correct irrigation points on the chart');
  console.log('   → Press F8 when ready to continue\n');
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: WAIT FOR F8 (The Pause Mechanism)
  // ═══════════════════════════════════════════════════════════════════════
  
  try {
    await page.waitForFunction(
      () => window._resumeAutomation === true,
      { timeout: 0 } // No timeout - wait indefinitely
    );
    
    console.log('   ✅ F8 detected! Resuming automation...\n');
    
  } catch (error) {
    console.log('   ⚠️  Wait interrupted:', error.message);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: RETRIEVE USER CLICKS & CALCULATE OFFSETS
  // ═══════════════════════════════════════════════════════════════════════
  
  const userClicks = await page.evaluate(() => {
    const clicks = window._userClicks || [];
    
    // Cleanup UI
    const banner = document.getElementById('training-banner');
    const overlay = document.getElementById('training-overlay');
    if (banner) banner.remove();
    if (overlay) overlay.remove();
    
    // Remove all training dots
    document.querySelectorAll('[style*="2147483645"]').forEach(el => el.remove());
    
    return clicks;
  });
  
  console.log(`   📝 Retrieved ${userClicks.length} user clicks`);
  
  let trainingData = {
    userClicks: userClicks,
    hasCorrections: false,
    offsets: null
  };
  
  if (userClicks.length >= 2) {
    const userFirst = userClicks[0];
    const userLast = userClicks[1];
    
    // Calculate offsets
    const offsetFirst = {
      x: userFirst.x - predictedFirst.x,
      y: userFirst.y - predictedFirst.y
    };
    
    const offsetLast = {
      x: userLast.x - predictedLast.x,
      y: userLast.y - predictedLast.y
    };
    
    console.log(`   📊 Offsets calculated:`);
    console.log(`      FIRST: X=${offsetFirst.x.toFixed(1)}px, Y=${offsetFirst.y.toFixed(1)}px`);
    console.log(`      LAST: X=${offsetLast.x.toFixed(1)}px, Y=${offsetLast.y.toFixed(1)}px`);
    
    trainingData.hasCorrections = true;
    trainingData.offsets = { first: offsetFirst, last: offsetLast };
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: SAVE TO TRAINING FILE
    // ═══════════════════════════════════════════════════════════════════════
    
    const trainingEntry = {
      timestamp: new Date().toISOString(),
      farm: farmName,
      date: date,
      algorithmPrediction: {
        first: predictedFirst,
        last: predictedLast
      },
      userCorrections: {
        first: userFirst,
        last: userLast
      },
      offsets: trainingData.offsets,
      feedback: `User provided ${userClicks.length} clicks`
    };
    
    // Load existing training data
    let allTrainingData = [];
    if (fs.existsSync(TRAINING_FILE)) {
      try {
        const fileContent = fs.readFileSync(TRAINING_FILE, 'utf-8');
        allTrainingData = JSON.parse(fileContent);
      } catch (err) {
        console.log('   ⚠️  Could not parse existing training file, creating new');
        allTrainingData = [];
      }
    }
    
    // Append new entry
    allTrainingData.push(trainingEntry);
    
    // Ensure directory exists
    const trainingDir = path.dirname(TRAINING_FILE);
    if (!fs.existsSync(trainingDir)) {
      fs.mkdirSync(trainingDir, { recursive: true });
    }
    
    // Save to file
    fs.writeFileSync(TRAINING_FILE, JSON.stringify(allTrainingData, null, 2));
    
    console.log(`   💾 Training data saved to: ${TRAINING_FILE}`);
    console.log(`   📈 Total training entries: ${allTrainingData.length}\n`);
    
  } else if (userClicks.length === 1) {
    console.log(`   ⚠️  Only 1 click detected - need at least 2 (START and END)`);
    console.log(`   → Skipping training save\n`);
  } else {
    console.log(`   ℹ️  No clicks detected - accepting algorithm prediction`);
    console.log(`   → No training data saved\n`);
  }
  
  console.log('🎓 ✅ Training complete. Resuming automation...\n');
  
  return trainingData;
}
