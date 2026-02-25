"use strict";

const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const chalk = require("chalk");
const XLSX = require("xlsx");

/**
 * Prompt user for column matcher inputs
 */
async function getColumnMatcherInputs() {
  console.log(chalk.yellow("\n💡 Tips:"));
  console.log(chalk.gray("  • Column A is the reference column (stays in place)"));
  console.log(chalk.gray("  • Column B values will be reordered to align with matches in column A"));
  console.log(chalk.gray("  • Rows where B has no match in A will be placed at the bottom\n"));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "filePath",
      message: "Excel file path:",
      validate: (input) => {
        const trimmed = input.trim();
        if (!trimmed) return "Please enter a file path";
        if (!fs.existsSync(trimmed)) return `File not found: ${trimmed}`;
        const ext = path.extname(trimmed).toLowerCase();
        if (![".xlsx", ".xls"].includes(ext))
          return "File must be an Excel file (.xlsx or .xls)";
        return true;
      },
      transformer: (input) => chalk.cyan(input),
    },
    {
      type: "input",
      name: "colA",
      message: "Column A name (reference column):",
      validate: (input) => (input.trim() ? true : "Please enter a column name"),
      transformer: (input) => chalk.cyan(input),
    },
    {
      type: "input",
      name: "colB",
      message: "Column B name (column to reorder):",
      validate: (input) => (input.trim() ? true : "Please enter a column name"),
      transformer: (input) => chalk.cyan(input),
    },
    {
      type: "input",
      name: "outputPath",
      message: "Output file path (leave blank to overwrite input):",
      transformer: (input) => chalk.cyan(input),
    },
  ]);

  return {
    filePath: answers.filePath.trim(),
    colA: answers.colA.trim(),
    colB: answers.colB.trim(),
    outputPath: answers.outputPath.trim() || answers.filePath.trim(),
  };
}

/**
 * Run the column matcher flow.
 */
async function runColumnMatcher() {
  const { filePath, colA, colB, outputPath } = await getColumnMatcherInputs();

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

  // Validate columns exist
  for (const col of [colA, colB]) {
    if (!(col in rows[0])) {
      const available = Object.keys(rows[0]).join(", ");
      console.log(chalk.red(`\n❌ Column "${col}" not found.`));
      console.log(chalk.gray(`   Available columns: ${available}\n`));
      process.exit(1);
    }
  }

  // Build a map of value -> list of rows from column B (preserving order for duplicates)
  const bValueMap = new Map(); // bValue -> [row, row, ...]
  for (const row of rows) {
    const bVal = String(row[colB]).trim();
    if (!bValueMap.has(bVal)) bValueMap.set(bVal, []);
    bValueMap.get(bVal).push({ ...row });
  }

  // For each row in A, find a matching B row and align it
  const matched = [];
  const usedBRows = new Set();
  const allBRows = rows.map((r, i) => ({ row: { ...r }, used: false, idx: i }));

  // Build index for fast lookup: bVal -> array of indices in allBRows
  const bIndex = new Map();
  for (let i = 0; i < allBRows.length; i++) {
    const bVal = String(allBRows[i].row[colB]).trim();
    if (!bIndex.has(bVal)) bIndex.set(bVal, []);
    bIndex.get(bVal).push(i);
  }

  const unmatched = [];

  for (let i = 0; i < rows.length; i++) {
    const aVal = String(rows[i][colA]).trim();
    const candidates = bIndex.get(aVal) || [];

    // Pick the first unused candidate
    const candidateIdx = candidates.find((ci) => !usedBRows.has(ci));

    if (candidateIdx !== undefined) {
      usedBRows.add(candidateIdx);
      // Merge: keep all columns from original row i, but replace colB with the matched B row's colB
      const matchedBRow = allBRows[candidateIdx].row;
      matched.push({ ...rows[i], [colB]: matchedBRow[colB] });
    } else {
      // No match found — keep row as-is, colB will be empty for this slot
      matched.push({ ...rows[i], [colB]: "" });
    }
  }

  // Append unmatched B rows at the bottom (B values that had no corresponding A)
  for (let i = 0; i < allBRows.length; i++) {
    if (!usedBRows.has(i)) {
      const leftoverRow = { ...allBRows[i].row };
      // Clear colA since there's no matching A value
      leftoverRow[colA] = "";
      unmatched.push(leftoverRow);
    }
  }

  const resultRows = [...matched, ...unmatched];

  // Count matches
  const matchCount = matched.filter((r) => r[colB] !== "").length;
  const unmatchedCount = unmatched.length;

  console.log(chalk.cyan(`\n📊 Results:`));
  console.log(chalk.green(`   ✓ ${matchCount} rows matched and aligned`));
  if (unmatchedCount > 0) {
    console.log(chalk.yellow(`   ⚠  ${unmatchedCount} B values had no match in A (appended at bottom)`));
  }

  // Write output
  const newSheet = XLSX.utils.json_to_sheet(resultRows);
  workbook.Sheets[sheetName] = newSheet;

  try {
    XLSX.writeFile(workbook, outputPath);
    console.log(chalk.green(`\n✅ Saved to: ${outputPath}\n`));
  } catch (err) {
    console.log(chalk.red(`\n❌ Could not write output file: ${err.message}\n`));
    process.exit(1);
  }
}

module.exports = { runColumnMatcher };
