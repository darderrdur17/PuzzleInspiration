import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vitest config (cast to align with Vite config types in build)
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)', 'src/**/*.smoke.test.tsx'],
  } as any,
} as any)
