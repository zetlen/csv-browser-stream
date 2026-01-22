import { normalizeHeader, parseCsvLine } from './parser.ts';
import type {
  CSVEndEvent,
  CSVErrorEvent,
  CSVHeadersEvent,
  CSVInput,
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
  private _options: Required<Pick<CSVStreamOptions, 'delimiter' | 'hasHeaders'>> & CSVStreamOptions;
  private _aborted = false;

  constructor(options: CSVStreamOptions = {}) {
    super();

    this._options = {
      delimiter: options.delimiter ?? ',',
      hasHeaders: options.hasHeaders ?? true,
      headers: options.headers,
      signal: options.signal,
    };

    if (options.headers) {
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

  /**
   * Add typed event listener.
   */
  on<T extends keyof CSVStreamEventMap>(
    type: T,
    listener: CSVStreamEventHandler<T>,
    options?: AddEventListenerOptions,
  ): this {
    this.addEventListener(type, listener as EventListener, options);
    return this;
  }

  /**
   * Remove typed event listener.
   */
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

  private _transform(chunk: string, controller: TransformStreamDefaultController<CSVRow>): void {
    if (this._aborted) return;
    this._buffer += chunk;
    this._processBuffer(controller);
  }

  private _flush(controller: TransformStreamDefaultController<CSVRow>): void {
    if (this._aborted) return;

    // Process any remaining data in buffer
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
    const lines = this._buffer.split('\n');
    // Keep the last incomplete line in buffer
    this._buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (this._aborted) return;
      this._processLine(line, controller);
    }
  }

  private _processLine(
    rawLine: string,
    controller: TransformStreamDefaultController<CSVRow>,
  ): void {
    this._lineNum += 1;
    const line = rawLine.replace(/\r$/, '');

    // Skip empty lines
    if (line.trim() === '') {
      return;
    }

    const parsed = parseCsvLine(line, this._options.delimiter);

    if (parsed.error) {
      this._emit('error', {
        type: parsed.error,
        message: `CSV parsing error: ${parsed.error}`,
        lineNum: this._lineNum,
        raw: line,
      } satisfies CSVErrorEvent);
      return;
    }

    const fields = parsed.fields;

    // Handle headers
    if (!this._headers && this._options.hasHeaders) {
      this._headers = fields.map((f, i) => (i === 0 ? normalizeHeader(f) : f.trim()));
      this._emit('headers', {
        headers: this._headers,
        lineNum: this._lineNum,
      } satisfies CSVHeadersEvent);
      return;
    }

    this._rowNum += 1;

    // Convert to object if we have headers
    let row: CSVRow;
    if (this._headers) {
      const obj: Record<string, string> = {};
      for (let i = 0; i < this._headers.length; i++) {
        obj[this._headers[i]!] = fields[i] ?? '';
      }
      row = obj;
    } else {
      row = fields;
    }

    // Emit row event
    this._emit('csvrow', {
      rowNum: this._rowNum,
      fields: row,
      raw: line,
    } satisfies CSVRowEvent);

    // Enqueue to the transform stream
    controller.enqueue(row);
  }
}

/**
 * Extracts a text ReadableStream from various input types.
 */
async function getTextStream(input: CSVInput): Promise<ReadableStream<string>> {
  // String input - create stream from string
  if (typeof input === 'string') {
    return new ReadableStream<string>({
      start(controller) {
        controller.enqueue(input);
        controller.close();
      },
    });
  }

  // File or Blob
  if (input instanceof Blob) {
    const byteStream = input.stream();
    return byteStream.pipeThrough(new TextDecoderStream());
  }

  // Response object
  if (input instanceof Response) {
    if (!input.body) {
      throw new Error('Response has no body');
    }
    return input.body.pipeThrough(new TextDecoderStream());
  }

  // HTMLInputElement - get file from input
  if (typeof HTMLInputElement !== 'undefined' && input instanceof HTMLInputElement) {
    if (input.type !== 'file') {
      throw new Error('HTMLInputElement must be of type "file"');
    }
    const file = input.files?.[0];
    if (!file) {
      throw new Error('No file selected');
    }
    return file.stream().pipeThrough(new TextDecoderStream());
  }

  // ReadableStream - could be bytes or strings
  if (input instanceof ReadableStream) {
    // Try to detect if it's a byte stream or text stream
    // We'll wrap it to handle both cases
    const reader = input.getReader();
    const { value, done } = await reader.read();
    reader.releaseLock();

    if (done) {
      return new ReadableStream<string>({
        start(controller) {
          controller.close();
        },
      });
    }

    // If value is a Uint8Array, pipe through TextDecoderStream
    if (value instanceof Uint8Array) {
      // Create a new stream that first yields the read chunk, then the rest
      const restStream = input as ReadableStream<Uint8Array>;
      const combinedStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(value);
          const reader = restStream.getReader();
          try {
            while (true) {
              const { value: chunk, done } = await reader.read();
              if (done) break;
              controller.enqueue(chunk);
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
      });
      return combinedStream.pipeThrough(
        new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>,
      );
    }

    // It's a string stream
    if (typeof value === 'string') {
      const restStream = input as ReadableStream<string>;
      return new ReadableStream<string>({
        async start(controller) {
          controller.enqueue(value);
          const reader = restStream.getReader();
          try {
            while (true) {
              const { value: chunk, done } = await reader.read();
              if (done) break;
              controller.enqueue(chunk);
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
      });
    }

    throw new Error('Unsupported ReadableStream content type');
  }

  throw new Error('Unsupported input type');
}

/**
 * Creates a CSVStream from various input types.
 * Returns the CSVStream which can be used for event listening and streaming.
 */
export async function streamCSV(
  input: CSVInput,
  options: CSVStreamOptions = {},
): Promise<CSVStream> {
  const csvStream = new CSVStream(options);
  const textStream = await getTextStream(input);

  // Pipe the text stream through the CSV stream (fire and forget)
  textStream.pipeTo(csvStream.writable).catch(() => {
    // Error handling is done via events
  });

  return csvStream;
}
