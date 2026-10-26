import { expect, test as base, type Locator, type Page } from '@playwright/test'

// Locations created by backend/app/scripts/seed_e2e.py. They sit far enough
// apart that the map never clusters them at the default world view.
export const SEED = {
  visited: 'E2E Paris',
  unvisited: 'E2E Tokyo',
  // Toggled by the visited test, which restores it afterwards.
  toggle: 'E2E Buenos Aires',
} as const

/** A map pin, by the location name it is labelled with. */
export function pin(page: Page, name: string): Locator {
  return page
    .locator('.leaflet-marker-icon')
    .and(page.getByRole('button', { name, exact: true }))
}

/** A name no earlier run or test can have used. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`
}

export const test = base.extend<{ pageErrors: string[] }>({
  // Applied to every test: keep the browser off the network (map tiles and
  // anything else external are aborted, so results never depend on a
  // third-party service) and fail the test on any uncaught page error.
  pageErrors: [
    async ({ page, baseURL }, use) => {
      const origin = new URL(baseURL ?? '').origin
      await page.route(
        (url) => url.origin !== origin,
        (route) => route.abort(),
      )
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await use(errors)
      expect(errors, 'uncaught errors in the page').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
