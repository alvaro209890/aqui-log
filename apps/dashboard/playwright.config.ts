import { defineConfig, devices } from '@playwright/test';
import { homedir } from 'node:os';
import { join } from 'node:path';

const baseURL = process.env.QA_DASHBOARD_URL || 'http://127.0.0.1:5199';
const cachedChrome = join(
  homedir(),
  '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
);

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'off',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM || cachedChrome,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
});
