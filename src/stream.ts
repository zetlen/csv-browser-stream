import { normalizeHeader, parseCsvLine } from './parser.ts';
import type {
  CSVEndEvent,
  CSVErrorEvent,
  CSVHeadersEvent,
  CSVInput,
  CSVProgressEvent,
  CSVRow,
  CSVRowEvent,
  CSVStreamEventMap,
  CSVStreamOptions,
} from './types.ts';

type CSVStreamEventHandler<T extends keyof CSVStreamEventMap> = (
  event: CustomEvent<CSVStreamEventMap[T]>,
) => void;

/**
 * CSVStream is a TransformStream that parses CSV data and emits events for each row.
 * It extends EventTarget to provide an event-based API.
 */
export class CSVStream extends EventTarget implements TransformStream<string, CSVRow> {
  readonly readable: ReadableStream<CSVRow>;
  readonly writable: WritableStream<string>;

  private _headers: string[] | null = null;
  private _lineNum = 0;
  private _rowNum = 0;
  private _buffer = '';
  private _bytesProcessed = 0;
  private _lastProgressRow = 0;
  private _options: Required<Pick<CSVStreamOptions, 'delimiter' | 'expectHeaders' | 'progressInterval' | 'strictColumns'>> &
    CSVStreamOptions;
  private _aborted = false;
  private _headersValidated = false;
  private _hasError = false;

