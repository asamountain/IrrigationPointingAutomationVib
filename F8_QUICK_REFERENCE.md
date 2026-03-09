# 🎓 F8 Training Mode - Quick Reference

## Start Training Mode

```powershell
# Windows PowerShell
$env:TRAINING_MODE="true"; npm start
```

## Workflow

1. ✅ Script auto-navigates to farm/date
2. ⏸️  **Script PAUSES** - Banner appears
3. 👀 Check predicted points (green/red circles)
4. ✅ **If correct**: Press **F8** immediately
5. ❌ **If wrong**: 
   - Click START point (yellow dot)
   - Click END point (red dot)
   - Press **F8**
6. ♻️  Script continues automatically

## Visual Guide

```
┌─────────────────────────────────────────────────┐
│ 🎓 LEARNING MODE 🎓                            │
│ Click: Start=Green, End=Red                    │
│ Press [F8] to Resume ⏩                         │
└─────────────────────────────────────────────────┘

     🟢 ←── Algorithm's predicted START
     
     Chart Data Here
     
     🔴 ←── Algorithm's predicted END

[Click to mark points, F8 to continue]
```

## Key Points

- **F8** = Resume automation
- **Green circle** = Predicted START (first irrigation)
- **Red circle** = Predicted END (last irrigation)
- **Yellow dot** = Your START click
- **Red dot** = Your END click
- Data saved to `training/training-data.json`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| F8 doesn't work | Click page to focus browser window |
| No pause happens | Check `$env:TRAINING_MODE` is "true" |
| Dots don't appear | Don't click on the banner (top bar) |

## Exit Training Mode

Just close the terminal or press **Ctrl+C**

## View Training Data

```powershell
# View training file
cat training/training-data.json

# Count training entries
(Get-Content training/training-data.json | ConvertFrom-Json).Count
```

---

**Remember**: The more you train, the smarter it gets! 🚀
