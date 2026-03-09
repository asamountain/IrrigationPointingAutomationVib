/**
 * System Setup Module
 * Handles pre-flight system checks and dependency installation
 * Currently focuses on Linux/WSL Korean font installation
 */

import { execSync } from 'child_process';

/**
 * Ensure Korean/CJK fonts are installed on Linux/WSL
 * Auto-installs fonts-noto-cjk if missing
 */
export function ensureFontsInstalled() {
  // Only run on Linux (including WSL)
  if (process.platform !== 'linux') {
    return;
  }
  
  console.log('🔤 Checking for CJK font support (Linux)...');
  
  // Check if fonts-noto-cjk is installed
  try {
    execSync('dpkg -s fonts-noto-cjk', { stdio: 'pipe' });
    console.log('  ✅ Korean/CJK fonts already installed.');
    return;
  } catch (checkError) {
    // Font package not found - attempt to install
    console.log('  ⚠️ Korean fonts missing. Attempting auto-installation...');
    
    const installCommand = 'sudo apt-get update && sudo apt-get install -y fonts-noto-cjk fonts-noto-core fonts-liberation';
    
    try {
      console.log('  📦 Installing font packages (requires sudo)...');
      console.log(`  → Running: ${installCommand}`);
      
      execSync(installCommand, { 
        stdio: 'inherit',
        timeout: 300000 // 5 minutes timeout
      });
      
      console.log('  ✅ Font packages installed successfully.');
      
      // Refresh font cache
      console.log('  🔄 Refreshing font cache...');
      try {
        execSync('sudo fc-cache -f -v', { stdio: 'pipe' });
        console.log('  ✅ Font cache refreshed.');
      } catch (cacheError) {
        console.log('  ⚠️ Font cache refresh failed (non-critical).');
      }
      
    } catch (installError) {
      console.log('\n  ❌ ═══════════════════════════════════════════════════════════');
      console.log('  ❌ Auto-install failed (needs sudo or other issue).');
      console.log('  ❌ ═══════════════════════════════════════════════════════════');
      console.log('  💡 Please run this command manually:\n');
      console.log(`     ${installCommand}`);
      console.log('     sudo fc-cache -f -v\n');
      console.log('  ═══════════════════════════════════════════════════════════\n');
      // Continue anyway - browser will launch but Korean text may be broken
    }
  }
}
