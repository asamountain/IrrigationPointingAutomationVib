# Simple Usage Guide

**Easy commands to run the irrigation automation**

---

## 🚀 **Basic Commands**

### **1. Normal Run (Auto mode)**
```powershell
npm start
```
- Runs automatically
- Uses learned corrections if available
- Default manager: **승진**

---

### **2. Choose Different Manager**
```powershell
# Run for 진우's farms
$env:MANAGER="진우"; npm start

# Run for 승진's farms (default)
$env:MANAGER="승진"; npm start
```

---

### **3. Learning Mode (Simple)**
```powershell
$env:CHART_LEARNING="true"; npm start
```

**What happens:**
- Shows green/red circles on chart
- **Pauses** for you to correct if wrong
- Press **F8** to continue (accept as correct)
- OR click correct points, then press **F8**

**When to use:** When algorithm makes mistakes, use this 5-10 times to train it

---

### **4. Analyze Training (Get Improvements)**
```powershell
npm run analyze
```

**What it shows:**
- How accurate the algorithm is
- What corrections to apply
- Suggests code changes

---

## 🎯 **Quick Workflow**

```
Step 1: Try normal run
  npm start

Step 2: If accuracy is bad, train it 5-10 times
  $env:CHART_LEARNING="true"; npm start
  (Correct wrong points, press F8)

Step 3: Analyze what was learned
  npm run analyze

Step 4: Run normally again - now it's smarter!
  npm start
```

---

## 📊 **How Auto-Learning Works**

1. **First time:** No training data → uses default algorithm
2. **After training:** Automatically applies learned corrections
3. **Gets smarter:** More training = better accuracy

**Example:**
```
Run 1 (no training): 60% accurate
↓ Train 10 times
Run 2 (with training): 85% accurate
↓ Train 10 more times  
Run 3 (more training): 95% accurate
```

---

## 💡 **Tips**

### **✅ DO:**
- Start with normal run (`npm start`)
- Train on different farms for better accuracy
- Use `$env:MANAGER="진우"` to switch managers
- Train 5-10 times before analyzing

### **❌ DON'T:**
- Don't train just once (not enough data)
- Don't analyze with less than 5 training sessions
- Don't forget to press F8 in learning mode (or it will hang)

---

## 🎓 **Learning Mode - Simple Explanation**

When you run with `CHART_LEARNING="true"`:

1. Script runs normally
2. At each chart, it shows:
   - 🟢 Green circle = "I think FIRST point is here"
   - 🔴 Red circle = "I think LAST point is here"
3. Browser **pauses** (DevTools opens automatically)
4. **You decide:**
   - ✅ **Correct?** Just press **F8**
   - ❌ **Wrong?** Click correct spots (🟢 then 🔴), then press **F8**
5. Script continues to next chart

**That's it!** No complicated setup, just show it the right points!

---

## 🔄 **Auto-Apply Learning**

Once you've trained the algorithm:

```powershell
# Normal run automatically uses learned corrections
npm start
```

You'll see:
```
🎓 Loaded learning data from 10 training sessions
   → Applying corrections: First(-6.2, -1.8), Last(8.5, -2.3)
```

The algorithm **automatically adjusts** based on your past corrections!

---

## 📁 **Manager Selection**

```powershell
# 진우's farms
$env:MANAGER="진우"; npm start

# 승진's farms (default)
$env:MANAGER="승진"; npm start

# Train for specific manager
$env:MANAGER="진우"; $env:CHART_LEARNING="true"; npm start
```

---

## ❓ **Troubleshooting**

### **Problem: Script is stuck**
**Solution:** You forgot to press **F8** in learning mode. Press it now!

### **Problem: Low accuracy after training**
**Solution:** Train on 10-20 more farms. 5 farms isn't enough data.

### **Problem: Wrong manager selected**
**Solution:** Use `$env:MANAGER="진우"` or `$env:MANAGER="승진"`

### **Problem: Learning mode too confusing**
**Solution:** Just use normal mode. Algorithm has default detection that works reasonably well.

---

## 🎯 **Summary**

| What I Want | Command |
|-------------|---------|
| Normal run | `npm start` |
| Choose manager | `$env:MANAGER="진우"; npm start` |
| Train algorithm | `$env:CHART_LEARNING="true"; npm start` |
| See improvements | `npm run analyze` |

---

**That's all you need to know!** 🎉

Most of the time, just use `npm start`. Only use learning mode if you need to improve accuracy.

