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
  const cjsResult = await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    target: 'browser',
    format: 'cjs',
    minify: true,
    naming: '[dir]/[name].cjs',
  });

  if (!cjsResult.success) {
    throw new Error('CJS build failed');
  }

  console.log('📝 Generating type declarations...');
  // Generate declarations to a temp directory first
  await $`bunx tsc --project tsconfig.build.json --outDir ./dist/.tmp-types`;

  // Bundle declarations using dts-bundle-generator
  console.log('📝 Bundling declarations...');
  await $`bunx dts-bundle-generator -o ./dist/index.d.ts ./src/index.ts --project tsconfig.build.json --no-banner`;

  // Clean up temp types
  await $`rm -rf ./dist/.tmp-types`;

  // Report bundle size
  console.log('\n📊 Bundle sizes:');
  const esm = Bun.file('./dist/index.js');
  const cjs = Bun.file('./dist/index.cjs');
  const dts = Bun.file('./dist/index.d.ts');
  console.log(`   ESM:  ${(esm.size / 1024).toFixed(2)} KB`);
  console.log(`   CJS:  ${(cjs.size / 1024).toFixed(2)} KB`);
  console.log(`   DTS:  ${(dts.size / 1024).toFixed(2)} KB`);

  // List all files
  console.log('\n📁 Output files:');
  await $`ls -la dist/`;

  console.log('\n✅ Build complete!');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
