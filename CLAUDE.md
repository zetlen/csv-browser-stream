# csv-browser-stream

Streaming CSV parser and writer for the browser.

## Commands

```bash
bun install         # Install dependencies
bun run build       # Build to dist/
bun run test        # Build + Playwright browser tests
bun run test:unit   # Unit tests only
bun run typecheck   # Type check
bun run check       # Lint + format with Biome
```

## Architecture

```
src/
  index.ts      - Public exports
  stream.ts     - CSVStream (TransformStream + EventTarget), streamCSV()
  collect.ts    - collect() reducer function
  parser.ts     - parseCsvLine(), normalizeHeader() (internal)
  writer.ts     - toCSV(), downloadCSV()
  types.ts      - TypeScript types

tests/
  *.test.ts              - Bun unit tests
  browser/*.spec.ts      - Playwright browser tests
```

## Public API

```typescript
// Parsing
streamCSV(input, options?)  // Returns CSVStream

// Collecting
collect(stream, callback, initialValue)  // Returns Promise<T>

// Writing
toCSV(data, options?)
downloadCSV(data, filename, options?)
```

## CSVStream

CSVStream implements `TransformStream<string, CSVRow>` and can be used directly in stream pipelines:

```typescript
await fetch('/data.csv')
  .then(r => r.body!.pipeThrough(new TextDecoderStream()))
  .pipeTo(new CSVStream().writable);
```

## Header Options

- `expectHeaders: true` (default) + no `headers`: first row becomes keys
- `expectHeaders: true` + `headers` provided: validates first row matches, errors if not
- `expectHeaders: false` + no `headers`: uses "1", "2", "3"... as keys
- `expectHeaders: false` + `headers` provided: applies headers to all rows

## Supported Inputs

`CSVInput = string | Blob | Response | ReadableStream<string>`

## Notes

- Browser-only: uses Web Streams API, no Node.js APIs
- CSVStream extends EventTarget (not Node EventEmitter)
- streamCSV() is synchronous, returns CSVStream immediately
- collect() uses reducer pattern: callback receives (accumulated, row), throw to stop early
- collect() rejects with CSVStreamError on stream errors (parsing, header mismatch)
