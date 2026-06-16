// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useProjectionStore } from '../projection'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('projection store', () => {
  it('defaults to the flat map when nothing is persisted', () => {
    const store = useProjectionStore()
    expect(store.projection).toBe('flat')
  })

  it('initialises from the persisted projection', () => {
    localStorage.setItem('tripmap.map.projection', 'globe')
    const store = useProjectionStore()
    expect(store.projection).toBe('globe')
  })

  it('ignores an invalid persisted value', () => {
    localStorage.setItem('tripmap.map.projection', 'nonsense')
    const store = useProjectionStore()
    expect(store.projection).toBe('flat')
  })

  it('set() updates the projection and persists it', async () => {
    const store = useProjectionStore()

    store.set('globe')
    await nextTick()
    expect(store.projection).toBe('globe')
    expect(localStorage.getItem('tripmap.map.projection')).toBe('globe')

    store.set('flat')
    await nextTick()
    expect(store.projection).toBe('flat')
    expect(localStorage.getItem('tripmap.map.projection')).toBe('flat')
  })
})
