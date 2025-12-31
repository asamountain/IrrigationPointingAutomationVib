# Irrigation Report Automation

**Purpose:** Automate browser-based data extraction from IoTCrops admin.iocrops.com 관수리포트 (irrigation report) menu.

**Strategic Value:**
- Portfolio asset for AgTech job applications
- Learning experiment with browser automation (Vibium)
- Reusable framework for future farm monitoring

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install Vibium and other required packages.

### 2. Configure Credentials

Open `irrigation-playwright.js` and update the CONFIG section:

```javascript
const CONFIG = {
  url: 'https://admin.iocrops.com',
  username: 'YOUR_USERNAME', // Replace with your actual username
  password: 'YOUR_PASSWORD', // Replace with your actual password
  // ...
};
```

**⚠️ Security Note:** Never commit credentials to Git! Create a separate `config.js` file (gitignored) if needed.

### 3. Run the Script

```bash
npm start
```

Or directly:

```bash
node irrigation-playwright.js
```

**Alternative (Vibium - experimental):**

```bash
npm run vibium  # Uses Vibium instead (may have Windows compatibility issues)
```

### 4. Review Screenshots

Check the `./screenshots/` folder for:
- `1-homepage-{timestamp}.png` - Initial page load
- `2-after-login-{timestamp}.png` - After login attempt
- `3-irrigation-menu-{timestamp}.png` - 관수리포트 menu page
- `4-report-points-{timestamp}.png` - Report points page

## Current Status: Week 1 (Proof of Concept)

### ✅ Completed
- Project structure setup
- Package.json with Vibium dependency
- Basic navigation flow
- Screenshot capture for verification

### 🔄 In Progress
- **TODO:** Inspect admin.iocrops.com login form and update selectors
- **TODO:** Find 관수리포트 menu selector
- **TODO:** Identify report point elements

### 📋 Next Steps (Week 2)
1. Update CSS selectors after inspecting the actual website
2. Implement data extraction from report points
3. Save extracted data to JSON files
4. Add error handling and retry logic

## How to Inspect Selectors

1. Open Chrome/Edge browser
2. Navigate to `https://admin.iocrops.com`
3. Right-click on element → "Inspect"
4. In DevTools, right-click on HTML element → Copy → Copy selector
5. Paste selector into `irrigation-click-test.js`

### Common Selector Examples

```javascript
// Vibium API: find() returns an Element, then call methods on it

// By ID
const button = await vibe.find('#login-button');
await button.click();

// By class
const menuItem = await vibe.find('.menu-item-irrigation');
await menuItem.click();

// By attribute
const menu = await vibe.find('[data-menu="irrigation"]');
await menu.click();

// By text content (CSS only - no :contains() support)
// Use evaluate() to find by text if needed
const linkText = await vibe.evaluate(`
  const link = Array.from(document.querySelectorAll('a'))
    .find(a => a.textContent.includes('관수리포트'));
  return link ? link.getAttribute('href') : null;
`);

// Complex selector
const irrigationLink = await vibe.find('nav.sidebar a[href*="irrigation"]');
await irrigationLink.click();
```

## Technology Stack

- **Browser Automation:** [Playwright](https://playwright.dev/) (industry-standard, Windows-compatible)
- **Runtime:** Node.js (ES Modules)
- **Data Storage:** JSON files (simple, no database)
- **Scheduling:** Manual (node-cron in future)

**Note:** Initially attempted Vibium but switched to Playwright for better Windows compatibility and stability.

## File Structure

```
IrrigationReportAutomation/
├── irrigation-playwright.js     # Main automation script (Playwright - RECOMMENDED)
├── irrigation-click-test.js     # Alternative script (Vibium - experimental)
├── package.json                  # Dependencies
├── README.md                     # This file
├── .gitignore                    # Ignore sensitive files
├── data/                         # JSON output (gitignored)
│   └── irrigation-report-YYYY-MM-DD.json
└── screenshots/                  # Debug screenshots (gitignored)
    └── *.png
```

## Troubleshooting

### "Cannot find module 'vibium'"
```bash
npm install
```

### "Login failed"
1. Check credentials in CONFIG
2. Inspect login form selectors using Chrome DevTools
3. Update selectors in the script

### "Could not find 관수리포트 menu"
1. Take a screenshot manually after login
2. Inspect the menu structure
3. Update the menu selector in the script

## 30-Day MVP Timeline

- **Week 1:** ✅ Setup + Navigation proof of concept
- **Week 2:** Data extraction from report points
- **Week 3:** Full dataset loop + error handling
- **Week 4:** Alert system for anomalies

## Portfolio Value

When interviewing at AgTech companies, you can say:

> "I built an automated irrigation monitoring system using Playwright for browser automation. The system autonomously navigates IoT dashboards, extracts sensor data from irrigation reports, and can alert on anomalies like irrigation failures - demonstrating my ability to build unsupervised system monitoring for agricultural applications."

## Documentation

For full project requirements and technical specifications, see:
- **PRD.md** (Section 14: Irrigation Report Automation)
- **Vibium Documentation:** https://github.com/VibiumDev/vibium

---

**Last Updated:** December 31, 2025  
**Status:** Week 1 - Proof of Concept

