const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const http = require("http");
const inquirer = require("inquirer");
const chalk = require("chalk");

const BASE_URL = "https://market.sec.or.th";
const DEFAULT_PORT = 3737;

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

function getListUrl(dateFrom, dateTo) {
  const from = dateFrom.replace(/-/g, "");
  const to = dateTo.replace(/-/g, "");
  return `${BASE_URL}/public/idisc/en/ViewMore/filing-dw?SecuTypeCode=DW&DbenEfftDateFrom=${from}&DbenEfftDateTo=${to}&FilingData=0`;
}

/**
 * Get user inputs for the link generator.
 * Returns { dateFrom, dateTo, filterIdentifiers }
 */
async function getLinkGenInputs() {
  console.log(chalk.yellow("\n💡 Tips:"));
  console.log(
    chalk.gray(
      "  • Default values are shown in parentheses — press Enter to use them",
    ),
  );
  console.log(chalk.gray("  • Or type your own value and press Enter\n"));

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const firstDay = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0);
  const lastDayStr = `${year}-${month}-${String(lastDay.getDate()).padStart(2, "0")}`;

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "dateFrom",
      message: "Start date (YYYY-MM-DD):",
      default: firstDay,
      validate: (input) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input))
          return "Please enter date in YYYY-MM-DD format";
        if (isNaN(new Date(input).getTime())) return "Please enter a valid date";
        return true;
      },
      transformer: (input) => chalk.cyan(input),
    },
    {
      type: "input",
      name: "dateTo",
      message: "End date (YYYY-MM-DD):",
      default: lastDayStr,
      validate: (input) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input))
          return "Please enter date in YYYY-MM-DD format";
        if (isNaN(new Date(input).getTime())) return "Please enter a valid date";
        return true;
      },
      transformer: (input) => chalk.cyan(input),
    },
  ]);

  if (new Date(answers.dateTo) < new Date(answers.dateFrom)) {
    console.log(chalk.red("\n❌ End date cannot be before start date!\n"));
    process.exit(1);
  }

  const { useFilter } = await inquirer.prompt([
    {
      type: "confirm",
      name: "useFilter",
      message: "Filter results by global identifier?",
      default: false,
    },
  ]);

  let filterIdentifiers = null;

  if (useFilter) {
    const filterAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "filterFilePath",
        message: "Excel file path containing identifiers:",
        validate: (input) => {
          const trimmed = input.trim();
          if (!trimmed) return "Please enter a file path";
          if (!fs.existsSync(trimmed)) return `File not found: ${trimmed}`;
          if (![".xlsx", ".xls"].includes(path.extname(trimmed).toLowerCase()))
            return "File must be an Excel file (.xlsx or .xls)";
          return true;
        },
        transformer: (input) => chalk.cyan(input),
      },
      {
        type: "input",
        name: "filterColumnName",
        message: "Column name containing the identifiers:",
        default: "global_identifier",
        validate: (input) => (input.trim() ? true : "Please enter a column name"),
        transformer: (input) => chalk.cyan(input),
      },
    ]);

    try {
      const workbook = XLSX.readFile(filterAnswers.filterFilePath.trim());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const colName = filterAnswers.filterColumnName.trim();

      if (rows.length === 0) {
        console.log(chalk.red("\n❌ The Excel sheet is empty!\n"));
        process.exit(1);
      }

      if (!(colName in rows[0])) {
        console.log(chalk.red(`\n❌ Column "${colName}" not found.`));
        console.log(
          chalk.gray(`   Available columns: ${Object.keys(rows[0]).join(", ")}\n`),
        );
        process.exit(1);
      }

      filterIdentifiers = new Set(
        rows.map((r) => String(r[colName]).trim()).filter(Boolean),
      );

      if (filterIdentifiers.size === 0) {
        console.log(
          chalk.red("\n❌ No identifiers found in the specified column!\n"),
        );
        process.exit(1);
      }

      console.log(
        chalk.green(
          `\n✓ Loaded ${filterIdentifiers.size} identifiers for filtering`,
        ),
      );
    } catch (err) {
      console.log(chalk.red(`\n❌ Could not read Excel file: ${err.message}\n`));
      process.exit(1);
    }
  }

  return {
    dateFrom: answers.dateFrom,
    dateTo: answers.dateTo,
    filterIdentifiers,
  };
}

/**
 * Parse the SEC listing page.
 * Extracts column headers and all data rows as plain objects.
 * Returns { headers: string[], rows: object[] }
 * Each row also carries a `_symbol` field for filtering.
 */
