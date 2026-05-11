import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  shims: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  banner: ({ format }) => ({
    js: format === 'esm' ? '#!/usr/bin/env node' : '',
  }),
});
