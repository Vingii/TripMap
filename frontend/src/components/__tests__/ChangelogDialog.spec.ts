// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import ChangelogDialog from '../ChangelogDialog.vue'
import type { ChangelogEntry } from '../../changelog'

let app: App | null = null
let root: HTMLElement
const onClose = vi.fn()

const ENTRIES: ChangelogEntry[] = [
  {
    id: 'new',
    date: '2026-10-26',
    title: 'Newer',
    body: '- **bold** item',
  },
  { id: 'old', date: '2026-01-01', title: 'Older', body: 'plain' },
]

function mount(unseenIds: string[]): void {
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp({
    render: () => h(ChangelogDialog, { entries: ENTRIES, unseenIds, onClose }),
  })
  app.mount(root)
}

afterEach(() => {
  app?.unmount()
  app = null
  root.remove()
  onClose.mockReset()
})

describe('ChangelogDialog', () => {
  it('renders entries in the given order with markdown', () => {
    mount([])

    const titles = [...root.querySelectorAll('h3')].map((el) => el.textContent)
    expect(titles).toEqual(['Newer', 'Older'])
    expect(root.querySelector('article li strong')?.textContent).toBe('bold')
  })

  it('badges only unseen entries as new', () => {
    mount(['new'])

    const articles = root.querySelectorAll('article')
    expect(articles[0].textContent).toContain('New')
    expect(articles[1].textContent).not.toContain('New')
  })

  it('emits close from the close button', async () => {
    mount([])

    const close = [...root.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Close',
    )
    close?.click()
    await nextTick()

    expect(onClose).toHaveBeenCalledOnce()
  })
})
