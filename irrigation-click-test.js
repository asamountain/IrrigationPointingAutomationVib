/**
 * Irrigation Report Automation - Starter Script
 * Purpose: Automate data extraction from admin.iocrops.com 관수리포트 menu
 * 
 * Week 1 Goal: Proof of Concept - Navigate and screenshot
 */

import { browser } from 'vibium';
import fs from 'fs';
import path from 'path';

// Configuration (move to config.js later)
const CONFIG = {
  url: 'https://admin.iocrops.com',
  username: 'YOUR_USERNAME', // TODO: Replace with your actual username
  password: 'YOUR_PASSWORD', // TODO: Replace with your actual password
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
  console.log('🚀 Starting Irrigation Report Automation...\n');
  
  // Launch browser with Vibium
  const vibe = await browser.launch({ headless: false });
  
  try {
    // Step 1: Navigate to IoTCrops admin
    console.log('📍 Step 1: Navigating to admin.iocrops.com...');
    await vibe.go(CONFIG.url);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page load
    
    // Take screenshot to verify we're on the right page
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const screenshotPath = path.join(CONFIG.screenshotDir, `1-homepage-${timestamp}.png`);
    const screenshot1 = await vibe.screenshot();
    fs.writeFileSync(screenshotPath, screenshot1);
    console.log(`✅ Homepage loaded. Screenshot saved: ${screenshotPath}\n`);
    
    // Step 2: Login
    console.log('🔐 Step 2: Attempting login...');
    
    // TODO: Inspect admin.iocrops.com to find the actual login form selectors
    // Common selectors to try (you'll need to verify these):
    // - input[type="text"], input[name="username"], #username
    // - input[type="password"], input[name="password"], #password
    // - button[type="submit"], input[type="submit"], .login-button
    
    // Example login flow (UPDATE SELECTORS AFTER INSPECTING PAGE):
    try {
      // Wait for login form to appear
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Type username (you need to find the correct selector)
      console.log('  → Entering username...');
      const usernameField = await vibe.find('input[type="text"]'); // UPDATE THIS SELECTOR
      await usernameField.type(CONFIG.username);
      
      // Type password
      console.log('  → Entering password...');
      const passwordField = await vibe.find('input[type="password"]'); // UPDATE THIS SELECTOR
      await passwordField.type(CONFIG.password);
      
      // Click login button
      console.log('  → Clicking login button...');
      const loginButton = await vibe.find('button[type="submit"]'); // UPDATE THIS SELECTOR
      await loginButton.click();
      
      // Wait for redirect after login
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const loginScreenshot = path.join(CONFIG.screenshotDir, `2-after-login-${timestamp}.png`);
      const screenshot2 = await vibe.screenshot();
      fs.writeFileSync(loginScreenshot, screenshot2);
      console.log(`✅ Login completed. Screenshot saved: ${loginScreenshot}\n`);
      
    } catch (loginError) {
      console.log('⚠️  Login failed (selectors may need updating). Error:', loginError.message);
      console.log('   → Open Chrome DevTools on admin.iocrops.com and inspect the login form');
      console.log('   → Update the selectors in this script\n');
    }
    
    // Step 3: Navigate to 관수리포트 menu
    console.log('📊 Step 3: Navigating to 관수리포트 menu...');
    
    // TODO: Find the selector for the 관수리포트 menu link
    // Options to try:
    // - CSS selector: await vibe.find('[href*="irrigation"]');
    // - Text in link: await vibe.find('a'); // then check text content
    
    try {
      // Wait for dashboard to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Click 관수리포트 menu (UPDATE THIS SELECTOR)
      // Vibium uses CSS selectors - text-based may not work, try href or class
      const menuLink = await vibe.find('a[href*="irrigation"]'); // UPDATE THIS SELECTOR
      await menuLink.click();
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const menuScreenshot = path.join(CONFIG.screenshotDir, `3-irrigation-menu-${timestamp}.png`);
      const screenshot3 = await vibe.screenshot();
      fs.writeFileSync(menuScreenshot, screenshot3);
      console.log(`✅ Reached 관수리포트 menu. Screenshot saved: ${menuScreenshot}\n`);
      
    } catch (menuError) {
      console.log('⚠️  Could not find 관수리포트 menu. Error:', menuError.message);
      console.log('   → Take a screenshot manually and inspect the menu structure');
      console.log('   → Update the selector in this script\n');
    }
    
    // Step 4: Find and click first report point
    console.log('🎯 Step 4: Looking for report points...');
    
    // TODO: Inspect the 관수리포트 page to find:
    // - What are the clickable "points"? (buttons, links, table rows?)
    // - What CSS class or ID do they have?
    // - Are they in a list, table, or grid?
    
    console.log('   → TODO: Inspect page to identify report point selectors');
    console.log('   → For now, taking final screenshot for manual inspection\n');
    
    const finalScreenshot = path.join(CONFIG.screenshotDir, `4-report-points-${timestamp}.png`);
    const screenshot4 = await vibe.screenshot();
    fs.writeFileSync(finalScreenshot, screenshot4);
    console.log(`📸 Final screenshot saved: ${finalScreenshot}\n`);
    
    // Success summary
    console.log('✅ Week 1 Proof of Concept Complete!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Review screenshots in ./screenshots/ folder');
    console.log('   2. Open admin.iocrops.com in Chrome DevTools');
    console.log('   3. Inspect login form, 관수리포트 menu, and report points');
    console.log('   4. Update selectors in this script with actual values');
    console.log('   5. Run again to test full navigation\n');
    
  } catch (error) {
    console.error('❌ Error during automation:', error);
    console.error('   Stack trace:', error.stack);
    
    // Try to take error screenshot
    try {
      const errorScreenshot = path.join(CONFIG.screenshotDir, `error-${Date.now()}.png`);
      const errorScreenshotData = await vibe.screenshot();
      fs.writeFileSync(errorScreenshot, errorScreenshotData);
      console.log(`📸 Error screenshot saved: ${errorScreenshot}`);
    } catch (screenshotError) {
      console.log('   Could not save error screenshot');
    }
    
  } finally {
    // Clean up
    console.log('\n🔚 Closing browser...');
    await vibe.quit();
    console.log('✅ Done!\n');
  }
}

// Run the automation
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

