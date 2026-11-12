import { defineConfig, devices } from '@playwright/test'

/** End-to-end checks in WebKit (Safari's engine), against the production build. Run: npm run e2e */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4318',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } }],
  webServer: {
    command: 'npx vite build && npx vite preview --port 4318 --strictPort',
    url: 'http://localhost:4318',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
