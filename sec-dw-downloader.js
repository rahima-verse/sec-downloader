#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
const inquirer = require('inquirer');
const chalk = require('chalk');
const figlet = require('figlet');

/**
 * Configuration (will be updated by user input)
 */
let CONFIG = {
    downloadDir: './downloads',
    cacheDir: './cache',
    progressFile: './progress.json',
    concurrentDownloads: 3,
    retryAttempts: 3,
    retryDelay: 2000,
    requestDelay: 1000,
    timeout: 30000,
    dateFrom: null,
    dateTo: null
};

/**
 * URLs
 */
const URLS = {
    base: 'https://market.sec.or.th',
    getListUrl: () => {
        const dateFrom = CONFIG.dateFrom.replace(/-/g, '');
        const dateTo = CONFIG.dateTo.replace(/-/g, '');
        return `${URLS.base}/public/idisc/en/ViewMore/filing-dw?SecuTypeCode=DW&DbenEfftDateFrom=${dateFrom}&DbenEfftDateTo=${dateTo}&FilingData=0`;
    }
};

/**
 * Browser-like headers
 */
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0'
};

/**
 * Display welcome banner
 */
function displayBanner() {
    console.clear();
    console.log(
        chalk.cyan(
            figlet.textSync('SEC DW Downloader', {
                font: 'Standard',
                horizontalLayout: 'default'
            })
        )
    );
    console.log(chalk.gray('  Thailand Derivative Warrant Terms & Conditions Downloader\n'));
}

/**
 * Get user inputs with smart defaults
 */
async function getUserInputs() {
    // Show helpful tips
    console.log(chalk.yellow('\n💡 Tips:'));
    console.log(chalk.gray('  • Default values are shown in parentheses - press Enter to use them'));
    console.log(chalk.gray('  • Or type your own value and press Enter'));
    console.log(chalk.gray('  • Use arrow keys (↑↓) to select download speed\n'));
    
    // Calculate smart date defaults (current month)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const firstDay = `${year}-${month}-01`;
    const lastDay = new Date(year, now.getMonth() + 1, 0);
    const lastDayStr = `${year}-${month}-${String(lastDay.getDate()).padStart(2, '0')}`;
    
    const questions = [
        {
            type: 'input',
            name: 'dateFrom',
            message: 'Start date (YYYY-MM-DD):',
            default: firstDay,
            validate: (input) => {
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(input)) {
                    return 'Please enter date in YYYY-MM-DD format (e.g., 2026-01-01)';
                }
                const date = new Date(input);
                if (isNaN(date.getTime())) {
                    return 'Please enter a valid date';
                }
                return true;
            },
            transformer: (input) => chalk.cyan(input) // Show input in cyan color
        },
        {
            type: 'input',
            name: 'dateTo',
            message: 'End date (YYYY-MM-DD):',
            default: lastDayStr,
            validate: (input) => {
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(input)) {
                    return 'Please enter date in YYYY-MM-DD format (e.g., 2026-01-31)';
                }
                const date = new Date(input);
                if (isNaN(date.getTime())) {
                    return 'Please enter a valid date';
                }
                return true;
            },
            transformer: (input) => chalk.cyan(input)
        },
        {
            type: 'input',
            name: 'downloadDir',
            message: 'Save files to folder:',
            default: './downloads',
            validate: (input) => {
                if (!input || input.trim() === '') {
                    return 'Please enter a folder path';
                }
                return true;
            },
            transformer: (input) => chalk.cyan(input)
        },
        {
            type: 'list',
            name: 'speed',
            message: 'Download speed:',
            choices: [
                { name: '🚶 Normal (Recommended)', value: 'normal' },
                { name: '🐢 Slow (Safest - Avoid blocks)', value: 'slow' },
                { name: '🏃 Fast (Risky but quick)', value: 'fast' }
            ],
            default: 'normal'
        }
    ];

    const answers = await inquirer.prompt(questions);
    
    // Validate date range
    const startDate = new Date(answers.dateFrom);
    const endDate = new Date(answers.dateTo);
    
    if (endDate < startDate) {
        console.log(chalk.red('\n❌ End date cannot be before start date!\n'));
        process.exit(1);
    }

    // Update config based on speed
    const speedSettings = {
        slow: { concurrent: 1, delay: 2000 },
        normal: { concurrent: 3, delay: 1000 },
        fast: { concurrent: 5, delay: 500 }
    };

    const settings = speedSettings[answers.speed];
    CONFIG.concurrentDownloads = settings.concurrent;
    CONFIG.requestDelay = settings.delay;
    CONFIG.dateFrom = answers.dateFrom;
    CONFIG.dateTo = answers.dateTo;
    CONFIG.downloadDir = answers.downloadDir;
    CONFIG.cacheDir = path.join(CONFIG.downloadDir, '.cache');
    CONFIG.progressFile = path.join(CONFIG.downloadDir, '.progress.json');

    return answers;
}

