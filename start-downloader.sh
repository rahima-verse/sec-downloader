#!/bin/bash
# SEC DW Downloader - Mac/Linux Launcher
# Double-click this file to run the downloader

# Change to the directory where this script is located
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if node_modules exists, if not run npm install
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install dependencies"
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Run the downloader
node sec-dw-downloader.js

# Keep terminal open if there was an error
if [ $? -ne 0 ]; then
    read -p "Press Enter to exit..."
fi
