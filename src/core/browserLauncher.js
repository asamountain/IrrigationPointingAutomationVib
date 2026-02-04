/**
 * Browser Launcher Module
 * Cross-platform "Write Once, Run Anywhere" browser launching
 * Handles: Windows, macOS, Linux/WSL with automatic dependency installation
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import { ensureFontsInstalled } from './systemSetup.js';

/**
 * Launch browser with intelligent platform detection and fallback strategies
 * @returns {Promise<Browser>} Playwright browser instance
 */
export async function launchBrowser() {
  // ═══════════════════════════════════════════════════════════════════
  // STEP 0: PRE-FLIGHT FONT CHECK (Linux only)
  // ═══════════════════════════════════════════════════════════════════
  ensureFontsInstalled();
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: OS DETECTION
  // ═══════════════════════════════════════════════════════════════════
  const platform = process.platform;
  const isLinux = platform === 'linux';
  const isMac = platform === 'darwin';
  const isWindows = platform === 'win32';
  
  // Detect WSL specifically (Linux with Microsoft in kernel version)
  const isWSL = isLinux && (() => {
    try {
      const release = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
      return release.includes('microsoft') || release.includes('wsl');
    } catch { return false; }
  })();

  const osName = isWSL ? 'WSL (Linux)' : 
                 isLinux ? 'Linux' : 
                 isMac ? 'macOS' : 
                 isWindows ? 'Windows' : 'Unknown';
  
  console.log(`🖥️  Detected Environment: ${osName}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: HEADLESS MODE DECISION
  // ═══════════════════════════════════════════════════════════════════
  // Default: VISIBLE (headless: false) for ALL environments
  // Override: Set $HEADLESS=true to run in invisible/headless mode
  const forceHeadless = process.env.HEADLESS?.toLowerCase();
  let headless;
  
  if (forceHeadless === 'true') {
    headless = true;
    console.log('🔇 Headless Mode: ENABLED (via $HEADLESS=true)');
  } else {
    headless = false;
    console.log('🖼️  Headless Mode: DISABLED (default - set $HEADLESS=true to hide browser)');
  }

  const launchArgs = [
    '--start-maximized',
    '--window-position=0,0',
    '--disable-blink-features=AutomationControlled' // Reduce bot detection
  ];

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: SMART LAUNCH STRATEGY
  // ═══════════════════════════════════════════════════════════════════
  
  // --- ATTEMPT 1: Try Google Chrome (preferred) ---
  try {
    console.log('🚀 Attempt 1: Launching Google Chrome...');
    const browser = await chromium.launch({
      headless,
      channel: 'chrome',
      args: launchArgs
    });
    console.log('✅ Google Chrome launched successfully.');
    return browser;
  } catch (chromeError) {
    console.log(`⚠️  Chrome launch failed: ${chromeError.message.split('\n')[0]}`);

    // --- PLATFORM-SPECIFIC RECOVERY ---
    if (isLinux || isWSL) {
      // Linux/WSL: Auto-install Chrome via Playwright
      console.log('📦 Linux/WSL detected - attempting to install Chrome...');
      try {
        execSync('npx playwright install chrome', { 
          stdio: 'inherit',
          timeout: 180000 // 3 minutes for slow connections
        });
        console.log('✅ Chrome installation completed.');
      } catch (installErr) {
        console.log(`⚠️  Chrome install failed: ${installErr.message}`);
      }
    } else if (isMac) {
      // macOS: Provide helpful guidance
      console.log('💡 macOS: Chrome may be missing or in a non-standard location.');
      console.log('   → Try: brew install --cask google-chrome');
      console.log('   → Or download from: https://www.google.com/chrome/');
    }
    // Windows: Chrome is usually installed; skip auto-install

    // --- ATTEMPT 2: Retry Chrome after install (Linux/WSL only) ---
    if (isLinux || isWSL) {
      try {
        console.log('🔄 Attempt 2: Retrying Chrome after installation...');
        const browser = await chromium.launch({
          headless,
          channel: 'chrome',
          args: launchArgs
        });
        console.log('✅ Google Chrome launched successfully (after install).');
        return browser;
      } catch (retryError) {
        console.log(`⚠️  Chrome retry failed: ${retryError.message.split('\n')[0]}`);
      }
    }

    // --- ATTEMPT 3: Fallback to Bundled Chromium ---
    console.log('🔄 Attempt 3: Falling back to bundled Chromium...');
    
    // Ensure Chromium is installed
    try {
      console.log('📦 Installing Playwright Chromium...');
      execSync('npx playwright install chromium', { 
        stdio: 'inherit',
        timeout: 180000
      });
      console.log('✅ Chromium installation completed.');
    } catch (chromiumInstallErr) {
      console.log(`⚠️  Chromium install warning: ${chromiumInstallErr.message}`);
      // Continue anyway - might already be installed
    }

    try {
      const browser = await chromium.launch({
        headless,
        args: launchArgs
        // No 'channel' = use bundled Chromium
      });
      console.log('✅ Bundled Chromium launched successfully.');
      return browser;
    } catch (chromiumError) {
      // --- FINAL FAILURE ---
      console.error('\n❌ ═══════════════════════════════════════════════════════════');
      console.error('❌ CRITICAL: Could not launch any browser!');
      console.error('❌ ═══════════════════════════════════════════════════════════');
      console.error(`   Chrome error: ${chromeError.message.split('\n')[0]}`);
      console.error(`   Chromium error: ${chromiumError.message.split('\n')[0]}`);
      console.error('\n💡 Manual fix options:');
      console.error('   1. Run: npx playwright install');
      console.error('   2. Install Chrome: https://www.google.com/chrome/');
      if (isLinux || isWSL) {
        console.error('   3. For WSL GUI: Install an X server (VcXsrv/WSLg)');
      }
      throw new Error('❌ Critical: Could not launch any browser after all attempts.');
    }
  }
}
