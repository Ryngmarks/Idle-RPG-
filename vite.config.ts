import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works on any static host or sub-path.
  base: './',
  plugins: [react()],
  // Shown in Meny → Version so the player can tell which build they run.
  define: { __APP_BUILD__: JSON.stringify(new Date().toISOString()) },
  build: { outDir: 'dist', sourcemap: false },
  test: { include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
});
