import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Wait for the module to load
  await page.waitForFunction(() => (window as any).testReady === true);
});

test.describe('streamCSV', () => {
  test('creates stream from string', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV } = (window as any).csvBrowserStream;
      const rows: any[] = [];

      const stream = streamCSV('name,age\nAlice,30');

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
      const stream = streamCSV(blob);

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
      const stream = streamCSV(response);

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

  test('uses numeric keys when expectHeaders is false', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV } = (window as any).csvBrowserStream;
      const rows: any[] = [];

      const stream = streamCSV('Alice,30\nBob,25', { expectHeaders: false });

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

    expect(result).toHaveLength(2);
    expect(result[0].fields).toEqual({ '1': 'Alice', '2': '30' });
    expect(result[1].fields).toEqual({ '1': 'Bob', '2': '25' });
  });

  test('applies custom headers when expectHeaders is false', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV } = (window as any).csvBrowserStream;
      const rows: any[] = [];

      const stream = streamCSV('Alice,30\nBob,25', {
        expectHeaders: false,
        headers: ['name', 'age'],
      });

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

    expect(result).toHaveLength(2);
    expect(result[0].fields).toEqual({ name: 'Alice', age: '30' });
    expect(result[1].fields).toEqual({ name: 'Bob', age: '25' });
  });

  test('validates headers when expectHeaders is true with headers provided', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV } = (window as any).csvBrowserStream;
      const errors: any[] = [];

      const stream = streamCSV('wrong,headers\nAlice,30', {
        expectHeaders: true,
        headers: ['name', 'age'],
      });

      stream.on('error', (e: CustomEvent) => {
        errors.push(e.detail);
      });

      const reader = stream.readable.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      return errors;
    });

    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('Header mismatch');
  });
});

test.describe('collect', () => {
  test('accumulates rows with reducer pattern', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV, collect } = (window as any).csvBrowserStream;
      const stream = streamCSV('name,amount\nAlice,100\nBob,200\nCharlie,300');
      return await collect(stream, (sum: number, row: any) => sum + Number(row.amount), 0);
    });

    expect(result).toBe(600);
  });

  test('collects rows into array', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV, collect } = (window as any).csvBrowserStream;
      const stream = streamCSV('name,age\nAlice,30\nBob,25');
      return await collect(stream, (arr: any[], row: any) => [...arr, row], []);
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Alice', age: '30' });
    expect(result[1]).toEqual({ name: 'Bob', age: '25' });
  });

  test('rejects on stream error', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV, collect, CSVStreamError } = (window as any).csvBrowserStream;
      const stream = streamCSV('name,age\n"unclosed,30');

      try {
        await collect(stream, (arr: any[], row: any) => [...arr, row], []);
        return { error: false };
      } catch (err: any) {
        return {
          error: true,
          isCSVStreamError: err instanceof CSVStreamError,
          type: err.type,
        };
      }
    });

    expect(result.error).toBe(true);
    expect(result.isCSVStreamError).toBe(true);
    expect(result.type).toBe('UNBALANCED_QUOTES');
  });

  test('stops early when callback throws', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV, collect, CollectAbortError } = (window as any).csvBrowserStream;
      const stream = streamCSV('id,name\n1,Alice\n2,Bob\n3,Charlie\n4,David');

      try {
        await collect(
          stream,
          (arr: any[], row: any) => {
            arr.push(row);
            if (arr.length >= 2) throw new Error('Stop');
            return arr;
          },
          [],
        );
        return { error: false };
      } catch (err: any) {
        return {
          error: true,
          isCollectAbortError: err instanceof CollectAbortError,
          message: err.message,
        };
      }
    });

    expect(result.error).toBe(true);
    expect(result.isCollectAbortError).toBe(true);
    expect(result.message).toBe('Stop');
  });

  test('handles BOM in header', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV, collect } = (window as any).csvBrowserStream;
      const stream = streamCSV('\uFEFFname,age\nAlice,30');
      return await collect(stream, (arr: any[], row: any) => [...arr, row], []);
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Alice', age: '30' });
  });

  test('handles Windows line endings', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { streamCSV, collect } = (window as any).csvBrowserStream;
      const stream = streamCSV('name,age\r\nAlice,30\r\nBob,25');
      return await collect(stream, (arr: any[], row: any) => [...arr, row], []);
    });

    expect(result).toHaveLength(2);
  });
});

test.describe('toCSV and downloadCSV', () => {
  test('converts array of objects to CSV string', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { toCSV } = (window as any).csvBrowserStream;
      return toCSV([
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ]);
    });

    expect(result).toBe('name,age\nAlice,30\nBob,25');
  });

  test('downloadCSV creates and clicks a download link', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { downloadCSV } = (window as any).csvBrowserStream;
      // Mock URL.createObjectURL and revokeObjectURL
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;

      let createdUrl = '';
      URL.createObjectURL = (blob: Blob) => {
        createdUrl = 'blob:mock-url';
        return createdUrl;
      };
      URL.revokeObjectURL = () => {};

      // Track if link was clicked
      let linkClicked = false;
      let linkHref = '';
      let linkDownload = '';

      const originalCreateElement = document.createElement.bind(document);
      document.createElement = ((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'a') {
          el.click = () => {
            linkClicked = true;
            linkHref = el.href;
            linkDownload = el.download;
          };
        }
        return el;
      }) as typeof document.createElement;

      downloadCSV([{ name: 'Alice' }], 'test.csv');

      // Restore
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;

      return { linkClicked, linkDownload };
    });

    expect(result.linkClicked).toBe(true);
    expect(result.linkDownload).toBe('test.csv');
  });
});
