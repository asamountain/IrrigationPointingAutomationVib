/**
 * Browser Launcher - Cross-platform browser launch with auto-install
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';

/**
 * Ensure Korean/CJK fonts are installed (Linux only)
 */
export function ensureFontsInstalled() {
  if (process.platform !== 'linux') return;

  console.log('🔤 Checking for CJK font support (Linux)...');

  try {
    execSync('dpkg -s fonts-noto-cjk', { stdio: 'pipe' });
    console.log('  ✅ Korean/CJK fonts already installed.');
    return;
  } catch (checkError) {
    console.log('  ⚠️ Korean fonts missing. Attempting auto-installation...');

    const installCommand = 'sudo apt-get update && sudo apt-get install -y fonts-noto-cjk fonts-noto-core fonts-liberation';

    try {
      console.log('  📦 Installing font packages (requires sudo)...');
      execSync(installCommand, { stdio: 'inherit', timeout: 300000 });
      console.log('  ✅ Font packages installed successfully.');

      try {
        execSync('sudo fc-cache -f -v', { stdio: 'pipe' });
        console.log('  ✅ Font cache refreshed.');
      } catch (cacheError) {
        console.log('  ⚠️ Font cache refresh failed (non-critical).');
      }

    } catch (installError) {
      console.log('\n  ❌ Auto-install failed (needs sudo or other issue).');
      console.log('  💡 Please run this command manually:\n');
      console.log(`     ${installCommand}`);
      console.log('     sudo fc-cache -f -v\n');
    }
  }
}

/**
 * Universal cross-platform browser launcher
 */
export async function launchBrowser() {
  // Font check for Linux
  ensureFontsInstalled();

  // OS Detection
  const platform = process.platform;
  const isLinux = platform === 'linux';
  const isMac = platform === 'darwin';
  const isWindows = platform === 'win32';

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

  // Headless mode
  const forceHeadless = process.env.HEADLESS?.toLowerCase();
  const headless = forceHeadless === 'true';

  if (headless) {
    console.log('🔇 Headless Mode: ENABLED (via $HEADLESS=true)');
  } else {
    console.log('🖼️  Headless Mode: DISABLED (default - set $HEADLESS=true to hide browser)');
  }

  const launchArgs = [
    '--start-maximized',
    '--window-position=0,0',
    '--disable-blink-features=AutomationControlled'
  ];

  // Attempt 1: Try Google Chrome
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

    if (isLinux || isWSL) {
      console.log('📦 Linux/WSL detected - attempting to install Chrome...');
      try {
        execSync('npx playwright install chrome', { stdio: 'inherit', timeout: 180000 });
        console.log('✅ Chrome installation completed.');
      } catch (installErr) {
        console.log(`⚠️  Chrome install failed: ${installErr.message}`);
      }
    } else if (isMac) {
      console.log('💡 macOS: Chrome may be missing or in a non-standard location.');
      console.log('   → Try: brew install --cask google-chrome');
    }

    // Attempt 2: Retry Chrome (Linux/WSL only)
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

    // Attempt 3: Fallback to bundled Chromium
    console.log('🔄 Attempt 3: Falling back to bundled Chromium...');

    try {
      execSync('npx playwright install chromium', { stdio: 'inherit', timeout: 180000 });
      console.log('✅ Chromium installation completed.');
    } catch (chromiumInstallErr) {
      console.log(`⚠️  Chromium install warning: ${chromiumInstallErr.message}`);
    }

    try {
      const browser = await chromium.launch({
        headless,
        args: launchArgs
      });
      console.log('✅ Bundled Chromium launched successfully.');
      return browser;
    } catch (chromiumError) {
      console.error('\n❌ CRITICAL: Could not launch any browser!');
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

/**
 * Create a browser context with default settings
 */
export async function createContext(browser, options = {}) {
  return await browser.newContext({
    viewport: null,
    screen: { width: 1920, height: 1080 },
    ...options
  });
}
