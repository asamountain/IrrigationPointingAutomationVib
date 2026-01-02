# Quick Start Guide

## ✅ Setup Complete!

Your irrigation automation project is ready to run. Here's what's been installed:

- ✅ Playwright (browser automation library)
- ✅ Chromium browser
- ✅ Project structure with screenshots/ and data/ folders
- ✅ PRD.md updated (Section 14)

## 🚀 Next Steps (15 Minutes Tonight)

### Step 1: Add Your Credentials

Open `irrigation-playwright.js` and find line 17-19:

```javascript
const CONFIG = {
  url: 'https://admin.iocrops.com',
  username: 'YOUR_USERNAME', // ← CHANGE THIS
  password: 'YOUR_PASSWORD', // ← CHANGE THIS
  // ...
};
```

Replace `YOUR_USERNAME` and `YOUR_PASSWORD` with your actual IoTCrops admin credentials.

### Step 2: Run the Script

```bash
npm start
```

**What will happen:**
1. A Chrome browser window will open (you'll see it!)
2. It will navigate to admin.iocrops.com
3. It will attempt to login (selectors may need updating)
4. It will look for the 관수리포트 menu
5. It will take screenshots at each step

### Step 3: Review Screenshots

Open the `screenshots/` folder and look at:
- `1-homepage-TIMESTAMP.png` - Did it reach the login page?
- `2-after-login-TIMESTAMP.png` - Did login work?
- `3-irrigation-menu-TIMESTAMP.png` - Did it find the menu?

### Step 4: Update Selectors

If login or navigation failed, you'll need to inspect the actual website:

1. Open admin.iocrops.com in Chrome
2. Right-click on the username field → "Inspect"
3. Copy the selector (e.g., `#username`, `input[name="user"]`)
4. Update the selector in `irrigation-playwright.js`

**Common selectors to check:**
- **Line 51:** Username field selector
- **Line 55:** Password field selector
- **Line 59:** Login button selector
- **Line 102:** 관수리포트 menu selector

## 📊 Example Selector Update

**Before (generic):**
```javascript
await page.fill('input[type="text"]', CONFIG.username);
```

**After (actual selector from inspecting the page):**
```javascript
await page.fill('#loginUsername', CONFIG.username);
```

## 🎯 Success Criteria for Tonight

- [ ] Script runs without crashing
- [ ] Screenshots are saved
- [ ] You can see what page it reached

**Don't worry if login fails!** The goal tonight is just to:
1. Run the script
2. Get screenshots
3. See what needs to be fixed

## 🆘 Troubleshooting

### "npm start" doesn't work
```bash
# Try running directly:
node irrigation-playwright.js
```

### Browser doesn't open
```bash
# Reinstall Chromium:
npx playwright install chromium
```

### "Cannot find module 'playwright'"
```bash
# Reinstall dependencies:
npm install
```

## 📅 30-Day Timeline

- **Week 1 (This week):** ✅ Setup + navigation proof of concept
- **Week 2:** Extract data from one report point
- **Week 3:** Loop through all points + error handling
- **Week 4:** Add alerts for anomalies

## 💡 Why This Matters

From your conversation with Perplexity:

> "This isn't 'just another QA task' - it's a **bridge asset** to your future career. It directly transfers to your farm automation in Yeosu and closes the skill gap between 'reactive QA tester' and 'systems architect'."

You're building this for **future-you**, not for IoTCrops. That's what makes it worth the 30-60 minutes per day.

## 🎓 Learning Resources

- **Playwright Docs:** https://playwright.dev/docs/intro
- **Selector Tutorial:** https://playwright.dev/docs/selectors
- **Screenshots:** https://playwright.dev/docs/screenshots

---

**Ready?** Update your credentials and run `npm start`! 🚀


