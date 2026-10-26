import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Playwright only stops the attached `up` process, which leaves e2e-db running
// with this run's data. Remove both containers so nothing lingers.
export default function globalTeardown(): void {
  execSync('docker compose --profile e2e rm --stop --force e2e-app e2e-db', {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    stdio: 'ignore',
  })
}
