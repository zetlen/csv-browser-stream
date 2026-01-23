#!/usr/bin/env bun
/**
 * Build script for csv-browser-stream
 * Generates ESM and CJS bundles with TypeScript declarations
 */

import { $ } from 'bun';

async function build() {
  console.log('🧹 Cleaning dist...');
  await $`rm -rf dist`;

  console.log('📦 Building ESM...');
  await $`bun build ./src/index.ts --outdir ./dist --target browser --format esm --minify`;

  console.log('📦 Building CJS...');
  await $`bun build ./src/index.ts --outdir ./dist/cjs --target browser --format cjs --minify`;

  // Rename CJS output to .cjs
  await $`mv ./dist/cjs/index.js ./dist/cjs/index.cjs`;

  console.log('📝 Generating type declarations...');
  await $`bunx tsc --project tsconfig.build.json`;

  // Copy and rename type declarations for CJS
  console.log('📝 Creating CJS type declarations...');
  await $`cp ./dist/index.d.ts ./dist/cjs/index.d.cts`;
  await $`cp ./dist/types.d.ts ./dist/cjs/types.d.cts 2>/dev/null || true`;
  await $`cp ./dist/parser.d.ts ./dist/cjs/parser.d.cts 2>/dev/null || true`;
  await $`cp ./dist/stream.d.ts ./dist/cjs/stream.d.cts 2>/dev/null || true`;
  await $`cp ./dist/validate.d.ts ./dist/cjs/validate.d.cts 2>/dev/null || true`;
  await $`cp ./dist/validators.d.ts ./dist/cjs/validators.d.cts 2>/dev/null || true`;
  await $`cp ./dist/schema.d.ts ./dist/cjs/schema.d.cts 2>/dev/null || true`;
  await $`cp ./dist/writer.d.ts ./dist/cjs/writer.d.cts 2>/dev/null || true`;

  // Report bundle size
  console.log('\n📊 Bundle size:');
  const esm = Bun.file('./dist/index.js');
  console.log(`   ${(esm.size / 1024).toFixed(2)} KB`);

  console.log('\n✅ Build complete!');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
