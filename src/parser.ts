import type { ParseResult } from './types.ts';

const DEFAULT_DELIMITER = ',';

/**
 * Normalizes a header value by removing BOM and trimming whitespace.
 */
export const normalizeHeader = (value: string): string => value.replace(/^\uFEFF/, '').trim();

/**
 * Parses a single CSV line into an array of fields.
 * Handles quoted fields and escaped quotes (doubled quotes).
 */
export const parseCsvLine = (line: string, delimiter: string = DEFAULT_DELIMITER): ParseResult => {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    return { error: 'UNBALANCED_QUOTES' };
  }

  fields.push(current);
  return { fields };
};
