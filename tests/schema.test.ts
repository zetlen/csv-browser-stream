import { describe, expect, test } from 'bun:test';
import { createValidator, validateSchema } from '../src/schema.ts';
import { email, number, required } from '../src/validators.ts';

describe('schema validation', () => {
  describe('validateSchema', () => {
    test('validates CSV with simple schema', async () => {
      const csv = 'name,email,age\nAlice,alice@example.com,30\nBob,bob@test.com,25';
      const schema = {
        name: [required()],
        email: [required(), email()],
        age: [number({ min: 0 })],
      };

      const result = await validateSchema(csv, schema);

      expect(result.valid).toBe(true);
      expect(result.rowCount).toBe(2);
      expect(result.invalidRowCount).toBe(0);
    });

    test('catches validation errors', async () => {
      const csv = 'name,email,age\n,invalid-email,-5';
      const schema = {
        name: [required()],
        email: [email()],
        age: [number({ min: 0 })],
      };

      const result = await validateSchema(csv, schema);

      expect(result.valid).toBe(false);
      expect(result.invalidRowCount).toBe(1);
      expect(result.invalidRows[0]!.errors).toContain('name is required');
      expect(result.invalidRows[0]!.errors).toContain('email must be a valid email address');
      expect(result.invalidRows[0]!.errors).toContain('age must be at least 0');
    });

    test('validates with full CSVSchema', async () => {
      const csv = 'name,email\nAlice,alice@example.com';
      const schema = {
        columns: [
          { name: 'name', validators: [required()] },
          { name: 'email', validators: [required(), email()] },
        ],
        allowExtraColumns: true,
      };

      const result = await validateSchema(csv, schema);

      expect(result.valid).toBe(true);
    });

    test('supports column aliases', async () => {
      const csv = 'firstName,emailAddress\nAlice,alice@example.com';
      const schema = {
        columns: [
          { name: 'name', validators: [required()], aliases: ['firstName', 'full_name'] },
          { name: 'email', validators: [required(), email()], aliases: ['emailAddress'] },
        ],
      };

      const result = await validateSchema(csv, schema);

      expect(result.valid).toBe(true);
    });

    test('rejects extra columns when not allowed', async () => {
      const csv = 'name,email,extra\nAlice,alice@example.com,foo';
      const schema = {
        columns: [
          { name: 'name', validators: [required()] },
          { name: 'email', validators: [email()] },
        ],
        allowExtraColumns: false,
      };

      const result = await validateSchema(csv, schema);

      expect(result.valid).toBe(false);
      expect(result.invalidRows[0]!.errors).toContain('Unexpected column: extra');
    });

    test('allows extra columns by default', async () => {
      const csv = 'name,email,extra\nAlice,alice@example.com,foo';
      const schema = {
        name: [required()],
        email: [email()],
      };

      const result = await validateSchema(csv, schema);

      expect(result.valid).toBe(true);
    });

    test('handles missing columns', async () => {
      const csv = 'name\nAlice';
      const schema = {
        name: [required()],
        email: [required()],
      };

      const result = await validateSchema(csv, schema);

      expect(result.valid).toBe(false);
      expect(result.invalidRows[0]!.errors).toContain('email is required');
    });

    test('respects maxInvalidRows option', async () => {
      // CSV with actual data rows that fail validation (comma makes it non-empty)
      const csv = 'name,value\n,1\n,2\n,3\n,4\n,5';
      const schema = {
        name: [required()],
        value: [],
      };

      const result = await validateSchema(csv, schema, { maxInvalidRows: 2 });

      expect(result.invalidRowCount).toBe(5);
      expect(result.invalidRows).toHaveLength(2);
    });

    test('supports custom delimiter', async () => {
      const csv = 'name;email\nAlice;alice@example.com';
      const schema = {
        columns: [
          { name: 'name', validators: [required()] },
          { name: 'email', validators: [email()] },
        ],
        delimiter: ';',
      };

      const result = await validateSchema(csv, schema);

      expect(result.valid).toBe(true);
    });
  });

  describe('createValidator', () => {
    test('creates reusable validator', async () => {
      const validator = createValidator({
        name: [required()],
        age: [number({ min: 0 })],
      });

      const result1 = await validator('name,age\nAlice,30');
      expect(result1.valid).toBe(true);

      const result2 = await validator('name,age\n,-5');
      expect(result2.valid).toBe(false);
    });

    test('accepts options on each call', async () => {
      const validator = createValidator({
        name: [required()],
        value: [],
      });

      // CSV with actual data rows that fail validation
      const result = await validator('name,value\n,1\n,2\n,3\n,4\n,5', { maxInvalidRows: 2 });

      expect(result.invalidRows).toHaveLength(2);
    });
  });
});
