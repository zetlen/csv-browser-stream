#!/usr/bin/env bun
/**
 * Build script for csv-browser-stream
 * Generates minimal ESM and CJS bundles with TypeScript declarations
 */

import { $ } from 'bun';

async function build() {
  console.log('🧹 Cleaning dist...');
  await $`rm -rf dist`;
  await $`mkdir -p dist`;

  console.log('📦 Building ESM...');
  await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    target: 'browser',
    format: 'esm',
    minify: true,
  });

  console.log('📦 Building CJS...');
  await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    target: 'browser',
    format: 'cjs',
    minify: true,
    naming: '[dir]/[name].cjs',
  });

  console.log('🗜️  Applying terser for maximum minification...');
  // Terser with property mangling for private members (prefixed with _)
  await $`bunx terser dist/index.js --compress --mangle --mangle-props regex=/^_/ -o dist/index.js`;
  await $`bunx terser dist/index.cjs --compress --mangle --mangle-props regex=/^_/ -o dist/index.cjs`;

  console.log('📝 Generating type declarations...');
  await $`bunx dts-bundle-generator -o ./dist/index.d.ts ./src/index.ts --project tsconfig.build.json --no-banner 2>/dev/null`;

  // Report bundle size
  console.log('\n📊 Bundle sizes:');
  const esm = Bun.file('./dist/index.js');
  const cjs = Bun.file('./dist/index.cjs');
  const dts = Bun.file('./dist/index.d.ts');
  console.log(`   ESM:  ${(esm.size / 1024).toFixed(2)} KB`);
  console.log(`   CJS:  ${(cjs.size / 1024).toFixed(2)} KB`);
  console.log(`   DTS:  ${(dts.size / 1024).toFixed(2)} KB`);

  console.log('\n✅ Build complete!');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
