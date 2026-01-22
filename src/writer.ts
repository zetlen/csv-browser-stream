/**
 * CSV writing/serialization - converts data to CSV format.
 */

/**
 * Options for CSV writing.
 */
export interface CSVWriterOptions {
  /** Field delimiter character. Defaults to ',' */
  delimiter?: string;
  /** Line ending. Defaults to '\r\n' (CRLF per RFC 4180) */
  lineEnding?: string;
  /** If true, always quote all fields. Default: false (only quote when necessary) */
  quoteAll?: boolean;
  /** Headers to use. If not provided with object rows, uses keys from first row */
  headers?: string[];
  /** If false, don't write header row. Default: true */
  includeHeaders?: boolean;
}

type CSVWriteRow = string[] | Record<string, unknown>;

/**
 * Escapes a field value for CSV output.
 * Quotes the field if it contains delimiter, quotes, or newlines.
 */
function escapeField(value: unknown, delimiter: string, quoteAll: boolean): string {
  const str = value === null || value === undefined ? '' : String(value);

  // Check if quoting is needed
  const needsQuoting =
    quoteAll ||
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r');

  if (needsQuoting) {
    // Escape quotes by doubling them
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return str;
}

/**
 * Converts a single row to a CSV line.
 */
function rowToLine(
  row: CSVWriteRow,
  headers: string[] | undefined,
  delimiter: string,
  quoteAll: boolean,
): string {
  if (Array.isArray(row)) {
    return row.map((v) => escapeField(v, delimiter, quoteAll)).join(delimiter);
  }

  // Object row - use headers order
  if (!headers) {
    headers = Object.keys(row);
  }

  return headers.map((h) => escapeField(row[h], delimiter, quoteAll)).join(delimiter);
}

/**
 * Converts data to a CSV string.
 *
 * @param data - Array of rows (arrays or objects)
 * @param options - Writer options
 * @returns CSV string
 *
 * @example
 * ```ts
 * // With arrays
 * const csv = toCSV([
 *   ['name', 'age'],
 *   ['Alice', 30],
 *   ['Bob', 25]
 * ], { includeHeaders: false });
 *
 * // With objects
 * const csv = toCSV([
 *   { name: 'Alice', age: 30 },
 *   { name: 'Bob', age: 25 }
 * ]);
 * ```
 */
export function toCSV(data: CSVWriteRow[], options: CSVWriterOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const lineEnding = options.lineEnding ?? '\r\n';
  const quoteAll = options.quoteAll ?? false;
  const includeHeaders = options.includeHeaders ?? true;

  if (data.length === 0) {
    return '';
  }

  const lines: string[] = [];
  let headers = options.headers;

  // Determine headers from first row if not provided
  if (!headers && !Array.isArray(data[0])) {
    headers = Object.keys(data[0]!);
  }

  // Write header row
  if (includeHeaders && headers) {
    lines.push(headers.map((h) => escapeField(h, delimiter, quoteAll)).join(delimiter));
  }

  // Write data rows
  for (const row of data) {
    lines.push(rowToLine(row, headers, delimiter, quoteAll));
  }

  return lines.join(lineEnding);
}

/**
 * Creates a TransformStream that converts objects/arrays to CSV lines.
 *
 * @param options - Writer options
 * @returns TransformStream that accepts rows and outputs CSV strings
 *
 * @example
 * ```ts
 * const stream = createCSVWriteStream({ headers: ['name', 'age'] });
 *
 * const writer = stream.writable.getWriter();
 * await writer.write({ name: 'Alice', age: 30 });
 * await writer.write({ name: 'Bob', age: 25 });
 * await writer.close();
 *
 * // Read from stream.readable
 * ```
 */
export function createCSVWriteStream(
  options: CSVWriterOptions = {},
): TransformStream<CSVWriteRow, string> {
  const delimiter = options.delimiter ?? ',';
  const lineEnding = options.lineEnding ?? '\r\n';
  const quoteAll = options.quoteAll ?? false;
  const includeHeaders = options.includeHeaders ?? true;

  let headers = options.headers;
  let headersSent = false;

  return new TransformStream<CSVWriteRow, string>({
    transform(row, controller) {
      // Determine headers from first object row
      if (!headers && !Array.isArray(row)) {
        headers = Object.keys(row);
      }

      // Send headers first
      if (includeHeaders && headers && !headersSent) {
        const headerLine = headers.map((h) => escapeField(h, delimiter, quoteAll)).join(delimiter);
        controller.enqueue(headerLine + lineEnding);
        headersSent = true;
      }

      // Send data row
      const line = rowToLine(row, headers, delimiter, quoteAll);
      controller.enqueue(line + lineEnding);
    },
  });
}

/**
 * Creates a Blob containing CSV data.
 * Useful for downloads or file operations.
 *
 * @param data - Array of rows
 * @param options - Writer options
 * @returns Blob with CSV content and text/csv MIME type
 *
 * @example
 * ```ts
 * const blob = toCSVBlob(data);
 * const url = URL.createObjectURL(blob);
 * // Use url for download link
 * ```
 */
export function toCSVBlob(data: CSVWriteRow[], options: CSVWriterOptions = {}): Blob {
  const csv = toCSV(data, options);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

/**
 * Triggers a download of CSV data in the browser.
 *
 * @param data - Array of rows
 * @param filename - Name of the file to download
 * @param options - Writer options
 *
 * @example
 * ```ts
 * downloadCSV(data, 'export.csv');
 * ```
 */
export function downloadCSV(
  data: CSVWriteRow[],
  filename: string,
  options: CSVWriterOptions = {},
): void {
  const blob = toCSVBlob(data, options);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
