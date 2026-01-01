/**
 * Irrigation Report Automation - Playwright Version
 * Purpose: Automate data extraction from admin.iocrops.com 관수리포트 menu
 * 
 * Week 1 Goal: Proof of Concept - Navigate and screenshot
 * 
 * Using Playwright instead of Vibium for better Windows compatibility
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Configuration (move to config.js later)
const CONFIG = {
  url: 'https://admin.iofarm.com/report/',
  username: 'admin@admin.com',
  password: 'jojin1234!!',
  targetName: '승진', // Wait for "승진's irrigation" to show up
  outputDir: './data',
  screenshotDir: './screenshots'
};

// Ensure output directories exist
[CONFIG.outputDir, CONFIG.screenshotDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function main() {
  console.log('🚀 Starting Irrigation Report Automation (Playwright)...\n');
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: false // Set to true for production
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Step 1: Navigate to IoFarm admin report page
    console.log('📍 Step 1: Navigating to admin.iofarm.com/report/...');
    await page.goto(CONFIG.url, { waitUntil: 'networkidle' });
    
    // Wait a few seconds as requested
    console.log('  → Waiting for page to fully load...');
    await page.waitForTimeout(3000);
    
    // Show current URL
    const currentUrl1 = page.url();
    console.log(`  → Current URL: ${currentUrl1}`);
    
    // Take screenshot to verify we're on the right page
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const screenshotPath = path.join(CONFIG.screenshotDir, `1-homepage-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Report page loaded. Screenshot saved: ${screenshotPath}\n`);
    
    // Step 2: Check if login is needed, if so, login
    console.log('🔐 Step 2: Checking if login is required...');
    
    try {
      // Check if login form exists (wait up to 5 seconds)
      const loginFormExists = await page.locator('input[type="email"], input[type="text"], input[name="email"], input[name="username"]').first().isVisible({ timeout: 5000 }).catch(() => false);
      
      if (loginFormExists) {
        console.log('  → Login form detected, proceeding with login...');
        
        // Try common email/username field selectors
        const emailSelectors = [
          'input[type="email"]',
          'input[name="email"]',
          'input[name="username"]',
          'input[placeholder*="email" i]',
          'input[placeholder*="이메일" i]'
        ];
        
        let emailFilled = false;
        for (const selector of emailSelectors) {
          try {
            const emailField = page.locator(selector).first();
            if (await emailField.isVisible({ timeout: 1000 })) {
              console.log(`  → Entering email: ${CONFIG.username}`);
              await emailField.fill(CONFIG.username);
              emailFilled = true;
              break;
            }
          } catch (e) {
            // Try next selector
            continue;
          }
        }
        
        if (!emailFilled) {
          console.log('  ⚠️ Could not find email field, trying generic input[type="text"]');
          await page.fill('input[type="text"]', CONFIG.username);
        }
        
        // Type password
        console.log('  → Entering password...');
        await page.fill('input[type="password"]', CONFIG.password);
        
        // Click login button
        console.log('  → Clicking login button...');
        const loginButtonSelectors = [
          'button[type="submit"]',
          'button:has-text("로그인")',
          'button:has-text("Login")',
          'input[type="submit"]',
          'button.login-button'
        ];
        
        let buttonClicked = false;
        for (const selector of loginButtonSelectors) {
          try {
            const button = page.locator(selector).first();
            if (await button.isVisible({ timeout: 1000 })) {
              await button.click();
              buttonClicked = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!buttonClicked) {
          // Try pressing Enter as fallback
          await page.keyboard.press('Enter');
        }
        
        // Wait for navigation after login
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        const loginScreenshot = path.join(CONFIG.screenshotDir, `2-after-login-${timestamp}.png`);
        await page.screenshot({ path: loginScreenshot, fullPage: true });
        
        // Show current URL after login
        const currentUrl2 = page.url();
        console.log(`  → Current URL after login: ${currentUrl2}`);
        console.log(`✅ Login completed. Screenshot saved: ${loginScreenshot}\n`);
        
        // Check if we need to navigate to report page after login
        if (!currentUrl2.includes('/report')) {
          console.log('  ⚠️  Not at /report page yet, attempting to navigate...');
          await page.goto('https://admin.iofarm.com/report', { waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);
          console.log(`  → Navigated to: ${page.url()}\n`);
        }
        
      } else {
        console.log('  ✅ No login required, already at report page');
        const currentUrl = page.url();
        console.log(`  → Current URL: ${currentUrl}\n`);
      }
      
    } catch (loginError) {
      console.log('⚠️  Login check/process had issues. Error:', loginError.message);
      console.log('   → Continuing anyway, might already be logged in\n');
      
      // Take screenshot
      const errorScreenshot = path.join(CONFIG.screenshotDir, `2-login-error-${timestamp}.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`📸 Screenshot saved: ${errorScreenshot}\n`);
    }
    
    // Step 3: Wait for "승진's irrigation" to show up
    console.log(`📊 Step 3: Waiting for "${CONFIG.targetName}'s irrigation" to appear...`);
    
    try {
      // Show current URL
      const currentUrl3 = page.url();
      console.log(`  → Current URL: ${currentUrl3}`);
      
      // Wait a few seconds for content to load
      await page.waitForTimeout(3000);
      
      // Get page title for verification
      const pageTitle = await page.title();
      console.log(`  → Page Title: "${pageTitle}"`);
      
      // Look for text containing "승진" and "irrigation" or "관수"
      const searchTexts = [
        `${CONFIG.targetName}'s irrigation`,
        `${CONFIG.targetName}`,
        '관수',
        'irrigation',
        'report',
        '리포트'
      ];
      
      console.log('  → Searching for target elements...');
      
      // Check if any of these texts appear on the page
      let foundTarget = false;
      for (const searchText of searchTexts) {
        try {
          const element = page.locator(`text=${searchText}`).first();
          if (await element.isVisible({ timeout: 2000 })) {
            console.log(`  ✅ Found: "${searchText}"`);
            foundTarget = true;
          }
        } catch (e) {
          // Text not found, try next
          continue;
        }
      }
      
      if (!foundTarget) {
        console.log(`  ⚠️  Could not find "${CONFIG.targetName}'s irrigation" text`);
        console.log('     → Might be on the page but with different formatting');
      }
      
      // Get all visible text on page for debugging
      const bodyText = await page.locator('body').textContent();
      const firstChars = bodyText?.substring(0, 200).replace(/\s+/g, ' ').trim();
      console.log(`  → First 200 chars of page: "${firstChars}..."`);
      
      // Take screenshot regardless
      const targetScreenshot = path.join(CONFIG.screenshotDir, `3-target-page-${timestamp}.png`);
      await page.screenshot({ path: targetScreenshot, fullPage: true });
      console.log(`📸 Screenshot saved: ${targetScreenshot}\n`);
      
    } catch (searchError) {
      console.log('⚠️  Error while searching for target. Error:', searchError.message);
      
      // Take screenshot
      const errorScreenshot = path.join(CONFIG.screenshotDir, `3-search-error-${timestamp}.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`📸 Error screenshot saved: ${errorScreenshot}\n`);
    }
    
    // Step 4: Click '승진' radio button to select that manager
    console.log('🎯 Step 4: Selecting "승진" manager...');
    
    try {
      // Use JavaScript to click the radio button (more reliable than Playwright click)
      const radioClicked = await page.evaluate(() => {
        // Find radio button by label text
        const labels = Array.from(document.querySelectorAll('label'));
        const seungjinLabel = labels.find(label => label.textContent.includes('승진'));
        if (seungjinLabel) {
          seungjinLabel.click();
          return true;
        }
        
        // Fallback: try input directly
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        const seungjinRadio = radios.find(radio => 
          radio.id.includes('승진') || radio.value.includes('승진')
        );
        if (seungjinRadio) {
          seungjinRadio.click();
          return true;
        }
        
        return false;
      });
      
      if (radioClicked) {
        console.log('  ✅ Clicked "승진" radio button via JavaScript');
        await page.waitForTimeout(2000);
        
        const step4Screenshot = path.join(CONFIG.screenshotDir, `4-selected-seungjin-${timestamp}.png`);
        await page.screenshot({ path: step4Screenshot, fullPage: true });
        console.log(`  📸 Screenshot: ${step4Screenshot}\n`);
      } else {
        console.log('  ⚠️  Could not find "승진" radio button\n');
      }
    } catch (error) {
      console.log(`  ⚠️  Error clicking "승진" radio: ${error.message}\n`);
    }
    
    // Step 5: Get all farms from the list and loop through them
    console.log('🏭 Step 5: Getting list of all farms...');
    
    let farmList = [];
    try {
      farmList = await page.evaluate(() => {
        const farms = [];
        const tabs = document.querySelector('[id*="tabs"][id*="content-point"]');
        if (tabs) {
          // Get all farm items in the list
          const farmDivs = tabs.querySelectorAll('div > div:first-child > div:nth-child(2) > div');
          farmDivs.forEach((div, idx) => {
            const text = div.textContent.trim();
            if (text && text.length > 0) {
              farms.push({ index: idx + 1, name: text });
            }
          });
        }
        return farms;
      });
      
      console.log(`  ✅ Found ${farmList.length} farms`);
      farmList.forEach((farm, idx) => {
        console.log(`     [${idx + 1}] ${farm.name}`);
      });
      console.log('');
    } catch (error) {
      console.log(`  ⚠️  Error getting farm list: ${error.message}`);
      console.log('  → Will try processing just the first farm\n');
      farmList = [{ index: 1, name: 'First Farm (fallback)' }];
    }
    
    // Array to store all farm data
    const allFarmData = [];
    
    // Loop through each farm
    const maxFarmsToProcess = 3; // Limit to first 3 farms for faster testing
    const farmsToProcess = farmList.slice(0, maxFarmsToProcess);
    
    for (let farmIdx = 0; farmIdx < farmsToProcess.length; farmIdx++) {
      const currentFarm = farmsToProcess[farmIdx];
      console.log(`\n${'='.repeat(70)}`);
      console.log(`🏭 Processing Farm ${farmIdx + 1}/${farmsToProcess.length}: ${currentFarm.name}`);
      console.log(`${'='.repeat(70)}\n`);
      
      // Click the farm
      try {
        const farmClicked = await page.evaluate((farmIndex) => {
          const tabs = document.querySelector('[id*="tabs"][id*="content-point"]');
          if (tabs) {
            const targetDiv = tabs.querySelector(`div > div:first-child > div:nth-child(2) > div:nth-child(${farmIndex})`);
            if (targetDiv) {
              targetDiv.click();
              return true;
            }
          }
        return false;
        }, currentFarm.index);
      
      if (farmClicked) {
          console.log(`  ✅ Clicked farm "${currentFarm.name}"`);
        await page.waitForTimeout(3000); // Wait for chart to load
      } else {
          console.log(`  ⚠️  Could not click farm "${currentFarm.name}", skipping...\n`);
          continue;
      }
    } catch (error) {
        console.log(`  ⚠️  Error clicking farm: ${error.message}, skipping...\n`);
        continue;
    }
    
    // Step 6: Check table fields and click irrigation points if needed
    console.log('💧 Checking irrigation time tables...');
    
    try {
      await page.waitForTimeout(2000); // Wait for page to stabilize
      
      // Check the two table fields - look specifically in the right panel
      const tableStatus = await page.evaluate(() => {
        const results = { debug: [] };
        
        // Target exact labels
        const firstTimeLabel = '구역 1 첫 급액 시간 1 (시분)';
        const lastTimeLabel = '구역 1 마지막 급액 시간 1 (시분)';
        
        let firstTimeValue = null;
        let lastTimeValue = null;
        
        // Strategy: Find headings with exact text, then look for input/display below
        const allElements = Array.from(document.querySelectorAll('*'));
        
        allElements.forEach(elem => {
          const text = (elem.textContent || '').trim();
          
          // Must match EXACTLY the label (to avoid picking up "진우")
          if (text === firstTimeLabel && elem.children.length === 0) {
            results.debug.push(`Found first label: ${elem.tagName}`);
            
            // Look in parent container for input or value display
            let container = elem.closest('div, section, article');
            if (container) {
              // Look for input field
              const input = container.querySelector('input[type="text"], input:not([type])');
              if (input) {
                firstTimeValue = input.value || input.placeholder;
                results.debug.push(`First value from input: "${firstTimeValue}"`);
              }
              
              // Or look for display text in sibling/child
              if (!firstTimeValue) {
                const siblings = Array.from(container.children);
                siblings.forEach(sib => {
                  const sibText = sib.textContent.trim();
                  if (sibText && sibText !== firstTimeLabel && sibText.length < 20) {
                    if (!firstTimeValue || sibText.includes(':')) {
                      firstTimeValue = sibText;
                      results.debug.push(`First value from sibling: "${sibText}"`);
                    }
                  }
                });
              }
            }
          }
          
          if (text === lastTimeLabel && elem.children.length === 0) {
            results.debug.push(`Found last label: ${elem.tagName}`);
            
            let container = elem.closest('div, section, article');
            if (container) {
              const input = container.querySelector('input[type="text"], input:not([type])');
              if (input) {
                lastTimeValue = input.value || input.placeholder;
                results.debug.push(`Last value from input: "${lastTimeValue}"`);
              }
              
              if (!lastTimeValue) {
                const siblings = Array.from(container.children);
                siblings.forEach(sib => {
                  const sibText = sib.textContent.trim();
                  if (sibText && sibText !== lastTimeLabel && sibText.length < 20) {
                    if (!lastTimeValue || sibText.includes(':')) {
                      lastTimeValue = sibText;
                      results.debug.push(`Last value from sibling: "${sibText}"`);
                    }
                  }
                });
              }
            }
          }
        });
        
        // Clean up values - remove the label text if it got included
        if (firstTimeValue && firstTimeValue.includes(firstTimeLabel)) {
          firstTimeValue = firstTimeValue.replace(firstTimeLabel, '').trim();
        }
        if (lastTimeValue && lastTimeValue.includes(lastTimeLabel)) {
          lastTimeValue = lastTimeValue.replace(lastTimeLabel, '').trim();
        }
        
        return {
          firstTime: firstTimeValue,
          lastTime: lastTimeValue,
          needsFirstClick: !firstTimeValue || firstTimeValue === '' || firstTimeValue === '-' || firstTimeValue === '--:--' || firstTimeValue.includes('클릭'),
          needsLastClick: !lastTimeValue || lastTimeValue === '' || lastTimeValue === '-' || lastTimeValue === '--:--' || lastTimeValue.includes('클릭'),
          debug: results.debug
        };
      });
      
      console.log(`  → Debug: ${tableStatus.debug.join(', ')}`);
      console.log(`  → 첫 급액시간: "${tableStatus.firstTime || 'EMPTY'}"`);
      console.log(`  → 마지막 급액시간: "${tableStatus.lastTime || 'EMPTY'}"`);
      console.log(`  → Needs first click: ${tableStatus.needsFirstClick}`);
      console.log(`  → Needs last click: ${tableStatus.needsLastClick}\n`);
      
      console.log(`  → 첫 급액시간: "${tableStatus.firstTime || 'EMPTY'}"`);
      console.log(`  → 마지막 급액시간: "${tableStatus.lastTime || 'EMPTY'}"`);
      
      // If either field is empty, click the chart points
      if (tableStatus.needsFirstClick || tableStatus.needsLastClick) {
        console.log('  ⚠️  Tables need data, clicking chart points...\n');
        
        // Wait longer for Highcharts to initialize
        await page.waitForTimeout(3000);
        
        // Professional chart point detection API  
        const clickResults = await page.evaluate((needs) => {
          const results = [];
          
          // ============================================
          // METHOD 1: Try Highcharts API (Most Accurate)
          // ============================================
          let chart = null;
          if (window.Highcharts && window.Highcharts.charts) {
            chart = window.Highcharts.charts.find(c => c !== undefined);
          }
          
          if (chart && chart.series && chart.series[0]) {
            results.push({ message: '✅ Highcharts API accessible' });
          
          const series = chart.series[0];
          const dataPoints = series.data;
          
            if (dataPoints.length > 0) {
              // Find irrigation spikes (Y-value drops)
          const spikes = [];
          for (let i = 1; i < dataPoints.length; i++) {
            const prevY = dataPoints[i - 1].y;
            const currY = dataPoints[i].y;
            const drop = prevY - currY;
            
                // Significant drop = irrigation event
            if (drop > 5) {
              spikes.push({
                index: i,
                    point: dataPoints[i],
                    x: dataPoints[i].x,
                    y: currY,
                    plotX: dataPoints[i].plotX + chart.plotLeft,
                    plotY: dataPoints[i].plotY + chart.plotTop,
                drop: drop,
                    time: dataPoints[i].category || dataPoints[i].x
              });
            }
          }
          
              if (spikes.length > 0) {
                results.push({ message: `Found ${spikes.length} irrigation spikes via API` });
                
                const firstSpike = spikes[0];
                const lastSpike = spikes[spikes.length - 1];
                
              // Click first spike
              if (needs.needsFirstClick) {
                firstSpike.point.select(true, false);
                firstSpike.point.firePointEvent('click');
          results.push({ 
                  action: '✅ API: Clicked FIRST spike', 
                  x: Math.round(firstSpike.plotX), 
                  y: Math.round(firstSpike.plotY),
                  time: firstSpike.time
                });
              }
              
              // Click last spike (use a different approach to ensure it registers)
              if (needs.needsLastClick) {
                // Deselect first spike first
                if (needs.needsFirstClick) {
                  firstSpike.point.select(false, false);
                }
                
                lastSpike.point.select(true, false);
                lastSpike.point.firePointEvent('click');
          results.push({
                  action: '✅ API: Clicked LAST spike', 
                  x: Math.round(lastSpike.plotX), 
                  y: Math.round(lastSpike.plotY),
                  time: lastSpike.time
                });
              }
                
                return results;
              }
            }
          }
          
          // ============================================
          // METHOD 2: SVG Path Analysis (Fallback)
          // ============================================
          results.push({ message: '⚠️ Highcharts API not accessible, using SVG path analysis' });
          
          // Find the series path
          const seriesPath = document.querySelector('.highcharts-series path[data-z-index="1"]');
          if (!seriesPath) {
            return { error: 'No series path found in SVG' };
          }
          
          const pathData = seriesPath.getAttribute('d');
          if (!pathData) {
            return { error: 'Path data attribute not found' };
          }
          
          // Parse SVG path coordinates (handles M, L, and C commands)
          const coordinates = [];
          
          // Extract all numbers from the path
          const numbers = pathData.match(/[\d.-]+/g);
          if (!numbers || numbers.length < 6) {
            return { error: `Path has insufficient data: ${numbers ? numbers.length : 0} numbers` };
          }
          
          // Parse coordinates (every 2 numbers = one point)
          for (let i = 0; i < numbers.length - 1; i += 2) {
            coordinates.push({
              x: parseFloat(numbers[i]),
              y: parseFloat(numbers[i + 1])
            });
          }
          
          // For Bézier curves (C command), only use the end points (every 3rd point)
          // This gives us the actual plotted points, not the control points
          const plottedPoints = [];
          plottedPoints.push(coordinates[0]); // First M command point
          for (let i = 3; i < coordinates.length; i += 3) {
            plottedPoints.push(coordinates[i]); // End point of each C command
          }
          
          // Use plotted points for spike detection
          const finalCoords = plottedPoints.length > 10 ? plottedPoints : coordinates;
            
            results.push({ 
            message: `Parsed ${finalCoords.length} plot points from SVG path (from ${coordinates.length} total coords)` 
          });
          
          // Debug: Show sample coordinates
          if (finalCoords.length > 0) {
            results.push({
              message: `Sample points: [0]=(${Math.round(finalCoords[0].x)},${Math.round(finalCoords[0].y)}), [${Math.floor(finalCoords.length/2)}]=(${Math.round(finalCoords[Math.floor(finalCoords.length/2)].x)},${Math.round(finalCoords[Math.floor(finalCoords.length/2)].y)})`
            });
          }
          
          if (finalCoords.length < 3) {
            return { error: `Not enough coordinates to find spikes: ${finalCoords.length} points` };
          }
          
          // HSSP Method: Find Highest Slope Start Points (irrigation event starts)
          
          // Get Y-range for context
          const allY = finalCoords.map(c => c.y);
          const maxY = Math.max(...allY);
          const minY = Math.min(...allY);
          const yRange = maxY - minY;
            
            results.push({ 
            message: `Y range: ${Math.round(minY)} to ${Math.round(maxY)} (span: ${Math.round(yRange)})` 
          });
          
          // Step 1: Find irrigation events (visual spikes UP = LOW Y values in SVG)
          const peaks = [];
          for (let i = 5; i < finalCoords.length - 5; i++) {
            // Look at wider window (5 points each side)
            const prev = finalCoords.slice(Math.max(0, i-5), i);
            const next = finalCoords.slice(i+1, Math.min(finalCoords.length, i+6));
            const curr = finalCoords[i];
            
            // Get average of neighbors
            const avgPrev = prev.reduce((sum, p) => sum + p.y, 0) / prev.length;
            const avgNext = next.reduce((sum, p) => sum + p.y, 0) / next.length;
            
            // Irrigation spike = LOWER Y than neighbors (visual spike UP)
            const prominence = Math.min(avgPrev, avgNext) - curr.y;
            
            // Threshold: 2% of Y range
            if (prominence > yRange * 0.02) {
              peaks.push({
                index: i,
                x: curr.x,
                y: curr.y,
                prominence: prominence
              });
            }
          }
          
          results.push({ 
            message: `Found ${peaks.length} peaks (irrigation events)` 
          });
          
          // Debug: Show peak locations
          if (peaks.length > 0 && peaks.length <= 10) {
            const peaksSummary = peaks.map((p, i) => `[${i}]=idx${p.index}(${Math.round(p.x)},${Math.round(p.y)})`).join(', ');
            results.push({ message: `Peak locations (raw): ${peaksSummary}` });
          }
          
          // De-duplicate adjacent peaks (keep highest within each cluster)
          const uniquePeaks = [];
          let i = 0;
          while (i < peaks.length) {
            let clusterHighest = peaks[i];
            let j = i + 1;
            
            // Find all adjacent peaks (within 3 indices AND similar Y-values)
            while (j < peaks.length) {
              const indexDiff = peaks[j].index - clusterHighest.index;
              const yDiff = Math.abs(peaks[j].y - clusterHighest.y);
              
              // Same cluster if very close in both index and Y-value
              if (indexDiff <= 3 || (indexDiff <= 8 && yDiff < yRange * 0.1)) {
                if (peaks[j].y > clusterHighest.y) {
                  clusterHighest = peaks[j];
                }
                j++;
              } else {
                break;  // Different cluster
              }
            }
            
            uniquePeaks.push(clusterHighest);
            i = j;
          }
            
            results.push({
            message: `After de-duplication: ${uniquePeaks.length} unique irrigation events` 
          });
          
          // Step 2: For each unique peak, find HSSP (where DROP starts)
          const spikes = [];
          for (let pIdx = 0; pIdx < uniquePeaks.length; pIdx++) {
            const peak = uniquePeaks[pIdx];
            let hsspIndex = peak.index;
            let maxDrop = 0;  // Most negative slope
            
            // Look backwards up to 30 points to find where steepest DROP starts
            const lookbackLimit = Math.max(0, peak.index - 30);
            
            for (let j = peak.index - 1; j > lookbackLimit; j--) {
              const slopeDrop = finalCoords[j].y - finalCoords[j + 1].y;  // Positive = dropping
              
              // Find where Y drops most steeply (irrigation starts)
              if (slopeDrop > maxDrop) {
                maxDrop = slopeDrop;
                hsspIndex = j;
              }
            }
            
            spikes.push({
              index: hsspIndex,
              x: finalCoords[hsspIndex].x,
              y: finalCoords[hsspIndex].y,
              peakIndex: peak.index,
              peakY: peak.y,
              maxDrop: maxDrop,
              lookbackRange: `${lookbackLimit} to ${peak.index}`
            });
            
                results.push({ 
              message: `Irrigation ${pIdx}: min_Y=${Math.round(peak.y)} at idx=${peak.index} → HSSP at idx=${hsspIndex}, Y=${Math.round(finalCoords[hsspIndex].y)}, drop=${Math.round(maxDrop)}`
            });
          }
          
          results.push({ 
            message: `Found ${spikes.length} HSSP points (irrigation start points)` 
          });
          
          // Debug: Show all HSSP coordinates
          if (spikes.length > 0 && spikes.length <= 10) {
            const coordsSummary = spikes.map((s, i) => `[${i}]=(${Math.round(s.x)},${Math.round(s.y)})`).join(', ');
            results.push({ message: `All HSSPs: ${coordsSummary}` });
          }
          
          if (spikes.length === 0) {
            results.push({ error: 'No irrigation start points (HSSP) found - check peak detection threshold' });
            return results;
          }
          
          // Get chart container for coordinate conversion
          const chartContainer = document.querySelector('.highcharts-container');
          const containerRect = chartContainer.getBoundingClientRect();
          
          const firstHSSP = spikes[0];
          const lastHSSP = spikes[spikes.length - 1];
          
          // For last irrigation, use the valley (lowest point = peak of irrigation)
          const lastValley = uniquePeaks[uniquePeaks.length - 1];
          
          // Only set lastClick if there are multiple irrigation events
          const hasMultipleEvents = uniquePeaks.length >= 2;
          
          // IMPORTANT: Click ABOVE the line (lower Y) to hit Highcharts clickable area
          const clickOffsetY = 15; // pixels above the chart line
          
          results.push({
            message: `Selecting: First HSSP idx=${firstHSSP.index}, Last VALLEY idx=${lastValley.index}`
          });
          
                results.push({ 
            message: `Click offset: ${clickOffsetY}px ABOVE chart line (Highcharts clickable area)`
          });
          
          if (!hasMultipleEvents) {
            results.push({
              message: `Only 1 irrigation event detected - skipping "last" click (UI limitation)`
            });
          }
          
          // Convert SVG coordinates to screen coordinates
          const firstX = containerRect.left + firstHSSP.x;
          const firstY = containerRect.top + firstHSSP.y - clickOffsetY;
          const lastX = containerRect.left + lastValley.x;
          const lastY = containerRect.top + lastValley.y - clickOffsetY;
          
          // Return coordinates for Playwright to click (more reliable than JS events)
          return {
            needsFirstClick: needs.needsFirstClick,
            needsLastClick: needs.needsLastClick && hasMultipleEvents, // Only click last if multiple events
            firstCoords: needs.needsFirstClick ? { x: Math.round(firstX), y: Math.round(firstY), svgX: Math.round(firstHSSP.x), svgY: Math.round(firstHSSP.y), drop: Math.round(firstHSSP.maxDrop) } : null,
            lastCoords: (needs.needsLastClick && hasMultipleEvents) ? { x: Math.round(lastX), y: Math.round(lastY), svgX: Math.round(lastValley.x), svgY: Math.round(lastValley.y), valleyIdx: lastValley.index } : null,
            debug: results
          };
            
            return results;
          }, tableStatus);
          
        // Display debug info
        if (clickResults.debug) {
          clickResults.debug.forEach(msg => {
            if (msg.message) console.log(`  → ${msg.message}`);
          });
        }
        
        // Now perform REAL Playwright mouse clicks for more reliable interaction
        if (clickResults.needsFirstClick && clickResults.firstCoords) {
          const coords = clickResults.firstCoords;
          console.log(`  ✅ HSSP: Clicking FIRST irrigation start`);
          console.log(`     → Screen Coord: (${coords.x}, ${coords.y}) - 15px ABOVE line`);
          console.log(`     → SVG Line Coord: (${coords.svgX}, ${coords.svgY})`);
          console.log(`     → Max Drop: ${coords.drop} (steepness)`);
          
          // Focus first input field
          await page.click('input[type="time"]:nth-of-type(1)');
          await page.waitForTimeout(500);
          
          // Click chart with Playwright mouse
          await page.mouse.click(coords.x, coords.y);
          await page.waitForTimeout(3000); // Wait for UI to update before second click
        }
        
        if (clickResults.needsLastClick && clickResults.lastCoords) {
          const coords = clickResults.lastCoords;
          console.log(`  ✅ PEAK: Clicking LAST irrigation peak`);
          console.log(`     → Screen Coord: (${coords.x}, ${coords.y}) - 15px ABOVE line`);
          console.log(`     → SVG Line Coord: (${coords.svgX}, ${coords.svgY})`);
          console.log(`     → Position: valley (lowest Y) at idx=${coords.valleyIdx}`);
          
          // Focus LAST input field
          const timeInputs = await page.$$('input[type="time"]');
          if (timeInputs.length > 1) {
            await timeInputs[timeInputs.length - 1].click();
            await page.waitForTimeout(500);
          }
          
          // Click chart with Playwright mouse
          await page.mouse.click(coords.x, coords.y);
          await page.waitForTimeout(2000); // Wait for UI to update
        }
        
        await page.waitForTimeout(2000); // Final wait for tables to fully update
        
      } else {
        console.log('  ✅ Both tables already have data, skipping clicks\n');
      }
      
      // Wait for UI to fully update after clicks
      await page.waitForTimeout(4000);
      
      // Take screenshot after clicking
      const step6Screenshot = path.join(CONFIG.screenshotDir, `6-after-clicks-${timestamp}.png`);
      await page.screenshot({ path: step6Screenshot, fullPage: true });
      console.log(`  📸 Screenshot: ${step6Screenshot}\n`);
      
      // Extract final table values
      console.log('📊 Step 7: Extracting irrigation data from tables...');
      
      // Wait a moment for tables to update after clicks
      await page.waitForTimeout(3000);
      
      const finalData = await page.evaluate(() => {
        const results = {
          firstIrrigationTime: null,
          lastIrrigationTime: null,
          debug: []
        };
        
        // Strategy 1: Look for time input fields (type="time")
        const timeInputs = Array.from(document.querySelectorAll('input[type="time"]'));
        results.debug.push(`Found ${timeInputs.length} time input fields`);
        
        // For each time input, look backwards in the DOM to find its label
        timeInputs.forEach((input, idx) => {
          const value = input.value;
          results.debug.push(`Time input ${idx + 1}: value="${value || 'EMPTY'}"`);
          
          // Find the parent container
          let container = input.closest('div');
          if (container) {
            // Look for text content in the same container or its siblings
            const containerText = container.textContent || '';
            results.debug.push(`Container text: "${containerText.substring(0, 50)}..."`);
            
            // Check if this is the "first irrigation time" field
            if (containerText.includes('첫 급액') || containerText.includes('첫급액')) {
              results.firstIrrigationTime = value;
              results.debug.push(`✅ Matched FIRST time: "${value}"`);
            }
            // Check if this is the "last irrigation time" field
            else if (containerText.includes('마지막 급액') || containerText.includes('마지막급액')) {
              results.lastIrrigationTime = value;
              results.debug.push(`✅ Matched LAST time: "${value}"`);
            }
          }
        });
        
        // If still not found, fallback to generic search
        if (!results.firstIrrigationTime || !results.lastIrrigationTime) {
          results.debug.push('Trying fallback strategy...');
          // Strategy 2: Look for table cells with time format
          const allText = Array.from(document.querySelectorAll('td, div, span, p'));
          allText.forEach((elem, idx) => {
          const text = elem.textContent.trim();
          
          // If we find the label
          if (text.includes('구역 1 첫 급액') && text.includes('시간')) {
            results.debug.push(`Found first label: "${text}"`);
            
            // Look in siblings, parent, or nearby elements
            const parent = elem.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children);
              siblings.forEach(sib => {
                const sibText = sib.textContent.trim();
                if (sibText.match(/\d{2}:\d{2}/) && !sibText.includes('급액')) {
                  results.firstIrrigationTime = sibText;
                  results.debug.push(`Found first time in sibling: "${sibText}"`);
                }
              });
            }
            
            // Try next element
            const next = allText[idx + 1];
            if (next && next.textContent.match(/\d{2}:\d{2}/)) {
              results.firstIrrigationTime = next.textContent.trim();
              results.debug.push(`Found first time in next element: "${next.textContent.trim()}"`);
            }
          }
          
          if (text.includes('구역 1 마지막 급액') && text.includes('시간')) {
            results.debug.push(`Found last label: "${text}"`);
            
            const parent = elem.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children);
              siblings.forEach(sib => {
                const sibText = sib.textContent.trim();
                if (sibText.match(/\d{2}:\d{2}/) && !sibText.includes('급액')) {
                  results.lastIrrigationTime = sibText;
                  results.debug.push(`Found last time in sibling: "${sibText}"`);
                }
              });
            }
            
            const next = allText[idx + 1];
            if (next && next.textContent.match(/\d{2}:\d{2}/)) {
              results.lastIrrigationTime = next.textContent.trim();
              results.debug.push(`Found last time in next element: "${next.textContent.trim()}"`);
            }
          }
          }); // End forEach
        
          // Strategy 3: If still not found, look for ANY elements with time format in the right panel
          if (!results.firstIrrigationTime || !results.lastIrrigationTime) {
            const timeElements = allText.filter(elem => {
              const text = elem.textContent.trim();
              return text.match(/^\d{2}:\d{2}$/);
            });
            
            results.debug.push(`Found ${timeElements.length} elements with time format`);
            
            if (timeElements.length >= 2) {
              // Assume first time-format element is "첫 급액시간"
              if (!results.firstIrrigationTime) {
                results.firstIrrigationTime = timeElements[0].textContent.trim();
                results.debug.push(`Using first time element: "${results.firstIrrigationTime}"`);
              }
              // Assume last time-format element is "마지막 급액시간"
              if (!results.lastIrrigationTime) {
                results.lastIrrigationTime = timeElements[timeElements.length - 1].textContent.trim();
                results.debug.push(`Using last time element: "${results.lastIrrigationTime}"`);
              }
            }
          } // End Strategy 3 if block
        } // End fallback if block
        
        return results;
      });
      
      console.log(`  → Debug info: ${finalData.debug.join(' | ')}`);
      console.log(`  → 첫 급액시간 1: ${finalData.firstIrrigationTime || 'NOT FOUND'}`);
      console.log(`  → 마지막 급액시간 1: ${finalData.lastIrrigationTime || 'NOT FOUND'}\n`);
      
      // Add farm data to collection
      const farmData = {
        farmName: currentFarm.name,
        farmIndex: farmIdx + 1,
        url: page.url(),
        firstIrrigationTime: finalData.firstIrrigationTime || null,
        lastIrrigationTime: finalData.lastIrrigationTime || null,
        extractedAt: new Date().toISOString()
      };
      allFarmData.push(farmData);
      
      if (finalData.firstIrrigationTime || finalData.lastIrrigationTime) {
        console.log(`  ✅ Data collected for farm "${currentFarm.name}"\n`);
      } else {
        console.log(`  ⚠️  No irrigation time data found for this farm\n`);
      }
      
    } catch (error) {
      console.log(`  ⚠️  Error in data extraction: ${error.message}\n`);
    }
    
      // Take screenshot after processing this farm
      const farmScreenshot = path.join(CONFIG.screenshotDir, `farm-${farmIdx + 1}-${timestamp}.png`);
      await page.screenshot({ path: farmScreenshot, fullPage: true });
      console.log(`  📸 Screenshot: ${farmScreenshot}\n`);
      
    } // End farm loop
    
    // Save all collected farm data
    console.log('\n💾 Saving all farm data...');
    const allDataFile = path.join(CONFIG.outputDir, `all-farms-data-${timestamp}.json`);
    const summaryData = {
      extractedAt: new Date().toISOString(),
      manager: CONFIG.targetName,
      totalFarms: allFarmData.length,
      farmsWithData: allFarmData.filter(f => f.firstIrrigationTime || f.lastIrrigationTime).length,
      farms: allFarmData
    };
    fs.writeFileSync(allDataFile, JSON.stringify(summaryData, null, 2));
    console.log(`✅ Saved data for ${allFarmData.length} farms to: ${allDataFile}\n`);
    
    // Step 8: Final screenshot
    const finalScreenshot = path.join(CONFIG.screenshotDir, `8-final-state-${timestamp}.png`);
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    console.log(`📸 Final screenshot saved: ${finalScreenshot}\n`);
    
    // Success summary
    console.log('✅ Multi-Farm Data Extraction Complete!');
    console.log('\n📋 Summary:');
    console.log(`   • Total farms processed: ${allFarmData.length}`);
    console.log(`   • Farms with data: ${summaryData.farmsWithData}`);
    console.log(`   • Manager: ${CONFIG.targetName}`);
    
    // Show summary table
    console.log('\n📊 Farm Details:');
    allFarmData.forEach((farm, idx) => {
      const first = farm.firstIrrigationTime || '--:--';
      const last = farm.lastIrrigationTime || '--:--';
      const status = (farm.firstIrrigationTime || farm.lastIrrigationTime) ? '✅' : '⚠️';
      console.log(`   ${status} [${idx + 1}] ${farm.farmName}`);
      console.log(`      First: ${first} | Last: ${last}`);
    });
    
    console.log('\n📋 What Was Accomplished:');
    console.log('   1. ✅ Navigated to report page');
    console.log('   2. ✅ Selected "승진" manager');
    console.log(`   3. ✅ Processed ${allFarmData.length} farms`);
    console.log('   4. ✅ Checked irrigation time tables for each farm');
    console.log('   5. ✅ Clicked chart points using HSSP algorithm');
    console.log('   6. ✅ Extracted data and saved to JSON');
    console.log('   7. ✅ Captured screenshots of the process\n');
    
  } catch (error) {
    console.error('❌ Error during automation:', error);
    console.error('   Stack trace:', error.stack);
    
    // Try to take error screenshot
    try {
      const errorScreenshot = path.join(CONFIG.screenshotDir, `error-${Date.now()}.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`📸 Error screenshot saved: ${errorScreenshot}`);
    } catch (screenshotError) {
      console.log('   Could not save error screenshot');
    }
    
  } finally {
    // Clean up
    console.log('\n🔚 Closing browser...');
    await browser.close();
    console.log('✅ Done!\n');
  }
}

// Run the automation
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