function parseListing(html) {
  const $ = cheerio.load(html);

  // Extract column headers from thead
  const headers = [];
  $("#gPP02T06 thead tr th").each((_, th) => {
    headers.push($(th).text().trim());
  });

  // Fallback: if no thead, try the first tr
  if (headers.length === 0) {
    $("#gPP02T06 tr:first-child th, #gPP02T06 tr:first-child td").each((_, cell) => {
      headers.push($(cell).text().trim());
    });
  }

  const rows = [];

  $("#gPP02T06 > tbody > tr").each((_, tr) => {
    const cells = [];
    $(tr).find("td").each((_, td) => {
      // For cells that have a link, also grab the href
      const a = $(td).find("a").first();
      const text = $(td).text().trim();
      const href = a.attr("href") || null;
      cells.push({ text, href });
    });

    if (cells.length === 0) return;

    // symbol is 3rd cell (index 2), same as the downloader
    const symbol = cells[2] ? cells[2].text : "";

    // Extract TransID from the last cell's link
    let transID = null;
    const lastHref = cells[cells.length - 1]?.href || "";
    const m = lastHref.match(/TransID=(\d+)/);
    if (m) transID = m[1];

    // Build filing URL if transID found
    const filingUrl = transID
      ? `${BASE_URL}/public/ipos/IPOSDW01.aspx?TransID=${transID}`
      : null;

    rows.push({ cells, symbol, transID, filingUrl });
  });

  return { headers, rows };
}

/**
 * Build a fully self-contained, browser-renderable HTML page
 * from the parsed table data. No external dependencies.
 */
