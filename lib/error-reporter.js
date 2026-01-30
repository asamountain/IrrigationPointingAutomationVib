/**
 * Error Reporter - Crash reports and F9 trigger handling
 */

import fs from 'fs';
import path from 'path';
import { PATHS } from '../config.js';

const crashDir = PATHS.CRASH_REPORTS_DIR;

/**
 * Check if F9 was triggered from dashboard and save crash report if so
 */
export async function checkAndHandleF9Trigger(page, context = 'Manual F9 Trigger') {
  try {
    const response = await fetch('http://localhost:3456/control/check-f9');
    const data = await response.json();

    if (data.triggered) {
      console.log('\n📸 F9 TRIGGERED! Saving crash report...');
      await saveCrashReport(page, context);
      return true;
    }
  } catch (err) {
    // F9 check failed silently (server might not be running)
  }
  return false;
}

/**
 * Save crash report with screenshot and debug info
 */
export async function saveCrashReport(page, reason = 'Manual F9 Trigger') {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  const reportDir = path.join(crashDir, `${timestamp}_${reason.replace(/\s+/g, '_')}`);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  console.log(`📸 Saving crash report to: ${reportDir}`);

  try {
    // Screenshot
    const screenshotPath = path.join(reportDir, 'screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`   ✅ Screenshot saved: ${screenshotPath}`);

    // Current URL
    const url = page.url();
    fs.writeFileSync(path.join(reportDir, 'url.txt'), url);
    console.log(`   ✅ URL saved`);

    // HTML content
    try {
      const html = await page.content();
      fs.writeFileSync(path.join(reportDir, 'page.html'), html);
      console.log(`   ✅ HTML saved`);
    } catch (e) {
      console.log(`   ⚠️ Could not capture HTML: ${e.message}`);
    }

    // Crash summary
    const summary = {
      timestamp: new Date().toISOString(),
      reason: reason,
      url: url,
      userAgent: await page.evaluate(() => navigator.userAgent)
    };
    fs.writeFileSync(path.join(reportDir, 'CRASH_SUMMARY.json'), JSON.stringify(summary, null, 2));
    console.log(`   ✅ Summary saved`);

    fs.writeFileSync(path.join(reportDir, 'reason.txt'), reason);

    console.log(`📸 Crash report complete: ${reportDir}\n`);
    return reportDir;

  } catch (e) {
    console.log(`❌ Error saving crash report: ${e.message}`);
    return null;
  }
}
