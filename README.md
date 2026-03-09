# Irrigation Report Automation

Automates browser-based data extraction from the IoTCrops admin portal (관수리포트 menu).
Built with Playwright + Node.js. Runs a local dashboard to control everything.

---

## Mac Setup (First Time Only)

### 1. Install Node.js

If you don't have Node.js yet, install it via [Homebrew](https://brew.sh/):

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then install Node.js
brew install node
```

Verify it works:

```bash
node --version   # should be v18 or higher
npm --version
```

---

### 2. Get the Code

```bash
git clone <repo-url>
cd IrrigationReportAutomation
```

Or if you received the folder directly, just `cd` into it.

---

### 3. Create the `.env` File

The script needs login credentials. Create a file named `.env` in the project root:

```bash
touch .env
open -e .env   # opens in TextEdit, or use any text editor
```

Paste in the following (ask your supervisor for the actual values):

```
ADMIN_EMAIL=your_email_here
ADMIN_PASSWORD=your_password_here
ADMIN_URL=https://admin.iofarm.com/report/
```

Save and close. This file is gitignored and never committed.

---

### 4. Install Dependencies

```bash
npm install
```

---

### 5. Install the Browser (Playwright)

```bash
npx playwright install chromium
```

This downloads a bundled Chromium browser that the script controls. You only need to do this once.

---

### 6. Run It

```bash
npm start
```

A browser window will open, and the **Dashboard** will appear at `http://localhost:3456` in your default browser.

---

## Using the Dashboard

When the dashboard opens, configure and start the run:

| Setting | What it does |
|---------|-------------|
| **Manager** | Select 승진 or 진우 (or type a custom name) |
| **Start From** | Which farm to begin processing from |
| **Mode** | Normal / Watch / Learning (see below) |
| **Max Farms** | How many farms to process (use 3 for testing) |

Click **"Start Automation"** when ready.

The dashboard shows live logs, screenshots, and pause/stop controls while it runs.

Results are saved to the `data/` folder as JSON files.

---

## Modes

### Normal Mode (Default)
Runs fully automatically. Extracts irrigation times from charts and saves results.

### Watch Mode
Same as Normal but doesn't click anything. Use this to verify the script navigates correctly without changing data.

### Learning Mode
Shows the script's detection on each chart and pauses for your review:
- Green circle = detected first irrigation point
- Red circle = detected last irrigation point

If the detection is **correct**: press **F8** to continue
If the detection is **wrong**: click the correct points on the chart, then press **F8**

After 10–20 corrections the algorithm noticeably improves.

---

## Daily Usage (after setup)

```bash
# Standard run
npm start

# Run for a specific manager
MANAGER="진우" npm start
MANAGER="승진" npm start

# Run with learning mode active
CHART_LEARNING="true" npm start

# Run learning mode for a specific manager
MANAGER="진우" CHART_LEARNING="true" npm start

# Analyze what the algorithm learned from your corrections
npm run analyze
```

---

## Typical Workflow

```
1. npm start                          → check if data looks right

2. CHART_LEARNING="true" npm start   → if detection is off, correct it 10–20 times

3. npm run analyze                    → see what improved

4. npm start                          → now runs with better accuracy
```

---

## Troubleshooting

**Dashboard doesn't open**
Check the terminal for a line like `Dashboard server started at http://localhost:XXXX`.
If port 3456 is taken, the server picks the next available port automatically.

**Script hangs and does nothing**
You're probably in Learning Mode and need to press **F8** to continue.

**"Cannot find module" or import errors**
Run `npm install` again — a dependency is missing.

**Browser opens but login fails**
Double-check your `.env` file has the correct email, password, and URL with no extra spaces.

**Kill all Node processes if something is stuck**
```bash
killall node
```

---

## Project Structure

```
IrrigationReportAutomation/
├── irrigation-playwright.js   # Main automation script
├── src/                       # Core modules (auth, navigation, chart analysis)
├── training/                  # Saved learning data (gitignored)
├── data/                      # Extracted results (gitignored)
├── .env                       # Credentials (gitignored, you create this)
├── package.json
└── README.md
```

---

## Tech Stack

- **Playwright** — browser automation
- **Node.js** (ES Modules) — runtime
- **TensorFlow.js** — TCN model for irrigation detection
- **HSSP Algorithm** — baseline chart analysis (Highest Slope Start Point)
- **Dashboard** — HTTP server with Server-Sent Events for real-time UI
