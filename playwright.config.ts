import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
export const E2E_SITE_URL = `http://localhost:${PORT}`

// Run with `npm run e2e`: scripts/e2e-prepare.ts builds a fresh seeded
// database first, then Playwright builds and starts the app against it.
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: E2E_SITE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'pixel', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: E2E_SITE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_PATH: './data/e2e.db',
      MEDIA_DIR: './data/e2e-media',
      SITE_URL: E2E_SITE_URL,
      AUTOFILL_FAKE: '1',
    },
  },
})
