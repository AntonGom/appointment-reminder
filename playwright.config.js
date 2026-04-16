const { defineConfig } = require("@playwright/test");
const path = require("path");

module.exports = defineConfig({
  testDir: path.join(__dirname, "tests"),
  timeout: 30000,
  outputDir: path.join(__dirname, "test-results"),
  preserveOutput: "failures-only",
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    viewport: {
      width: 1440,
      height: 1100
    }
  },
  webServer: {
    command: "node tests/static-server.cjs",
    port: 4173,
    reuseExistingServer: true,
    timeout: 15000
  }
});
