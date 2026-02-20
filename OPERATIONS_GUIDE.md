# 📋 Operations Manual: Irrigation Report Automation
**System Version:** 2.1 (Enhanced Logic)
**Target Audience:** Operations / HR Manager

## 🌟 Business Value & Impact
This system transforms a multi-hour manual task into a supervised automated process, ensuring high-quality data delivery to our farm customers.
- **Efficiency:** Processes dozens of farms across multiple managers (**승진** & **진우**) in minutes.
- **Data Integrity:** Automatically detects and "heals" missing data (the `-` placeholders) by triggering background calculations.
- **Precision Delivery:** Uses smart filtering (e.g., 'Friday' filter) to ensure farms only receive reports on their scheduled days.
- **Customer Experience:** **Zero-duplicate guarantee**. The system checks the "Report Count" for every farm and skips those already sent.

## 🛠 Operational Workflow

### 1. Launching the Dashboard
Start the application and the Dashboard will automatically open in your browser. This is your command center.

### 2. Configuration Settings
- **👤 Manager:** Select **승진**, **진우**, or **Both**. "Both" will process everyone in one go.
- **📅 Day Filter:** Select the current day (e.g., **금** for Friday). The system will strictly process farms with matching indicators like `[월수금]`.
- **🏭 Start From / Max Farms:** Controls the batch size. Useful for resuming or testing.

### 3. Execution Modes
- **🚀 Start Automation:** Uses the HSSP algorithm to extract data points for internal records.
- **📤 Auto-Send Reports:** Our "Delivery Mode." It validates data, triggers necessary calculations to fix holes, and clicks **리포트 생성** (Generate Report) to send it to the customer.

## 🛡 Built-in Safeguards

### 🔍 Proactive Data Recovery
If the system sees a `-` in *Night Moisture* or *Last Irrigation Time* for previous days (T-1 to T-5), it:
1.  Identifies the gap.
2.  Triggers a **"Calculate + Refresh"** sequence.
3.  Verifies the data is populated before clicking "Send".
*Note: The system correctly ignores empty values for 'Today' (T-0) as those are finalized post-report.*

### 🚫 Anti-Spam (Duplicate Prevention)
The system performs a **"Pre-Flight Check"** on the **리포트 수 (Report Count)** column.
- If **Report Count > 0**, the farm is skipped.
- **Outcome:** No duplicate reports are sent to customers, even if the script is run multiple times.

### 📋 Monitoring
The Dashboard provides a live log and progress bar. You can see every success, skip, and recovery action as it happens.

---
*Created for the HR/Operations Team to ensure excellence in automated service delivery.*
