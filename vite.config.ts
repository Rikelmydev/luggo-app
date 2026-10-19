import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// No GitHub Pages o site fica em /luggo-app/; localmente, na raiz.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
