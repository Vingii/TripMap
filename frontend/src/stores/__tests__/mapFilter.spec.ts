import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { isMapFilter, useMapFilterStore } from '../mapFilter'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('mapFilter store', () => {
  it('defaults to "all"', () => {
    const store = useMapFilterStore()
    expect(store.filter).toBe('all')
  })

  it('set() updates the active filter', () => {
    const store = useMapFilterStore()
    store.set('visited')
    expect(store.filter).toBe('visited')
  })
})

describe('isMapFilter', () => {
  it('accepts the known filter values', () => {
    expect(isMapFilter('all')).toBe(true)
    expect(isMapFilter('visited')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isMapFilter('nope')).toBe(false)
    expect(isMapFilter(undefined)).toBe(false)
    expect(isMapFilter(['visited'])).toBe(false)
  })
})