/**
 * Display configuration summary
 */
function displayConfig() {
    console.log(chalk.cyan('\n📋 Configuration Summary:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  ${chalk.white('Date Range:')} ${CONFIG.dateFrom} to ${CONFIG.dateTo}`);
    console.log(`  ${chalk.white('Download Folder:')} ${path.resolve(CONFIG.downloadDir)}`);
    console.log(`  ${chalk.white('Parallel Downloads:')} ${CONFIG.concurrentDownloads}`);
    console.log(chalk.gray('─'.repeat(50)));
}

/**
 * Ask for confirmation
 */
async function confirmStart() {
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Start downloading?',
            default: true
        }
    ]);

    return confirm;
}

/**
 * Initialize directories
 */
function initializeDirectories() {
    [CONFIG.downloadDir, CONFIG.cacheDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

/**
 * Create axios instance
 */
const httpClient = axios.create({
    timeout: CONFIG.timeout,
    maxRedirects: 5,
    headers: BROWSER_HEADERS
});

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Progress tracker class
 */
class ProgressTracker {
    constructor(filepath) {
        this.filepath = filepath;
        this.data = this.load();
    }

    load() {
        if (fs.existsSync(this.filepath)) {
            try {
                return JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
            } catch (error) {
                return { completed: [], failed: [], pending: [] };
            }
        }
        return { completed: [], failed: [], pending: [] };
    }

    save() {
        fs.writeFileSync(this.filepath, JSON.stringify(this.data, null, 2));
    }

    isCompleted(transID) {
        return this.data.completed.some(item => item.transID === transID);
    }

    markCompleted(result) {
        this.data.completed.push(result);
        this.data.pending = this.data.pending.filter(id => id !== result.transID);
        this.save();
    }

    markFailed(result) {
        this.data.failed.push(result);
        this.data.pending = this.data.pending.filter(id => id !== result.transID);
        this.save();
    }

    setPending(transIDs) {
        this.data.pending = transIDs.filter(id => !this.isCompleted(id));
        this.save();
    }

    getPending() {
        return this.data.pending;
    }

    getStats() {
        return {
            completed: this.data.completed.length,
            failed: this.data.failed.length,
            pending: this.data.pending.length
        };
    }
}

/**
 * Cache manager class
 */
class CacheManager {
    constructor(cacheDir) {
        this.cacheDir = cacheDir;
    }

    getCachePath(key) {
        const safeKey = key.replace(/[^a-zA-Z0-9]/g, '_');
        return path.join(this.cacheDir, `${safeKey}.html`);
    }

    has(key) {
        return fs.existsSync(this.getCachePath(key));
    }

    get(key) {
        if (this.has(key)) {
            return fs.readFileSync(this.getCachePath(key), 'utf8');
        }
        return null;
    }

    set(key, data) {
        fs.writeFileSync(this.getCachePath(key), data);
    }
}

/**
 * Fetch with retry
 */
async function fetchWithRetry(url, options = {}, retries = CONFIG.retryAttempts) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await httpClient.get(url, options);
            return response;
        } catch (error) {
            if (attempt === retries) throw error;
            await sleep(CONFIG.retryDelay * attempt);
        }
    }
}

