// Main entry point for csv-browser-stream

export { normalizeHeader, parseCsvLine } from './parser.ts';
export type {
  ColumnSchema,
  CSVSchema,
  SchemaValidateOptions,
  SimpleSchema,
} from './schema.ts';
// Schema-based validation
export { createValidator, validateSchema } from './schema.ts';
export { CSVStream, streamCSV } from './stream.ts';
// Re-export types
export type {
  CSVEndEvent,
  CSVErrorEvent,
  CSVHeadersEvent,
  CSVInput,
  CSVProgressEvent,
  CSVRow,
  CSVRowEvent,
  CSVStreamEventMap,
  CSVStreamOptions,
  FatalError,
  InvalidRow,
  ParseResult,
  ValidateOptions,
  ValidateProgress,
  ValidateProgressCallback,
  ValidateResult,
  ValidateRowCallback,
  ValidateRowData,
} from './types.ts';
export { validate } from './validate.ts';
export type { FieldValidator } from './validators.ts';
// Validators
export { boolean, date, number, pattern } from './validators.ts';
export type { CSVWriterOptions } from './writer.ts';
// CSV Writer
export { createCSVWriteStream, downloadCSV, toCSV, toCSVBlob } from './writer.ts';
