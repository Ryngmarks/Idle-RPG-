import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works on any static host or sub-path.
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  test: { include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
});
