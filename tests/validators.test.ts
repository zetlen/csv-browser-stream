import { describe, expect, test } from 'bun:test';
import { boolean, date, number, pattern } from '../src/validators.ts';

describe('validators', () => {
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
});
