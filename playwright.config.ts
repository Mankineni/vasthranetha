import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
export const E2E_SITE_URL = `http://localhost:${PORT}`
const SEED_SPECS = /(^|[\\/])(browse|product)\.spec\.ts$/

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
  // The public specs assert on the untouched seed data, so they run first;
  // specs that add or change data run afterwards in the "admin" project.
  projects: [
    { name: 'public', testMatch: SEED_SPECS, use: { ...devices['Pixel 7'] } },
    { name: 'admin', testIgnore: SEED_SPECS, dependencies: ['public'], use: { ...devices['Pixel 7'] } },
  ],
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
