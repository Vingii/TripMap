import { expect, SEED, test, uniqueName } from './fixtures'

test('creates an album and adds a location to it', async ({ page }) => {
  const name = uniqueName('E2E Album')
  await page.goto('/albums')

  await page.getByRole('button', { name: 'New album' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  // Creating opens the new album.
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
  await expect(page.getByText('No locations in this album yet.')).toBeVisible()

  await page.getByLabel('Filter locations to add').fill(SEED.unvisited)
  await page.getByRole('button', { name: `+ ${SEED.unvisited}` }).click()

  const remove = page.getByRole('button', {
    name: `Remove ${SEED.unvisited} from album`,
  })
  await expect(remove).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Locations (1)' }),
  ).toBeVisible()

  // Listed with its location count back on the albums page.
  await page.goto('/albums')
  await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
})
