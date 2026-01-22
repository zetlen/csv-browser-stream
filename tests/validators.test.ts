import { describe, expect, test } from 'bun:test';
import {
  all,
  boolean,
  custom,
  date,
  email,
  length,
  number,
  oneOf,
  pattern,
  required,
  url,
} from '../src/validators.ts';

describe('validators', () => {
  describe('required', () => {
    test('returns error for empty string', () => {
      const validator = required();
      expect(validator('', 'name')).toBe('name is required');
    });

    test('returns error for whitespace-only string', () => {
      const validator = required();
      expect(validator('   ', 'name')).toBe('name is required');
    });

    test('returns undefined for non-empty string', () => {
      const validator = required();
      expect(validator('Alice', 'name')).toBeUndefined();
    });

    test('uses custom message', () => {
      const validator = required('Please provide a name');
      expect(validator('', 'name')).toBe('Please provide a name');
    });
  });

  describe('number', () => {
    test('returns undefined for valid numbers', () => {
      const validator = number();
      expect(validator('42', 'age')).toBeUndefined();
      expect(validator('-3.14', 'value')).toBeUndefined();
      expect(validator('0', 'count')).toBeUndefined();
    });

    test('returns error for non-numeric strings', () => {
      const validator = number();
      expect(validator('abc', 'age')).toBe('age must be a valid number');
      expect(validator('12ab', 'age')).toBe('age must be a valid number');
    });

    test('returns undefined for empty strings', () => {
      const validator = number();
      expect(validator('', 'age')).toBeUndefined();
    });

    test('validates minimum', () => {
      const validator = number({ min: 0 });
      expect(validator('-1', 'age')).toBe('age must be at least 0');
      expect(validator('0', 'age')).toBeUndefined();
      expect(validator('5', 'age')).toBeUndefined();
    });

    test('validates maximum', () => {
      const validator = number({ max: 100 });
      expect(validator('101', 'age')).toBe('age must be at most 100');
      expect(validator('100', 'age')).toBeUndefined();
      expect(validator('50', 'age')).toBeUndefined();
    });

    test('validates integer', () => {
      const validator = number({ integer: true });
      expect(validator('3.14', 'count')).toBe('count must be an integer');
      expect(validator('42', 'count')).toBeUndefined();
    });

    test('uses custom message', () => {
      const validator = number({ message: 'Invalid number' });
      expect(validator('abc', 'age')).toBe('Invalid number');
    });
  });

  describe('pattern', () => {
    test('validates against regex', () => {
      const validator = pattern(/^[A-Z]{3}-\d{4}$/);
      expect(validator('ABC-1234', 'code')).toBeUndefined();
      expect(validator('abc-1234', 'code')).toBe('code does not match the required pattern');
      expect(validator('AB-123', 'code')).toBe('code does not match the required pattern');
    });

    test('returns undefined for empty strings', () => {
      const validator = pattern(/^[A-Z]+$/);
      expect(validator('', 'code')).toBeUndefined();
    });

    test('uses custom message', () => {
      const validator = pattern(/^[A-Z]+$/, 'Must be uppercase letters');
      expect(validator('abc', 'code')).toBe('Must be uppercase letters');
    });
  });

  describe('email', () => {
    test('validates email format', () => {
      const validator = email();
      expect(validator('test@example.com', 'email')).toBeUndefined();
      expect(validator('user.name@domain.co.uk', 'email')).toBeUndefined();
      expect(validator('invalid', 'email')).toBe('email must be a valid email address');
      expect(validator('missing@', 'email')).toBe('email must be a valid email address');
      expect(validator('@domain.com', 'email')).toBe('email must be a valid email address');
    });

    test('returns undefined for empty strings', () => {
      const validator = email();
      expect(validator('', 'email')).toBeUndefined();
    });
  });

  describe('url', () => {
    test('validates URL format', () => {
      const validator = url();
      expect(validator('https://example.com', 'website')).toBeUndefined();
      expect(validator('http://localhost:3000/path', 'website')).toBeUndefined();
      expect(validator('not-a-url', 'website')).toBe('website must be a valid URL');
    });

    test('returns undefined for empty strings', () => {
      const validator = url();
      expect(validator('', 'website')).toBeUndefined();
    });
  });

  describe('length', () => {
    test('validates minimum length', () => {
      const validator = length({ min: 3 });
      expect(validator('ab', 'username')).toBe('username must be at least 3 characters');
      expect(validator('abc', 'username')).toBeUndefined();
      expect(validator('abcd', 'username')).toBeUndefined();
    });

    test('validates maximum length', () => {
      const validator = length({ max: 5 });
      expect(validator('abcdef', 'username')).toBe('username must be at most 5 characters');
      expect(validator('abcde', 'username')).toBeUndefined();
    });

    test('validates exact length', () => {
      const validator = length({ exact: 4 });
      expect(validator('abc', 'code')).toBe('code must be exactly 4 characters');
      expect(validator('abcde', 'code')).toBe('code must be exactly 4 characters');
      expect(validator('abcd', 'code')).toBeUndefined();
    });
  });

  describe('oneOf', () => {
    test('validates against allowed values', () => {
      const validator = oneOf(['red', 'green', 'blue']);
      expect(validator('red', 'color')).toBeUndefined();
      expect(validator('green', 'color')).toBeUndefined();
      expect(validator('yellow', 'color')).toBe('color must be one of: red, green, blue');
    });

    test('case sensitive by default', () => {
      const validator = oneOf(['Yes', 'No']);
      expect(validator('Yes', 'answer')).toBeUndefined();
      expect(validator('yes', 'answer')).toBe('answer must be one of: Yes, No');
    });

    test('case insensitive option', () => {
      const validator = oneOf(['Yes', 'No'], { caseSensitive: false });
      expect(validator('YES', 'answer')).toBeUndefined();
      expect(validator('yes', 'answer')).toBeUndefined();
    });

    test('returns undefined for empty strings', () => {
      const validator = oneOf(['a', 'b']);
      expect(validator('', 'choice')).toBeUndefined();
    });
  });

  describe('date', () => {
    test('validates ISO date strings', () => {
      const validator = date();
      expect(validator('2024-01-15', 'birthdate')).toBeUndefined();
      expect(validator('not-a-date', 'birthdate')).toBe('birthdate must be a valid date');
    });

    test('validates US date format', () => {
      const validator = date({ format: 'us' });
      expect(validator('12/31/2024', 'date')).toBeUndefined();
      expect(validator('31/12/2024', 'date')).toBe('date must be a valid date (MM/DD/YYYY)');
    });

    test('validates EU date format', () => {
      const validator = date({ format: 'eu' });
      expect(validator('31/12/2024', 'date')).toBeUndefined();
    });

    test('validates before constraint', () => {
      const validator = date({ before: new Date('2024-01-01') });
      expect(validator('2023-12-31', 'date')).toBeUndefined();
      expect(validator('2024-01-01', 'date')).toContain('must be before');
    });

    test('validates after constraint', () => {
      const validator = date({ after: new Date('2024-01-01') });
      expect(validator('2024-01-02', 'date')).toBeUndefined();
      expect(validator('2024-01-01', 'date')).toContain('must be after');
    });

    test('returns undefined for empty strings', () => {
      const validator = date();
      expect(validator('', 'date')).toBeUndefined();
    });
  });

  describe('boolean', () => {
    test('validates boolean-like values', () => {
      const validator = boolean();
      expect(validator('true', 'active')).toBeUndefined();
      expect(validator('false', 'active')).toBeUndefined();
      expect(validator('yes', 'active')).toBeUndefined();
      expect(validator('no', 'active')).toBeUndefined();
      expect(validator('1', 'active')).toBeUndefined();
      expect(validator('0', 'active')).toBeUndefined();
      expect(validator('Y', 'active')).toBeUndefined();
      expect(validator('N', 'active')).toBeUndefined();
    });

    test('returns error for invalid values', () => {
      const validator = boolean();
      expect(validator('maybe', 'active')).toContain('boolean value');
    });

    test('returns undefined for empty strings', () => {
      const validator = boolean();
      expect(validator('', 'active')).toBeUndefined();
    });
  });

  describe('custom', () => {
    test('runs custom validation function', () => {
      const validator = custom((value) =>
        value.startsWith('SKU-') ? undefined : 'Must start with SKU-',
      );
      expect(validator('SKU-123', 'sku')).toBeUndefined();
      expect(validator('PROD-123', 'sku')).toBe('Must start with SKU-');
    });
  });

  describe('all', () => {
    test('combines multiple validators', () => {
      const validator = all(required(), number({ min: 0, max: 100 }));
      expect(validator('', 'score')).toBe('score is required');
      expect(validator('abc', 'score')).toBe('score must be a valid number');
      expect(validator('-5', 'score')).toBe('score must be at least 0');
      expect(validator('150', 'score')).toBe('score must be at most 100');
      expect(validator('50', 'score')).toBeUndefined();
    });

    test('returns first error only', () => {
      const validator = all(required(), email());
      expect(validator('', 'email')).toBe('email is required');
    });
  });
});
