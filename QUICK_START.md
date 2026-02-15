# 🎯 QUICK START GUIDE - SEC DW DOWNLOADER

## For Windows Users 🪟

### FIRST TIME SETUP (Do Once)

**Step 1: Install Node.js**
```
1. Go to: https://nodejs.org/
2. Click the green button that says "LTS"
3. Run the downloaded file
4. Click "Next" → "Next" → "Next" → "Install"
5. Restart your computer
```

**Step 2: Run the Downloader**
```
1. Find the folder you downloaded
2. Double-click: start-downloader.bat
3. Wait for setup to complete (1-2 minutes)
```

**Step 3: Create Desktop Shortcut (Optional)**
```
1. Right-click: start-downloader.bat
2. Choose: "Send to" → "Desktop (create shortcut)"
3. Rename to: "Download SEC Files"
```

### DAILY USE (Every Time)

**Just Double-Click Your Desktop Shortcut!**

Then answer these questions:

```
┌─────────────────────────────────────────┐
│  ? Enter START date: 2026-01-01         │  ← Type date and press Enter
├─────────────────────────────────────────┤
│  ? Enter END date: 2026-01-31           │  ← Type date and press Enter
├─────────────────────────────────────────┤
│  ? Enter download folder: ./downloads   │  ← Press Enter (or type path)
├─────────────────────────────────────────┤
│  ? Select download speed:               │  ← Use ↑↓ arrows to choose
│    ○ Slow (Safest)                      │
│    ● Normal (Recommended)               │
│    ○ Fast                               │
├─────────────────────────────────────────┤
│  ? Start downloading? (Y/n)             │  ← Press Enter to start
└─────────────────────────────────────────┘

Downloading |████████░░░░| 75% | 75/100 files

✅ Download complete!
   ✓ Successful: 98
   ✗ Failed: 2
   📁 Location: C:\Users\...\downloads

Press Enter to exit...
```

---

## For Mac Users 🍎

### FIRST TIME SETUP (Do Once)

**Step 1: Install Node.js**
```
1. Go to: https://nodejs.org/
2. Click the green button that says "LTS"
3. Open the downloaded file
4. Follow installation steps
5. Restart your computer
```

**Step 2: Make Script Executable**
```
1. Open Terminal (Applications → Utilities → Terminal)
2. Type: cd [space]
3. Drag the downloaded folder into Terminal
4. Press Enter
5. Type: chmod +x start-downloader.sh
6. Press Enter
```

**Step 3: Run the Downloader**
```
1. Double-click: start-downloader.sh
   (If it opens in text editor, right-click → Open With → Terminal)
```

### DAILY USE (Every Time)

**Double-Click: start-downloader.sh**

Then follow the same prompts as Windows above.

---

## 📋 EXAMPLE USAGE

### Example 1: Download January 2026 Files
```
Start date: 2026-01-01
End date: 2026-01-31
Folder: ./downloads
Speed: Normal
```
✅ Result: All January DW files in `downloads` folder

### Example 2: Download to Desktop
```
Start date: 2026-02-01
End date: 2026-02-28
Folder: C:\Users\YourName\Desktop\SEC_Feb
Speed: Slow
```
✅ Result: February files in `SEC_Feb` folder on Desktop

### Example 3: Download Specific Week
```
Start date: 2026-01-15
End date: 2026-01-21
Folder: ./downloads
Speed: Fast
```
✅ Result: One week of files downloaded quickly

---

## ⚠️ COMMON ISSUES & FIXES

### Issue: "Node.js not found"
**Fix:** 
1. Install Node.js from https://nodejs.org/
2. Restart computer
3. Try again

### Issue: "Permission denied" (Mac)
**Fix:** 
1. Open Terminal
2. Type: `chmod +x start-downloader.sh`
3. Try again

### Issue: Downloads fail or stop
**Fix:** 
1. Choose "Slow" speed next time
2. Check internet connection
3. Run again (it will continue from where it stopped)

### Issue: Can't find downloaded files
**Check:**
- Look in the folder you specified
- Default is `downloads` folder next to the program
- Check Desktop if you specified Desktop path

---

## 📞 NEED HELP?

**Before asking for help, try:**
1. Restart the program
2. Choose "Slow" speed
3. Try a smaller date range (1 week instead of 1 month)

**If still not working, write down:**
- What error message you see
- What you typed for dates and folder
- Windows or Mac?

---

## ✨ PRO TIPS

💡 **TIP 1:** Create a dedicated folder
```
Create: C:\Users\YourName\Desktop\SEC_Downloads
Use as download folder each time
```

💡 **TIP 2:** Use date format carefully
```
✅ CORRECT: 2026-01-01
❌ WRONG: 01-01-2026
❌ WRONG: 1-1-2026
```

💡 **TIP 3:** Download speed guide
```
Slow:   Best if having problems (safest)
Normal: Best for regular use (recommended)
Fast:   Only if you need it urgently (risky)
```

💡 **TIP 4:** Interrupted? No problem!
```
Just run the program again - it remembers what you already downloaded!
```

💡 **TIP 5:** Check your downloads
```
After download completes, open the folder and verify your PDFs are there.
```

---

## 🎉 YOU'RE READY!

**Windows:** Double-click `start-downloader.bat`  
**Mac:** Double-click `start-downloader.sh`

Follow the prompts → Wait for download → Done! ✅

**That's it! Happy downloading! 📥**
