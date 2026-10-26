import { expect, pin, SEED, test } from './fixtures'

test('filters the map between all and my visited locations', async ({
  page,
}) => {
  await page.goto('/map')
  await expect(pin(page, SEED.visited)).toBeVisible()
  await expect(pin(page, SEED.unvisited)).toBeVisible()

  await page.getByRole('button', { name: 'My visited', exact: true }).click()
  await expect(page).toHaveURL(/[?&]filter=visited/)
  await expect(pin(page, SEED.visited)).toBeVisible()
  await expect(pin(page, SEED.unvisited)).toHaveCount(0)

  await page.getByRole('button', { name: 'All', exact: true }).click()
  await expect(page).not.toHaveURL(/filter=/)
  await expect(pin(page, SEED.unvisited)).toBeVisible()
})

test('switches between the pin and zone views', async ({ page }) => {
  await page.goto('/map')
  await expect(pin(page, SEED.visited)).toBeVisible()

  await page.getByRole('link', { name: 'Zones', exact: true }).click()
  await expect(page).toHaveURL(/\/zones$/)
  // The choropleth draws every country as an SVG path; pins are gone.
  const zones = page.locator('.leaflet-overlay-pane path')
  await expect(zones.first()).toBeVisible()
  expect(await zones.count()).toBeGreaterThan(100)
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0)

  await page.getByRole('link', { name: 'Map', exact: true }).click()
  await expect(page).toHaveURL(/\/map/)
  await expect(pin(page, SEED.visited)).toBeVisible()
})
