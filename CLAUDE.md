# csv-browser-stream

Browser-compatible streaming CSV parser and validator.

## Architecture

```
src/
  types.ts       - All TypeScript type definitions
  parser.ts      - CSV line parsing logic (parseCsvLine, normalizeHeader)
  stream.ts      - CSVStream class (TransformStream + EventEmitter) and streamCSV()
  validate.ts    - validate() convenience function
  index.ts       - Main entry point, re-exports public API

tests/
  parser.test.ts   - Unit tests for parser (bun test)
  stream.test.ts   - Unit tests for CSVStream (bun test)
  validate.test.ts - Unit tests for validate function (bun test)
  browser/
    test-server.ts      - Test server for Playwright
    index.html          - Test page that loads the module
    csv-stream.spec.ts  - Playwright browser tests (Chrome, Firefox, WebKit)

scripts/
  build.ts       - Build script for ESM/CJS outputs
```

## Key Concepts

- **CSVStream**: A TransformStream that emits events for each parsed row. Extends EventTarget.
- **streamCSV()**: Factory function that creates CSVStream from various inputs (string, File, Blob, Response, HTMLInputElement, ReadableStream).
- **validate()**: High-level convenience function for row-by-row validation with callbacks.
- **parseCsvLine()**: Low-level CSV line parser handling quoted fields.

## Commands

```bash
bun install         # Install dependencies
bun run build       # Build ESM to dist/ and CJS to dist/cjs/
bun run test        # Build and run Playwright browser tests
bun run test:unit   # Run unit tests with Bun
bun run test:browser # Build and run Playwright tests
bun run typecheck   # TypeScript type checking
bun run lint        # Run biome linter
bun run lint:fix    # Fix linting issues
bun run format      # Format code with biome
bun run check       # Run biome check (lint + format)
```

## Tooling

- **Bun**: Runtime, bundler, test runner
- **Biome**: Linting and formatting (replaces ESLint + Prettier)
- **Playwright**: Browser testing across Chrome, Firefox, WebKit
- **Lefthook**: Git hooks for pre-commit linting and type checking
- **TypeScript**: Type checking with strict mode

## Exports

- ESM: `import { streamCSV, validate } from 'csv-browser-stream'`
- CJS: `const { streamCSV, validate } = require('csv-browser-stream/cjs')`

## Development Notes

- Use Bun for all tooling (build, test, run)
- Browser-compatible: no Node.js-specific APIs
- Uses Web Streams API (TransformStream, ReadableStream)
- EventTarget-based event emitter for browser compatibility
- Tests run against real browsers via Playwright for guaranteed compatibility
- Pre-commit hooks run biome and typecheck automatically

## CI/CD

GitHub Actions runs on every push/PR to main:
- Lint & typecheck
- Playwright tests on all 3 browsers (Chrome, Firefox, WebKit)
