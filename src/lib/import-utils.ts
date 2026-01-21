import Papa from "papaparse";
import ExcelJS from "exceljs";
import { z } from "zod";
import { bulkImportRowSchema, type BulkImportRowInput } from "./validations/testcase";

/**
 * Expected columns for import
 */
export const IMPORT_COLUMNS = [
  { key: "reference_id", label: "Reference ID", required: false },
  { key: "title", label: "Title", required: true },
  { key: "description", label: "Description", required: false },
  { key: "steps_to_reproduce", label: "Steps to Reproduce", required: false },
  { key: "expected_result", label: "Expected Result", required: false },
  { key: "actual_result", label: "Actual Result", required: false },
  { key: "severity", label: "Severity (LOW/MEDIUM/HIGH/CRITICAL)", required: false },
  { key: "priority", label: "Priority (LOW/MEDIUM/HIGH/URGENT)", required: false },
  { key: "url", label: "URL", required: false },
] as const;

/**
 * Parsed row from CSV/Excel
 */
export interface ParsedRow {
  reference_id?: string;
  title?: string;
  description?: string;
  steps_to_reproduce?: string;
  expected_result?: string;
  actual_result?: string;
  severity?: string;
  priority?: string;
  url?: string;
  [key: string]: string | undefined;
}

/**
 * Validation result for a single row
 */
export interface RowValidationResult {
  rowIndex: number;
  data: BulkImportRowInput | null;
  isValid: boolean;
  errors: string[];
  rawData: ParsedRow;
}

/**
 * Overall validation result
 */
export interface ValidationResult {
  validRows: RowValidationResult[];
  invalidRows: RowValidationResult[];
  totalRows: number;
}

/**
 * Normalize column name to match expected keys
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Map raw row data to expected column names
 */
function mapRowToExpectedColumns(row: Record<string, unknown>): ParsedRow {
  const result: ParsedRow = {};

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeColumnName(key);

    // Map common variations to expected keys
    const keyMapping: Record<string, string> = {
      reference_id: "reference_id",
      referenceid: "reference_id",
      ref_id: "reference_id",
      refid: "reference_id",
      id: "reference_id",
      test_case_id: "reference_id",
      testcaseid: "reference_id",
      tc_id: "reference_id",
      tcid: "reference_id",
      title: "title",
      test_case_title: "title",
      testcasetitle: "title",
      name: "title",
      description: "description",
      desc: "description",
      steps_to_reproduce: "steps_to_reproduce",
      stepstoreproduce: "steps_to_reproduce",
      steps: "steps_to_reproduce",
      repro_steps: "steps_to_reproduce",
      reprosteps: "steps_to_reproduce",
      expected_result: "expected_result",
      expectedresult: "expected_result",
      expected: "expected_result",
      expected_outcome: "expected_result",
      actual_result: "actual_result",
      actualresult: "actual_result",
      actual: "actual_result",
      actual_outcome: "actual_result",
      severity: "severity",
      sev: "severity",
      priority: "priority",
      pri: "priority",
      url: "url",
      link: "url",
    };

    const mappedKey = keyMapping[normalizedKey] || normalizedKey;
    result[mappedKey] = typeof value === "string" ? value.trim() : String(value ?? "");
  }

  return result;
}

/**
 * Parse CSV file
 */
export function parseCSV(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const rows = results.data as Record<string, unknown>[];
        const mappedRows = rows.map(mapRowToExpectedColumns);
        resolve(mappedRows);
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}

/**
 * Parse Excel file
 */
export async function parseExcel(file: File): Promise<ParsedRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error("No worksheet found in Excel file");
  }

  const rows: ParsedRow[] = [];
  const headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row is headers
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? "").trim();
      });
    } else {
      // Data rows
      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          // Handle different cell value types
          let value = cell.value;
          if (typeof value === "object" && value !== null) {
            // Handle rich text or formula results
            if ("result" in value) {
              value = value.result;
            } else if ("text" in value) {
              value = value.text;
            }
          }
          rowData[header] = value;
        }
      });

      // Only add non-empty rows
      const hasContent = Object.values(rowData).some(
        (v) => v !== undefined && v !== null && String(v).trim() !== ""
      );
      if (hasContent) {
        rows.push(mapRowToExpectedColumns(rowData));
      }
    }
  });

  return rows;
}

/**
 * Parse file based on type
 */
export async function parseFile(file: File): Promise<ParsedRow[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    return parseCSV(file);
  } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    return parseExcel(file);
  } else {
    throw new Error("Unsupported file format. Please use CSV or Excel (.xlsx) files.");
  }
}

/**
 * Validate parsed rows against the schema
 */
