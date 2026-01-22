import { describe, expect, test } from 'bun:test';
import { CSVStream, streamCSV } from '../src/stream.ts';
import type { CSVEndEvent, CSVHeadersEvent, CSVRowEvent } from '../src/types.ts';

// Helper to pipe string content through CSVStream and collect results
async function processCSV(
  csv: string,
  options: ConstructorParameters<typeof CSVStream>[0] = {},
): Promise<{
  rows: CSVRowEvent[];
  headersEvent: CSVHeadersEvent | null;
  endEvent: CSVEndEvent | null;
}> {
  const rows: CSVRowEvent[] = [];
  let headersEvent: CSVHeadersEvent | null = null;
  let endEvent: CSVEndEvent | null = null;

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

  return { rows, headersEvent, endEvent };
}

describe('CSVStream', () => {
  test('parses CSV with headers', async () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const { rows } = await processCSV(csv, { hasHeaders: true });

    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', age: '30' });
    expect(rows[1]!.fields).toEqual({ name: 'Bob', age: '25' });
  });

  test('parses CSV without headers', async () => {
    const csv = 'Alice,30\nBob,25';
    const { rows } = await processCSV(csv, { hasHeaders: false });

    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toEqual(['Alice', '30']);
    expect(rows[1]!.fields).toEqual(['Bob', '25']);
  });

  test('uses predefined headers', async () => {
    const csv = 'Alice,30\nBob,25';
    const { rows } = await processCSV(csv, { headers: ['firstName', 'yearsOld'] });

    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toEqual({ firstName: 'Alice', yearsOld: '30' });
  });

  test('emits headers event', async () => {
    const csv = 'name,age\nAlice,30';
    const { headersEvent } = await processCSV(csv, { hasHeaders: true });

    expect(headersEvent).not.toBeNull();
    expect(headersEvent!.headers).toEqual(['name', 'age']);
    expect(headersEvent!.lineNum).toBe(1);
  });

  test('emits end event', async () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const { endEvent } = await processCSV(csv, { hasHeaders: true });

    expect(endEvent).not.toBeNull();
    expect(endEvent!.totalRows).toBe(2);
    expect(endEvent!.totalLines).toBe(3);
  });

  test('handles chunked input', async () => {
    const rows: CSVRowEvent[] = [];
    const stream = new CSVStream({ hasHeaders: true });

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
    const { rows } = await processCSV(csv, { hasHeaders: true });

    expect(rows).toHaveLength(2);
  });

  test('handles Windows line endings (CRLF)', async () => {
    const csv = 'name,age\r\nAlice,30\r\nBob,25';
    const { rows } = await processCSV(csv, { hasHeaders: true });

    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', age: '30' });
  });

  test('handles custom delimiter', async () => {
    const csv = 'name;age\nAlice;30';
    const { rows } = await processCSV(csv, { hasHeaders: true, delimiter: ';' });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.fields).toEqual({ name: 'Alice', age: '30' });
  });

  test('fills missing fields with empty strings', async () => {
    const csv = 'a,b,c\n1,2';
    const { rows } = await processCSV(csv, { hasHeaders: true });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.fields).toEqual({ a: '1', b: '2', c: '' });
  });

  test('includes row numbers', async () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const { rows } = await processCSV(csv, { hasHeaders: true });

    expect(rows[0]!.rowNum).toBe(1);
    expect(rows[1]!.rowNum).toBe(2);
  });

  test('includes raw line in event', async () => {
    const csv = 'name,age\nAlice,30';
    const { rows } = await processCSV(csv, { hasHeaders: true });

    expect(rows[0]!.raw).toBe('Alice,30');
  });
});

describe('streamCSV', () => {
  test('creates stream from string', async () => {
    const csv = 'name,age\nAlice,30';
    const rows: CSVRowEvent[] = [];

    const stream = await streamCSV(csv, { hasHeaders: true });

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

    const stream = await streamCSV(blob, { hasHeaders: true });

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

    const stream = await streamCSV(response, { hasHeaders: true });

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

  test('creates stream from ReadableStream<Uint8Array>', async () => {
    const csv = 'name,age\nAlice,30';
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(csv));
        controller.close();
      },
    });
    const rows: CSVRowEvent[] = [];

    const stream = await streamCSV(readableStream, { hasHeaders: true });

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
    const stream = await streamCSV(csv, { hasHeaders: true });

    // Consume the stream to ensure headers are parsed
    const reader = stream.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(stream.headers).toEqual(['name', 'age']);
  });
});
