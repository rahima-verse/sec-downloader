"use strict";

const fs = require("fs");
const path = require("path");
const cliProgress = require("cli-progress");
const inquirer = require("inquirer");
const chalk = require("chalk");
const XLSX = require("xlsx");

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Cache-Control": "max-age=0",
};

/**
 * Prompt user for ISIN finder inputs
 */
async function getIsinInputs() {
  console.log(chalk.yellow("\n💡 Tips:"));
  console.log(
    chalk.gray("  • Enter the full path to your Excel file (.xlsx / .xls)"),
  );
  console.log(chalk.gray("  • Column names are case-sensitive\n"));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "filePath",
      message: "Excel file path:",
      validate: (input) => {
        const trimmed = input.trim();
        if (!trimmed) return "Please enter a file path";
        if (!fs.existsSync(trimmed)) return `File not found: ${trimmed}`;
        if (![".xlsx", ".xls"].includes(path.extname(trimmed).toLowerCase())) {
          return "File must be an Excel file (.xlsx or .xls)";
        }
        return true;
      },
      transformer: (input) => chalk.cyan(input),
    },
    {
      type: "input",
      name: "identifierCol",
      message: "Column name containing global identifiers (e.g. DW symbol):",
      default: "global_identifier",
      validate: (input) => (input.trim() ? true : "Please enter a column name"),
      transformer: (input) => chalk.cyan(input),
    },
    {
      type: "input",
      name: "targetCol",
      message: "Target column name to write ISINs into:",
      default: "isin",
      validate: (input) => (input.trim() ? true : "Please enter a column name"),
      transformer: (input) => chalk.cyan(input),
    },
  ]);

  return {
    filePath: answers.filePath.trim(),
    identifierCol: answers.identifierCol.trim(),
    targetCol: answers.targetCol.trim(),
  };
}

/**
 * Fetch ISIN for a single identifier from SET website.
 * Returns the ISIN string, or null if not found.
 * @param {string} identifier
 * @param {Function} fetchWithRetry  shared HTTP helper from main module
 */
async function fetchIsin(identifier, fetchWithRetry) {
  const url = `https://www.set.or.th/en/market/product/dw/quote/${encodeURIComponent(identifier)}/price`;
  try {
    const response = await fetchWithRetry(url, {
      headers: {
        ...BROWSER_HEADERS,
        Referer: "https://www.set.or.th/en/market/product/dw",
      },
    });

    const html = response.data;

    // ISIN is embedded in the server-side __NUXT__ state — no JS rendering needed
    const nuxtIdx = html.indexOf("window.__NUXT__");
    if (nuxtIdx === -1) return null;

    const nuxtEnd = html.indexOf("</script>", nuxtIdx);
    const nuxtScript = html.slice(nuxtIdx, nuxtEnd);

    // ISIN format: 2 uppercase letters + 9 alphanumeric + 1 digit (ISO 6166)
    const match = nuxtScript.match(/["']([A-Z]{2}[A-Z0-9]{9}[0-9])['"]/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Run the ISIN finder flow.
 * @param {{ fetchWithRetry: Function, sleep: Function, config: object }} deps
 */
async function runIsinFinder({ fetchWithRetry, sleep, config }) {
  const { filePath, identifierCol, targetCol } = await getIsinInputs();

  // Read workbook
  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (err) {
    console.log(chalk.red(`\n❌ Could not read Excel file: ${err.message}\n`));
    process.exit(1);
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rows.length === 0) {
    console.log(chalk.yellow("\n⚠️  The sheet is empty.\n"));
    process.exit(0);
  }

  // Validate column exists
  if (!(identifierCol in rows[0])) {
    const available = Object.keys(rows[0]).join(", ");
    console.log(chalk.red(`\n❌ Column "${identifierCol}" not found.`));
    console.log(chalk.gray(`   Available columns: ${available}\n`));
    process.exit(1);
  }

  const identifiers = rows
    .map((r) => String(r[identifierCol]).trim())
    .filter(Boolean);
  const unique = [...new Set(identifiers)];

  console.log(
    chalk.cyan(
      `\n📋 Found ${rows.length} rows, ${unique.length} unique identifiers\n`,
    ),
  );

  // Fetch ISINs with progress bar
  const progressBar = new cliProgress.SingleBar({
    format:
      chalk.cyan("Fetching ISINs") + " |{bar}| {percentage}% | {value}/{total}",
    barCompleteChar: "█",
    barIncompleteChar: "░",
    hideCursor: true,
  });

  progressBar.start(unique.length, 0);

  const isinMap = new Map(); // identifier -> isin | null
  const errors = [];

  for (let i = 0; i < unique.length; i += config.concurrentDownloads) {
    const batch = unique.slice(i, i + config.concurrentDownloads);
    await Promise.all(
      batch.map(async (id) => {
        await sleep(config.requestDelay);
        const isin = await fetchIsin(id, fetchWithRetry);
        isinMap.set(id, isin);
        if (!isin) errors.push(id);
        progressBar.increment();
      }),
    );
  }

  progressBar.stop();

  // Summary
  const found = unique.length - errors.length;
  console.log(chalk.cyan("\n📊 Fetch Summary"));
  console.log(chalk.gray("─".repeat(50)));
  console.log(`  ${chalk.green("✓ ISINs found:")} ${found}`);
  console.log(`  ${chalk.red("✗ Not found:")}   ${errors.length}`);

  if (errors.length > 0 && errors.length <= 20) {
    console.log(chalk.red("\n  Identifiers with no ISIN:"));
    errors.forEach((id) => console.log(chalk.gray(`    • ${id}`)));
  }
  console.log(chalk.gray("─".repeat(50)));

  if (found === 0) {
    console.log(
      chalk.yellow("\n⚠️  No ISINs were found. File will not be modified.\n"),
    );
    process.exit(0);
  }

  // Confirm write
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Write ISINs to column "${targetCol}" in ${path.basename(filePath)}?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow("\n👋 Cancelled. No changes written.\n"));
    process.exit(0);
  }

  // Write back to Excel
  rows.forEach((row) => {
    const id = String(row[identifierCol]).trim();
    const isin = isinMap.get(id);
    row[targetCol] = isin != null ? isin : row[targetCol] || "";
  });

  const newSheet = XLSX.utils.json_to_sheet(rows);
  workbook.Sheets[sheetName] = newSheet;
  XLSX.writeFile(workbook, filePath);

  console.log(
    chalk.green(
      `\n✅ Done! ISINs written to "${targetCol}" in ${path.resolve(filePath)}\n`,
    ),
  );
}

module.exports = { runIsinFinder };
