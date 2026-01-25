import { describe, expect, test } from 'bun:test';
import { CSVStream, streamCSV } from '../src/stream.ts';
import type { CSVEndEvent, CSVErrorEvent, CSVHeadersEvent, CSVProgressEvent, CSVRowEvent } from '../src/types.ts';

// Helper to pipe string content through CSVStream and collect results
async function processCSV(
  csv: string,
  options: ConstructorParameters<typeof CSVStream>[0] = {},
): Promise<{
  rows: CSVRowEvent[];
  headersEvent: CSVHeadersEvent | null;
  endEvent: CSVEndEvent | null;
  errors: CSVErrorEvent[];
}> {
  const rows: CSVRowEvent[] = [];
  let headersEvent: CSVHeadersEvent | null = null;
  let endEvent: CSVEndEvent | null = null;
  const errors: CSVErrorEvent[] = [];

  const stream = new CSVStream(options);

  stream.on('csvrow', (event: CustomEvent<CSVRowEvent>) => {
    rows.push(event.detail);
  });
  stream.on('headers', (event: CustomEvent<CSVHeadersEvent>) => {
    headersEvent = event.detail;
  });
  stream.on('end', (event: CustomEvent<CSVEndEvent>) => {
    endEvent = event.detail;
  });
  stream.on('error', (event: CustomEvent<CSVErrorEvent>) => {
    errors.push(event.detail);
  });

  // Create a source stream from the CSV string
  const source = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(csv);
      controller.close();
    },
  });

  // Pipe source through CSV stream and consume (both must run concurrently)
  const pipePromise = source.pipeTo(stream.writable);
  const consumePromise = (async () => {
    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  })();

  await Promise.all([pipePromise, consumePromise]);

  return { rows, headersEvent, endEvent, errors };
}

describe('CSVStream', () => {
  test('parses CSV with headers (default)', async () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const { rows } = await processCSV(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', age: '30' });
    expect(rows[1]!.fields).toEqual({ name: 'Bob', age: '25' });
  });

  test('parses CSV without headers (uses numeric keys)', async () => {
    const csv = 'Alice,30\nBob,25';
    const { rows } = await processCSV(csv, { expectHeaders: false });

    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toEqual({ '1': 'Alice', '2': '30' });
    expect(rows[1]!.fields).toEqual({ '1': 'Bob', '2': '25' });
  });

  test('applies predefined headers to all rows (expectHeaders: false)', async () => {
    const csv = 'Alice,30\nBob,25';
    const { rows } = await processCSV(csv, { expectHeaders: false, headers: ['firstName', 'yearsOld'] });

    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toEqual({ firstName: 'Alice', yearsOld: '30' });
    expect(rows[1]!.fields).toEqual({ firstName: 'Bob', yearsOld: '25' });
  });

  test('validates headers when expectHeaders: true and headers provided', async () => {
    const csv = 'name,age\nAlice,30';
    const { rows, errors } = await processCSV(csv, { expectHeaders: true, headers: ['name', 'age'] });

    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', age: '30' });
  });

  test('emits error on header mismatch when validating', async () => {
    const csv = 'name,age\nAlice,30';
    const { rows, errors } = await processCSV(csv, { expectHeaders: true, headers: ['firstName', 'lastName'] });

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('Header mismatch');
    expect(rows).toHaveLength(0);
  });

  test('emits headers event', async () => {
    const csv = 'name,age\nAlice,30';
    const { headersEvent } = await processCSV(csv);

    expect(headersEvent).not.toBeNull();
    expect(headersEvent!.headers).toEqual(['name', 'age']);
    expect(headersEvent!.lineNum).toBe(1);
  });

  test('emits end event', async () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const { endEvent } = await processCSV(csv);

    expect(endEvent).not.toBeNull();
    expect(endEvent!.totalRows).toBe(2);
    expect(endEvent!.totalLines).toBe(3);
  });

  test('handles chunked input', async () => {
    const rows: CSVRowEvent[] = [];
    const stream = new CSVStream();

    stream.on('csvrow', (event: CustomEvent<CSVRowEvent>) => {
      rows.push(event.detail);
    });

    // Create a source with multiple chunks
    const chunks = ['name,a', 'ge\nAli', 'ce,30\nBob,25'];
    const source = new ReadableStream<string>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const pipePromise = source.pipeTo(stream.writable);
    const consumePromise = (async () => {
      const reader = stream.readable.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    })();

    await Promise.all([pipePromise, consumePromise]);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', age: '30' });
    expect(rows[1]!.fields).toEqual({ name: 'Bob', age: '25' });
  });

  test('skips empty lines', async () => {
    const csv = 'name,age\n\nAlice,30\n\nBob,25\n';
    const { rows } = await processCSV(csv);

    expect(rows).toHaveLength(2);
  });

  test('handles Windows line endings (CRLF)', async () => {
    const csv = 'name,age\r\nAlice,30\r\nBob,25';
    const { rows } = await processCSV(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', age: '30' });
  });

  test('handles custom delimiter', async () => {
    const csv = 'name;age\nAlice;30';
    const { rows } = await processCSV(csv, { delimiter: ';' });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', age: '30' });
  });

  test('fills missing fields with empty strings', async () => {
    const csv = 'a,b,c\n1,2';
    const { rows } = await processCSV(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.fields).toEqual({ a: '1', b: '2', c: '' });
  });

  test('includes row numbers', async () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const { rows } = await processCSV(csv);

    expect(rows[0]!.rowNum).toBe(1);
    expect(rows[1]!.rowNum).toBe(2);
  });

  test('includes raw line in event', async () => {
    const csv = 'name,age\nAlice,30';
    const { rows } = await processCSV(csv);

    expect(rows[0]!.raw).toBe('Alice,30');
  });
});