export function validateImportData(rows: ParsedRow[]): ValidationResult {
  const validRows: RowValidationResult[] = [];
  const invalidRows: RowValidationResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rawData = rows[i];
    const errors: string[] = [];

    // Transform raw data to match schema
    const transformedData = {
      referenceId: rawData.reference_id || null,
      title: rawData.title || "",
      description: rawData.description || "",
      stepsToReproduce: rawData.steps_to_reproduce || null,
      expectedResult: rawData.expected_result || null,
      actualResult: rawData.actual_result || null,
      severity: rawData.severity?.toUpperCase() || "MEDIUM",
      priority: rawData.priority?.toUpperCase() || "MEDIUM",
      url: rawData.url || null,
    };

    // Validate against schema
    const result = bulkImportRowSchema.safeParse(transformedData);

    if (result.success) {
      validRows.push({
        rowIndex: i + 1, // 1-indexed for display
        data: result.data,
        isValid: true,
        errors: [],
        rawData,
      });
    } else {
      // Extract error messages
      for (const issue of result.error.issues) {
        const field = issue.path.join(".");
        errors.push(`${field}: ${issue.message}`);
      }

      invalidRows.push({
        rowIndex: i + 1, // 1-indexed for display
        data: null,
        isValid: false,
        errors,
        rawData,
      });
    }
  }

  return {
    validRows,
    invalidRows,
    totalRows: rows.length,
  };
}

/**
 * Generate CSV template content
 */
export function generateCSVTemplate(): string {
  const headers = IMPORT_COLUMNS.map((col) => col.label);
  const exampleRow = [
    "TC-001",
    "Login with valid credentials",
    "Test that users can login with correct username and password",
    "1. Navigate to login page\n2. Enter valid username\n3. Enter valid password\n4. Click login button",
    "User should be redirected to dashboard",
    "",
    "HIGH",
    "HIGH",
    "https://example.com/login",
  ];

  return [headers.join(","), exampleRow.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")].join(
    "\n"
  );
}

/**
 * Generate Excel template
 */
export async function generateExcelTemplate(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Test Cases");

  // Add headers
  const headers = IMPORT_COLUMNS.map((col) => col.label);
  const headerRow = worksheet.addRow(headers);

  // Style headers
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    cell.border = {
      bottom: { style: "thin" },
    };

    // Mark required columns
    if (IMPORT_COLUMNS[colNumber - 1]?.required) {
      cell.font = { bold: true, color: { argb: "FFCC0000" } };
    }
  });

  // Set column widths
  worksheet.columns = [
    { width: 15 }, // Reference ID
    { width: 40 }, // Title
    { width: 50 }, // Description
    { width: 50 }, // Steps to Reproduce
    { width: 40 }, // Expected Result
    { width: 40 }, // Actual Result
    { width: 15 }, // Severity
    { width: 15 }, // Priority
    { width: 30 }, // URL
  ];

  // Add example row
  const exampleRow = worksheet.addRow([
    "TC-001",
    "Login with valid credentials",
    "Test that users can login with correct username and password",
    "1. Navigate to login page\n2. Enter valid username\n3. Enter valid password\n4. Click login button",
    "User should be redirected to dashboard",
    "",
    "HIGH",
    "HIGH",
    "https://example.com/login",
  ]);

  // Style example row
  exampleRow.eachCell((cell) => {
    cell.font = { italic: true, color: { argb: "FF666666" } };
  });

  // Add validation notes
  const notesSheet = workbook.addWorksheet("Notes");
  notesSheet.addRow(["Field", "Description", "Valid Values"]);
  notesSheet.addRow(["Reference ID", "Optional. Unique ID for re-importing. If provided and exists, will update instead of create.", ""]);
  notesSheet.addRow(["Title", "Required. Test case title.", ""]);
  notesSheet.addRow(["Description", "Optional. Detailed description.", ""]);
  notesSheet.addRow(["Steps to Reproduce", "Optional. Step-by-step instructions.", ""]);
  notesSheet.addRow(["Expected Result", "Optional. What should happen.", ""]);
  notesSheet.addRow(["Actual Result", "Optional. What actually happened.", ""]);
  notesSheet.addRow(["Severity", "Optional. Defaults to MEDIUM.", "LOW, MEDIUM, HIGH, CRITICAL"]);
  notesSheet.addRow(["Priority", "Optional. Defaults to MEDIUM.", "LOW, MEDIUM, HIGH, URGENT"]);
  notesSheet.addRow(["URL", "Optional. Related URL.", ""]);

  // Style notes header
  const notesHeader = notesSheet.getRow(1);
  notesHeader.font = { bold: true };

  // Set column widths for notes
  notesSheet.columns = [
    { width: 20 },
    { width: 50 },
    { width: 30 },
  ];

  // Generate blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Download CSV template
 */
export function downloadCSVTemplate(): void {
  const content = generateCSVTemplate();
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "test_cases_template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Download Excel template
 */
export async function downloadExcelTemplate(): Promise<void> {
  const blob = await generateExcelTemplate();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "test_cases_template.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}
