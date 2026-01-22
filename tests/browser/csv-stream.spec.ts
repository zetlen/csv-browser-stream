import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Wait for the module to load
  await page.waitForFunction(() => (window as any).testReady === true);
});

test.describe('parseCsvLine', () => {
  test('parses simple comma-separated values', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { parseCsvLine } = (window as any).csvBrowserStream;
      return parseCsvLine('a,b,c');
    });
    expect(result).toEqual({ fields: ['a', 'b', 'c'] });
  });

  test('parses quoted fields with commas', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { parseCsvLine } = (window as any).csvBrowserStream;
      return parseCsvLine('"hello, world",test');
    });
    expect(result).toEqual({ fields: ['hello, world', 'test'] });
  });

  test('parses escaped quotes', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { parseCsvLine } = (window as any).csvBrowserStream;
      return parseCsvLine('"He said ""hello"""');
    });
    expect(result).toEqual({ fields: ['He said "hello"'] });
  });

  test('returns error for unbalanced quotes', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { parseCsvLine } = (window as any).csvBrowserStream;
      return parseCsvLine('"unclosed quote');
    });
    expect(result).toEqual({ error: 'UNBALANCED_QUOTES' });
  });
});

test.describe('CSVStream', () => {
  test('parses CSV with headers', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CSVStream } = (window as any).csvBrowserStream;
      const stream = new CSVStream({ hasHeaders: true });
      const rows: any[] = [];

      stream.on('csvrow', (e: CustomEvent) => {
        rows.push(e.detail);
      });

      const source = new ReadableStream({
        start(controller) {
          controller.enqueue('name,age\nAlice,30\nBob,25');
          controller.close();
        },
      });

      const pipePromise = source.pipeTo(stream.writable);
      const reader = stream.readable.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      await pipePromise;

      return rows;
    });

    expect(result).toHaveLength(2);
    expect(result[0].fields).toEqual({ name: 'Alice', age: '30' });
    expect(result[1].fields).toEqual({ name: 'Bob', age: '25' });
  });

  test('parses CSV without headers', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CSVStream } = (window as any).csvBrowserStream;
      const stream = new CSVStream({ hasHeaders: false });
      const rows: any[] = [];

      stream.on('csvrow', (e: CustomEvent) => {
        rows.push(e.detail);
      });

      const source = new ReadableStream({
        start(controller) {
          controller.enqueue('Alice,30\nBob,25');
          controller.close();
        },
      });

      const pipePromise = source.pipeTo(stream.writable);
      const reader = stream.readable.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      await pipePromise;

      return rows;
    });

    expect(result).toHaveLength(2);
    expect(result[0].fields).toEqual(['Alice', '30']);
    expect(result[1].fields).toEqual(['Bob', '25']);
  });

  test('handles chunked input correctly', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CSVStream } = (window as any).csvBrowserStream;
      const stream = new CSVStream({ hasHeaders: true });
      const rows: any[] = [];

      stream.on('csvrow', (e: CustomEvent) => {
        rows.push(e.detail);
      });

      // Simulate chunked data that splits mid-field
      const chunks = ['name,a', 'ge\nAli', 'ce,30\nBob,25'];
      const source = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      const pipePromise = source.pipeTo(stream.writable);
      const reader = stream.readable.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      await pipePromise;

      return rows;
    });

    expect(result).toHaveLength(2);
    expect(result[0].fields).toEqual({ name: 'Alice', age: '30' });
    expect(result[1].fields).toEqual({ name: 'Bob', age: '25' });
  });

  test('emits end event with correct counts', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CSVStream } = (window as any).csvBrowserStream;
      const stream = new CSVStream({ hasHeaders: true });
      let endEvent: any = null;

      stream.on('end', (e: CustomEvent) => {
        endEvent = e.detail;
      });

      const source = new ReadableStream({
        start(controller) {
          controller.enqueue('name,age\nAlice,30\nBob,25');
          controller.close();
        },
      });

      const pipePromise = source.pipeTo(stream.writable);
      const reader = stream.readable.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      await pipePromise;

      return endEvent;
    });

    expect(result.totalRows).toBe(2);
    expect(result.totalLines).toBe(3);
  });
});

