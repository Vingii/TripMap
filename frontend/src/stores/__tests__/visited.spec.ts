// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useVisitedStore } from '../visited'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('visited store', () => {
  it('starts empty when nothing is persisted', () => {
    const store = useVisitedStore()
    expect(store.isVisited('a')).toBe(false)
  })

  it('hydrates the visited set from localStorage', () => {
    localStorage.setItem('tripmap.visited', JSON.stringify(['a', 'b']))
    const store = useVisitedStore()
    expect(store.isVisited('a')).toBe(true)
    expect(store.isVisited('b')).toBe(true)
    expect(store.isVisited('c')).toBe(false)
  })

  it('ignores malformed persisted data', () => {
    localStorage.setItem('tripmap.visited', 'not json')
    const store = useVisitedStore()
    expect(store.isVisited('a')).toBe(false)
  })

  it('toggle() flips membership and persists to localStorage', async () => {
    const store = useVisitedStore()

    store.toggle('a')
    await nextTick()
    expect(store.isVisited('a')).toBe(true)
    expect(JSON.parse(localStorage.getItem('tripmap.visited') ?? '[]')).toEqual(
      ['a'],
    )

    store.toggle('a')
    await nextTick()
    expect(store.isVisited('a')).toBe(false)
    expect(JSON.parse(localStorage.getItem('tripmap.visited') ?? '[]')).toEqual(
      [],
    )
  })
})
