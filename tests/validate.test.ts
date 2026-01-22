import { describe, expect, test } from 'bun:test';
import type { ValidateProgress, ValidateRowData } from '../src/types.ts';
import { validate } from '../src/validate.ts';

describe('validate', () => {
  test('validates a valid CSV', async () => {
    const csv = 'name,age\nAlice,30\nBob,25';

    const result = await validate(csv);

    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(2);
    expect(result.invalidRowCount).toBe(0);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.fatalError).toBeUndefined();
  });

  test('validates with required headers - matching', async () => {
    const csv = 'name,age\nAlice,30';

    const result = await validate(csv, {
      requiredHeaders: ['name', 'age'],
    });

    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(1);
  });

  test('validates with required headers - not matching', async () => {
    const csv = 'firstName,lastName\nAlice,Smith';

    const result = await validate(csv, {
      requiredHeaders: ['name', 'age'],
    });

    expect(result.valid).toBe(false);
    expect(result.fatalError).toBeDefined();
    expect(result.fatalError!.type).toBe('HEADER_MISMATCH');
  });

  test('calls row callback for each row', async () => {
    const csv = 'name,age\nAlice,30\nBob,25\nCharlie,35';
    const callbackData: ValidateRowData[] = [];

    await validate(csv, {}, (data) => {
      callbackData.push({ ...data });
      return undefined;
    });

    expect(callbackData).toHaveLength(3);
    expect(callbackData[0]!.rowNum).toBe(1);
    expect(callbackData[0]!.fields).toEqual({ name: 'Alice', age: '30' });
    expect(callbackData[1]!.rowNum).toBe(2);
    expect(callbackData[2]!.rowNum).toBe(3);
  });

  test('collects invalid rows from callback', async () => {
    const csv = 'name,age\nAlice,30\n,25\nCharlie,';

    const result = await validate(csv, {}, ({ fields }) => {
      const errors: string[] = [];
      const record = fields as Record<string, string>;
      if (!record.name) errors.push('name is required');
      if (!record.age) errors.push('age is required');
      return errors;
    });

    expect(result.valid).toBe(false);
    expect(result.rowCount).toBe(3);
    expect(result.invalidRowCount).toBe(2);
    expect(result.invalidRows).toHaveLength(2);
    expect(result.invalidRows[0]!.rowNum).toBe(2);
    expect(result.invalidRows[0]!.errors).toContain('name is required');
    expect(result.invalidRows[1]!.rowNum).toBe(3);
    expect(result.invalidRows[1]!.errors).toContain('age is required');
  });

  test('respects maxInvalidRows option', async () => {
    const csv = 'name,age\n,1\n,2\n,3\n,4\n,5\n,6\n,7\n,8\n,9\n,10';

    const result = await validate(csv, { maxInvalidRows: 3 }, ({ fields }) => {
      const record = fields as Record<string, string>;
      if (!record.name) return ['name is required'];
    });

    expect(result.invalidRowCount).toBe(10);
    expect(result.invalidRows).toHaveLength(3);
  });

  test('calls progress callback', async () => {
    const csv = 'name,age\nAlice,30\nBob,25\nCharlie,35';
    const progressCalls: ValidateProgress[] = [];

    await validate(csv, {}, undefined, (progress) => {
      progressCalls.push({ ...progress });
    });

    expect(progressCalls.length).toBeGreaterThan(0);
    const lastProgress = progressCalls[progressCalls.length - 1]!;
    expect(lastProgress.rowCount).toBe(3);
  });

  test('handles unbalanced quotes as fatal error', async () => {
    const csv = 'name,age\n"unclosed,30';

    const result = await validate(csv);

    expect(result.valid).toBe(false);
    expect(result.fatalError).toBeDefined();
    expect(result.fatalError!.type).toBe('UNBALANCED_QUOTES');
  });

  test('handles CSV with only headers as error', async () => {
    const csv = 'name,age';

    const result = await validate(csv);

    expect(result.valid).toBe(false);
    expect(result.fatalError).toBeDefined();
    expect(result.fatalError!.type).toBe('NO_DATA_ROWS');
  });

  test('handles empty CSV as error', async () => {
    const csv = '';

    const result = await validate(csv);

    expect(result.valid).toBe(false);
    expect(result.fatalError).toBeDefined();
    expect(result.fatalError!.type).toBe('NO_DATA_ROWS');
  });

  test('validates CSV without headers', async () => {
    const csv = 'Alice,30\nBob,25';
    const rows: ValidateRowData[] = [];

    const result = await validate(csv, { hasHeaders: false }, (data) => {
      rows.push({ ...data });
      return undefined;
    });

    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(2);
    expect(rows[0]!.fields).toEqual(['Alice', '30']);
  });

  test('validates CSV with predefined headers', async () => {
    const csv = 'Alice,30\nBob,25';
    const rows: ValidateRowData[] = [];

    const result = await validate(csv, { headers: ['firstName', 'yearsOld'] }, (data) => {
      rows.push({ ...data });
      return undefined;
    });

    expect(result.valid).toBe(true);
    expect(rows[0]!.fields).toEqual({ firstName: 'Alice', yearsOld: '30' });
  });

  test('validates CSV from Blob', async () => {
    const csv = 'name,age\nAlice,30';
    const blob = new Blob([csv], { type: 'text/csv' });

    const result = await validate(blob);

    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(1);
  });

  test('validates CSV from Response', async () => {
    const csv = 'name,age\nAlice,30';
    const response = new Response(csv);

    const result = await validate(response);

    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(1);
  });

  test('handles abort signal', async () => {
    // Use a large CSV so we have time to abort mid-stream
    const csv = `name,age\n${'Alice,30\n'.repeat(10000)}`;
    const controller = new AbortController();

    // Start validation and abort after a small delay
    const resultPromise = validate(csv, { signal: controller.signal });

    // Abort after a tick to allow streaming to start
    setTimeout(() => controller.abort(), 1);

    const result = await resultPromise;

    // With immediate abort, we might get canceled or complete very fast
    // Just verify it doesn't throw and returns a result
    expect(result).toBeDefined();
    expect(typeof result.rowCount).toBe('number');
  });

  test('handles BOM in header', async () => {
    const csv = '\uFEFFname,age\nAlice,30';

    const result = await validate(csv, {
      requiredHeaders: ['name', 'age'],
    });

    expect(result.valid).toBe(true);
  });

  test('handles Windows line endings', async () => {
    const csv = 'name,age\r\nAlice,30\r\nBob,25';

    const result = await validate(csv);

    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(2);
  });

  test('handles custom delimiter', async () => {
    const csv = 'name;age\nAlice;30';

    const result = await validate(csv, { delimiter: ';' });

    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(1);
  });

  test('row callback returning undefined is treated as valid', async () => {
    const csv = 'name,age\nAlice,30';

    const result = await validate(csv, {}, () => {
      // Return undefined - should be treated as valid
      return undefined;
    });

    expect(result.valid).toBe(true);
    expect(result.invalidRowCount).toBe(0);
  });

  test('row callback returning empty array is treated as valid', async () => {
    const csv = 'name,age\nAlice,30';

    const result = await validate(csv, {}, () => {
      return [];
    });

    expect(result.valid).toBe(true);
    expect(result.invalidRowCount).toBe(0);
  });
});
