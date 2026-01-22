# csv-browser-stream

In-browser streaming CSV tools. Use `csv-browser-stream` to do client-side validation or manipulation of CSVs that might be excessively large to load into browser memory! How large is too large to load into browser memory? _Your users decide, when their browsers freeze!_

## Features

- **Streaming**: Process CSVs of any size without loading them entirely into memory
- **Browser-native**: Built on Web Streams API (TransformStream, ReadableStream)
- **Flexible input**: Accept strings, Files, Blobs, fetch Responses, or file inputs
- **Event-driven**: Subscribe to row-by-row events for real-time processing
- **Built-in validators**: Common field validators (required, email, number, date, etc.)
- **Schema validation**: Define column schemas declaratively
- **CSV writing**: Serialize data back to CSV format
- **Multiline support**: Handle quoted fields containing newlines (RFC 4180)
- **Progress tracking**: Monitor bytes processed for large files
- **TypeScript**: Fully typed API with exported type definitions
- **Dual format**: Ships both ESM and CommonJS builds

## Installation

```bash
npm install csv-browser-stream
# or
pnpm add csv-browser-stream
# or
yarn add csv-browser-stream
# or
bun add csv-browser-stream
```

Or import directly from a CDN:

```html
<script type="module">
  import { streamCSV, validate } from 'https://esm.sh/csv-browser-stream';
</script>
```

## Quick Start

### Validate a CSV file

```typescript
import { validate } from 'csv-browser-stream';

// Get a file from an input element
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

const result = await validate(file, {
  requiredHeaders: ['name', 'email', 'age']
}, ({ rowNum, fields }) => {
  // Return validation errors for each row
  const errors = [];
  if (!fields.email.includes('@')) {
    errors.push('Invalid email format');
  }
  if (isNaN(Number(fields.age))) {
    errors.push('Age must be a number');
  }
  return errors;
});

if (result.valid) {
  console.log(`CSV is valid! Processed ${result.rowCount} rows.`);
} else {
  console.log(`Found ${result.invalidRowCount} invalid rows`);
  console.log(result.invalidRows);
}
```

### Stream CSV rows

```typescript
import { streamCSV } from 'csv-browser-stream';

const response = await fetch('/data.csv');
const stream = await streamCSV(response, { hasHeaders: true });

stream.on('headers', (event) => {
  console.log('CSV headers:', event.detail.headers);
});

stream.on('csvrow', (event) => {
  const { rowNum, fields } = event.detail;
  console.log(`Row ${rowNum}:`, fields);
});

stream.on('end', (event) => {
  console.log(`Processed ${event.detail.totalRows} rows`);
});

// Consume the stream
for await (const row of stream.readable) {
  // Each row is either an object (if headers) or array of strings
}
```

## API Reference

### `streamCSV(input, options?)`

Creates a streaming CSV parser from various input types.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `CSVInput` | The CSV data source (see supported types below) |
| `options` | `CSVStreamOptions` | Optional configuration |

**Supported input types (`CSVInput`):**

- `string` - Raw CSV text
- `File` - File object from file input
- `Blob` - Blob containing CSV data
- `Response` - Fetch Response object
- `ReadableStream<Uint8Array>` - Byte stream
- `ReadableStream<string>` - Text stream
- `HTMLInputElement` - File input element (reads first selected file)