describe('streamCSV', () => {
  test('creates stream from string', async () => {
    const csv = 'name,age\nAlice,30';
    const rows: CSVRowEvent[] = [];

    const stream = streamCSV(csv);

    stream.on('csvrow', (event: CustomEvent<CSVRowEvent>) => {
      rows.push(event.detail);
    });

    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(rows).toHaveLength(1);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', age: '30' });
  });

  test('creates stream from Blob', async () => {
    const csv = 'name,age\nAlice,30';
    const blob = new Blob([csv], { type: 'text/csv' });
    const rows: CSVRowEvent[] = [];

    const stream = streamCSV(blob);

    stream.on('csvrow', (event: CustomEvent<CSVRowEvent>) => {
      rows.push(event.detail);
    });

    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(rows).toHaveLength(1);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', age: '30' });
  });

  test('creates stream from Response', async () => {
    const csv = 'name,age\nAlice,30';
    const response = new Response(csv);
    const rows: CSVRowEvent[] = [];

    const stream = streamCSV(response);

    stream.on('csvrow', (event: CustomEvent<CSVRowEvent>) => {
      rows.push(event.detail);
    });

    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(rows).toHaveLength(1);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', age: '30' });
  });

  test('exposes headers property', async () => {
    const csv = 'name,age\nAlice,30';
    const stream = streamCSV(csv);

    // Consume the stream to ensure headers are parsed
    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(stream.headers).toEqual(['name', 'age']);
  });

  test('auto-detects total bytes from Blob', async () => {
    const csv = 'name,age\nAlice,30';
    const blob = new Blob([csv], { type: 'text/csv' });
    const stream = streamCSV(blob);

    expect(stream.totalBytes).toBe(blob.size);

    // Consume stream
    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  });

  test('tracks bytes processed', async () => {
    const csv = 'name,age\nAlice,30';
    const stream = streamCSV(csv);

    // Consume stream
    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(stream.bytesProcessed).toBeGreaterThan(0);
  });
});

