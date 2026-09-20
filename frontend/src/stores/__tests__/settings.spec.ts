// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../settings'
import { useThemeStore } from '../theme'
import { useProjectionStore } from '../projection'
import { useMapFilterStore } from '../mapFilter'
import { useBaseLayerStore } from '../baseLayer'
import type { UserSettings } from '../../api/me'

vi.mock('../../api/me', () => ({
  getMySettings: vi.fn(),
  updateMySettings: vi.fn(),
}))

import { getMySettings, updateMySettings } from '../../api/me'

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    theme: 'system',
    default_projection: 'flat',
    default_map_filter: 'all',
    default_base_layer: 'osm',
    default_visited: true,
    immich_api_key_set: false,
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
})

describe('settings store', () => {
  it('hydrate applies saved defaults to the live stores', () => {
    const store = useSettingsStore()

    store.hydrate(
      makeSettings({
        theme: 'dark',
        default_projection: 'globe',
        default_map_filter: 'visited',
        default_base_layer: 'mapy',
      }),
    )

    expect(store.settings?.theme).toBe('dark')
    expect(useThemeStore().theme).toBe('dark')
    expect(useProjectionStore().projection).toBe('globe')
    expect(useMapFilterStore().filter).toBe('visited')
    expect(useBaseLayerStore().baseLayer).toBe('mapy')
  })

  it('hydrate leaves a choice already made on this device alone', () => {
    // What a reload looks like: the map toggles were used last visit, so the
    // account defaults must not undo them.
    localStorage.setItem('tripmap.map.projection', 'globe')
    localStorage.setItem('tripmap.map.baseLayer', 'mapy')
    const store = useSettingsStore()

    store.hydrate(
      makeSettings({ default_projection: 'flat', default_base_layer: 'osm' }),
    )

    expect(useProjectionStore().projection).toBe('globe')
    expect(useBaseLayerStore().baseLayer).toBe('mapy')
    // The saved defaults are still what the Settings page shows.
    expect(store.settings?.default_projection).toBe('flat')
    expect(store.settings?.default_base_layer).toBe('osm')
  })

  it('save overrides a choice made on this device', async () => {
    localStorage.setItem('tripmap.map.baseLayer', 'osm')
    vi.mocked(updateMySettings).mockResolvedValue(
      makeSettings({ default_base_layer: 'mapy' }),
    )
    const store = useSettingsStore()

    await store.save({ default_base_layer: 'mapy' })

    // Choosing a default in Settings is explicit, so it takes effect at once.
    expect(useBaseLayerStore().baseLayer).toBe('mapy')
    expect(localStorage.getItem('tripmap.map.baseLayer')).toBe('mapy')
  })

  it('save persists the patch and re-applies the result', async () => {
    vi.mocked(updateMySettings).mockResolvedValue(
      makeSettings({ default_projection: 'globe' }),
    )
    const store = useSettingsStore()

    await store.save({ default_projection: 'globe' })

    expect(updateMySettings).toHaveBeenCalledWith({
      default_projection: 'globe',
    })
    expect(store.settings?.default_projection).toBe('globe')
    expect(useProjectionStore().projection).toBe('globe')
  })

  it('refresh loads settings from the API', async () => {
    vi.mocked(getMySettings).mockResolvedValue(
      makeSettings({ immich_api_key_set: true }),
    )
    const store = useSettingsStore()

    await store.refresh()

    expect(store.settings?.immich_api_key_set).toBe(true)
  })
})
