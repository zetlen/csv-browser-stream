import { describe, expect, test } from 'bun:test';
import { toCSV } from '../src/writer.ts';

describe('CSV writer', () => {
  describe('toCSV', () => {
    test('converts array rows to CSV', () => {
      const data = [
        ['name', 'age'],
        ['Alice', '30'],
        ['Bob', '25'],
      ];

      const csv = toCSV(data, { includeHeaders: false });

      expect(csv).toBe('name,age\r\nAlice,30\r\nBob,25');
    });

    test('converts object rows to CSV', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];

      const csv = toCSV(data);

      expect(csv).toBe('name,age\r\nAlice,30\r\nBob,25');
    });

    test('writes headers by default for objects', () => {
      const data = [{ name: 'Alice' }];

      const csv = toCSV(data);

      expect(csv).toBe('name\r\nAlice');
    });

    test('respects includeHeaders option', () => {
      const data = [{ name: 'Alice' }];

      const csv = toCSV(data, { includeHeaders: false });

      expect(csv).toBe('Alice');
    });

    test('uses custom headers order', () => {
      const data = [
        { age: 30, name: 'Alice' },
        { age: 25, name: 'Bob' },
      ];

      const csv = toCSV(data, { headers: ['name', 'age'] });

      expect(csv).toBe('name,age\r\nAlice,30\r\nBob,25');
    });

    test('quotes fields containing delimiter', () => {
      const data = [{ value: 'hello,world' }];

      const csv = toCSV(data);

      expect(csv).toBe('value\r\n"hello,world"');
    });

    test('quotes fields containing quotes and escapes them', () => {
      const data = [{ value: 'say "hello"' }];

      const csv = toCSV(data);

      expect(csv).toBe('value\r\n"say ""hello"""');
    });

    test('quotes fields containing newlines', () => {
      const data = [{ value: 'line1\nline2' }];

      const csv = toCSV(data);

      expect(csv).toBe('value\r\n"line1\nline2"');
    });

    test('uses custom delimiter', () => {
      const data = [{ a: '1', b: '2' }];

      const csv = toCSV(data, { delimiter: ';' });

      expect(csv).toBe('a;b\r\n1;2');
    });

    test('uses custom line ending', () => {
      const data = [{ a: '1' }, { a: '2' }];

      const csv = toCSV(data, { lineEnding: '\n' });

      expect(csv).toBe('a\n1\n2');
    });

    test('quotes all fields when quoteAll is true', () => {
      const data = [{ name: 'Alice', age: '30' }];

      const csv = toCSV(data, { quoteAll: true });

      expect(csv).toBe('"name","age"\r\n"Alice","30"');
    });

    test('handles null and undefined values', () => {
      const data = [{ a: null, b: undefined, c: 'value' }];

      const csv = toCSV(data);

      expect(csv).toBe('a,b,c\r\n,,value');
    });

    test('handles empty data array', () => {
      const csv = toCSV([]);

      expect(csv).toBe('');
    });
  });
});