describe('multiline quoted fields', () => {
  test('parses field with embedded newline', async () => {
    const csv = 'name,address\nAlice,"123 Main St\nApt 4"';
    const stream = streamCSV(csv);
    const rows: CSVRowEvent[] = [];

    stream.on('csvrow', (event: CustomEvent<CSVRowEvent>) => {
      rows.push(event.detail);
    });

    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(rows).toHaveLength(1);
    expect(rows[0]!.fields).toEqual({
      name: 'Alice',
      address: '123 Main St\nApt 4',
    });
  });

  test('parses multiple rows with multiline fields', async () => {
    const csv = 'name,note\nAlice,"Line 1\nLine 2"\nBob,"Single line"';
    const stream = streamCSV(csv);
    const rows: CSVRowEvent[] = [];

    stream.on('csvrow', (event: CustomEvent<CSVRowEvent>) => {
      rows.push(event.detail);
    });

    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', note: 'Line 1\nLine 2' });
    expect(rows[1]!.fields).toEqual({ name: 'Bob', note: 'Single line' });
  });

  test('handles multiline field with quotes inside', async () => {
    const csv = 'name,bio\nAlice,"She said ""hello""\nand left"';
    const stream = streamCSV(csv);
    const rows: CSVRowEvent[] = [];

    stream.on('csvrow', (event: CustomEvent<CSVRowEvent>) => {
      rows.push(event.detail);
    });

    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(rows).toHaveLength(1);
    expect(rows[0]!.fields).toEqual({
      name: 'Alice',
      bio: 'She said "hello"\nand left',
    });
  });

  test('handles multiline field split across chunks', async () => {
    const rows: CSVRowEvent[] = [];
    const stream = new CSVStream();

    stream.on('csvrow', (event: CustomEvent<CSVRowEvent>) => {
      rows.push(event.detail);
    });

    // Split the multiline field across chunks
    const chunks = ['name,note\nAlice,"Line 1', '\nLine 2"\nBob,Simple'];
    const source = new ReadableStream<string>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const pipePromise = source.pipeTo(stream.writable);
    const consumePromise = (async () => {
      const reader = stream.readable.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    })();

    await Promise.all([pipePromise, consumePromise]);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', note: 'Line 1\nLine 2' });
    expect(rows[1]!.fields).toEqual({ name: 'Bob', note: 'Simple' });
  });
});

describe('progress events', () => {
  test('emits progress events at intervals', async () => {
    // Create a CSV with more rows than the default interval
    const headerRow = 'id,name';
    const dataRows = Array.from({ length: 2500 }, (_, i) => `${i},Name${i}`);
    const csv = [headerRow, ...dataRows].join('\n');

    const progressEvents: CSVProgressEvent[] = [];
    const stream = streamCSV(csv, { progressInterval: 1000 });

    stream.on('progress', (event: CustomEvent<CSVProgressEvent>) => {
      progressEvents.push(event.detail);
    });

    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Should have at least 2 progress events (at 1000 and 2000 rows)
    expect(progressEvents.length).toBeGreaterThanOrEqual(2);
    expect(progressEvents[0]!.rowNum).toBe(1000);
    expect(progressEvents[1]!.rowNum).toBe(2000);
    expect(progressEvents[0]!.bytesProcessed).toBeGreaterThan(0);
  });

  test('respects custom progress interval', async () => {
    const headerRow = 'id,name';
    const dataRows = Array.from({ length: 50 }, (_, i) => `${i},Name${i}`);
    const csv = [headerRow, ...dataRows].join('\n');

    const progressEvents: CSVProgressEvent[] = [];
    const stream = streamCSV(csv, { progressInterval: 10 });

    stream.on('progress', (event: CustomEvent<CSVProgressEvent>) => {
      progressEvents.push(event.detail);
    });

    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Should have at least 4 progress events (at 10, 20, 30, 40 rows)
    expect(progressEvents.length).toBeGreaterThanOrEqual(4);
    expect(progressEvents[0]!.rowNum).toBe(10);
    expect(progressEvents[1]!.rowNum).toBe(20);
  });

  test('disables progress events when interval is 0', async () => {
    const headerRow = 'id,name';
    const dataRows = Array.from({ length: 100 }, (_, i) => `${i},Name${i}`);
    const csv = [headerRow, ...dataRows].join('\n');

    const progressEvents: CSVProgressEvent[] = [];
    const stream = streamCSV(csv, { progressInterval: 0 });

    stream.on('progress', (event: CustomEvent<CSVProgressEvent>) => {
      progressEvents.push(event.detail);
    });

    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(progressEvents).toHaveLength(0);
  });
});
