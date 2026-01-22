/**
 * Built-in field validators for CSV validation.
 * These can be used with the schema-based validation system or standalone.
 */

/**
 * Result of a field validation. Returns undefined if valid, or an error message string if invalid.
 */
export type FieldValidator = (value: string, fieldName: string) => string | undefined;

/**
 * Creates a validator that requires a non-empty value.
 *
 * @example
 * ```ts
 * const schema = { name: [required()] };
 * ```
 */
export function required(message?: string): FieldValidator {
  return (value, fieldName) => {
    if (value === undefined || value === null || value.trim() === '') {
      return message ?? `${fieldName} is required`;
    }
    return undefined;
  };
}

/**
 * Creates a validator that checks if the value is a valid number.
 *
 * @param options - Optional constraints for the number
 * @example
 * ```ts
 * const schema = { age: [number({ min: 0, max: 120, integer: true })] };
 * ```
 */
export function number(options?: {
  min?: number;
  max?: number;
  integer?: boolean;
  message?: string;
}): FieldValidator {
  return (value, fieldName) => {
    if (value.trim() === '') return undefined; // Empty values should use required() validator

    const num = Number(value);
    if (Number.isNaN(num)) {
      return options?.message ?? `${fieldName} must be a valid number`;
    }

    if (options?.integer && !Number.isInteger(num)) {
      return options?.message ?? `${fieldName} must be an integer`;
    }

    if (options?.min !== undefined && num < options.min) {
      return options?.message ?? `${fieldName} must be at least ${options.min}`;
    }

    if (options?.max !== undefined && num > options.max) {
      return options?.message ?? `${fieldName} must be at most ${options.max}`;
    }

    return undefined;
  };
}

/**
 * Creates a validator that checks if the value matches a regex pattern.
 *
 * @param pattern - Regular expression to match against
 * @param message - Optional custom error message
 * @example
 * ```ts
 * const schema = { code: [pattern(/^[A-Z]{3}-\d{4}$/)] };
 * ```
 */
export function pattern(regex: RegExp, message?: string): FieldValidator {
  return (value, fieldName) => {
    if (value.trim() === '') return undefined;

    if (!regex.test(value)) {
      return message ?? `${fieldName} does not match the required pattern`;
    }
    return undefined;
  };
}

/**
 * Creates a validator that checks if the value is a valid email address.
 *
 * @example
 * ```ts
 * const schema = { email: [email()] };
 * ```
 */
export function email(message?: string): FieldValidator {
  // RFC 5322 simplified email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return (value, fieldName) => {
    if (value.trim() === '') return undefined;

    if (!emailRegex.test(value)) {
      return message ?? `${fieldName} must be a valid email address`;
    }
    return undefined;
  };
}

/**
 * Creates a validator that checks if the value is a valid URL.
 *
 * @example
 * ```ts
 * const schema = { website: [url()] };
 * ```
 */
export function url(message?: string): FieldValidator {
  return (value, fieldName) => {
    if (value.trim() === '') return undefined;

    try {
      new URL(value);
      return undefined;
    } catch {
      return message ?? `${fieldName} must be a valid URL`;
    }
  };
}

/**
 * Creates a validator that checks string length constraints.
 *
 * @param options - Length constraints
 * @example
 * ```ts
 * const schema = { username: [length({ min: 3, max: 20 })] };
 * ```
 */
export function length(options: {
  min?: number;
  max?: number;
  exact?: number;
  message?: string;
}): FieldValidator {
  return (value, fieldName) => {
    if (value.trim() === '' && options.min === undefined && options.exact === undefined) {
      return undefined;
    }

    const len = value.length;

    if (options.exact !== undefined && len !== options.exact) {
      return options.message ?? `${fieldName} must be exactly ${options.exact} characters`;
    }

    if (options.min !== undefined && len < options.min) {
      return options.message ?? `${fieldName} must be at least ${options.min} characters`;
    }

    if (options.max !== undefined && len > options.max) {
      return options.message ?? `${fieldName} must be at most ${options.max} characters`;
    }

    return undefined;
  };
}

/**
 * Creates a validator that checks if the value is one of the allowed values.
 *
 * @param allowedValues - Array of allowed string values
 * @param options - Optional settings
 * @example
 * ```ts
 * const schema = { status: [oneOf(['active', 'inactive', 'pending'])] };
 * ```
 */
