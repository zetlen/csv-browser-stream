# csv-browser-stream

Streaming CSV parser, validator, and writer for the browser. Process large CSVs without freezing the UI.

**7 KB** minified. Zero dependencies.

## Features

- **Streaming**: Process CSVs of any size without loading into memory
- **Browser-native**: Built on Web Streams API
- **Validation**: Row-by-row validation with schema support
- **Writing**: Convert data to CSV and trigger downloads
- **TypeScript**: Fully typed API

## Installation

```bash
npm install csv-browser-stream
```

## Quick Start

### Parse a CSV

```typescript
import { streamCSV } from 'csv-browser-stream';

const response = await fetch('/data.csv');
const stream = streamCSV(response);

stream.on('csvrow', (e) => {
  console.log(e.detail.fields); // { name: 'Alice', age: '30' }
});

// Consume the stream
for await (const row of stream.readable) {
  // process row
}
```

### Validate a CSV

```typescript
import { validate } from 'csv-browser-stream';

const file = document.querySelector('input[type="file"]').files[0];

const result = await validate(file, {
  requiredHeaders: ['name', 'email', 'age']
}, ({ fields }) => {
  const errors = [];
  if (!fields.email.includes('@')) errors.push('Invalid email');
  if (isNaN(Number(fields.age))) errors.push('Age must be a number');
  return errors;
});

if (result.valid) {
  console.log(`Validated ${result.rowCount} rows`);
} else {
  console.log(result.invalidRows);
}
```

### Schema validation

```typescript
import { validateSchema, number, pattern } from 'csv-browser-stream';

const result = await validateSchema(file, {
  name: [(v, f) => !v.trim() ? `${f} required` : undefined],
  age: [number({ min: 0, max: 150 })],
  code: [pattern(/^[A-Z]{3}-\d+$/)]
});
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
  delimiter: ',',      // Field delimiter
  hasHeaders: true,    // First row is headers
  headers: ['a', 'b'], // Predefined headers
  signal: controller.signal // AbortSignal
});

stream.on('csvrow', (e) => { /* e.detail.fields */ });
stream.on('headers', (e) => { /* e.detail.headers */ });
stream.on('error', (e) => { /* e.detail.message */ });
stream.on('end', (e) => { /* e.detail.totalRows */ });
```

### `validate(input, options?, onRow?, onProgress?)`

Validate CSV with row callback.

```typescript
const result = await validate(input, {
  requiredHeaders: ['name', 'email'],
  maxInvalidRows: 100
}, (row) => {
  // Return array of error strings, or undefined if valid
  return row.fields.name ? undefined : ['Name required'];
});
```

### `validateSchema(input, schema, options?)`

Validate CSV against a schema.

```typescript
const result = await validateSchema(input, {
  email: [pattern(/@/)],
  age: [number({ min: 0 })]
});
```

### `number(options?)`

Validate numeric fields.

```typescript
number({ min: 0, max: 100, integer: true, allowEmpty: true })
```

### `pattern(regex, message?)`

Validate against regex.

```typescript
pattern(/^\d{3}-\d{4}$/, 'Invalid phone format')
```

### `toCSV(data, options?)`

Convert array of objects/arrays to CSV string.

```typescript
toCSV(data, {
  delimiter: ',',
  lineEnding: '\r\n',
  headers: ['col1', 'col2'],
  includeHeaders: true,
  quoteAll: false
})
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
  CSVRow,             // string[] | Record<string, string>
  CSVStreamOptions,
  ValidateResult,
  FieldValidator,
  CSVWriterOptions,
} from 'csv-browser-stream';
```

## License

MIT
