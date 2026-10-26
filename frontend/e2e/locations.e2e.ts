import { expect, pin, SEED, test, uniqueName } from './fixtures'

test('creates a location by clicking the map', async ({ page }) => {
  const name = uniqueName('E2E Pin')
  await page.goto('/map')
  const map = page.locator('.leaflet-container')
  await expect(pin(page, SEED.visited)).toBeVisible()

  // South-east of the default view's centre: open ocean, clear of the seeded
  // pins and of the map's overlay controls.
  const box = await map.boundingBox()
  if (!box) throw new Error('map has no bounding box')
  await page.mouse.click(
    box.x + box.width / 2 + 200,
    box.y + box.height / 2 + 150,
  )

  await expect(
    page.getByRole('heading', { name: 'New location' }),
  ).toBeVisible()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  await expect(pin(page, name)).toBeVisible()
  // Persisted, not just added to the client-side store.
  await page.reload()
  await expect(pin(page, name)).toBeVisible()
})

test('toggles a location between visited and unvisited', async ({ page }) => {
  await page.goto('/map')
  await pin(page, SEED.toggle).click()

  await page.getByRole('button', { name: 'Mark visited' }).click()
  await expect(page.getByRole('button', { name: '✓ Visited' })).toBeVisible()

  // The state is stored server-side: it survives a reload.
  await page.reload()
  await pin(page, SEED.toggle).click()
  await page.getByRole('button', { name: '✓ Visited' }).click()
  await expect(page.getByRole('button', { name: 'Mark visited' })).toBeVisible()

  await page.reload()
  await pin(page, SEED.toggle).click()
  await expect(page.getByRole('button', { name: 'Mark visited' })).toBeVisible()
})
