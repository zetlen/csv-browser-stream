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

/**
 * Validates a CSV input row by row with optional callbacks.
 */
export async function validate(
  input: CSVInput,
  options: ValidateOptions = {},
  onRow?: ValidateRowCallback,
  onProgress?: ValidateProgressCallback,
): Promise<ValidateResult> {
  const maxInvalidRows = options.maxInvalidRows ?? 100;
  const requiredHeaders = options.requiredHeaders?.map(normalizeHeader);

  let rowCount = 0;
  let invalidRowCount = 0;
  const invalidRows: InvalidRow[] = [];
  let fatalError: FatalError | undefined;
  let canceled = false;

  const csvStream = streamCSV(input, {
    delimiter: options.delimiter,
    hasHeaders: options.hasHeaders ?? true,
    headers: options.headers,
    signal: options.signal,
  });

  if (requiredHeaders) {
    csvStream.on('headers', (e: CustomEvent<CSVHeadersEvent>) => {
      const normalized = e.detail.headers.map(normalizeHeader);
      const matches =
        requiredHeaders.length === normalized.length &&
        requiredHeaders.every((h, i) => h === normalized[i]);
      if (!matches) {
        fatalError = {
          type: 'HEADER_MISMATCH',
          message: `Expected [${requiredHeaders.join(', ')}], got [${normalized.join(', ')}]`,
          lineNum: e.detail.lineNum,
        };
      }
    });
  }

  csvStream.on('csvrow', (e: CustomEvent<CSVRowEvent>) => {
    if (fatalError || canceled) return;
    const { rowNum, fields, raw } = e.detail;
    rowCount++;

    if (onRow) {
      const errors = onRow({ rowNum, fields, raw });
      if (errors?.length) {
        invalidRowCount++;
        if (invalidRows.length < maxInvalidRows) {
          invalidRows.push({ rowNum, errors, raw });
        }
      }
    }

    if (onProgress) {
      onProgress({ rowCount, invalidRowCount, lineNum: rowNum });
    }
  });

  csvStream.on('error', (e: CustomEvent<CSVErrorEvent>) => {
    fatalError = { type: e.detail.type, message: e.detail.message, lineNum: e.detail.lineNum };
  });

  if (options.signal) {
    options.signal.addEventListener('abort', () => {
      canceled = true;
    });
  }

  // Consume stream to drive parsing
  const reader = csvStream.readable.getReader();
  try {
    while (!fatalError && !canceled) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch (err) {
    fatalError = {
      type: 'STREAM_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      lineNum: 0,
    };
  }

  if (!fatalError && rowCount === 0) {
    fatalError = { type: 'NO_DATA_ROWS', message: 'CSV has no data rows', lineNum: 1 };
  }

  return {
    valid: !fatalError && invalidRowCount === 0,
    rowCount,
    invalidRowCount,
    invalidRows,
    fatalError,
    canceled,
  };
}
