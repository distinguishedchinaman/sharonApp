import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }, { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: { command: 'npm run start -- --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false },
});
