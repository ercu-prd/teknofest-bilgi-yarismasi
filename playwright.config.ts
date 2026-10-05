import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// Mirror what the Vite dev server will see (.env / .env.local) into process.env so
// specs can tell whether the app under test is wired to a real Supabase project.
const viteEnv = loadEnv('development', process.cwd(), 'VITE_');
for (const [key, value] of Object.entries(viteEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const PORT = 5179;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