test.describe('streamCSV', () => {
  test('creates stream from string', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV } = (window as any).csvBrowserStream;
      const rows: any[] = [];

      const stream = await streamCSV('name,age\nAlice,30', { hasHeaders: true });

      stream.on('csvrow', (e: CustomEvent) => {
        rows.push(e.detail);
      });

      const reader = stream.readable.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      return rows;
    });

    expect(result).toHaveLength(1);
    expect(result[0].fields).toEqual({ name: 'Alice', age: '30' });
  });

  test('creates stream from Blob', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV } = (window as any).csvBrowserStream;
      const rows: any[] = [];

      const blob = new Blob(['name,age\nAlice,30'], { type: 'text/csv' });
      const stream = await streamCSV(blob, { hasHeaders: true });

      stream.on('csvrow', (e: CustomEvent) => {
        rows.push(e.detail);
      });

      const reader = stream.readable.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      return rows;
    });

    expect(result).toHaveLength(1);
    expect(result[0].fields).toEqual({ name: 'Alice', age: '30' });
  });

  test('creates stream from Response', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV } = (window as any).csvBrowserStream;
      const rows: any[] = [];

      const response = new Response('name,age\nAlice,30');
      const stream = await streamCSV(response, { hasHeaders: true });

      stream.on('csvrow', (e: CustomEvent) => {
        rows.push(e.detail);
      });

      const reader = stream.readable.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      return rows;
    });

    expect(result).toHaveLength(1);
    expect(result[0].fields).toEqual({ name: 'Alice', age: '30' });
  });
});

test.describe('validate', () => {
  test('validates a valid CSV', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { validate } = (window as any).csvBrowserStream;
      return await validate('name,age\nAlice,30\nBob,25');
    });

    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(2);
    expect(result.invalidRowCount).toBe(0);
  });

  test('validates with required headers - matching', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { validate } = (window as any).csvBrowserStream;
      return await validate('name,age\nAlice,30', {
        requiredHeaders: ['name', 'age'],
      });
    });

    expect(result.valid).toBe(true);
  });

  test('validates with required headers - not matching', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { validate } = (window as any).csvBrowserStream;
      return await validate('firstName,lastName\nAlice,Smith', {
        requiredHeaders: ['name', 'age'],
      });
    });

    expect(result.valid).toBe(false);
    expect(result.fatalError.type).toBe('HEADER_MISMATCH');
  });

  test('collects invalid rows from callback', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { validate } = (window as any).csvBrowserStream;
      return await validate('name,age\nAlice,30\n,25\nCharlie,', {}, ({ fields }: any) => {
        const errors: string[] = [];
        if (!fields.name) errors.push('name is required');
        if (!fields.age) errors.push('age is required');
        return errors;
      });
    });

    expect(result.valid).toBe(false);
    expect(result.rowCount).toBe(3);
    expect(result.invalidRowCount).toBe(2);
    expect(result.invalidRows).toHaveLength(2);
  });

  test('handles unbalanced quotes as fatal error', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { validate } = (window as any).csvBrowserStream;
      return await validate('name,age\n"unclosed,30');
    });

    expect(result.valid).toBe(false);
    expect(result.fatalError.type).toBe('UNBALANCED_QUOTES');
  });

  test('handles CSV with only headers', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { validate } = (window as any).csvBrowserStream;
      return await validate('name,age');
    });

    expect(result.valid).toBe(false);
    expect(result.fatalError.type).toBe('NO_DATA_ROWS');
  });

  test('handles BOM in header', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { validate } = (window as any).csvBrowserStream;
      return await validate('\uFEFFname,age\nAlice,30', {
        requiredHeaders: ['name', 'age'],
      });
    });

    expect(result.valid).toBe(true);
  });

  test('handles Windows line endings', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { validate } = (window as any).csvBrowserStream;
      return await validate('name,age\r\nAlice,30\r\nBob,25');
    });

    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(2);
  });
});
