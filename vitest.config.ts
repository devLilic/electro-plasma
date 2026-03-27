import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src/renderer'),
      '@domain': path.join(__dirname, 'src/renderer/domain'),
      '@application': path.join(__dirname, 'src/renderer/application'),
      '@infrastructure': path.join(__dirname, 'src/renderer/infrastructure'),
      '@ui': path.join(__dirname, 'src/renderer/ui'),
      '@shared': path.join(__dirname, 'src/shared'),
    },
  },
  test: {
    root: __dirname,
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    hookTimeout: 1000 * 30,
    testTimeout: 1000 * 29,
  },
})
