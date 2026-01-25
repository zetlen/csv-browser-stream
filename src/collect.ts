import type { CSVStream } from './stream.ts';
import type { CSVErrorEvent, CSVRow, CSVRowEvent } from './types.ts';

/**
 * Error thrown when collect() is stopped early by the callback.
 */
export class CollectAbortError extends Error {
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'CollectAbortError';
    this.originalError = originalError;
  }
}

/**
 * Error thrown when a CSV stream error occurs during collect().
 */
export class CSVStreamError extends Error {
  readonly type: string;
  readonly lineNum: number;
  readonly raw?: string;

  constructor(detail: CSVErrorEvent) {
    super(detail.message);
    this.name = 'CSVStreamError';
    this.type = detail.type;
    this.lineNum = detail.lineNum;
    this.raw = detail.raw;
  }
}

/**
 * Collects rows from a CSVStream using a reducer-like pattern.
 *
 * @param stream - A CSVStream to collect rows from
 * @param callback - Reducer function receiving (accumulated, row) and returning the new accumulated value
 * @param initialValue - The initial value for the accumulator
 * @returns Promise resolving to the final accumulated value
 *
 * @example
 * ```ts
 * const stream = streamCSV(csvString);
 * const total = await collect(stream, (sum, row) => sum + Number(row.amount), 0);
 * ```
 *
 * @example
 * ```ts
 * // Stop early by throwing an error
 * const firstTen = await collect(stream, (rows, row) => {
 *   rows.push(row);
 *   if (rows.length >= 10) throw new Error('Done');
 *   return rows;
 * }, []);
 * ```
 */
export async function collect<T>(
  stream: CSVStream,
  callback: (accumulated: T, row: CSVRow) => T,
  initialValue: T,
): Promise<T> {
  let accumulated = initialValue;
  let userError: unknown = null;
  let streamError: CSVErrorEvent | null = null;

  stream.on('csvrow', (e: CustomEvent<CSVRowEvent>) => {
    if (userError || streamError) return;
    try {
      accumulated = callback(accumulated, e.detail.fields);
    } catch (err) {
      userError = err;
    }
  });

  stream.on('error', (e: CustomEvent<CSVErrorEvent>) => {
    streamError = e.detail;
  });

  const reader = stream.readable.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done || userError || streamError) break;
    }
  } finally {
    reader.releaseLock();
  }

  if (streamError) {
    throw new CSVStreamError(streamError);
  }

  if (userError) {
    throw new CollectAbortError(
      userError instanceof Error ? userError.message : 'Collection aborted',
      userError,
    );
  }

  return accumulated;
}
