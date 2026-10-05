// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import LocationSearch from '../LocationSearch.vue'
import { searchPlaces, type GeocodeResult } from '../../api/geocode'

vi.mock('../../api/geocode', () => ({ searchPlaces: vi.fn() }))

const BERLIN: GeocodeResult = {
  name: 'Berlin, Germany',
  lat: 52.52,
  lng: 13.405,
  country_code: 'DE',
  subdivision_codes: ['DE-BE'],
  bounding_box: null,
}

let app: App
let root: HTMLElement

async function type(value: string): Promise<void> {
  const input = root.querySelector('input')!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await vi.advanceTimersByTimeAsync(300)
  await nextTick()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(searchPlaces).mockResolvedValue([BERLIN])
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp(LocationSearch)
  app.mount(root)
})

afterEach(() => {
  app.unmount()
  root.remove()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('LocationSearch', () => {
  it('does not reopen the dropdown after a place is selected', async () => {
    await type('berl')
    const option = root.querySelector('li')!
    expect(option.textContent).toContain('Berlin, Germany')

    option.dispatchEvent(new MouseEvent('mousedown', { cancelable: true }))
    await vi.advanceTimersByTimeAsync(300)
    await nextTick()

    expect(root.querySelector('input')!.value).toBe('Berlin, Germany')
    expect(root.querySelector('ul')).toBeNull()
    expect(searchPlaces).toHaveBeenCalledTimes(1)
  })

  it('searches again once the selected name is edited', async () => {
    await type('berl')
    root
      .querySelector('li')!
      .dispatchEvent(new MouseEvent('mousedown', { cancelable: true }))
    await nextTick()

    await type('Berlin, Germ')

    expect(searchPlaces).toHaveBeenCalledTimes(2)
    expect(root.querySelector('ul')).not.toBeNull()
  })
})