function buildPage(headers, rows, dateFrom, dateTo, filterIdentifiers) {
  const totalFetched = rows.length;
  const filterNote = filterIdentifiers
    ? `Filtered: <strong>${rows.length}</strong> of ${totalFetched} matched identifier(s)`
    : `Showing all <strong>${rows.length}</strong> result(s)`;

  // Build header <th> cells
  const thCells = headers
    .map((h) => `<th>${escHtml(h)}</th>`)
    .join("\n        ");

  // Build data rows
  const dataRows = rows
    .map((row) => {
      const tds = row.cells
        .map((cell, i) => {
          const isLast = i === row.cells.length - 1;
          if (isLast && row.filingUrl) {
            return `<td><a href="${escHtml(row.filingUrl)}" target="_blank">${escHtml(cell.text)}</a></td>`;
          }
          return `<td>${escHtml(cell.text)}</td>`;
        })
        .join("\n          ");
      return `      <tr>\n          ${tds}\n      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SEC DW Listings — ${escHtml(dateFrom)} to ${escHtml(dateTo)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      background: #f4f6f9;
      color: #1a1a2e;
    }

    /* ── Banner ── */
    .banner {
      background: #1a1a2e;
      color: #e0e0e0;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      border-bottom: 3px solid #7c3aed;
    }
    .banner .title {
      color: #a78bfa;
      font-weight: 700;
      font-size: 15px;
      white-space: nowrap;
    }
    .banner .meta { color: #9ca3af; font-size: 12px; }
    .banner .hint {
      margin-left: auto;
      background: #7c3aed22;
      border: 1px solid #7c3aed55;
      color: #c4b5fd;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      white-space: nowrap;
    }

    /* ── Stats bar ── */
    .stats {
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      padding: 8px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 12px;
      color: #6b7280;
    }
    .stats strong { color: #1a1a2e; }

    /* ── Table wrapper ── */
    .table-wrap {
      padding: 16px 24px 40px;
      overflow-x: auto;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }

    thead tr {
      background: #1a1a2e;
      color: #e0e0e0;
    }
    thead th {
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      white-space: nowrap;
      letter-spacing: 0.02em;
    }

    tbody tr {
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.1s;
    }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: #f5f3ff; }

    td {
      padding: 8px 14px;
      white-space: nowrap;
      color: #374151;
    }

    a {
      color: #7c3aed;
      text-decoration: none;
      font-weight: 500;
    }
    a:hover { text-decoration: underline; }

    /* ── Empty state ── */
    .empty {
      text-align: center;
      padding: 60px 24px;
      color: #9ca3af;
      font-size: 14px;
    }

    /* ── Footer ── */
    .footer {
      text-align: center;
      padding: 16px;
      font-size: 11px;
      color: #9ca3af;
    }
  </style>
</head>
<body>

  <div class="banner">
    <span class="title">SEC DW Link Generator</span>
    <span class="meta">📅 ${escHtml(dateFrom)} &rarr; ${escHtml(dateTo)}</span>
    <span class="meta">🔎 ${filterNote}</span>
    <span class="hint">Excel: Data &rarr; From Web &rarr; paste URL &rarr; Load</span>
  </div>

  <div class="stats">
    <span>Source: <strong>market.sec.or.th</strong></span>
    <span>&bull;</span>
    <span>Generated: <strong>${new Date().toLocaleString()}</strong></span>
    <span>&bull;</span>
    <span>Rows: <strong>${rows.length}</strong></span>
  </div>

  <div class="table-wrap">
    ${
      rows.length === 0
        ? `<div class="empty">No warrants found for the selected criteria.</div>`
        : `<table id="dw-table">
      <thead>
        <tr>
        ${thCells}
        </tr>
      </thead>
      <tbody>
${dataRows}
      </tbody>
    </table>`
    }
  </div>

  <div class="footer">
    Data sourced from SEC Thailand &mdash; for Excel import, use <strong>Data &rarr; From Web</strong>
  </div>

</body>
</html>`;
}

/** HTML-escape a string */
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Start a local HTTP server serving the HTML page.
 * Returns the http.Server instance.
 */
function startServer(htmlContent, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/" || req.url === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(htmlContent);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(port, "127.0.0.1", () => resolve(server));
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use.`));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Main entry point — called from sec-dw-downloader.js
 */
async function runLinkGenerator({ fetchWithRetry }) {
  const { dateFrom, dateTo, filterIdentifiers } = await getLinkGenInputs();

  console.log(chalk.cyan("\n📋 Configuration Summary:"));
  console.log(chalk.gray("─".repeat(50)));
  console.log(`  ${chalk.white("Date Range:")} ${dateFrom} to ${dateTo}`);
  if (filterIdentifiers) {
    console.log(
      `  ${chalk.white("ID Filter:")} ${chalk.yellow("ON")} (${filterIdentifiers.size} identifiers)`,
    );
  } else {
    console.log(`  ${chalk.white("ID Filter:")} ${chalk.gray("OFF (showing all)")}`);
  }
  console.log(chalk.gray("─".repeat(50)));

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Generate link?",
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow("\n👋 Cancelled.\n"));
    return;
  }

  console.log(chalk.cyan("\n🚀 Fetching data...\n"));

  let html;
  try {
    console.log(chalk.yellow("🔍 Fetching warrant listings from SEC..."));
    const response = await fetchWithRetry(getListUrl(dateFrom, dateTo));
    html = response.data;
    console.log(chalk.green("✓ Listing fetched"));
  } catch (err) {
    console.log(chalk.red(`\n❌ Failed to fetch listing: ${err.message}\n`));
    return;
  }

  let { headers, rows } = parseListing(html);

  if (rows.length === 0) {
    console.log(chalk.yellow("⚠️  No warrants found for this date range.\n"));
    return;
  }

  console.log(chalk.green(`✓ Found ${rows.length} warrants`));

  if (filterIdentifiers) {
    const before = rows.length;
    rows = rows.filter((r) => r.symbol && filterIdentifiers.has(r.symbol));
    console.log(
      chalk.green(`✓ ${rows.length} of ${before} warrants matched the filter`),
    );

    if (rows.length === 0) {
      console.log(
        chalk.yellow("\n⚠️  No warrants matched the provided identifiers.\n"),
      );
      return;
    }
  }

  const pageHtml = buildPage(headers, rows, dateFrom, dateTo, filterIdentifiers);

  let server;
  try {
    server = await startServer(pageHtml, DEFAULT_PORT);
  } catch (err) {
    console.log(chalk.red(`\n❌ ${err.message}\n`));
    return;
  }

  const url = `http://127.0.0.1:${DEFAULT_PORT}/`;

  console.log(chalk.green("\n✅ Server is running!\n"));
  console.log(chalk.gray("─".repeat(60)));
  console.log(`  ${chalk.white("🔗 URL:")} ${chalk.cyan(url)}`);
  console.log(`  ${chalk.white("📊 Rows:")} ${rows.length} warrant(s)`);
  console.log(chalk.gray("─".repeat(60)));
  console.log(chalk.yellow("\n  Open in browser:"));
  console.log(chalk.gray(`    → ${url}`));
  console.log(chalk.yellow("\n  Import in Excel:"));
  console.log(chalk.gray("    1. Data tab → From Web"));
  console.log(chalk.gray(`    2. Paste: ${url}`));
  console.log(chalk.gray("    3. Select the table → Load"));
  console.log(chalk.gray("\n  Press Ctrl+C to stop the server and clean up.\n"));

  function cleanup() {
    console.log(chalk.yellow("\n\n🧹 Shutting down server..."));
    server.close(() => {
      console.log(chalk.green("✓ Server stopped. Goodbye!\n"));
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2000);
  }

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Keep process alive until Ctrl+C
  await new Promise(() => {});
}

module.exports = { runLinkGenerator };
