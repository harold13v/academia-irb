import { defineConfig } from '@playwright/test';

/** Smoke de consola. Por defecto usa el Chromium de Playwright (`npx playwright install chromium`);
 *  QA_CHROME_ROOT apunta a un chrome-headless-shell propio si no se quieren descargar navegadores. */
const QA = process.env.QA_CHROME_ROOT;
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:4200',
    launchOptions: QA ? { executablePath: `${QA}/chrome-headless-shell-linux64/chrome-headless-shell`, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: `${QA}/libs/usr/lib64` } } : {},
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