export function oneOf(
  allowedValues: readonly string[],
  options?: {
    caseSensitive?: boolean;
    message?: string;
  },
): FieldValidator {
  const caseSensitive = options?.caseSensitive ?? true;
  const normalizedValues = caseSensitive
    ? allowedValues
    : allowedValues.map((v) => v.toLowerCase());

  return (value, fieldName) => {
    if (value.trim() === '') return undefined;

    const normalizedValue = caseSensitive ? value : value.toLowerCase();

    if (!normalizedValues.includes(normalizedValue)) {
      return options?.message ?? `${fieldName} must be one of: ${allowedValues.join(', ')}`;
    }
    return undefined;
  };
}

/**
 * Creates a validator that checks if the value is a valid date.
 *
 * @param options - Optional date format and range constraints
 * @example
 * ```ts
 * const schema = { birthDate: [date({ before: new Date() })] };
 * ```
 */
export function date(options?: {
  format?: 'iso' | 'us' | 'eu';
  before?: Date;
  after?: Date;
  message?: string;
}): FieldValidator {
  return (value, fieldName) => {
    if (value.trim() === '') return undefined;

    let parsed: Date;

    if (options?.format === 'us') {
      // MM/DD/YYYY - month is 1-12, day is 1-31
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) {
        return options?.message ?? `${fieldName} must be a valid date (MM/DD/YYYY)`;
      }
      const month = Number(match[1]);
      const day = Number(match[2]);
      const year = Number(match[3]);
      // Validate month and day ranges
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return options?.message ?? `${fieldName} must be a valid date (MM/DD/YYYY)`;
      }
      parsed = new Date(year, month - 1, day);
      // Check if date is valid (handles invalid dates like Feb 30)
      if (parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
        return options?.message ?? `${fieldName} must be a valid date (MM/DD/YYYY)`;
      }
    } else if (options?.format === 'eu') {
      // DD/MM/YYYY - day is 1-31, month is 1-12
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) {
        return options?.message ?? `${fieldName} must be a valid date (DD/MM/YYYY)`;
      }
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      // Validate month and day ranges
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return options?.message ?? `${fieldName} must be a valid date (DD/MM/YYYY)`;
      }
      parsed = new Date(year, month - 1, day);
      // Check if date is valid
      if (parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
        return options?.message ?? `${fieldName} must be a valid date (DD/MM/YYYY)`;
      }
    } else {
      // ISO format or any parseable date string
      parsed = new Date(value);
    }

    if (Number.isNaN(parsed.getTime())) {
      return options?.message ?? `${fieldName} must be a valid date`;
    }

    if (options?.before && parsed >= options.before) {
      return options?.message ?? `${fieldName} must be before ${options.before.toISOString()}`;
    }

    if (options?.after && parsed <= options.after) {
      return options?.message ?? `${fieldName} must be after ${options.after.toISOString()}`;
    }

    return undefined;
  };
}

/**
 * Creates a validator that checks if the value is a valid boolean.
 * Accepts: true, false, yes, no, 1, 0, y, n (case insensitive)
 *
 * @example
 * ```ts
 * const schema = { active: [boolean()] };
 * ```
 */
export function boolean(message?: string): FieldValidator {
  const validValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];

  return (value, fieldName) => {
    if (value.trim() === '') return undefined;

    if (!validValues.includes(value.toLowerCase())) {
      return message ?? `${fieldName} must be a boolean value (true/false, yes/no, 1/0)`;
    }
    return undefined;
  };
}

/**
 * Creates a validator that runs a custom validation function.
 *
 * @param fn - Custom validation function
 * @example
 * ```ts
 * const schema = {
 *   sku: [custom((value) => value.startsWith('SKU-') ? undefined : 'Invalid SKU format')]
 * };
 * ```
 */
export function custom(
  fn: (value: string, fieldName: string) => string | undefined,
): FieldValidator {
  return fn;
}

/**
 * Combines multiple validators into one. All validators must pass.
 *
 * @param validators - Array of validators to combine
 * @example
 * ```ts
 * const schema = { age: [all(required(), number({ min: 0 }))] };
 * ```
 */
export function all(...validators: FieldValidator[]): FieldValidator {
  return (value, fieldName) => {
    for (const validator of validators) {
      const error = validator(value, fieldName);
      if (error) return error;
    }
    return undefined;
  };
}