/**
 * Extract TransIDs from listing page
 */
async function extractTransIDs(cache) {
    console.log(chalk.yellow('\n🔍 Fetching warrant listings...'));
    
    try {
        const cacheKey = `listing_${CONFIG.dateFrom}_${CONFIG.dateTo}`;
        let html = cache.get(cacheKey);
        
        if (!html) {
            const response = await fetchWithRetry(URLS.getListUrl());
            html = response.data;
            cache.set(cacheKey, html);
            console.log(chalk.green('✓ Listing fetched'));
        } else {
            console.log(chalk.green('✓ Using cached listing'));
        }
        
        const $ = cheerio.load(html);
        const transIDs = [];
        
        $('table tbody tr').each((index, row) => {
            const filingLink = $(row).find('td:last-child a').attr('href');
            if (filingLink) {
                const match = filingLink.match(/TransID=(\d+)/);
                if (match && match[1]) {
                    transIDs.push(match[1]);
                }
            }
        });
        
        return transIDs;
        
    } catch (error) {
        throw new Error(`Failed to fetch listings: ${error.message}`);
    }
}

/**
 * Extract Terms URL from detail page
 */
function extractTermsURL(html) {
    const $ = cheerio.load(html);
    
    const issuer = $('span#ctl00_ContentPlaceHolder1_lblIssuer').text().trim();
    const symbol = $('span#ctl00_ContentPlaceHolder1_lblSymbol').text().trim();
    
    let termsFileURL = null;
    let fileDate = null;
    
    $('table tbody tr').each((index, row) => {
        const topicText = $(row).find('td:first-child').text().trim();
        
        if (topicText.toLowerCase().includes('ข้อกำหนดสิทธิฉบับหลัก เฉพาะ')) {
            fileDate = $(row).find('td:last-child a').text().trim();
            const onclick = $(row).find('td:last-child a').attr('onclick');
            if (onclick) {
                const urlMatch = onclick.match(/window\.open\('([^']+)'/);
                if (urlMatch && urlMatch[1]) {
                    termsFileURL = urlMatch[1].replace(/&amp;/g, '&');
                }
            }
        }
    });
    
    if (!termsFileURL) return null;
    
    if (!termsFileURL.startsWith('http')) {
        termsFileURL = URLS.base + termsFileURL;
    }
    
    return { url: termsFileURL, issuer, symbol, fileDate };
}

/**
 * Download single warrant
 */
async function downloadWarrant(transID, cache, progressBar) {
    const detailURL = `${URLS.base}/public/ipos/IPOSDW01.aspx?TransID=${transID}`;
    
    try {
        let html = cache.get(`detail_${transID}`);
        
        if (!html) {
            await sleep(CONFIG.requestDelay);
            const response = await fetchWithRetry(detailURL, {
                headers: { ...BROWSER_HEADERS, 'Referer': URLS.getListUrl() }
            });
            html = response.data;
            cache.set(`detail_${transID}`, html);
        }
        
        const termsInfo = extractTermsURL(html);
        if (!termsInfo) {
            progressBar.increment();
            return { success: false, transID, reason: 'Terms file not found' };
        }
        
        const fileResponse = await fetchWithRetry(termsInfo.url, {
            responseType: 'arraybuffer',
            headers: { ...BROWSER_HEADERS, 'Referer': detailURL }
        });
        
        let filename = null;
        const contentDisposition = fileResponse.headers['content-disposition'];
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }
        
        if (!filename) {
            const safeSymbol = termsInfo.symbol.replace(/[^a-zA-Z0-9]/g, '_');
            filename = `${safeSymbol}_Terms_${transID}.pdf`;
        }
        
        const filepath = path.join(CONFIG.downloadDir, filename);
        fs.writeFileSync(filepath, fileResponse.data);
        
        progressBar.increment();
        
        return {
            success: true,
            transID,
            symbol: termsInfo.symbol,
            issuer: termsInfo.issuer,
            filename,
            fileDate: termsInfo.fileDate,
            fileSize: fileResponse.data.length
        };
        
    } catch (error) {
        progressBar.increment();
        return { success: false, transID, reason: error.message };
    }
}

