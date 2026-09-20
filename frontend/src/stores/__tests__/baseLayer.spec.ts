// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { isBaseLayer, useBaseLayerStore } from '../baseLayer'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('base layer store', () => {
  it('defaults to OpenStreetMap when nothing is persisted', () => {
    const store = useBaseLayerStore()
    expect(store.baseLayer).toBe('osm')
  })

  it('initialises from the persisted base layer', () => {
    localStorage.setItem('tripmap.map.baseLayer', 'mapy')
    const store = useBaseLayerStore()
    expect(store.baseLayer).toBe('mapy')
  })

  it('ignores an invalid persisted value', () => {
    localStorage.setItem('tripmap.map.baseLayer', 'nonsense')
    const store = useBaseLayerStore()
    expect(store.baseLayer).toBe('osm')
  })

  it('set() updates the base layer and persists it', async () => {
    const store = useBaseLayerStore()

    store.set('mapy')
    await nextTick()
    expect(store.baseLayer).toBe('mapy')
    expect(localStorage.getItem('tripmap.map.baseLayer')).toBe('mapy')

    store.set('osm')
    await nextTick()
    expect(store.baseLayer).toBe('osm')
    expect(localStorage.getItem('tripmap.map.baseLayer')).toBe('osm')
  })

  it('isBaseLayer guards the known values', () => {
    expect(isBaseLayer('osm')).toBe(true)
    expect(isBaseLayer('mapy')).toBe(true)
    expect(isBaseLayer('nonsense')).toBe(false)
    expect(isBaseLayer(undefined)).toBe(false)
  })
})
