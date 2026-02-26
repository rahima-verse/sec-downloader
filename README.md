# 📥 SEC DW Downloader - Easy Setup Guide

A simple, user-friendly toolkit to download Derivative Warrant Terms & Conditions from SEC Thailand, look up ISIN codes, and match columns across datasets.

---

## 🎯 Quick Start (For Users)

### First Time Setup

#### On Windows:

1. **Install Node.js** (one-time setup)
   - Download from: https://nodejs.org/
   - Choose "LTS" version (recommended)
   - Run installer and click "Next" until finished
   - Restart your computer

2. **Setup the Downloader**
   - Extract the downloaded folder to your Desktop
   - Double-click `start-downloader.bat`
   - First time will install required files (takes 1-2 minutes)

3. **Create Desktop Shortcut** (optional)
   - Right-click `start-downloader.bat`
   - Choose "Send to" → "Desktop (create shortcut)"
   - Rename shortcut to "Download DW Files"

#### On Mac:

1. **Install Node.js** (one-time setup)
   - Download from: https://nodejs.org/
   - Choose "LTS" version (recommended)
   - Open the downloaded file and follow installation steps
   - Restart your computer

2. **Setup the Downloader**
   - Extract the downloaded folder to your Desktop
   - Open Terminal (Applications → Utilities → Terminal)
   - Type: `cd ` (with a space at the end)
   - Drag the extracted folder into Terminal window
   - Press Enter
   - Type: `chmod +x start-downloader.sh`
   - Press Enter
   - Type: `./start-downloader.sh`

3. **Create Desktop Shortcut** (optional)
   - Right-click `start-downloader.sh`
   - Choose "Make Alias"
   - Drag alias to Desktop
   - Rename to "Download DW Files"

---

## 🧰 Available Tools

When you start the program, you'll be asked to choose a tool:

### 📄 Documents Downloader

Download DW Terms & Conditions PDFs from SEC Thailand.

### 🔎 ISIN Finder

Look up ISIN codes for DW symbols. Reads identifiers from an Excel file and writes the matching ISIN codes back.

### 🔗 Column Matcher

Align column B rows to match column A values across datasets.

---

## 💡 How to Use

### Starting the Program:

**Windows:** Double-click `start-downloader.bat` (or your desktop shortcut)

**Mac:** Double-click `start-downloader.sh` (or your desktop shortcut)

### 📄 Documents Downloader

The program will ask you for:

1. **Start Date**
   - Format: YYYY-MM-DD
   - Example: `2026-01-01`
   - Press Enter to use default (1st of current month)

2. **End Date**
   - Format: YYYY-MM-DD
   - Example: `2026-01-31`
   - Press Enter to use default (last day of current month)

3. **Download Folder**
   - Where to save the PDF files
   - Default: `./downloads` (creates folder next to the program)
   - Or specify: `C:\Users\YourName\Desktop\SEC_Files`
   - Press Enter to use default

4. **Filter by Global Identifier** (optional)
   - Default: No (download all warrants in the date range)
   - If Yes, provide:
     - Path to an Excel file (`.xlsx` / `.xls`) containing identifiers
     - Column name with the identifiers (default: `global_identifier`)
   - Only warrants matching identifiers in that column will be downloaded

5. **Confirm**
   - Review your settings
   - Press Enter to start, or type `n` to cancel

### While Downloading:

- A progress bar shows how many files are downloaded
- Don't close the window!
- Downloads run at fast speed (5 parallel downloads)

### When Finished:

- Summary shows successful and failed downloads
- Files are in your chosen download folder
- Press Enter to close the program

### 🔎 ISIN Finder

1. **Excel file path** — the file containing DW symbols
2. **Identifier column** — column name with the DW symbols (default: `global_identifier`)
3. **Target column** — column name to write ISINs into (default: `isin`)

The tool fetches ISIN codes from the SET website and writes them back into your Excel file.

### 🔗 Column Matcher

Follow the prompts to align column values across datasets.

---

## 📁 File Structure

```
sec-dw-downloader/
├── start-downloader.bat        ← Windows: Double-click this!
├── start-downloader.sh         ← Mac: Double-click this!
├── sec-dw-downloader.js        (main program)
├── isin-finder.js              (ISIN lookup module)
├── column-matcher.js           (column matching module)
├── package.json                (dependencies list)
├── README.md                   (this file)
│
└── downloads/                  ← Your PDF files will be here
    ├── ABC_Terms_123456.pdf
    ├── XYZ_Terms_123457.pdf
    ├── .cache/                 (temp files - can delete)
    └── .progress.json          (tracks progress)
```

---

## 🔧 Features

✅ **Three Tools in One** - Downloader, ISIN Finder, and Column Matcher
✅ **Simple & Easy** - Just answer a few questions
✅ **ID Filtering** - Download only specific warrants from an Excel list
✅ **Resume Support** - If interrupted, run again and it continues
✅ **Smart Caching** - Faster on repeated downloads
✅ **Progress Bar** - See real-time download progress
✅ **Error Handling** - Retries failed downloads automatically
✅ **Safe** - Won't re-download existing files

---

## 💾 Downloaded Files

Files are saved with their original names, usually like:

```
N-KGI0073-2026VAC14KBANK13C2607BDW_TERMS_AND_CONDITIONS_740646.pdf
```

Each file contains the Terms & Conditions for one derivative warrant.

---

## ❓ Troubleshooting

### "Node.js not found" error

- **Solution:** Install Node.js from https://nodejs.org/
- Make sure to restart your computer after installing

### "Failed to install dependencies"

- **Solution:** Check your internet connection
- Try running again (it will retry automatically)

### "No warrants found"

- **Solution:** Check your date range
- Make sure dates are correct (YYYY-MM-DD format)
- Try a different date range

### "No warrants matched the provided identifiers"

- **Solution:** Check that the identifiers in your Excel file match the DW symbols on SEC
- Verify the correct column name was specified

### "Column not found"

- **Solution:** Check the column name (case-sensitive)
- The available columns will be shown in the error message

### Program closes immediately

- **Solution:** Run from Terminal/Command Prompt to see errors
- Make sure all files are in the same folder

### Files not downloading

- **Windows:** Run `start-downloader.bat` as Administrator (right-click)
- **Mac:** Check folder permissions
- Try a different download folder location

---

## 🆘 Support

If you need help:

1. Check the troubleshooting section above
2. Look at the error message (write it down)
3. Check the `.progress.json` file in downloads folder
4. Contact the developer with:
   - Operating system (Windows/Mac)
   - Error message
   - What you were trying to do

---

## 📝 Tips

💡 **Tip 1:** Create a folder like "SEC_Downloads" on your Desktop and use that as download folder

💡 **Tip 2:** Use the ID filter feature to download only the warrants you need — saves time!

💡 **Tip 3:** If download fails, just run the program again - it will continue where it stopped

💡 **Tip 4:** Downloaded files can be deleted from `.cache` folder to free up space

💡 **Tip 5:** You can run the program multiple times with different date ranges

---

## 🔄 Updating

To get the latest version:

1. Download new version
2. Extract to same location (overwrite old files)
3. Your downloads and progress are safe!

---

## 🎉 That's It!

You're ready to use the SEC DW Toolkit!

**Just double-click the start file and follow the prompts.**

Happy downloading! 📥
