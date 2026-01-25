# csv-browser-stream

Streaming CSV parser and writer for the browser. Process large CSVs without freezing the UI.

**4.7 KB** minified. Zero dependencies.

## Features

- **Streaming**: Process CSVs of any size without loading into memory
- **Browser-native**: Built on Web Streams API, CSVStream is a standard `TransformStream`
- **Reducer pattern**: Collect rows with a familiar `reduce`-style API
- **Writing**: Convert data to CSV and trigger downloads
- **TypeScript**: Fully typed API

## Installation

```bash
npm install csv-browser-stream
```

## Quick Start

### Parse and collect rows

```typescript
import { streamCSV, collect } from 'csv-browser-stream';

const response = await fetch('/data.csv');
const stream = streamCSV(response);

// Collect all rows into an array
const rows = await collect(stream, (arr, row) => [...arr, row], []);

// Or sum a column
const total = await collect(stream, (sum, row) => sum + Number(row.amount), 0);
```

### Stream with events

```typescript
import { streamCSV } from 'csv-browser-stream';

const stream = streamCSV(file);

stream.on('csvrow', (e) => {
  console.log(e.detail.fields);      // { name: 'Alice', age: '30' }
  console.log(e.detail.fieldsArray); // ['Alice', '30']
  console.log(e.detail.columnCount); // 2
});

// Consume the stream
for await (const row of stream.readable) {
  // process row
}
```

### Use as a TransformStream

CSVStream implements `TransformStream<string, CSVRow>` and works in pipelines:

```typescript
import { CSVStream } from 'csv-browser-stream';

await fetch('/data.csv')
  .then(r => r.body!.pipeThrough(new TextDecoderStream()))
  .pipeThrough(new CSVStream())
  .pipeTo(new WritableStream({
    write(row) {
      console.log(row);
    }
  }));
```

### Validate while collecting

```typescript
import { streamCSV, collect, CollectAbortError } from 'csv-browser-stream';

const errors: string[] = [];
const rows = await collect(
  streamCSV(file),
  (arr, row) => {
    if (!row.email?.includes('@')) {
      errors.push(`Row ${arr.length + 1}: invalid email`);
    }
    return [...arr, row];
  },
  []
);

// Or stop early on error
try {
  await collect(stream, (arr, row) => {
    if (!row.email?.includes('@')) {
      throw new Error('Invalid email');
    }
    return [...arr, row];
  }, []);
} catch (err) {
  if (err instanceof CollectAbortError) {
    console.log('Stopped:', err.message);
  }
}
```

### Export to CSV

```typescript
import { downloadCSV, toCSV } from 'csv-browser-stream';

const data = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
];

// Get CSV string
const csv = toCSV(data);

// Or trigger download
downloadCSV(data, 'export.csv');
```

## API

### `streamCSV(input, options?)`

Parse CSV from string, Blob, Response, or ReadableStream.

```typescript
const stream = streamCSV(input, {
  delimiter: ',',        // Field delimiter (default: ',')
  expectHeaders: true,   // First row is headers (default: true)
  headers: ['a', 'b'],   // Predefined headers
  signal: AbortSignal,   // Cancel streaming
  strictColumns: false   // Error on extra non-empty columns (default: false)
});

stream.on('csvrow', (e) => { /* e.detail.fields */ });
stream.on('headers', (e) => { /* e.detail.headers */ });
stream.on('error', (e) => { /* e.detail.message */ });
stream.on('end', (e) => { /* e.detail.totalRows */ });
```

#### Header options

| `expectHeaders` | `headers` | Behavior |
|-----------------|-----------|----------|
| `true` (default) | not set | First row becomes keys |
| `true` | set | Validates first row matches, errors if not |
| `false` | not set | Uses `"1"`, `"2"`, `"3"`... as keys |
| `false` | set | Applies headers to all rows (first row is data) |

#### Column validation with `strictColumns`

When `strictColumns: true`, rows with extra non-empty columns trigger an error. Trailing empty columns are tolerated.

```typescript
// Validate column count
const stream = streamCSV(file, {
  strictColumns: true,
  headers: ['name', 'age']
});

stream.on('error', (e) => {
  // "Row 5 has 4 columns but expected 2"
  console.error(e.detail.message);
});

// Access raw column data for custom validation
stream.on('csvrow', (e) => {
  const { fieldsArray, columnCount } = e.detail;
  if (columnCount !== expectedColumns) {
    console.warn(`Row has ${columnCount} columns`);
  }
});
```

### `collect(stream, callback, initialValue)`

Collect rows using a reducer pattern. Returns a Promise.

```typescript
// Sum values
const total = await collect(stream, (sum, row) => sum + Number(row.amount), 0);

// Build an object
const byId = await collect(stream, (map, row) => {
  map[row.id] = row;
  return map;
}, {});

// Stop early by throwing
await collect(stream, (arr, row) => {
  if (arr.length >= 100) throw new Error('Limit reached');
  return [...arr, row];
}, []);
```

Throws `CollectAbortError` if callback throws, `CSVStreamError` on parse errors.

### `toCSV(data, options?)`

Convert array of objects/arrays to CSV string.

```typescript
toCSV(data, {
  delimiter: ',',
  lineEnding: '\r\n',  // CRLF per RFC 4180
  headers: ['col1', 'col2'],
  includeHeaders: true,
  quoteAll: false
});
```

### `downloadCSV(data, filename, options?)`

Trigger CSV download in browser.

```typescript
downloadCSV(data, 'export.csv');
```

## Types

```typescript
import type {
  CSVInput,           // string | Blob | Response | ReadableStream<string>
  CSVRow,             // Record<string, string>
  CSVStreamOptions,
  CSVWriterOptions,
} from 'csv-browser-stream';

import {
  CollectAbortError,  // Thrown when collect callback throws
  CSVStreamError,     // Thrown on parse errors
} from 'csv-browser-stream';
```

## License

MIT
