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
  targetName: process.env.MANAGER || '승진', // Choose manager: $env:MANAGER="진우" or "승진"
  outputDir: './data',
  screenshotDir: './screenshots',
  chartLearningMode: process.env.CHART_LEARNING === 'true', // Enable with: $env:CHART_LEARNING="true"; npm start
  watchMode: process.env.WATCH_MODE === 'true' // Simple watch mode: $env:WATCH_MODE="true"; npm start
};

// Ensure output directories exist
[CONFIG.outputDir, CONFIG.screenshotDir, './training'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Training data file
const TRAINING_FILE = './training/training-data.json';

// Load existing learning data for auto-correction
function loadLearningOffsets() {
  if (!fs.existsSync(TRAINING_FILE)) {
    return { firstX: 0, firstY: 0, lastX: 0, lastY: 0, count: 0 };
  }
  
  try {
    const trainingData = JSON.parse(fs.readFileSync(TRAINING_FILE));
    const corrected = trainingData.filter(entry => entry.userCorrections);
    
    if (corrected.length === 0) {
      return { firstX: 0, firstY: 0, lastX: 0, lastY: 0, count: 0 };
    }
    
    let firstXTotal = 0, firstYTotal = 0, firstCount = 0;
    let lastXTotal = 0, lastYTotal = 0, lastCount = 0;
    
    corrected.forEach(entry => {
      if (entry.userCorrections.first) {
        firstXTotal += entry.userCorrections.first.svgX - entry.algorithmDetection.first.svgX;
        firstYTotal += entry.userCorrections.first.svgY - entry.algorithmDetection.first.svgY;
        firstCount++;
      }
      if (entry.userCorrections.last) {
        lastXTotal += entry.userCorrections.last.svgX - entry.algorithmDetection.last.svgX;
        lastYTotal += entry.userCorrections.last.svgY - entry.algorithmDetection.last.svgY;
        lastCount++;
      }
    });
    
    return {
      firstX: firstCount > 0 ? firstXTotal / firstCount : 0,
      firstY: firstCount > 0 ? firstYTotal / firstCount : 0,
      lastX: lastCount > 0 ? lastXTotal / lastCount : 0,
      lastY: lastCount > 0 ? lastYTotal / lastCount : 0,
      count: corrected.length
    };
  } catch (err) {
    console.log('⚠️  Could not load learning data:', err.message);
    return { firstX: 0, firstY: 0, lastX: 0, lastY: 0, count: 0 };
  }
}

async function main() {
  console.log('🚀 Starting Irrigation Report Automation (Playwright)...\n');
  
  // Load learned offsets from previous training
  const learnedOffsets = loadLearningOffsets();
  if (learnedOffsets.count > 0) {
    console.log(`🎓 Loaded learning data from ${learnedOffsets.count} training sessions`);
    console.log(`   → Applying corrections: First(${learnedOffsets.firstX.toFixed(1)}, ${learnedOffsets.firstY.toFixed(1)}), Last(${learnedOffsets.lastX.toFixed(1)}, ${learnedOffsets.lastY.toFixed(1)})\n`);
  }
  
  // Show selected manager
  console.log(`👤 Selected Manager: ${CONFIG.targetName}`);
  if (CONFIG.watchMode) {
    console.log(`👁️  WATCH MODE: Script will observe but not interfere`);
  } else if (CONFIG.chartLearningMode) {
    console.log(`🎓 LEARNING MODE: Will pause for corrections`);
  }
  console.log();

  // Launch browser
  const browser = await chromium.launch({
    headless: false, // Set to true for production
    devtools: CONFIG.chartLearningMode || CONFIG.watchMode   // Open DevTools in learning/watch mode
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
    
    // Date range: Last 5 days to today (6 days total)
    const totalDaysToCheck = 6;
    
    console.log('\n📅 Date Range Configuration:');
    console.log(`   → Range: 5 days ago → today`);
    console.log(`   → Total days to check: ${totalDaysToCheck}`);
    console.log(`   → Method: Click "Previous period" 5 times, then iterate forward\n`);
    
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
    
    // Step: Navigate to 5 days ago using "Previous period" button
    console.log(`\n  🔙 Navigating to 5 days ago...`);
    try {
      // Click "이전 기간" (Previous period) button 5 times
      for (let i = 0; i < 5; i++) {
        const clicked = await page.evaluate(() => {
          const prevButton = document.querySelector('button[aria-label="이전 기간"]');
          if (prevButton) {
            prevButton.click();
            console.log(`✅ [BROWSER] Clicked "Previous period" button`);
            return true;
          }
          console.error('❌ [BROWSER] Previous period button not found');
          return false;
        });
        
        if (clicked) {
          console.log(`     ✅ Clicked "Previous period" (${i + 1}/5)`);
          await page.waitForTimeout(1500); // Wait for chart to update
        } else {
          console.log(`     ⚠️  Could not find "Previous period" button`);
          break;
        }
      }
      console.log(`  ✅ Navigated back 5 days\n`);
    } catch (navError) {
      console.log(`  ⚠️  Error navigating dates: ${navError.message}\n`);
    }
    
    // Loop through dates for this farm (5 days ago to today)
    let dateIdx = 0;
    const farmDateData = []; // Store data for all dates of this farm
    
    for (let dayOffset = 0; dayOffset < totalDaysToCheck; dayOffset++) {
      dateIdx++;
      
      // Get the current date from the date picker button
      const displayedDate = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button.chakra-button'));
        const dateButton = buttons.find(btn => {
          const hasSvg = btn.querySelector('svg rect[x="3"][y="4"][width="18"][height="18"]');
          const hasDateText = btn.textContent.includes('년') && btn.textContent.includes('일');
          return hasSvg && hasDateText;
        });
        
        if (dateButton) {
          const dateText = dateButton.textContent.trim();
          console.log(`📅 [BROWSER] Current displayed date: ${dateText}`);
          return dateText;
        }
        return 'Unknown Date';
      });
      
      console.log(`\n  📅 Date ${dateIdx}/${totalDaysToCheck}: ${displayedDate}`);
      console.log(`  ${'─'.repeat(60)}`);
      
      // Step 2: Check if tables are already filled for this date
      console.log('  💧 Checking irrigation time tables...');
      
      try {
        await page.waitForTimeout(2000); // Wait for data to load for this date
        
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
      
        console.log(`     → Debug: ${tableStatus.debug.join(', ')}`);
        console.log(`     → 첫 급액시간: "${tableStatus.firstTime || 'EMPTY'}"`);
        console.log(`     → 마지막 급액시간: "${tableStatus.lastTime || 'EMPTY'}"`);
        console.log(`     → Needs first click: ${tableStatus.needsFirstClick}`);
        console.log(`     → Needs last click: ${tableStatus.needsLastClick}\n`);
        
        // Check if tables are already completely filled
        const tablesAlreadyFilled = !tableStatus.needsFirstClick && !tableStatus.needsLastClick;
        
        if (tablesAlreadyFilled) {
          console.log(`     ✅ Tables already filled for this date - NO MODIFICATION NEEDED`);
          console.log(`        → Existing First: ${tableStatus.firstTime}`);
          console.log(`        → Existing Last: ${tableStatus.lastTime}`);
          console.log(`        → Skipping HSSP algorithm (preserving existing data)\n`);
          
          // Store the existing data without running detection
          const dateData = {
            date: displayedDate,
            firstIrrigationTime: tableStatus.firstTime,
            lastIrrigationTime: tableStatus.lastTime,
            extractedAt: new Date().toISOString(),
            alreadyFilled: true
          };
          farmDateData.push(dateData);
          
          // Take screenshot
          const skipScreenshot = path.join(CONFIG.screenshotDir, `farm-${farmIdx + 1}-date-${dateIdx}-skipped-${timestamp}.png`);
          await page.screenshot({ path: skipScreenshot, fullPage: true });
          console.log(`     📸 Screenshot: ${skipScreenshot}\n`);
          
          // Move to next date using "Next period" button (except for last date)
          if (dayOffset < totalDaysToCheck - 1) {
            console.log(`     ⏭️  Moving to next date...`);
            const nextClicked = await page.evaluate(() => {
              const nextButton = document.querySelector('button[aria-label="다음 기간"]');
              if (nextButton) {
                nextButton.click();
                console.log(`✅ [BROWSER] Clicked "Next period" button`);
                return true;
              }
              return false;
            });
            
            if (nextClicked) {
              console.log(`     ✅ Moved to next date`);
              await page.waitForTimeout(2000);
            }
          }
          
          continue; // Skip to next date
        }
        
        // If either field is empty, click the chart points
        if (tableStatus.needsFirstClick || tableStatus.needsLastClick) {
        console.log('  ⚠️  Tables need data, clicking chart points...\n');
        
        // Wait longer for Highcharts to initialize
        await page.waitForTimeout(3000);
        
        // Professional chart point detection API  
        const clickResults = await page.evaluate((needs) => {
          const results = [];
          
          // Log to browser console for debugging
          console.log('🔍 [BROWSER] Starting irrigation point detection...');
          console.log('🔍 [BROWSER] Needs first click:', needs.needsFirstClick);
          console.log('🔍 [BROWSER] Needs last click:', needs.needsLastClick);
          
          // ============================================
          // METHOD 1: Try Highcharts API (Most Accurate)
          // ============================================
          let chart = null;
          if (window.Highcharts && window.Highcharts.charts) {
            chart = window.Highcharts.charts.find(c => c !== undefined);
          }
          
          if (chart && chart.series && chart.series[0]) {
            results.push({ message: '✅ Highcharts API accessible' });
            console.log('✅ [BROWSER] Highcharts API accessible');
          
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
          console.log('⚠️ [BROWSER] Highcharts API not accessible, using SVG path analysis');
          
          // Find the series path
          const seriesPath = document.querySelector('.highcharts-series path[data-z-index="1"]');
          if (!seriesPath) {
            console.error('❌ [BROWSER] No series path found in SVG');
            return { error: 'No series path found in SVG' };
          }
          console.log('✅ [BROWSER] Found series path in SVG');
          
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
          
          // NEW APPROACH: Find steep DROPS (irrigation events)
          // Irrigation = sudden decrease in water level = Y increases (visual drop)
          
          const drops = [];
          const smoothWindow = 3; // Smooth over 3 points to reduce noise
          
          // Calculate smoothed Y values
          const smoothedY = [];
          for (let i = 0; i < finalCoords.length; i++) {
            const start = Math.max(0, i - smoothWindow);
            const end = Math.min(finalCoords.length, i + smoothWindow + 1);
            const window = finalCoords.slice(start, end);
            const avg = window.reduce((sum, p) => sum + p.y, 0) / window.length;
            smoothedY.push(avg);
          }
          
          // Find significant drops (Y increasing = water level dropping)
          for (let i = 15; i < finalCoords.length - 15; i++) {
            // Look back 10 points to see if there's a significant drop
            const before = smoothedY.slice(i - 10, i);
            const after = smoothedY.slice(i, i + 10);
            
            const avgBefore = before.reduce((sum, y) => sum + y, 0) / before.length;
            const avgAfter = after.reduce((sum, y) => sum + y, 0) / after.length;
            
            // Drop = avgAfter is HIGHER than avgBefore (remember: higher Y = lower water = drop)
            const dropAmount = avgAfter - avgBefore;
            const dropPercent = (dropAmount / yRange) * 100;
            
            // Significant drop: at least 8% of Y range
            if (dropAmount > yRange * 0.08) {
              drops.push({
                index: i,
                x: finalCoords[i].x,
                y: finalCoords[i].y,
                dropAmount: dropAmount,
                dropPercent: dropPercent.toFixed(1),
                beforeY: avgBefore,
                afterY: avgAfter
              });
            }
          }
          
          console.log(`🔍 [BROWSER] Found ${drops.length} significant drops (≥8% Y-range)`);
          
          if (drops.length === 0) {
            console.log(`⚠️ [BROWSER] No irrigation drops detected - may have no irrigation this date`);
            results.push({ message: 'No irrigation drops found' });
          }
          
          // De-duplicate adjacent drops (merge drops within 10% of X-span)
          const uniqueDrops = [];
          const xSpan = finalCoords[finalCoords.length - 1].x - finalCoords[0].x;
          
          for (let i = 0; i < drops.length; i++) {
            const drop = drops[i];
            
            // Check if this drop is close to any existing unique drop
            let isDuplicate = false;
            for (const existingDrop of uniqueDrops) {
              const xDiff = Math.abs(drop.x - existingDrop.x);
              const xDiffPercent = (xDiff / xSpan) * 100;
              
              // If within 10% X-distance, consider it the same irrigation event
              if (xDiffPercent < 10) {
                isDuplicate = true;
                // Keep the one with bigger drop
                if (drop.dropAmount > existingDrop.dropAmount) {
                  uniqueDrops[uniqueDrops.indexOf(existingDrop)] = drop;
                }
                break;
              }
            }
            
            if (!isDuplicate) {
              uniqueDrops.push(drop);
            }
          }
          
          console.log(`🎯 [BROWSER] After de-duplication: ${uniqueDrops.length} unique irrigation events`);
          if (drops.length > uniqueDrops.length) {
            console.log(`   → Removed ${drops.length - uniqueDrops.length} duplicate drops`);
          }
          
          // Sort by X position (time order - left to right)
          uniqueDrops.sort((a, b) => a.x - b.x);
          
          // For each drop, find START (before drop) and END (after recovery)
          const irrigationEvents = [];
          
          for (let dIdx = 0; dIdx < uniqueDrops.length; dIdx++) {
            const drop = uniqueDrops[dIdx];
            const dropIndex = drop.index;
            
            // 1. Find START: Look backwards to find where water level was HIGH (before irrigation)
            let startIndex = dropIndex;
            let highestYBefore = drop.y;
            
            for (let j = dropIndex - 1; j >= Math.max(0, dropIndex - 20); j--) {
              const currentY = smoothedY[j];
              if (currentY < highestYBefore) {
                highestYBefore = currentY;
                startIndex = j;
              }
            }
            
            // 2. Find END: Look forward to find where water level RECOVERS (after irrigation)
            let endIndex = dropIndex;
            let highestYAfter = drop.y;
            
            for (let j = dropIndex + 1; j < Math.min(finalCoords.length, dropIndex + 30); j++) {
              const currentY = smoothedY[j];
              // Find where water level is high again (recovered from irrigation)
              if (currentY < highestYAfter) {
                highestYAfter = currentY;
                endIndex = j;
              }
            }
            
            // Validate
            const startValid = startIndex < dropIndex;
            const endValid = endIndex > dropIndex;
            
            if (startValid && endValid) {
              irrigationEvents.push({
                startIndex: startIndex,
                startX: finalCoords[startIndex].x,
                startY: finalCoords[startIndex].y,
                endIndex: endIndex,
                endX: finalCoords[endIndex].x,
                endY: finalCoords[endIndex].y,
                dropAmount: drop.dropAmount,
                dropPercent: drop.dropPercent
              });
              
              console.log(`✅ [BROWSER] Irrigation ${dIdx + 1}: Start idx=${startIndex} (X=${Math.round(finalCoords[startIndex].x)}), End idx=${endIndex} (X=${Math.round(finalCoords[endIndex].x)}), drop=${drop.dropPercent}%`);
            } else {
              console.log(`⚠️ [BROWSER] Irrigation ${dIdx + 1}: Could not find valid start/end points, skipping`);
            }
          }
          
          results.push({
            message: `Found ${irrigationEvents.length} valid irrigation events with start/end points`
          });
          
          if (irrigationEvents.length === 0) {
            console.error('❌ [BROWSER] No valid irrigation events found');
            return {
              needsFirstClick: false,
              needsLastClick: false,
              error: 'No valid irrigation events',
              debug: results
            };
          }
          
          // FIRST irrigation = START of first event
          // LAST irrigation = END of last event
          const firstEvent = irrigationEvents[0];
          const lastEvent = irrigationEvents[irrigationEvents.length - 1];
          
          const spikes = [
            {
              index: firstEvent.startIndex,
              x: firstEvent.startX,
              y: firstEvent.startY,
              dropAmount: firstEvent.dropAmount,
              dropPercent: firstEvent.dropPercent,
              type: 'FIRST_START'
            },
            {
              index: lastEvent.endIndex,
              x: lastEvent.endX,
              y: lastEvent.endY,
              dropAmount: lastEvent.dropAmount,
              dropPercent: lastEvent.dropPercent,
              type: 'LAST_END'
            }
          ];
          
          console.log(`📌 [BROWSER] Using FIRST irrigation START (idx=${firstEvent.startIndex}) and LAST irrigation END (idx=${lastEvent.endIndex})`);
          
          
          // Get chart container for coordinate conversion
          const chartContainer = document.querySelector('.highcharts-container');
          const containerRect = chartContainer.getBoundingClientRect();
          
          const firstPoint = spikes[0]; // FIRST irrigation START
          const lastPoint = spikes[1]; // LAST irrigation END
          
          // Calculate X-axis separation between first start and last end
          const xSeparation = Math.abs(lastPoint.x - firstPoint.x);
          const totalXRange = finalCoords[finalCoords.length - 1].x - finalCoords[0].x;
          const separationPercent = (xSeparation / totalXRange) * 100;
          
          console.log(`📊 [BROWSER] First (START) vs Last (END) separation: ${Math.round(separationPercent)}%`);
          
          // IMPORTANT: Click ABOVE the line (lower Y) to hit Highcharts clickable area
          const clickOffsetY = 15; // pixels above the chart line
          
          results.push({
            message: `Selecting: FIRST START at idx=${firstPoint.index}, LAST END at idx=${lastPoint.index}`
          });
          
          results.push({
            message: `Separation: ${Math.round(xSeparation)}px (${Math.round(separationPercent)}% of chart)`
          });
          console.log(`📏 [BROWSER] First-Last separation: ${Math.round(xSeparation)}px (${Math.round(separationPercent)}% of chart)`);
          
          results.push({ 
            message: `Click offset: ${clickOffsetY}px ABOVE chart line (Highcharts clickable area)`
          });
          
          // Convert SVG coordinates to screen coordinates
          const firstX = containerRect.left + firstPoint.x;
          const firstY = containerRect.top + firstPoint.y - clickOffsetY;
          const lastX = containerRect.left + lastPoint.x;
          const lastY = containerRect.top + lastPoint.y - clickOffsetY;
          
          console.log(`🎯 [BROWSER] Final click coordinates:`);
          console.log(`   → FIRST (START): idx=${firstPoint.index} Screen(${Math.round(firstX)}, ${Math.round(firstY)}) SVG(${Math.round(firstPoint.x)}, ${Math.round(firstPoint.y)})`);
          console.log(`   → LAST (END): idx=${lastPoint.index} Screen(${Math.round(lastX)}, ${Math.round(lastY)}) SVG(${Math.round(lastPoint.x)}, ${Math.round(lastPoint.y)})`);
          
          // Return coordinates for Playwright to click
          // ALWAYS click both points - they are different (START vs END)
          return {
            needsFirstClick: needs.needsFirstClick,
            needsLastClick: needs.needsLastClick, // Always click last - it's different from first
            firstCoords: needs.needsFirstClick ? { 
              x: Math.round(firstX), 
              y: Math.round(firstY), 
              svgX: Math.round(firstPoint.x), 
              svgY: Math.round(firstPoint.y), 
              drop: firstPoint.dropAmount,
              type: 'START'
            } : null,
            lastCoords: needs.needsLastClick ? { 
              x: Math.round(lastX), 
              y: Math.round(lastY), 
              svgX: Math.round(lastPoint.x), 
              svgY: Math.round(lastPoint.y), 
              drop: lastPoint.dropAmount,
              type: 'END'
            } : null,
            singleEvent: false, // Never single - we have START and END
            separationPercent: Math.round(separationPercent),
            debug: results
          };
            
            return results;
          }, tableStatus);
          
        // Check if HSSP detection failed
        if (clickResults.error) {
          console.log(`     ⚠️  HSSP detection failed: ${clickResults.error}`);
          console.log(`        → No irrigation points found for this date`);
          console.log(`        → Tables will remain empty\n`);
          
          // Store empty data
          const dateData = {
            date: displayedDate,
            firstIrrigationTime: null,
            lastIrrigationTime: null,
            extractedAt: new Date().toISOString(),
            error: clickResults.error
          };
          farmDateData.push(dateData);
          
          // Take screenshot
          const errorScreenshot = path.join(CONFIG.screenshotDir, `farm-${farmIdx + 1}-date-${dateIdx}-no-data-${timestamp}.png`);
          await page.screenshot({ path: errorScreenshot, fullPage: true });
          console.log(`     📸 Screenshot: ${errorScreenshot}\n`);
          
          // Move to next date
          if (dayOffset < totalDaysToCheck - 1) {
            const nextClicked = await page.evaluate(() => {
              const nextButton = document.querySelector('button[aria-label="다음 기간"]');
              if (nextButton) { nextButton.click(); return true; }
              return false;
            });
            if (nextClicked) {
              console.log(`     ⏭️  Moving to next date...\n`);
              await page.waitForTimeout(2000);
            }
          }
          continue; // Skip to next date
        }
        
        // Display debug info
        if (clickResults.debug) {
          clickResults.debug.forEach(msg => {
            if (msg.message) console.log(`     → ${msg.message}`);
          });
        }
        
        // Show separation info
        if (clickResults.separationPercent !== undefined) {
          console.log(`     ✅ First (START) and Last (END) separated by ${clickResults.separationPercent}% of chart`);
        }
        
        // CHART LEARNING MODE: Show detected points and allow user correction
        if (CONFIG.chartLearningMode && clickResults.firstCoords && clickResults.lastCoords) {
          console.log(`\n     🎓 CHART LEARNING MODE ACTIVE`);
          console.log(`        Algorithm will click at:`);
          console.log(`        → FIRST: Screen(${clickResults.firstCoords.x}, ${clickResults.firstCoords.y})`);
          console.log(`        → LAST: Screen(${clickResults.lastCoords.x}, ${clickResults.lastCoords.y})`);
          
          // Take screenshot BEFORE showing markers
          const beforeScreenshot = path.join(CONFIG.screenshotDir, `learning-before-${Date.now()}.png`);
          await page.screenshot({ path: beforeScreenshot, fullPage: false });
          console.log(`        📸 Chart screenshot: ${beforeScreenshot}`);
          
          // Draw BIG visible indicators on the page using HTML overlays
          await page.evaluate((first, last) => {
            // Create overlay container
            const overlay = document.createElement('div');
            overlay.id = 'learning-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 999999;';
            
            // Draw FIRST point marker (GREEN)
            const firstMarker = document.createElement('div');
            firstMarker.style.cssText = `
              position: absolute;
              left: ${first.x - 30}px;
              top: ${first.y - 30}px;
              width: 60px;
              height: 60px;
              border: 5px solid lime;
              border-radius: 50%;
              background: rgba(0, 255, 0, 0.2);
              pointer-events: none;
              animation: pulse 1s infinite;
            `;
            
            // Add label
            const firstLabel = document.createElement('div');
            firstLabel.textContent = 'FIRST';
            firstLabel.style.cssText = `
              position: absolute;
              left: ${first.x - 30}px;
              top: ${first.y - 50}px;
              background: lime;
              color: black;
              padding: 5px 10px;
              border-radius: 5px;
              font-weight: bold;
              font-size: 14px;
              pointer-events: none;
            `;
            
            // Draw LAST point marker (RED)
            const lastMarker = document.createElement('div');
            lastMarker.style.cssText = `
              position: absolute;
              left: ${last.x - 30}px;
              top: ${last.y - 30}px;
              width: 60px;
              height: 60px;
              border: 5px solid red;
              border-radius: 50%;
              background: rgba(255, 0, 0, 0.2);
              pointer-events: none;
              animation: pulse 1s infinite;
            `;
            
            // Add label
            const lastLabel = document.createElement('div');
            lastLabel.textContent = 'LAST';
            lastLabel.style.cssText = `
              position: absolute;
              left: ${last.x - 30}px;
              top: ${last.y - 50}px;
              background: red;
              color: white;
              padding: 5px 10px;
              border-radius: 5px;
              font-weight: bold;
              font-size: 14px;
              pointer-events: none;
            `;
            
            // Add pulsing animation
            const style = document.createElement('style');
            style.textContent = `
              @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.2); opacity: 0.7; }
              }
            `;
            
            document.head.appendChild(style);
            overlay.appendChild(firstMarker);
            overlay.appendChild(firstLabel);
            overlay.appendChild(lastMarker);
            overlay.appendChild(lastLabel);
            document.body.appendChild(overlay);
            
            // Setup click recorder
            window.learningClicks = [];
            const clickHandler = (e) => {
              window.learningClicks.push({
                svgX: e.clientX,
                svgY: e.clientY,
                screenX: e.clientX,
                screenY: e.clientY
              });
              
              // Visual feedback for user clicks
              const userMarker = document.createElement('div');
              userMarker.style.cssText = `
                position: absolute;
                left: ${e.clientX - 20}px;
                top: ${e.clientY - 20}px;
                width: 40px;
                height: 40px;
                border: 4px solid ${window.learningClicks.length === 1 ? 'yellow' : 'orange'};
                border-radius: 50%;
                background: rgba(255, 255, 0, 0.3);
                pointer-events: none;
                z-index: 999999;
              `;
              overlay.appendChild(userMarker);
              
              console.log(`✅ [BROWSER] Recorded user click #${window.learningClicks.length}: (${Math.round(e.clientX)}, ${Math.round(e.clientY)})`);
            };
            document.addEventListener('click', clickHandler, true);
            window.removeClickHandler = () => {
              document.removeEventListener('click', clickHandler, true);
              if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
              }
            };
          }, clickResults.firstCoords, clickResults.lastCoords);
          
          await page.waitForTimeout(1000); // Let markers appear
          
          console.log(`\n        🟢 LOOK AT THE BROWSER!`);
          console.log(`        → Green pulsing circle = Algorithm's FIRST point`);
          console.log(`        → Red pulsing circle = Algorithm's LAST point`);
          console.log(`\n        📋 OPTIONS:`);
          console.log(`        1. If CORRECT → Just wait 30 seconds (auto-continue)`);
          console.log(`        2. If WRONG → Click correct FIRST, then LAST, then wait`);
          console.log(`           (Yellow circle = your FIRST, Orange = your LAST)\n`);
          
          // Wait 30 seconds for user to make corrections
          console.log(`        ⏱️  Waiting 30 seconds for corrections...`);
          await page.waitForTimeout(30000);
          
          // Collect user corrections
          const userCorrections = await page.evaluate(() => {
            const clicks = window.learningClicks || [];
            if (window.removeClickHandler) window.removeClickHandler();
            return clicks;
          });
          
          // Save training data
          const trainingEntry = {
            timestamp: new Date().toISOString(),
            date: displayedDate,
            farm: currentFarm.name,
            algorithmDetection: {
              first: { svgX: clickResults.firstCoords.svgX, svgY: clickResults.firstCoords.svgY },
              last: { svgX: clickResults.lastCoords.svgX, svgY: clickResults.lastCoords.svgY }
            },
            userCorrections: userCorrections.length > 0 ? {
              first: userCorrections[0] || null,
              last: userCorrections[1] || null
            } : null,
            feedback: userCorrections.length === 0 ? 'User accepted algorithm detection' : `User made ${userCorrections.length} corrections`
          };
          
          // Append to training file
          let trainingData = [];
          if (fs.existsSync(TRAINING_FILE)) {
            trainingData = JSON.parse(fs.readFileSync(TRAINING_FILE));
          }
          trainingData.push(trainingEntry);
          fs.writeFileSync(TRAINING_FILE, JSON.stringify(trainingData, null, 2));
          
          if (userCorrections.length > 0) {
            console.log(`\n     📝 Recorded ${userCorrections.length} user corrections`);
            console.log(`        Saved to training/training-data.json`);
            
            // Calculate differences
            if (userCorrections.length >= 1) {
              const firstDiffX = userCorrections[0].svgX - clickResults.firstCoords.svgX;
              const firstDiffY = userCorrections[0].svgY - clickResults.firstCoords.svgY;
              console.log(`        First point offset: X=${Math.round(firstDiffX)}px, Y=${Math.round(firstDiffY)}px`);
            }
            if (userCorrections.length >= 2) {
              const lastDiffX = userCorrections[1].svgX - clickResults.lastCoords.svgX;
              const lastDiffY = userCorrections[1].svgY - clickResults.lastCoords.svgY;
              console.log(`        Last point offset: X=${Math.round(lastDiffX)}px, Y=${Math.round(lastDiffY)}px\n`);
            }
          } else {
            console.log(`\n     ✅ User accepted algorithm detection (no corrections)\n`);
          }
        }
        
        // Now perform REAL Playwright mouse clicks for more reliable interaction
        if (clickResults.needsFirstClick && clickResults.firstCoords) {
          let coords = clickResults.firstCoords;
          
          // Apply learned corrections if available
          if (learnedOffsets.count > 0 && !CONFIG.chartLearningMode) {
            const correctedX = coords.x + learnedOffsets.firstX;
            const correctedY = coords.y + learnedOffsets.firstY;
            console.log(`     🎓 Applying learned correction: (${learnedOffsets.firstX.toFixed(1)}, ${learnedOffsets.firstY.toFixed(1)})`);
            coords = { ...coords, x: Math.round(correctedX), y: Math.round(correctedY) };
          }
          
          console.log(`     ✅ Clicking FIRST irrigation time (START of irrigation)`);
          console.log(`        → Screen Coord: (${coords.x}, ${coords.y}) - 15px ABOVE line`);
          console.log(`        → SVG Line Coord: (${coords.svgX}, ${coords.svgY})`);
          console.log(`        → Type: ${coords.type || 'START'}`);
          
          // Focus first input field
          await page.click('input[type="time"]:nth-of-type(1)');
          await page.waitForTimeout(500);
          
          // Click chart with Playwright mouse
          await page.mouse.click(coords.x, coords.y);
          await page.waitForTimeout(3000); // Wait for UI to update before second click
        }
        
        if (clickResults.needsLastClick && clickResults.lastCoords) {
          let coords = clickResults.lastCoords;
          
          // Apply learned corrections if available
          if (learnedOffsets.count > 0 && !CONFIG.chartLearningMode) {
            const correctedX = coords.x + learnedOffsets.lastX;
            const correctedY = coords.y + learnedOffsets.lastY;
            console.log(`     🎓 Applying learned correction: (${learnedOffsets.lastX.toFixed(1)}, ${learnedOffsets.lastY.toFixed(1)})`);
            coords = { ...coords, x: Math.round(correctedX), y: Math.round(correctedY) };
          }
          
          console.log(`     ✅ Clicking LAST irrigation time (END of irrigation)`);
          console.log(`        → Screen Coord: (${coords.x}, ${coords.y}) - 15px ABOVE line`);
          console.log(`        → SVG Line Coord: (${coords.svgX}, ${coords.svgY})`);
          console.log(`        → Type: ${coords.type || 'END'}`);
          
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
          console.log('     ✅ Some tables already have data, minimal clicks needed\n');
        }
        
        // Wait for UI to fully update after clicks
        await page.waitForTimeout(4000);
        
        // Take screenshot after clicking
        const step6Screenshot = path.join(CONFIG.screenshotDir, `farm-${farmIdx + 1}-date-${dateIdx}-after-clicks-${timestamp}.png`);
        await page.screenshot({ path: step6Screenshot, fullPage: true });
        console.log(`     📸 Screenshot: ${step6Screenshot}\n`);
        
        // Extract final table values
        console.log('     📊 Extracting irrigation data from tables...');
      
      // Wait a moment for tables to update after clicks
      await page.waitForTimeout(3000);
      
      const finalData = await page.evaluate(() => {
        const results = {
          firstIrrigationTime: null,
          lastIrrigationTime: null,
          debug: []
        };
        
        console.log('📊 [BROWSER] Extracting irrigation time data from tables...');
        
        // Strategy 1: Look for time input fields (type="time")
        const timeInputs = Array.from(document.querySelectorAll('input[type="time"]'));
        results.debug.push(`Found ${timeInputs.length} time input fields`);
        console.log(`📊 [BROWSER] Found ${timeInputs.length} time input fields`);
        
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
              console.log(`✅ [BROWSER] Found FIRST irrigation time: "${value}"`);
            }
            // Check if this is the "last irrigation time" field
            else if (containerText.includes('마지막 급액') || containerText.includes('마지막급액')) {
              results.lastIrrigationTime = value;
              results.debug.push(`✅ Matched LAST time: "${value}"`);
              console.log(`✅ [BROWSER] Found LAST irrigation time: "${value}"`);
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
        
        console.log('📋 [BROWSER] Extraction complete:');
        console.log(`   → First time: ${results.firstIrrigationTime || 'NOT FOUND'}`);
        console.log(`   → Last time: ${results.lastIrrigationTime || 'NOT FOUND'}`);
        
        return results;
      });
      
        console.log(`  → Debug info: ${finalData.debug.join(' | ')}`);
        console.log(`  → 첫 급액시간 1: ${finalData.firstIrrigationTime || 'NOT FOUND'}`);
        console.log(`  → 마지막 급액시간 1: ${finalData.lastIrrigationTime || 'NOT FOUND'}\n`);
        
        // Add this date's data to collection
        const dateData = {
          date: displayedDate,
          firstIrrigationTime: finalData.firstIrrigationTime || null,
          lastIrrigationTime: finalData.lastIrrigationTime || null,
          extractedAt: new Date().toISOString()
        };
        farmDateData.push(dateData);
        
        if (finalData.firstIrrigationTime || finalData.lastIrrigationTime) {
          console.log(`     ✅ Data collected for ${displayedDate}\n`);
        } else {
          console.log(`     ⚠️  No irrigation time data found for this date\n`);
        }
        
      } catch (error) {
        console.log(`     ⚠️  Error in data extraction: ${error.message}\n`);
      }
      
      // Take screenshot after processing this date
      const dateScreenshot = path.join(CONFIG.screenshotDir, `farm-${farmIdx + 1}-date-${dateIdx}-${timestamp}.png`);
      await page.screenshot({ path: dateScreenshot, fullPage: true });
      console.log(`     📸 Screenshot: ${dateScreenshot}\n`);
      
      // Move to next date using "Next period" button (except for last date)
      if (dayOffset < totalDaysToCheck - 1) {
        console.log(`     ⏭️  Moving to next date...`);
        const nextClicked = await page.evaluate(() => {
          const nextButton = document.querySelector('button[aria-label="다음 기간"]');
          if (nextButton) {
            nextButton.click();
            console.log(`✅ [BROWSER] Clicked "Next period" button`);
            return true;
          }
          console.error('❌ [BROWSER] Next period button not found');
          return false;
        });
        
        if (nextClicked) {
          console.log(`     ✅ Moved to next date`);
          await page.waitForTimeout(2000); // Wait for chart to update
        } else {
          console.log(`     ⚠️  Could not find "Next period" button`);
        }
      }
      
    } // End date loop
    
    // Add all dates data for this farm to collection
    const farmData = {
      farmName: currentFarm.name,
      farmIndex: farmIdx + 1,
      totalDates: farmDateData.length,
      datesWithData: farmDateData.filter(d => d.firstIrrigationTime || d.lastIrrigationTime).length,
      dates: farmDateData
    };
    allFarmData.push(farmData);
    
    console.log(`\n  ✅ Completed all dates for farm "${currentFarm.name}"`);
    console.log(`     → Processed ${farmDateData.length} dates`);
    console.log(`     → Data found for ${farmData.datesWithData} dates\n`);
      
    } // End farm loop
    
    // Save all collected farm data
    console.log('\n💾 Saving all farm data...');
    const allDataFile = path.join(CONFIG.outputDir, `all-farms-data-${timestamp}.json`);
    const summaryData = {
      extractedAt: new Date().toISOString(),
      manager: CONFIG.targetName,
      dateRange: {
        description: '5 days ago to today',
        totalDays: totalDaysToCheck,
        method: 'Previous/Next period buttons'
      },
      totalFarms: allFarmData.length,
      farmsWithData: allFarmData.filter(f => f.datesWithData > 0).length,
      totalDatesProcessed: allFarmData.reduce((sum, f) => sum + f.totalDates, 0),
      totalDatesWithData: allFarmData.reduce((sum, f) => sum + f.datesWithData, 0),
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
      const status = farm.datesWithData > 0 ? '✅' : '⚠️';
      console.log(`   ${status} [${idx + 1}] ${farm.farmName}`);
      console.log(`      Dates processed: ${farm.totalDates} | Data found: ${farm.datesWithData}`);
      
      // Show first few dates as examples
      const sampleDates = farm.dates.slice(0, 3);
      sampleDates.forEach((dateData, dIdx) => {
        const first = dateData.firstIrrigationTime || '--:--';
        const last = dateData.lastIrrigationTime || '--:--';
        const dateStatus = (dateData.firstIrrigationTime || dateData.lastIrrigationTime) ? '✓' : '✗';
        console.log(`        ${dateStatus} ${dateData.date}: First ${first} | Last ${last}`);
      });
      
      if (farm.dates.length > 3) {
        console.log(`        ... and ${farm.dates.length - 3} more dates`);
      }
    });
    
    console.log('\n📋 What Was Accomplished:');
    console.log('   1. ✅ Navigated to report page');
    console.log('   2. ✅ Selected "승진" manager');
    console.log(`   3. ✅ Processed ${allFarmData.length} farms`);
    console.log(`   4. ✅ Checked ${summaryData.dateRange.totalDays} days per farm (last 5 days)`);
    console.log(`   5. ✅ Total dates processed: ${summaryData.totalDatesProcessed}`);
    console.log(`   6. ✅ Dates with data: ${summaryData.totalDatesWithData}`);
    console.log('   7. ✅ Skipped dates with pre-filled tables (efficient!)');
    console.log('   8. ✅ Used HSSP algorithm for irrigation point detection');
    console.log('   9. ✅ Extracted data and saved to JSON');
    console.log('   10. ✅ Captured screenshots of the process\n');
    
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
    // Keep browser open for inspection
    console.log('\n🔚 Automation complete. Browser will stay open for inspection...');
    console.log('   → Check the browser DevTools Console tab to see webpage logs');
    console.log('   → Close the browser manually when done\n');
    // await browser.close(); // Commented out - close manually to inspect results
  }
}

// Run the automation
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

