@echo off
:: SEC DW Downloader - Windows Launcher
:: Double-click this file to run the downloader

title SEC DW Downloader

:: Change to the directory where this script is located
cd /d "%~dp0"

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if node_modules exists, if not run npm install
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Run the downloader
node sec-dw-downloader.js

:: Keep window open if there was an error
if %errorlevel% neq 0 (
    pause
)
