// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import ImmichAlbumPicker from '../ImmichAlbumPicker.vue'

const searchImmichAlbums = vi.fn()

vi.mock('../../api/immich', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/immich')>()),
  searchImmichAlbums: (...args: unknown[]) =>
    searchImmichAlbums(...args) as unknown,
}))

const { ImmichError } = await import('../../api/immich')

let app: App | null = null
let root: HTMLElement

function mount(initial: string | null = null, name?: string) {
  const model = ref<string | null>(initial)
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp({
    render: () =>
      h(ImmichAlbumPicker, {
        modelValue: model.value,
        name,
        'onUpdate:modelValue': (id: string | null) => {
          model.value = id
        },
      }),
  })
  app.mount(root)
  return model
}

function input(): HTMLInputElement {
  return root.querySelector<HTMLInputElement>(
    'input[aria-label="Search Immich albums"]',
  )!
}

async function type(value: string): Promise<void> {
  input().value = value
  input().dispatchEvent(new Event('input'))
  await nextTick()
}

async function settle(): Promise<void> {
  await vi.runAllTimersAsync()
  await nextTick()
}

function button(label: string): HTMLButtonElement {
  return [...root.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(label),
  )!
}

beforeEach(() => {
  vi.useFakeTimers()
  searchImmichAlbums.mockReset()
})

afterEach(() => {
  app?.unmount()
  app = null
  root.remove()
  vi.useRealTimers()
})

const PARIS = {
  id: 'a1',
  name: 'Paris 2023',
  asset_count: 12,
  thumbnail_asset_id: null,
}

describe('ImmichAlbumPicker', () => {
  it('debounces typing into a single search', async () => {
    searchImmichAlbums.mockResolvedValue([PARIS])
    mount()

    input().dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await type('Pa')
    await type('Par')
    await settle()

    expect(searchImmichAlbums).toHaveBeenCalledTimes(1)
    expect(searchImmichAlbums.mock.calls[0][0]).toBe('Par')
    expect(root.textContent).toContain('Paris 2023')
    expect(root.textContent).toContain('12 photos')
  })

  it('links the chosen album and shows its name', async () => {
    searchImmichAlbums.mockResolvedValue([PARIS])
    const model = mount()

    input().dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await settle()
    root
      .querySelector('li.cursor-pointer')!
      .dispatchEvent(new MouseEvent('mousedown'))
    await nextTick()

    expect(model.value).toBe('a1')
    expect(root.textContent).toContain('Paris 2023')
    expect(input()).toBeNull()
  })

  it('unlinks the current album', async () => {
    const model = mount('a1', 'Paris 2023')

    button('Unlink').click()
    await nextTick()

    expect(model.value).toBeNull()
    expect(input()).not.toBeNull()
  })

  it('shows the backend message when Immich fails', async () => {
    searchImmichAlbums.mockRejectedValue(
      new ImmichError(400, 'Add your Immich API key in Settings to use Immich'),
    )
    mount()

    input().dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await settle()

    expect(root.textContent).toContain('Add your Immich API key in Settings')
  })
})
