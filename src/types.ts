/**
 * Configuration options for CSV parsing and streaming.
 */
export interface CSVStreamOptions {
  /** Field delimiter character. Defaults to ',' */
  delimiter?: string;
  /** If true, treats the first row as headers and emits rows as objects. */
  hasHeaders?: boolean;
  /** Predefined headers to use. If provided, first row is treated as data. */
  headers?: string[];
  /** AbortSignal to cancel streaming. */
  signal?: AbortSignal;
  /** Total bytes for progress reporting (automatically set for File/Blob inputs) */
  totalBytes?: number;
  /** Emit progress events every N rows. Default: 1000. Set to 0 to disable. */
  progressInterval?: number;
}

/**
 * A parsed CSV row, either as an array of strings or a record (if headers are defined).
 */
export type CSVRow = string[] | Record<string, string>;

/**
 * Event data emitted for each parsed CSV row.
 */
export interface CSVRowEvent {
  /** 1-based row number in the source file. */
  rowNum: number;
  /** Parsed fields as array or object depending on header configuration. */
  fields: CSVRow;
  /** Raw line string before parsing. */
  raw: string;
}

/**
 * Event data emitted when headers are detected/validated.
 */
export interface CSVHeadersEvent {
  /** The detected or configured headers. */
  headers: string[];
  /** 1-based line number where headers were found. */
  lineNum: number;
}

/**
 * Event data emitted when a parsing error occurs.
 */
export interface CSVErrorEvent {
  /** Error type identifier. */
  type: 'UNBALANCED_QUOTES' | 'PARSE_ERROR' | 'STREAM_ERROR';
  /** Human-readable error message. */
  message: string;
  /** 1-based line number where error occurred. */
  lineNum: number;
  /** The problematic raw line, if available. */
  raw?: string;
}

/**
 * Event data emitted when streaming completes.
 */
export interface CSVEndEvent {
  /** Total number of data rows processed (excluding header row). */
  totalRows: number;
  /** Total number of lines processed (including empty lines and headers). */
  totalLines: number;
}

/**
 * Map of event names to their data types.
 */
export interface CSVStreamEventMap {
  csvrow: CSVRowEvent;
  headers: CSVHeadersEvent;
  error: CSVErrorEvent;
  end: CSVEndEvent;
  progress: CSVProgressEvent;
}

/**
 * Custom event type for CSV stream events.
 */
export class CSVStreamEvent<T extends keyof CSVStreamEventMap> extends Event {
  readonly detail: CSVStreamEventMap[T];

  constructor(type: T, detail: CSVStreamEventMap[T]) {
    super(type);
    this.detail = detail;
  }
}

/**
 * Result of parsing a single CSV line.
 */
export type ParseResult =
  | { fields: string[]; error?: never }
  | { error: 'UNBALANCED_QUOTES'; fields?: never };

/**
 * Supported input types for streamCSV().
 */
export type CSVInput =
  | string
  | File
  | Blob
  | ReadableStream<Uint8Array>
  | ReadableStream<string>
  | Response
  | HTMLInputElement;

/**
 * Options for the validate() convenience function.
 */
export interface ValidateOptions extends CSVStreamOptions {
  /** Required headers that must be present in the CSV. */
  requiredHeaders?: string[];
  /** Maximum number of invalid rows to collect before stopping. */
  maxInvalidRows?: number;
}

/**
 * Data passed to the validate row callback.
 */
export interface ValidateRowData {
  /** 1-based row number. */
  rowNum: number;
  /** Parsed fields. */
  fields: CSVRow;
  /** Raw line string. */
  raw: string;
}

/**
 * Represents a validation error for a specific row.
 */
export interface InvalidRow {
  /** 1-based row number. */
  rowNum: number;
  /** Fields that failed validation. */
  errors: string[];
  /** The raw line content. */
  raw: string;
}

/**
 * Fatal error that stops validation.
 */
export interface FatalError {
  /** Error type identifier. */
  type: string;
  /** Human-readable error message. */
  message: string;
  /** 1-based line number where error occurred. */
  lineNum: number;
}

/**
 * Result returned by the validate() function.
 */
export interface ValidateResult {
  /** True if validation passed with no errors. */
  valid: boolean;
  /** Total number of data rows processed. */
  rowCount: number;
  /** Number of invalid rows found. */
  invalidRowCount: number;
  /** Collection of invalid rows (up to maxInvalidRows). */
  invalidRows: InvalidRow[];
  /** Fatal error that stopped processing, if any. */
  fatalError?: FatalError;
  /** True if validation was canceled via AbortSignal. */
  canceled?: boolean;
}

/**
 * Callback for validating each row. Return an array of error strings, or empty array if valid.
 */
export type ValidateRowCallback = (data: ValidateRowData) => string[] | undefined;

/**
 * Progress callback for validation.
 */
export interface ValidateProgress {
  rowCount: number;
  invalidRowCount: number;
  lineNum: number;
  /** Bytes processed so far (if available) */
  bytesProcessed?: number;
  /** Total bytes (if known, e.g., from file size) */
  totalBytes?: number;
}

export type ValidateProgressCallback = (progress: ValidateProgress) => void;

/**
 * Progress event data emitted during streaming.
 */
export interface CSVProgressEvent {
  /** Bytes processed so far */
  bytesProcessed: number;
  /** Total bytes if known */
  totalBytes?: number;
  /** Current line number */
  lineNum: number;
  /** Current row number (data rows only) */
  rowNum: number;
}
