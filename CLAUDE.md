# csv-browser-stream

Streaming CSV parser, validator, and writer for the browser. 7 KB minified.

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
  validate.ts   - validate() function
  schema.ts     - validateSchema(), schema types
  validators.ts - number(), pattern() validators
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

// Validation
validate(input, options?, onRow?, onProgress?)
validateSchema(input, schema, options?)

// Validators
number(options?)
pattern(regex, message?)

// Writing
toCSV(data, options?)
downloadCSV(data, filename, options?)
```

## Supported Inputs

`CSVInput = string | Blob | Response | ReadableStream<string>`

## Notes

- Browser-only: uses Web Streams API, no Node.js APIs
- CSVStream extends EventTarget (not Node EventEmitter)
- streamCSV() is synchronous, returns CSVStream immediately
- validate() and validateSchema() are async, return Promise<ValidateResult>
