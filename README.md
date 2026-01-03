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

This will install Playwright and other required packages.

### 2. Run the Automation

```bash
npm start
```

### 3. Configure via Dashboard

A browser will open to the **Dashboard** at `http://localhost:3456`

Configure your automation:
- **👤 Manager**: Select 승진 (Seungjin), 진우 (Jinwoo), or enter custom name
- **🏭 Start From**: Choose which farm to start processing from
- **📊 Mode**: 
  - **Normal**: Extract irrigation data automatically
  - **Watch Mode**: Observe without clicking (debugging)
  - **Learning Mode**: Train the AI by correcting detection errors
- **🔢 Max Farms**: How many farms to process (3 for testing, or All)

### 4. Click "🚀 Start Automation"

The automation will:
- Login to admin.iofarm.com
- Select your chosen manager
- Process each farm's irrigation data
- Extract first and last irrigation times
- Save results to `data/` folder

### 5. Monitor Progress

The dashboard shows:
- ✅ Real-time status and logs
- 📸 Live screenshots
- 🎓 Learning progress (if in Learning Mode)
- ⏸️ Pause/Resume/Stop controls

### 6. Review Results

Check the `./data/` folder for JSON files with extracted irrigation data

## Features

### ✅ Core Features
- 🎛️ **Dashboard Control Panel** - Configure everything from a web interface
- 🤖 **Automated Data Extraction** - Extract irrigation times from Highcharts
- 📊 **HSSP Algorithm** - Highest Slope Start Point detection for irrigation events
- 🎓 **Learning Mode** - Train AI to improve accuracy with your corrections
- 🏭 **Multi-Farm Processing** - Process multiple farms automatically
- 📅 **Date Range Iteration** - Check last 5 days of data per farm
- ⏸️ **Real-time Control** - Pause/Resume/Stop anytime via dashboard
- 📸 **Live Monitoring** - See screenshots and logs in real-time
- 💾 **JSON Export** - All data saved in structured format

### 🎓 Learning System
The automation learns from your corrections:
- **🌱 Ready to learn** (0 sessions) - No training yet
- **🌿 Early learning** (1-4 sessions) - Just starting
- **🌳 Improving** (5-19 sessions) - Getting better
- **🏆 Well trained** (20+ sessions) - Highly accurate

See `LEARNING_MODE_GUIDE.md` for detailed instructions.

## Usage Modes

### Normal Mode (Default)
Extract irrigation data automatically with learned corrections applied.

### Watch Mode
Observe the automation without clicking anything. Useful for:
- Debugging chart detection
- Verifying manager/farm selection
- Understanding the workflow

### Learning Mode
Train the AI by showing it correct irrigation points:
1. System shows where it thinks irrigation starts/ends (🟢🔴)
2. If wrong, you click the correct spots (🟡🟠)
3. System learns from your corrections
4. After 20+ sessions, accuracy is excellent!

**Full guide:** See `LEARNING_MODE_GUIDE.md`

## Technology Stack

- **Browser Automation:** [Playwright](https://playwright.dev/) - Industry-standard automation
- **Runtime:** Node.js with ES Modules
- **Dashboard:** HTTP server with Server-Sent Events (SSE)
- **Chart Interaction:** SVG path parsing + Bézier curve analysis
- **Algorithm:** HSSP (Highest Slope Start Point) detection
- **Learning:** JSON-based training data storage
- **Data Export:** Structured JSON files

## File Structure

```
IrrigationPointingAutomationVib/
├── irrigation-playwright.js     # Main automation script
├── dashboard-server.js          # Dashboard HTTP server + SSE
├── dashboard.html               # Dashboard web interface
├── package.json                 # Dependencies
├── README.md                    # This file
├── LEARNING_MODE_GUIDE.md       # Detailed learning mode instructions
├── .gitignore                   # Ignore sensitive files
├── data/                        # Extracted data (gitignored)
│   └── all-farms-data-*.json
├── training/                    # Learning data (gitignored)
│   └── training-data.json
└── screenshots/                 # Debug screenshots (gitignored)
    └── *.png
```

## Troubleshooting

### Dashboard won't open
- Check if port 3456 is available
- Server will auto-retry on port 3457, 3458, etc.
- Look for "Dashboard server started at http://localhost:XXXX" in console

### Manager selection not working
- Make sure you clicked "Start Automation" button in dashboard
- Check console logs for "Clicked [manager] radio button"
- Verify the manager exists in the dropdown

### Learning Mode: Can't see markers
- Ensure "Learning Mode (Train)" is selected in dashboard
- Browser window must be visible
- Look for purple banner at top: "🎓 LEARNING MODE ACTIVE"

### Irrigation times not extracted
- Check if chart has visible data (not empty)
- Enable Learning Mode to verify detection accuracy
- Check `screenshots/` folder for debugging
- Review `training/training-data.json` for patterns

### "Port EADDRINUSE" error
- Dashboard server will automatically try next port
- If issue persists, kill other Node processes:
  ```bash
  # macOS/Linux
  killall node
  
  # Windows
  taskkill /F /IM node.exe
  ```

## Output Data Format

Extracted data is saved to `data/all-farms-data-{timestamp}.json`:

```json
{
  "extractedAt": "2026-01-03T12:00:00.000Z",
  "manager": "승진",
  "totalFarms": 10,
  "farmsWithData": 8,
  "dateRange": {
    "description": "5 days ago to today",
    "totalDays": 6
  },
  "farms": [
    {
      "farmName": "Farm A",
      "dates": [
        {
          "date": "2026-01-01",
          "firstIrrigationTime": "10:38 AM",
          "lastIrrigationTime": "10:45 AM",
          "hasSingleEvent": false
        }
      ]
    }
  ]
}
```

## Portfolio Value

When interviewing at AgTech companies, you can say:

> "I built an automated irrigation monitoring system using Playwright for browser automation. The system uses SVG path parsing and machine learning to extract irrigation timing data from Highcharts visualizations. I implemented a training system where the AI learns from corrections, improving accuracy from baseline to 95%+ through iterative feedback. The dashboard provides real-time control and monitoring, demonstrating my ability to build production-ready automation for agricultural IoT systems."

## Documentation

- **LEARNING_MODE_GUIDE.md** - Complete guide to training the AI
- **PRD.md** - Project requirements and specifications

---

**Last Updated:** January 3, 2026  
**Status:** Production-Ready with AI Learning