  constructor(options: CSVStreamOptions = {}) {
    super();

    this._options = {
      delimiter: options.delimiter ?? ',',
      expectHeaders: options.expectHeaders ?? true,
      headers: options.headers,
      signal: options.signal,
      totalBytes: options.totalBytes,
      progressInterval: options.progressInterval ?? 1000,
      strictColumns: options.strictColumns ?? false,
    };

    // If headers provided and not expecting header row, apply them immediately
    if (options.headers && !this._options.expectHeaders) {
      this._headers = options.headers.map(normalizeHeader);
    }

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        this._aborted = true;
      });
    }

    const stream = new TransformStream<string, CSVRow>({
      transform: (chunk, controller) => this._transform(chunk, controller),
      flush: (controller) => this._flush(controller),
    });

    this.readable = stream.readable;
    this.writable = stream.writable;
  }

  get headers(): string[] | null {
    return this._headers;
  }

  get lineNum(): number {
    return this._lineNum;
  }

  get rowNum(): number {
    return this._rowNum;
  }

  get bytesProcessed(): number {
    return this._bytesProcessed;
  }

  get totalBytes(): number | undefined {
    return this._options.totalBytes;
  }

  on<T extends keyof CSVStreamEventMap>(
    type: T,
    listener: CSVStreamEventHandler<T>,
    options?: AddEventListenerOptions,
  ): this {
    this.addEventListener(type, listener as EventListener, options);
    return this;
  }

  off<T extends keyof CSVStreamEventMap>(
    type: T,
    listener: CSVStreamEventHandler<T>,
    options?: EventListenerOptions,
  ): this {
    this.removeEventListener(type, listener as EventListener, options);
    return this;
  }

  private _emit<T extends keyof CSVStreamEventMap>(type: T, detail: CSVStreamEventMap[T]): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  private _maybeEmitProgress(): void {
    const interval = this._options.progressInterval;
    if (interval === 0) return;

    if (this._rowNum - this._lastProgressRow >= interval) {
      this._lastProgressRow = this._rowNum;
      this._emit('progress', {
        bytesProcessed: this._bytesProcessed,
        totalBytes: this._options.totalBytes,
        lineNum: this._lineNum,
        rowNum: this._rowNum,
      } satisfies CSVProgressEvent);
    }
  }

  private _transform(chunk: string, controller: TransformStreamDefaultController<CSVRow>): void {
    if (this._aborted || this._hasError) return;
    this._bytesProcessed += new TextEncoder().encode(chunk).length;
    this._buffer += chunk;
    this._processBuffer(controller);
  }

  private _flush(controller: TransformStreamDefaultController<CSVRow>): void {
    if (this._aborted || this._hasError) return;

    if (this._buffer.length > 0) {
      this._processLine(this._buffer, controller);
      this._buffer = '';
    }

    this._emit('end', {
      totalRows: this._rowNum,
      totalLines: this._lineNum,
    } satisfies CSVEndEvent);
  }

  private _processBuffer(controller: TransformStreamDefaultController<CSVRow>): void {
    let lineStart = 0;
    let inQuotes = false;

    for (let i = 0; i < this._buffer.length; i++) {
      const char = this._buffer[i];

      if (char === '"') {
        if (inQuotes && this._buffer[i + 1] === '"') {
          i++;
          continue;
        }
        inQuotes = !inQuotes;
      } else if (char === '\n' && !inQuotes) {
        const line = this._buffer.slice(lineStart, i);
        if (this._aborted || this._hasError) return;
        this._processLine(line, controller);
        lineStart = i + 1;
      }
    }

    this._buffer = this._buffer.slice(lineStart);
  }

  private _processLine(rawLine: string, controller: TransformStreamDefaultController<CSVRow>): void {
    this._lineNum += 1;
    const line = rawLine.replace(/\r$/, '');

    if (line.trim() === '') return;

    const parsed = parseCsvLine(line, this._options.delimiter);

    if (parsed.error) {
      this._hasError = true;
      this._emit('error', {
        type: parsed.error,
        message: `CSV parsing error: ${parsed.error}`,
        lineNum: this._lineNum,
        raw: line,
      } satisfies CSVErrorEvent);
      return;
    }

    const fields = parsed.fields;

    // Handle header row logic
    if (this._options.expectHeaders && !this._headersValidated) {
      this._headersValidated = true;
      const parsedHeaders = fields.map((f, i) => (i === 0 ? normalizeHeader(f) : f.trim()));

      if (this._options.headers) {
        // Validate that first row matches expected headers
        const expected = this._options.headers.map(normalizeHeader);
        const matches =
          expected.length === parsedHeaders.length && expected.every((h, i) => h === parsedHeaders[i]);

        if (!matches) {
          this._hasError = true;
          this._emit('error', {
            type: 'PARSE_ERROR',
            message: `Header mismatch: expected [${expected.join(', ')}], got [${parsedHeaders.join(', ')}]`,
            lineNum: this._lineNum,
            raw: line,
          } satisfies CSVErrorEvent);
          return;
        }
      }

      this._headers = parsedHeaders;
      this._emit('headers', {
        headers: this._headers,
        lineNum: this._lineNum,
      } satisfies CSVHeadersEvent);
      return;
    }

    this._rowNum += 1;

    // Strict column validation: error if extra non-empty columns exist
    if (this._options.strictColumns && this._headers) {
      const extraFields = fields.slice(this._headers.length);
      const hasNonEmptyExtra = extraFields.some((f) => f.trim() !== '');
      if (hasNonEmptyExtra) {
        this._hasError = true;
        this._emit('error', {
          type: 'PARSE_ERROR',
          message: `Row ${this._rowNum} has ${fields.length} columns but expected ${this._headers.length}`,
          lineNum: this._lineNum,
          raw: line,
        } satisfies CSVErrorEvent);
        return;
      }
    }

    // Build row object
    let row: CSVRow;
    if (this._headers) {
      const obj: Record<string, string> = {};
      for (let i = 0; i < this._headers.length; i++) {
        obj[this._headers[i]!] = fields[i] ?? '';
      }
      row = obj;
    } else {
      // No headers and expectHeaders is false: use "1", "2", "3"... as keys
      const obj: Record<string, string> = {};
      for (let i = 0; i < fields.length; i++) {
        obj[String(i + 1)] = fields[i]!;
      }
      row = obj;
    }

    this._emit('csvrow', {
      rowNum: this._rowNum,
      fields: row,
      raw: line,
      fieldsArray: fields,
      columnCount: fields.length,
    } satisfies CSVRowEvent);

    this._maybeEmitProgress();
    controller.enqueue(row);
  }
}

function toTextStream(input: CSVInput): ReadableStream<string> {
  if (typeof input === 'string') {
    return new ReadableStream<string>({
      start(controller) {
        controller.enqueue(input);
        controller.close();
      },
    });
  }

  if (input instanceof Blob) {
    return input.stream().pipeThrough(new TextDecoderStream());
  }

  if (input instanceof Response) {
    if (!input.body) throw new Error('Response has no body');
    return input.body.pipeThrough(new TextDecoderStream());
  }

  // ReadableStream<string> - pass through directly
  return input;
}

/**
 * Creates a CSVStream from various input types.
 */
export function streamCSV(input: CSVInput, options: CSVStreamOptions = {}): CSVStream {
  let totalBytes = options.totalBytes;
  if (totalBytes === undefined) {
    if (input instanceof Blob) {
      totalBytes = input.size;
    } else if (input instanceof Response) {
      const contentLength = input.headers.get('content-length');
      if (contentLength) totalBytes = Number.parseInt(contentLength, 10);
    }
  }

  const csvStream = new CSVStream({ ...options, totalBytes });
  toTextStream(input)
    .pipeTo(csvStream.writable)
    .catch(() => {});

  return csvStream;
}
