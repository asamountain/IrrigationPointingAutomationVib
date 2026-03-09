/**
 * Test Script for Visual Confirmation Feature
 * 
 * This script tests the visual overlay and keyboard confirmation system
 * without running the full automation.
 * 
 * Usage: node test-visual-confirmation.js
 */

import { chromium } from 'playwright';

async function testVisualConfirmation() {
  console.log('🧪 Testing Visual Confirmation Feature\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  let browser = null;
  let page = null;
  
  try {
    // Launch browser
    console.log('1️⃣  Launching browser...');
    browser = await chromium.launch({ 
      headless: false,
      args: ['--start-maximized']
    });
    
    const context = await browser.newContext({
      viewport: null
    });
    
    page = await context.newPage();
    console.log('   ✅ Browser launched\n');
    
    // Navigate to a test page with Highcharts
    console.log('2️⃣  Loading test chart...');
    await page.goto('https://www.highcharts.com/demo/line-basic', {
      waitUntil: 'networkidle'
    });
    console.log('   ✅ Test page loaded\n');
    
    // Wait for chart to render
    await page.waitForTimeout(2000);
    
    // Test the overlay injection
    console.log('3️⃣  Injecting visual overlay...');
    await page.evaluate(() => {
      // Remove any existing overlay
      const existing = document.getElementById('irrigation-click-overlay');
      if (existing) existing.remove();
      
      // Create overlay container
      const overlay = document.createElement('div');
      overlay.id = 'irrigation-click-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 99999;
      `;
      
      // Create info box
      const infoBox = document.createElement('div');
      infoBox.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        font-family: 'Consolas', monospace;
        font-size: 14px;
        z-index: 100000;
        pointer-events: auto;
        min-width: 280px;
      `;
      
      infoBox.innerHTML = `
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #4CAF50;">
          👁️ Visual Confirmation Mode - TEST
        </div>
        <div style="margin-bottom: 8px;">
          <span style="color: #FF4444; font-size: 18px;">●</span> FIRST: 08:30
          <span style="color: #888; font-size: 11px;">(Test Point)</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #4444FF; font-size: 18px;">●</span> LAST: 15:45
          <span style="color: #888; font-size: 11px;">(Test Point)</span>
        </div>
        <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 5px;">
          <div style="color: #4CAF50; font-weight: bold;">Press ENTER to confirm clicks</div>
          <div style="color: #FF9800;">Press ESC to skip this date</div>
        </div>
      `;
      
      // Add test markers at chart center
      const chartContainer = document.querySelector('.highcharts-container');
      if (chartContainer) {
        const rect = chartContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width * 0.3;
        const centerY = rect.top + rect.height / 2;
        
        // First marker (RED)
        const firstMarker = document.createElement('div');
        firstMarker.style.cssText = `
          position: fixed;
          left: ${centerX - 15}px;
          top: ${centerY - 15}px;
          width: 30px;
          height: 30px;
          border: 3px solid #FF4444;
          border-radius: 50%;
          background: rgba(255, 68, 68, 0.3);
          animation: pulse 1s infinite;
        `;
        
        const firstLabel = document.createElement('div');
        firstLabel.style.cssText = `
          position: fixed;
          left: ${centerX + 20}px;
          top: ${centerY - 10}px;
          background: #FF4444;
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          font-family: sans-serif;
        `;
        firstLabel.textContent = 'FIRST: 08:30';
        
        // Last marker (BLUE)
        const lastX = rect.left + rect.width * 0.7;
        const lastMarker = document.createElement('div');
        lastMarker.style.cssText = `
          position: fixed;
          left: ${lastX - 15}px;
          top: ${centerY - 15}px;
          width: 30px;
          height: 30px;
          border: 3px solid #4444FF;
          border-radius: 50%;
          background: rgba(68, 68, 255, 0.3);
          animation: pulse 1s infinite;
        `;
        
        const lastLabel = document.createElement('div');
        lastLabel.style.cssText = `
          position: fixed;
          left: ${lastX + 20}px;
          top: ${centerY - 10}px;
          background: #4444FF;
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          font-family: sans-serif;
        `;
        lastLabel.textContent = 'LAST: 15:45';
        
        overlay.appendChild(firstMarker);
        overlay.appendChild(firstLabel);
        overlay.appendChild(lastMarker);
        overlay.appendChild(lastLabel);
      }
      
      // Add CSS animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
        }
      `;
      
      overlay.appendChild(style);
      overlay.appendChild(infoBox);
      document.body.appendChild(overlay);
      
      console.log('✅ Overlay injected successfully');
    });
    
    console.log('   ✅ Overlay displayed\n');
    
    // Test keyboard listener
    console.log('4️⃣  Testing keyboard listener...');
    console.log('   📋 Instructions:');
    console.log('      • Press ENTER in the browser to confirm');
    console.log('      • Press ESC in the browser to skip');
    console.log('      • Test will timeout after 30 seconds\n');
    
    const result = await page.evaluate((timeoutMs) => {
      return new Promise((resolve) => {
        window._overlayConfirmed = null;
        
        const handler = (e) => {
          if (e.key === 'Enter') {
            window._overlayConfirmed = true;
            document.removeEventListener('keydown', handler);
            resolve({ action: 'confirmed', key: 'Enter' });
          } else if (e.key === 'Escape') {
            window._overlayConfirmed = false;
            document.removeEventListener('keydown', handler);
            resolve({ action: 'skipped', key: 'Escape' });
          }
        };
        
        document.addEventListener('keydown', handler);
        
        // Timeout fallback
        setTimeout(() => {
          document.removeEventListener('keydown', handler);
          if (window._overlayConfirmed === null) {
            resolve({ action: 'timeout', key: null });
          }
        }, timeoutMs);
      });
    }, 30000);
    
    // Remove overlay
    await page.evaluate(() => {
      const overlay = document.getElementById('irrigation-click-overlay');
      if (overlay) overlay.remove();
    });
    
    console.log('\n5️⃣  Test Results:');
    if (result.action === 'confirmed') {
      console.log('   ✅ SUCCESS: User pressed ENTER (confirmed)');
    } else if (result.action === 'skipped') {
      console.log('   ✅ SUCCESS: User pressed ESC (skipped)');
    } else {
      console.log('   ⏱️  TIMEOUT: No key pressed within 30 seconds');
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ Visual Confirmation Test Complete!\n');
    
    // Keep browser open for 3 seconds
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run test
testVisualConfirmation().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
