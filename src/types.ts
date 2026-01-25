/**
 * Configuration options for CSV parsing and streaming.
 */
export interface CSVStreamOptions {
  /** Field delimiter character. Defaults to ',' */
  delimiter?: string;
  /**
   * Whether to expect a header row in the CSV.
   * - true + no headers: first row becomes keys for subsequent rows
   * - true + headers provided: validates first row matches, emits error if not
   * - false + no headers: uses "1", "2", "3"... as keys
   * - false + headers provided: applies headers to all rows (first row is data)
   * Defaults to true.
   */
  expectHeaders?: boolean;
  /** Predefined headers to use or validate against. */
  headers?: string[];
  /** AbortSignal to cancel streaming. */
  signal?: AbortSignal;
  /** Total bytes for progress reporting (automatically set for File/Blob inputs) */
  totalBytes?: number;
  /** Emit progress events every N rows. Default: 1000. Set to 0 to disable. */
  progressInterval?: number;
}

/**
 * A parsed CSV row as a record with string keys and values.
 * Keys are header names, or "1", "2", "3"... if no headers.
 */
export type CSVRow = Record<string, string>;

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
export type CSVInput = string | Blob | Response | ReadableStream<string>;

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
