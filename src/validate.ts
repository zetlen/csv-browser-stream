import { normalizeHeader } from './parser.ts';
import { streamCSV } from './stream.ts';
import type {
  CSVErrorEvent,
  CSVHeadersEvent,
  CSVInput,
  CSVRowEvent,
  FatalError,
  InvalidRow,
  ValidateOptions,
  ValidateProgressCallback,
  ValidateResult,
  ValidateRowCallback,
} from './types.ts';

const DEFAULT_MAX_INVALID_ROWS = 100;

/**
 * Validates a CSV input row by row with optional callbacks.
 *
 * @param input - CSV input (string, File, Blob, ReadableStream, Response, or HTMLInputElement)
 * @param options - Validation options
 * @param onRow - Optional callback for each row. Return error strings array, or void/empty for valid.
 * @param onProgress - Optional progress callback
 * @returns Promise resolving to validation result
 */
export async function validate(
  input: CSVInput,
  options: ValidateOptions = {},
  onRow?: ValidateRowCallback,
  onProgress?: ValidateProgressCallback,
): Promise<ValidateResult> {
  const maxInvalidRows = options.maxInvalidRows ?? DEFAULT_MAX_INVALID_ROWS;
  const requiredHeaders = options.requiredHeaders?.map(normalizeHeader);

  const state = {
    rowCount: 0,
    invalidRowCount: 0,
    invalidRows: [] as InvalidRow[],
    fatalError: undefined as FatalError | undefined,
    canceled: false,
  };

  const emitProgress = (lineNum: number) => {
    if (onProgress) {
      onProgress({
        rowCount: state.rowCount,
        invalidRowCount: state.invalidRowCount,
        lineNum,
      });
    }
  };

  const makeResult = (): ValidateResult => ({
    valid: !state.fatalError && state.invalidRowCount === 0,
    rowCount: state.rowCount,
    invalidRowCount: state.invalidRowCount,
    invalidRows: state.invalidRows,
    fatalError: state.fatalError,
    canceled: state.canceled,
  });

  try {
    const csvStream = await streamCSV(input, {
      delimiter: options.delimiter,
      hasHeaders: options.hasHeaders ?? true,
      headers: options.headers,
      signal: options.signal,
    });

    // Track if we've validated headers yet
    let headersValidated = !requiredHeaders;

    // Create a promise that resolves when 'end' event fires
    const endPromise = new Promise<void>((resolveEnd) => {
      csvStream.on('headers', (event: CustomEvent<CSVHeadersEvent>) => {
        const { headers, lineNum } = event.detail;

        if (requiredHeaders) {
          // Check if required headers match
          const normalizedHeaders = headers.map(normalizeHeader);
          const matches =
            requiredHeaders.length === normalizedHeaders.length &&
            requiredHeaders.every((h, i) => h === normalizedHeaders[i]);

          if (!matches) {
            state.fatalError = {
              type: 'HEADER_MISMATCH',
              message: `CSV headers do not match required headers. Expected: [${requiredHeaders.join(', ')}], got: [${normalizedHeaders.join(', ')}]`,
              lineNum,
            };
            return;
          }
          headersValidated = true;
        }
        emitProgress(lineNum);
      });

      csvStream.on('csvrow', (event: CustomEvent<CSVRowEvent>) => {
        if (state.fatalError || state.canceled) return;

        const { rowNum, fields, raw } = event.detail;
        state.rowCount += 1;

        // Call user's row callback if provided
        if (onRow) {
          const errors = onRow({ rowNum, fields, raw });
          if (errors && errors.length > 0) {
            state.invalidRowCount += 1;
            if (state.invalidRows.length < maxInvalidRows) {
              state.invalidRows.push({ rowNum, errors, raw });
            }
          }
        }

        emitProgress(rowNum);
      });

      csvStream.on('error', (event: CustomEvent<CSVErrorEvent>) => {
        const { type, message, lineNum } = event.detail;
        state.fatalError = { type, message, lineNum };
        emitProgress(lineNum);
      });

      csvStream.on('end', () => {
        // Check if we got any data rows
        if (!state.fatalError && state.rowCount === 0 && headersValidated) {
          state.fatalError = {
            type: 'NO_DATA_ROWS',
            message: 'CSV must contain at least one data row.',
            lineNum: 1,
          };
        }
        resolveEnd();
      });
    });

    // Handle abort signal
    let abortPromise: Promise<void> | undefined;
    if (options.signal) {
      abortPromise = new Promise<void>((resolveAbort) => {
        options.signal!.addEventListener('abort', () => {
          state.canceled = true;
          resolveAbort();
        });
      });
    }

    // Consume the stream to completion
    const reader = csvStream.readable.getReader();
    const consumeStream = async () => {
      while (true) {
        const { done } = await reader.read();
        if (done || state.fatalError || state.canceled) break;
      }
    };

    // Wait for either: stream end, abort, or consumption complete
    if (abortPromise) {
      await Promise.race([endPromise, abortPromise, consumeStream()]);
    } else {
      await Promise.race([endPromise, consumeStream()]);
    }

    return makeResult();
  } catch (err) {
    state.fatalError = {
      type: 'STREAM_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      lineNum: 0,
    };
    return makeResult();
  }
}
