import { describe, expect, test } from 'bun:test';
import { normalizeHeader, parseCsvLine } from '../src/parser.ts';

describe('parseCsvLine', () => {
  test('parses simple comma-separated values', () => {
    const result = parseCsvLine('a,b,c');
    expect(result).toEqual({ fields: ['a', 'b', 'c'] });
  });

  test('parses empty fields', () => {
    const result = parseCsvLine('a,,c');
    expect(result).toEqual({ fields: ['a', '', 'c'] });
  });

  test('parses quoted fields', () => {
    const result = parseCsvLine('"hello","world"');
    expect(result).toEqual({ fields: ['hello', 'world'] });
  });

  test('parses quoted fields with commas', () => {
    const result = parseCsvLine('"hello, world",test');
    expect(result).toEqual({ fields: ['hello, world', 'test'] });
  });

  test('parses escaped quotes (doubled quotes)', () => {
    const result = parseCsvLine('"He said ""hello"""');
    expect(result).toEqual({ fields: ['He said "hello"'] });
  });

  test('handles mixed quoted and unquoted fields', () => {
    const result = parseCsvLine('name,"address, city",phone');
    expect(result).toEqual({ fields: ['name', 'address, city', 'phone'] });
  });

  test('returns error for unbalanced quotes', () => {
    const result = parseCsvLine('"unclosed quote');
    expect(result).toEqual({ error: 'UNBALANCED_QUOTES' });
  });

  test('handles single field', () => {
    const result = parseCsvLine('single');
    expect(result).toEqual({ fields: ['single'] });
  });

  test('handles empty string', () => {
    const result = parseCsvLine('');
    expect(result).toEqual({ fields: [''] });
  });

  test('uses custom delimiter', () => {
    const result = parseCsvLine('a;b;c', ';');
    expect(result).toEqual({ fields: ['a', 'b', 'c'] });
  });

  test('handles tab delimiter', () => {
    const result = parseCsvLine('a\tb\tc', '\t');
    expect(result).toEqual({ fields: ['a', 'b', 'c'] });
  });

  test('handles newlines inside quoted fields', () => {
    const result = parseCsvLine('"line1\nline2",next');
    expect(result).toEqual({ fields: ['line1\nline2', 'next'] });
  });
});

describe('normalizeHeader', () => {
  test('removes BOM', () => {
    expect(normalizeHeader('\uFEFFname')).toBe('name');
  });

  test('trims whitespace', () => {
    expect(normalizeHeader('  name  ')).toBe('name');
  });

  test('handles both BOM and whitespace', () => {
    expect(normalizeHeader('\uFEFF  name  ')).toBe('name');
  });

  test('returns empty string for empty input', () => {
    expect(normalizeHeader('')).toBe('');
  });
});
