import { defineConfig, devices } from '@playwright/test'

// End-to-end suite. `npm run e2e` starts the isolated `e2e` Docker Compose
// stack (fresh, seeded database on its own port), runs the tests against the
// built image, and removes the stack again. See e2e/fixtures.ts for the seed.
const PORT = 8001
const CI = Boolean(process.env.CI)
// Removing the containers (not just stopping them) is what discards the tmpfs
// database; `up --force-recreate` alone leaves a running e2e-db in place.
const RESET_STACK =
  'docker compose --profile e2e rm --stop --force e2e-app e2e-db'

export default defineConfig({
  testDir: './e2e',
  // Not *.spec.ts, which Vitest would pick up as unit tests.
  testMatch: '**/*.e2e.ts',
  // The tests share one seeded database and one user, so run them in order.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalTeardown: './e2e/global-teardown.ts',
  webServer: {
    // Start from fresh containers, so the database holds only the seed. Attached
    // (no -d) so Playwright can stop the app; global-teardown removes the rest.
    command: `${RESET_STACK} && docker compose --profile e2e up --build e2e-app`,
    cwd: '..',
    url: `http://127.0.0.1:${PORT}/api/health`,
    // A cold image build (npm ci + vite build + uv sync) takes a few minutes.
    timeout: 10 * 60_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 30_000 },
  },
})
