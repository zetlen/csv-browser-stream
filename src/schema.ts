/**
 * Schema-based validation for CSV files.
 * Define column schemas declaratively and validate CSVs against them.
 */

import type { CSVInput, CSVRow, ValidateProgress, ValidateResult } from './types.ts';
import { validate } from './validate.ts';
import type { FieldValidator } from './validators.ts';

/**
 * Schema definition for a single column.
 */
export interface ColumnSchema {
  /** Column name (must match CSV header) */
  name: string;
  /** Array of validators to apply to this column */
  validators: FieldValidator[];
  /** Optional alias names for this column */
  aliases?: string[];
}

/**
 * Schema definition for validating a CSV file.
 */
export interface CSVSchema {
  /** Array of column definitions */
  columns: ColumnSchema[];
  /** If true, extra columns not in schema are allowed. Default: true */
  allowExtraColumns?: boolean;
  /** If true, columns can be in any order. Default: true */
  allowReordering?: boolean;
  /** Custom delimiter. Default: ',' */
  delimiter?: string;
}

/**
 * Options for schema-based validation.
 */
export interface SchemaValidateOptions {
  /** Maximum number of invalid rows to collect. Default: 100 */
  maxInvalidRows?: number;
  /** AbortSignal to cancel validation */
  signal?: AbortSignal;
  /** Progress callback */
  onProgress?: (progress: ValidateProgress) => void;
}

/**
 * Simple schema definition using just field names and validators.
 * @example
 * ```ts
 * const schema: SimpleSchema = {
 *   name: [required()],
 *   email: [required(), email()],
 *   age: [number({ min: 0, max: 150 })]
 * };
 * ```
 */
export type SimpleSchema = Record<string, FieldValidator[]>;

/**
 * Converts a simple schema to a full CSVSchema with defaults applied.
 */
function normalizeSchema(schema: CSVSchema | SimpleSchema): CSVSchema {
  if ('columns' in schema && Array.isArray((schema as CSVSchema).columns)) {
    // Apply defaults for full CSVSchema
    const fullSchema = schema as CSVSchema;
    return {
      ...fullSchema,
      allowExtraColumns: fullSchema.allowExtraColumns ?? true,
      allowReordering: fullSchema.allowReordering ?? true,
    };
  }

  // Convert simple schema to full schema
  const simpleSchema = schema as SimpleSchema;
  return {
    columns: Object.entries(simpleSchema).map(([name, validators]) => ({
      name,
      validators,
    })),
    allowExtraColumns: true,
    allowReordering: true,
  };
}

/**
 * Creates a row validator function from a schema.
 */
function createSchemaValidator(schema: CSVSchema) {
  // Build a map of column name -> validators (including aliases)
  const validatorMap = new Map<string, { validators: FieldValidator[]; canonical: string }>();

  for (const col of schema.columns) {
    const entry = { validators: col.validators, canonical: col.name };
    validatorMap.set(col.name.toLowerCase(), entry);
    if (col.aliases) {
      for (const alias of col.aliases) {
        validatorMap.set(alias.toLowerCase(), entry);
      }
    }
  }

  return (data: { rowNum: number; fields: CSVRow; raw: string }): string[] | undefined => {
    const errors: string[] = [];

    if (Array.isArray(data.fields)) {
      // Without headers - can't validate by column name
      return ['Schema validation requires headers to be enabled'];
    }

    const record = data.fields as Record<string, string>;

    // Validate each field against its schema
    for (const [fieldName, value] of Object.entries(record)) {
      const entry = validatorMap.get(fieldName.toLowerCase());
      if (entry) {
        for (const validator of entry.validators) {
          const error = validator(value, entry.canonical);
          if (error) {
            errors.push(error);
          }
        }
      } else if (!schema.allowExtraColumns) {
        errors.push(`Unexpected column: ${fieldName}`);
      }
    }

    // Check for missing required columns
    for (const col of schema.columns) {
      const fieldName = col.name.toLowerCase();
      const hasField = Object.keys(record).some((k) => {
        const lowerKey = k.toLowerCase();
        return lowerKey === fieldName || col.aliases?.some((a) => a.toLowerCase() === lowerKey);
      });

      if (!hasField) {
        // Run validators with empty string to check required
        for (const validator of col.validators) {
          const error = validator('', col.name);
          if (error) {
            errors.push(error);
          }
        }
      }
    }

    return errors.length > 0 ? errors : undefined;
  };
}

/**
 * Validates a CSV input against a schema.
 *
 * @param input - CSV input (string, File, Blob, ReadableStream, Response, or HTMLInputElement)
 * @param schema - Schema to validate against (CSVSchema or SimpleSchema)
 * @param options - Validation options
 * @returns Promise resolving to validation result
 *
 * @example
 * ```ts
 * import { validateSchema, required, email, number } from 'csv-browser-stream';
 *
 * const schema = {
 *   name: [required()],
 *   email: [required(), email()],
 *   age: [number({ min: 0, max: 150 })]
 * };
 *
 * const result = await validateSchema(file, schema);
 * if (result.valid) {
 *   console.log('CSV is valid!');
 * } else {
 *   console.log('Errors:', result.invalidRows);
 * }
 * ```
 */
export async function validateSchema(
  input: CSVInput,
  schema: CSVSchema | SimpleSchema,
  options: SchemaValidateOptions = {},
): Promise<ValidateResult> {
  const normalizedSchema = normalizeSchema(schema);
  const rowValidator = createSchemaValidator(normalizedSchema);

  // Extract required headers from schema
  const requiredHeaders = normalizedSchema.allowReordering
    ? undefined
    : normalizedSchema.columns.map((c) => c.name);

  return validate(
    input,
    {
      delimiter: normalizedSchema.delimiter,
      hasHeaders: true,
      requiredHeaders,
      maxInvalidRows: options.maxInvalidRows,
      signal: options.signal,
    },
    rowValidator,
    options.onProgress,
  );
}

/**
 * Creates a reusable schema validator function.
 * Useful when validating multiple files against the same schema.
 *
 * @param schema - Schema to validate against
 * @returns Validator function
 *
 * @example
 * ```ts
 * const validator = createValidator({
 *   name: [required()],
 *   email: [email()]
 * });
 *
 * const result1 = await validator(file1);
 * const result2 = await validator(file2);
 * ```
 */
export function createValidator(schema: CSVSchema | SimpleSchema) {
  const normalizedSchema = normalizeSchema(schema);

  return (input: CSVInput, options: SchemaValidateOptions = {}): Promise<ValidateResult> => {
    return validateSchema(input, normalizedSchema, options);
  };
}