/**
 * Process downloads in parallel
 */
async function processDownloads(transIDs, cache, progress) {
    const total = transIDs.length;
    
    const progressBar = new cliProgress.SingleBar({
        format: chalk.cyan('Downloading') + ' |{bar}| {percentage}% | {value}/{total} files',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true
    });
    
    progressBar.start(total, 0);
    
    const results = [];
    
    for (let i = 0; i < transIDs.length; i += CONFIG.concurrentDownloads) {
        const batch = transIDs.slice(i, i + CONFIG.concurrentDownloads);
        const batchResults = await Promise.all(
            batch.map(transID => downloadWarrant(transID, cache, progressBar))
        );
        
        batchResults.forEach(result => {
            if (result.success) {
                progress.markCompleted(result);
            } else {
                progress.markFailed(result);
            }
            results.push(result);
        });
    }
    
    progressBar.stop();
    return results;
}

/**
 * Display summary
 */
function displaySummary(results) {
    console.log(chalk.cyan('\n\n📊 Download Summary'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`  ${chalk.green('✓ Successful:')} ${successful.length}`);
    console.log(`  ${chalk.red('✗ Failed:')} ${failed.length}`);
    
    if (successful.length > 0) {
        const totalSize = successful.reduce((sum, r) => sum + (r.fileSize || 0), 0);
        console.log(`  ${chalk.white('📦 Total size:')} ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    }
    
    console.log(`  ${chalk.white('📁 Location:')} ${path.resolve(CONFIG.downloadDir)}`);
    console.log(chalk.gray('─'.repeat(50)));
    
    if (failed.length > 0 && failed.length <= 10) {
        console.log(chalk.red('\n❌ Failed downloads:'));
        failed.forEach(f => {
            console.log(chalk.gray(`  • TransID ${f.transID}: ${f.reason}`));
        });
    }
}

/**
 * Main function
 */
async function main() {
    try {
        // Display banner
        displayBanner();
        
        // Get user inputs
        await getUserInputs();
        
        // Display config
        displayConfig();
        
        // Confirm start
        const shouldStart = await confirmStart();
        if (!shouldStart) {
            console.log(chalk.yellow('\n👋 Cancelled. Goodbye!\n'));
            process.exit(0);
        }
        
        // Initialize
        console.log(chalk.cyan('\n🚀 Starting download process...\n'));
        initializeDirectories();
        const cache = new CacheManager(CONFIG.cacheDir);
        const progress = new ProgressTracker(CONFIG.progressFile);
        
        // Get TransIDs
        const allTransIDs = await extractTransIDs(cache);
        
        if (allTransIDs.length === 0) {
            console.log(chalk.yellow('⚠️  No warrants found for this date range.\n'));
            process.exit(0);
        }
        
        console.log(chalk.green(`✓ Found ${allTransIDs.length} warrants\n`));
        
        // Filter pending
        progress.setPending(allTransIDs);
        const pendingTransIDs = progress.getPending();
        const stats = progress.getStats();
        
        if (stats.completed > 0) {
            console.log(chalk.gray(`  (${stats.completed} already downloaded, ${pendingTransIDs.length} remaining)\n`));
        }
        
        if (pendingTransIDs.length === 0) {
            console.log(chalk.green('✅ All files already downloaded!\n'));
            process.exit(0);
        }
        
        // Process downloads
        const results = await processDownloads(pendingTransIDs, cache, progress);
        
        // Display summary
        displaySummary(results);
        
        console.log(chalk.green('\n✅ Download complete!\n'));
        
        // Wait for user to press enter
        await inquirer.prompt([
            {
                type: 'input',
                name: 'exit',
                message: 'Press Enter to exit...'
            }
        ]);
        
    } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
        console.log(chalk.gray('Please try again or contact support.\n'));
        process.exit(1);
    }
}

// Run
if (require.main === module) {
    main();
}

module.exports = { main };