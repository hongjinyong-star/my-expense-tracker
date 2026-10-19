import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: {baseURL: 'http://127.0.0.1:8000', headless: true, launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}},
  webServer: {command: 'npm start', url: 'http://127.0.0.1:8000', reuseExistingServer: false},
});
