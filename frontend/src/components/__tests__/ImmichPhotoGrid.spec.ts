// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import ImmichPhotoGrid from '../ImmichPhotoGrid.vue'

const loadImage = vi.fn()

vi.mock('../../api/immich', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/immich')>()),
  loadImage: (...args: unknown[]) => loadImage(...args) as unknown,
}))

const { ImmichError } = await import('../../api/immich')

let app: App | null = null
let root: HTMLElement

function mount(): void {
  // happy-dom's IntersectionObserver never fires; without one, images load
  // straight away.
  vi.stubGlobal('IntersectionObserver', undefined)
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:test',
    revokeObjectURL: () => undefined,
  })
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp({
    render: () =>
      h(ImmichPhotoGrid, {
        assets: [
          { id: 'x1', type: 'IMAGE' },
          { id: 'x2', type: 'IMAGE' },
        ],
        coverAssetId: 'x1',
        immichUrl: 'https://photos.example',
      }),
  })
  app.mount(root)
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await nextTick()
}

afterEach(() => {
  app?.unmount()
  app = null
  root.remove()
  loadImage.mockReset()
  vi.unstubAllGlobals()
})

describe('ImmichPhotoGrid', () => {
  it('explains why thumbnails failed, once', async () => {
    loadImage.mockRejectedValue(
      new ImmichError(
        502,
        'Immich refused the request: Missing required permission: asset.view',
      ),
    )
    mount()
    await flush()

    const notices = root.querySelectorAll('[role="status"]')
    expect(notices).toHaveLength(1)
    expect(notices[0].textContent).toContain('asset.view')
  })

  it('shows no notice when thumbnails load', async () => {
    loadImage.mockResolvedValue(new Blob(['img']))
    mount()
    await flush()

    expect(root.querySelector('[role="status"]')).toBeNull()
    expect(root.querySelectorAll('img')).toHaveLength(2)
  })
})
