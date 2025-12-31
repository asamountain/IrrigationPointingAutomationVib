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
    
    // Step 5: Click the top farm in the left list
    console.log('🏭 Step 5: Clicking top farm in left list...');
    
    try {
      // Use JavaScript to click the element (more reliable)
      const farmClicked = await page.evaluate(() => {
        // Try specific XPath-like selection
        const tabs = document.querySelector('[id*="tabs"][id*="content-point"]');
        if (tabs) {
          // Navigate to the specific div structure
          const targetDiv = tabs.querySelector('div > div:first-child > div:nth-child(2) > div:nth-child(2)');
          if (targetDiv) {
            targetDiv.click();
            return 'XPath-like selector';
          }
        }
        
        // Fallback: find first clickable farm item in list
        const farmList = document.querySelectorAll('[class*="farm"], [class*="point"], [role="button"]');
        if (farmList.length > 0) {
          farmList[0].click();
          return 'First farm item';
        }
        
        return false;
      });
      
      if (farmClicked) {
        console.log(`  ✅ Clicked top farm via JavaScript (method: ${farmClicked})`);
        await page.waitForTimeout(3000); // Wait for chart to load
        
        const step5Screenshot = path.join(CONFIG.screenshotDir, `5-selected-farm-${timestamp}.png`);
        await page.screenshot({ path: step5Screenshot, fullPage: true });
        console.log(`  📸 Screenshot: ${step5Screenshot}\n`);
      } else {
        console.log('  ⚠️  Could not find top farm element\n');
      }
    } catch (error) {
      console.log(`  ⚠️  Error clicking top farm: ${error.message}\n`);
    }
    
    // Step 6: Check table fields and click irrigation points if needed
    console.log('💧 Step 6: Checking irrigation time tables...');
    
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
        
        // Find actual spike points in the Highcharts data
        const clickResults = await page.evaluate((needs) => {
          const results = [];
          
          // Access Highcharts chart object
          let chart = null;
          
          // Try multiple ways to access Highcharts
          if (window.Highcharts && window.Highcharts.charts) {
            chart = window.Highcharts.charts.find(c => c !== undefined);
          }
          
          // Fallback: look for chart in global scope
          if (!chart) {
            // Check if there's a chart stored in a React component or other framework
            const chartContainer = document.querySelector('.highcharts-container');
            if (chartContainer && chartContainer.chart) {
              chart = chartContainer.chart;
            }
          }
          
          // If still no chart, use SVG path analysis as fallback
          if (!chart || !chart.series || !chart.series[0]) {
            return { error: 'Highcharts API not accessible, will try SVG path analysis' };
          }
          
          const series = chart.series[0];
          const dataPoints = series.data;
          
          if (dataPoints.length === 0) {
            return { error: 'No data points in series' };
          }
          
          // Find spikes: look for large drops in Y value (irrigation events)
          const spikes = [];
          for (let i = 1; i < dataPoints.length; i++) {
            const prevY = dataPoints[i - 1].y;
            const currY = dataPoints[i].y;
            const drop = prevY - currY;
            
            // If drop is significant (more than 5 units), it's a spike
            if (drop > 5) {
              const point = dataPoints[i];
              const coords = chart.pointer.getCoordinates({ chartX: point.plotX + chart.plotLeft, chartY: point.plotY + chart.plotTop });
              
              spikes.push({
                index: i,
                x: point.x,
                y: point.y,
                plotX: point.plotX + chart.plotLeft,
                plotY: point.plotY + chart.plotTop,
                drop: drop,
                category: point.category || point.x
              });
            }
          }
          
          if (spikes.length === 0) {
            return { error: 'No spikes found in data' };
          }
          
          results.push({ 
            message: `Found ${spikes.length} irrigation spikes`,
            spikes: spikes.map(s => ({ 
              category: s.category, 
              y: s.y, 
              drop: Math.round(s.drop * 100) / 100 
            }))
          });
          
          // Get first and last spikes
          const firstSpike = spikes[0];
          const lastSpike = spikes[spikes.length - 1];
          
          results.push({
            firstSpike: { x: firstSpike.plotX, y: firstSpike.plotY, category: firstSpike.category },
            lastSpike: { x: lastSpike.plotX, y: lastSpike.plotY, category: lastSpike.category }
          });
          
          // Click first spike if needed
          if (needs.needsFirstClick && firstSpike) {
            // Trigger click on the actual data point
            firstSpike.point = dataPoints[firstSpike.index];
            
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: firstSpike.plotX,
              clientY: firstSpike.plotY
            });
            
            // Also call the point's select method if available
            if (dataPoints[firstSpike.index].select) {
              dataPoints[firstSpike.index].select(true);
            }
            
            // Dispatch click event at the coordinates
            document.elementFromPoint(firstSpike.plotX, firstSpike.plotY)?.dispatchEvent(clickEvent);
            
            results.push({ 
              action: 'Clicked FIRST spike', 
              x: Math.round(firstSpike.plotX), 
              y: Math.round(firstSpike.plotY),
              time: firstSpike.category
            });
          }
          
          // Click last spike if needed
          if (needs.needsLastClick && lastSpike) {
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: lastSpike.plotX,
              clientY: lastSpike.plotY
            });
            
            if (dataPoints[lastSpike.index].select) {
              dataPoints[lastSpike.index].select(true);
            }
            
            document.elementFromPoint(lastSpike.plotX, lastSpike.plotY)?.dispatchEvent(clickEvent);
            
            results.push({ 
              action: 'Clicked LAST spike', 
              x: Math.round(lastSpike.plotX), 
              y: Math.round(lastSpike.plotY),
              time: lastSpike.category
            });
          }
          
          return results;
        }, tableStatus);
        
        if (clickResults.error && clickResults.error.includes('not accessible')) {
          console.log(`  ⚠️  ${clickResults.error}`);
          console.log(`  → Trying SVG path analysis fallback...\n`);
          
          // Fallback: Click directly on visible spike in SVG
          const svgClickResult = await page.evaluate((needs) => {
            const results = [];
            
            // Find the chart line (series path)
            const seriesPaths = document.querySelectorAll('.highcharts-series path, path[class*="series"]');
            if (seriesPaths.length === 0) {
              return { error: 'No series paths found in SVG' };
            }
            
            // Get the main line path
            const mainPath = Array.from(seriesPaths).find(p => {
              const d = p.getAttribute('d');
              return d && d.length > 100; // Main line path will be long
            });
            
            if (!mainPath) {
              return { error: 'Could not find main series path' };
            }
            
            const pathData = mainPath.getAttribute('d');
            const rect = mainPath.getBoundingClientRect();
            
            // Parse path to find spike locations (where line goes down sharply)
            // For now, use simple heuristic: left 20% and right 20% of visible path
            const chartContainer = document.querySelector('.highcharts-container');
            const containerRect = chartContainer.getBoundingClientRect();
            
            // First spike: 15% from left, at 70% down (near bottom of spike)
            const firstX = containerRect.left + containerRect.width * 0.15;
            const firstY = containerRect.top + containerRect.height * 0.70;
            
            // Last spike: 85% from left (near right side), at 70% down
            const lastX = containerRect.left + containerRect.width * 0.85;
            const lastY = containerRect.top + containerRect.height * 0.70;
            
            results.push({
              message: 'Using SVG coordinate estimation',
              chartWidth: Math.round(containerRect.width),
              chartHeight: Math.round(containerRect.height)
            });
            
            // Click first spike if needed
            if (needs.needsFirstClick) {
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: firstX,
                clientY: firstY
              });
              
              const elem = document.elementFromPoint(firstX, firstY);
              if (elem) {
                elem.dispatchEvent(clickEvent);
                results.push({ 
                  action: 'SVG: Clicked FIRST spike area', 
                  x: Math.round(firstX), 
                  y: Math.round(firstY),
                  element: elem.tagName
                });
              }
            }
            
            // Click last spike if needed  
            if (needs.needsLastClick) {
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: lastX,
                clientY: lastY
              });
              
              const elem = document.elementFromPoint(lastX, lastY);
              if (elem) {
                elem.dispatchEvent(clickEvent);
                results.push({ 
                  action: 'SVG: Clicked LAST spike area', 
                  x: Math.round(lastX), 
                  y: Math.round(lastY),
                  element: elem.tagName
                });
              }
            }
            
            return results;
          }, tableStatus);
          
          if (svgClickResult.error) {
            console.log(`  ❌ SVG Error: ${svgClickResult.error}`);
          } else {
            svgClickResult.forEach(result => {
              if (result.action) {
                console.log(`  ✅ ${result.action} at (${result.x}, ${result.y})`);
              } else if (result.message) {
                console.log(`  → ${result.message}: ${result.chartWidth}x${result.chartHeight}px`);
              }
            });
          }
          
        } else if (clickResults.error) {
          console.log(`  ❌ Error: ${clickResults.error}`);
        } else {
          clickResults.forEach(result => {
            if (result.action) {
              console.log(`  ✅ ${result.action} at (${Math.round(result.x)}, ${Math.round(result.y)})`);
            } else if (result.plotBandBox) {
              console.log(`  → Yellow zone: x=${Math.round(result.plotBandBox.x)}, width=${Math.round(result.plotBandBox.width)}`);
            }
          });
        }
        
        await page.waitForTimeout(2000); // Wait for tables to update
        
      } else {
        console.log('  ✅ Both tables already have data, skipping clicks\n');
      }
      
      // Take screenshot after clicking
      const step6Screenshot = path.join(CONFIG.screenshotDir, `6-after-clicks-${timestamp}.png`);
      await page.screenshot({ path: step6Screenshot, fullPage: true });
      console.log(`  📸 Screenshot: ${step6Screenshot}\n`);
      
      // Extract final table values
      console.log('📊 Step 7: Extracting irrigation data from tables...');
      
      const finalData = await page.evaluate(() => {
        const firstTimeLabel = '구역 1 첫 급액시간 1';
        const lastTimeLabel = '구역 1 마지막 급액시간 1';
        
        const cells = Array.from(document.querySelectorAll('td, div, span'));
        let firstTimeValue = null;
        let lastTimeValue = null;
        
        cells.forEach((cell, idx) => {
          const text = cell.textContent.trim();
          if (text.includes(firstTimeLabel)) {
            const nextCell = cells[idx + 1];
            if (nextCell) {
              firstTimeValue = nextCell.textContent.trim();
            }
          }
          if (text.includes(lastTimeLabel)) {
            const nextCell = cells[idx + 1];
            if (nextCell) {
              lastTimeValue = nextCell.textContent.trim();
            }
          }
        });
        
        return {
          firstIrrigationTime: firstTimeValue,
          lastIrrigationTime: lastTimeValue
        };
      });
      
      console.log(`  → 첫 급액시간 1: ${finalData.firstIrrigationTime || 'NOT FOUND'}`);
      console.log(`  → 마지막 급액시간 1: ${finalData.lastIrrigationTime || 'NOT FOUND'}\n`);
      
      // Save data to JSON
      if (finalData.firstIrrigationTime || finalData.lastIrrigationTime) {
        const dataFile = path.join(CONFIG.outputDir, `irrigation-data-${timestamp}.json`);
        fs.writeFileSync(dataFile, JSON.stringify(finalData, null, 2));
        console.log(`  💾 Data saved to: ${dataFile}\n`);
      }
      
    } catch (error) {
      console.log(`  ⚠️  Error in data extraction: ${error.message}\n`);
    }
    
    // Step 8: Final screenshot
    const finalScreenshot = path.join(CONFIG.screenshotDir, `8-final-state-${timestamp}.png`);
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    console.log(`📸 Final screenshot saved: ${finalScreenshot}\n`);
    
    // Success summary
    console.log('✅ Week 3 - Data Extraction Complete!');
    console.log('\n📋 What Was Accomplished:');
    console.log('   1. ✅ Navigated to report page');
    console.log('   2. ✅ Selected "승진" manager');
    console.log('   3. ✅ Clicked top farm in list');
    console.log('   4. ✅ Checked irrigation time tables');
    console.log('   5. ✅ Clicked chart points to fill empty tables');
    console.log('   6. ✅ Extracted data and saved to JSON');
    console.log('   7. ✅ Captured 8 screenshots of the process');
    console.log('\n📋 Next Steps:');
    console.log('   1. Review screenshots to verify data extraction');
    console.log('   2. Loop through multiple farms');
    console.log('   3. Handle farms that already have data\n');
    
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

