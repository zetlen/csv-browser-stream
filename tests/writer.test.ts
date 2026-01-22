import { describe, expect, test } from 'bun:test';
import { createCSVWriteStream, toCSV, toCSVBlob } from '../src/writer.ts';

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

  describe('toCSVBlob', () => {
    test('creates blob with correct type', () => {
      const data = [{ name: 'Alice' }];

      const blob = toCSVBlob(data);

      expect(blob.type).toBe('text/csv;charset=utf-8');
    });

    test('creates blob with CSV content', async () => {
      const data = [{ name: 'Alice', age: 30 }];

      const blob = toCSVBlob(data);
      const text = await blob.text();

      expect(text).toBe('name,age\r\nAlice,30');
    });
  });

  describe('createCSVWriteStream', () => {
    test('streams object rows to CSV', async () => {
      const stream = createCSVWriteStream({ headers: ['name', 'age'] });
      const chunks: string[] = [];

      // Must read and write concurrently with TransformStream
      const readPromise = (async () => {
        const reader = stream.readable.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      })();

      const writePromise = (async () => {
        const writer = stream.writable.getWriter();
        await writer.write({ name: 'Alice', age: 30 });
        await writer.write({ name: 'Bob', age: 25 });
        await writer.close();
      })();

      await Promise.all([readPromise, writePromise]);

      expect(chunks.join('')).toBe('name,age\r\nAlice,30\r\nBob,25\r\n');
    });

    test('infers headers from first object', async () => {
      const stream = createCSVWriteStream();
      const chunks: string[] = [];

      const readPromise = (async () => {
        const reader = stream.readable.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      })();

      const writePromise = (async () => {
        const writer = stream.writable.getWriter();
        await writer.write({ name: 'Alice' });
        await writer.close();
      })();

      await Promise.all([readPromise, writePromise]);

      expect(chunks.join('')).toBe('name\r\nAlice\r\n');
    });

    test('streams array rows without headers', async () => {
      const stream = createCSVWriteStream({ includeHeaders: false });
      const chunks: string[] = [];

      const readPromise = (async () => {
        const reader = stream.readable.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      })();

      const writePromise = (async () => {
        const writer = stream.writable.getWriter();
        await writer.write(['Alice', '30']);
        await writer.write(['Bob', '25']);
        await writer.close();
      })();

      await Promise.all([readPromise, writePromise]);

      expect(chunks.join('')).toBe('Alice,30\r\nBob,25\r\n');
    });

    test('handles special characters in stream', async () => {
      const stream = createCSVWriteStream({ headers: ['value'] });
      const chunks: string[] = [];

      const readPromise = (async () => {
        const reader = stream.readable.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      })();

      const writePromise = (async () => {
        const writer = stream.writable.getWriter();
        await writer.write({ value: 'has,comma' });
        await writer.write({ value: 'has"quote' });
        await writer.close();
      })();

      await Promise.all([readPromise, writePromise]);

      const output = chunks.join('');
      expect(output).toContain('"has,comma"');
      expect(output).toContain('"has""quote"');
    });
  });
});