**Options (`CSVStreamOptions`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delimiter` | `string` | `','` | Field delimiter character |
| `hasHeaders` | `boolean` | `true` | Treat first row as headers |
| `headers` | `string[]` | - | Predefined headers (skips header detection) |
| `signal` | `AbortSignal` | - | Signal to cancel streaming |
| `totalBytes` | `number` | - | Total bytes for progress (auto-detected for File/Blob) |
| `progressInterval` | `number` | `1000` | Emit progress every N rows (0 to disable) |

**Returns:** `Promise<CSVStream>`

The returned `CSVStream` is both:
- A `TransformStream<string, CSVRow>` - pipe data through it
- An `EventTarget` - subscribe to parsing events

**Events:**

| Event | Detail Type | Description |
|-------|-------------|-------------|
| `headers` | `CSVHeadersEvent` | Emitted when headers are parsed |
| `csvrow` | `CSVRowEvent` | Emitted for each data row |
| `progress` | `CSVProgressEvent` | Emitted at progressInterval (includes bytesProcessed) |
| `error` | `CSVErrorEvent` | Emitted on parsing errors |
| `end` | `CSVEndEvent` | Emitted when parsing completes |

### `validate(input, options?, onRow?, onProgress?)`

Convenience function for validating CSV data row by row.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `CSVInput` | The CSV data source |
| `options` | `ValidateOptions` | Validation options |
| `onRow` | `ValidateRowCallback` | Called for each row, return errors array |
| `onProgress` | `ValidateProgressCallback` | Called periodically with progress |

**Options (`ValidateOptions`):**

Extends `CSVStreamOptions` with:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `requiredHeaders` | `string[]` | - | Headers that must be present |
| `maxInvalidRows` | `number` | `100` | Max invalid rows to collect |

**Returns:** `Promise<ValidateResult>`

```typescript
interface ValidateResult {
  valid: boolean;           // true if no errors
  rowCount: number;         // total data rows processed
  invalidRowCount: number;  // number of invalid rows
  invalidRows: InvalidRow[]; // collected invalid rows (up to maxInvalidRows)
  fatalError?: FatalError;  // parsing error that stopped processing
  canceled?: boolean;       // true if aborted via signal
}
```

### `parseCsvLine(line, delimiter?)`

Low-level function to parse a single CSV line.

```typescript
import { parseCsvLine } from 'csv-browser-stream';

const result = parseCsvLine('hello,"world, quoted",123');
// { fields: ['hello', 'world, quoted', '123'] }

const error = parseCsvLine('"unclosed quote');
// { error: 'UNBALANCED_QUOTES' }
```

### `normalizeHeader(value)`

Utility to normalize header values (removes BOM, trims whitespace).

```typescript
import { normalizeHeader } from 'csv-browser-stream';

normalizeHeader('\uFEFF  Name  '); // 'Name'
```

### `validateSchema(input, schema, options?)`

Validate CSV data against a declarative schema with built-in validators.

```typescript
import { validateSchema, required, email, number } from 'csv-browser-stream';

const schema = {
  name: [required()],
  email: [required(), email()],
  age: [number({ min: 0, max: 150 })]
};

const result = await validateSchema(file, schema);
```

**Available validators:**

| Validator | Description | Example |
|-----------|-------------|---------|
| `required(msg?)` | Field must not be empty | `required('Name is required')` |
| `number(opts?)` | Must be a valid number | `number({ min: 0, max: 100, integer: true })` |
| `email(msg?)` | Must be valid email format | `email()` |
| `url(msg?)` | Must be valid URL | `url()` |
| `pattern(regex, msg?)` | Must match regex | `pattern(/^[A-Z]{3}-\d{4}$/)` |
| `length(opts)` | String length constraints | `length({ min: 3, max: 20 })` |
| `oneOf(values, opts?)` | Must be one of allowed values | `oneOf(['active', 'inactive'])` |
| `date(opts?)` | Must be valid date | `date({ format: 'us', before: new Date() })` |
| `boolean(msg?)` | Must be boolean-like | `boolean()` |
| `custom(fn)` | Custom validation function | `custom((v) => v.startsWith('SKU-') ? undefined : 'Invalid')` |
| `all(...validators)` | Combine multiple validators | `all(required(), email())` |

### `toCSV(data, options?)`

Convert data to CSV string.

```typescript
import { toCSV } from 'csv-browser-stream';

const csv = toCSV([
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
]);
// "name,age\r\nAlice,30\r\nBob,25"
```

**Options (`CSVWriterOptions`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delimiter` | `string` | `','` | Field delimiter |
| `lineEnding` | `string` | `'\r\n'` | Line ending (CRLF per RFC 4180) |
| `quoteAll` | `boolean` | `false` | Quote all fields |
| `headers` | `string[]` | - | Custom header order |
| `includeHeaders` | `boolean` | `true` | Include header row |

### `createCSVWriteStream(options?)`

Create a streaming CSV writer.

```typescript
import { createCSVWriteStream } from 'csv-browser-stream';

const stream = createCSVWriteStream({ headers: ['name', 'age'] });
const writer = stream.writable.getWriter();

await writer.write({ name: 'Alice', age: 30 });
await writer.write({ name: 'Bob', age: 25 });
await writer.close();
```

### `toCSVBlob(data, options?)` / `downloadCSV(data, filename, options?)`

Create a Blob or trigger a browser download.

```typescript
import { toCSVBlob, downloadCSV } from 'csv-browser-stream';

const blob = toCSVBlob(data);
downloadCSV(data, 'export.csv');
```

## Examples

### Validate with progress updates

```typescript
const result = await validate(
  largeFile,
  { requiredHeaders: ['id', 'name', 'email'] },
  ({ fields }) => {
    if (!fields.id) return ['ID is required'];
    if (!fields.email.includes('@')) return ['Invalid email'];
    return [];
  },
  (progress) => {
    console.log(`Processed ${progress.rowCount} rows...`);
    updateProgressBar(progress.rowCount);
  }
);
```

### Cancel validation with AbortController

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

const result = await validate(file, {
  signal: controller.signal,
  requiredHeaders: ['name', 'email']
});

if (result.canceled) {
  console.log('Validation was canceled');
}
```

### Process fetch response

```typescript
const response = await fetch('/api/export.csv');
const stream = await streamCSV(response);

const rows = [];
stream.on('csvrow', (e) => rows.push(e.detail.fields));

// Wait for completion
const reader = stream.readable.getReader();
while (!(await reader.read()).done) {}

console.log(`Loaded ${rows.length} rows`);
```

### Use with custom delimiter

```typescript
// Tab-separated values
const stream = await streamCSV(tsvContent, {
  delimiter: '\t',
  hasHeaders: true
});

// Semicolon-separated (common in European locales)
const result = await validate(csvContent, {
  delimiter: ';',
  requiredHeaders: ['nom', 'prenom', 'email']
});
```

### Without headers

```typescript
const stream = await streamCSV(data, { hasHeaders: false });

stream.on('csvrow', (e) => {
  // fields is string[] instead of Record<string, string>
  const [col1, col2, col3] = e.detail.fields;
});
```

### With predefined headers

```typescript
// CSV has no header row, but we know the structure
const stream = await streamCSV(data, {
  headers: ['firstName', 'lastName', 'age']
});

stream.on('csvrow', (e) => {
  // First row is treated as data, fields is an object
  console.log(e.detail.fields.firstName);
});
```

### Schema validation with reusable validator

```typescript
import { createValidator, required, email, number, oneOf } from 'csv-browser-stream';

// Create a reusable validator
const validateUsers = createValidator({
  id: [required(), number({ integer: true })],
  email: [required(), email()],
  role: [oneOf(['admin', 'user', 'guest'])],
  age: [number({ min: 0, max: 150 })]
});

// Use for multiple files
const result1 = await validateUsers(file1);
const result2 = await validateUsers(file2);
```

### Progress tracking with byte position

```typescript
const stream = await streamCSV(largeFile);

stream.on('progress', (e) => {
  const { bytesProcessed, totalBytes, rowNum } = e.detail;
  if (totalBytes) {
    const percent = ((bytesProcessed / totalBytes) * 100).toFixed(1);
    console.log(`${percent}% complete (${rowNum} rows)`);
  }
});
```

### Multiline quoted fields

The parser correctly handles RFC 4180 compliant CSVs with newlines inside quoted fields:

```typescript
const csv = `name,address
Alice,"123 Main St
Apt 4"
Bob,"456 Oak Ave"`;

const stream = await streamCSV(csv);
// Parses as 2 rows with multiline address in first row
```

### Export data to CSV

```typescript
import { downloadCSV, toCSV } from 'csv-browser-stream';

// Generate CSV string
const csvString = toCSV(data, {
  headers: ['name', 'email', 'createdAt'],
  delimiter: ';' // European style
});

// Or trigger direct download
downloadCSV(data, 'users-export.csv');
```

## TypeScript

All types are exported for TypeScript users:

```typescript
import type {
  // Stream types
  CSVInput,
  CSVRow,
  CSVStreamOptions,
  CSVRowEvent,
  CSVHeadersEvent,
  CSVErrorEvent,
  CSVEndEvent,
  CSVProgressEvent,
  // Validation types
  ValidateOptions,
  ValidateResult,
  ValidateRowData,
  ValidateRowCallback,
  InvalidRow,
  FatalError,
  // Schema types
  CSVSchema,
  SimpleSchema,
  ColumnSchema,
  SchemaValidateOptions,
  FieldValidator,
  // Writer types
  CSVWriterOptions,
} from 'csv-browser-stream';
```

## Browser Support

This library uses the Web Streams API, which is supported in all modern browsers:

- Chrome 67+
- Firefox 102+
- Safari 14.1+
- Edge 79+

## CommonJS Usage

For CommonJS environments:

```javascript
const { streamCSV, validate } = require('csv-browser-stream/cjs');
```

## Development

```bash
# Install dependencies
bun install

# Run tests (Playwright browser tests)
bun run test

# Run unit tests only
bun run test:unit

# Build
bun run build

# Type check
bun run typecheck

# Lint and format
bun run lint
bun run format
```

## License

MIT
