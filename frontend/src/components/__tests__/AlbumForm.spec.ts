// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import AlbumForm from '../AlbumForm.vue'
import type { AlbumCreate } from '../../api/albums'

let app: App | null = null
let root: HTMLElement

function mount(initial?: AlbumCreate): AlbumCreate[] {
  const submitted: AlbumCreate[] = []
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp({
    render: () =>
      h(AlbumForm, {
        title: 'Album',
        initial,
        onSubmit: (payload: AlbumCreate) => submitted.push(payload),
      }),
  })
  app.mount(root)
  return submitted
}

function select(label: string, value: string): void {
  const el = root.querySelector<HTMLSelectElement>(
    `select[aria-label="${label}"]`,
  )!
  el.value = value
  el.dispatchEvent(new Event('change'))
}

async function submit(): Promise<void> {
  await nextTick()
  root.querySelector('form')!.dispatchEvent(new Event('submit'))
  await nextTick()
}

afterEach(() => {
  app?.unmount()
  app = null
  root.remove()
})

const EXISTING: AlbumCreate = {
  name: 'Summer trip',
  description: 'Sun',
  date: '2024-07-14',
  date_precision: 'day',
  immich_album_id: 'imm-1',
}

describe('AlbumForm', () => {
  it('submits the seeded values unchanged', async () => {
    const submitted = mount(EXISTING)

    await submit()

    expect(submitted).toEqual([EXISTING])
  })

  it('pins the day to the 1st at month precision', async () => {
    const submitted = mount(EXISTING)

    select('Date precision', 'month')
    await submit()

    expect(submitted[0]).toMatchObject({
      date: '2024-07-01',
      date_precision: 'month',
    })
  })

  it('pins month and day to January 1st at year precision', async () => {
    const submitted = mount(EXISTING)

    select('Date precision', 'year')
    await submit()

    expect(submitted[0]).toMatchObject({
      date: '2024-01-01',
      date_precision: 'year',
    })
  })

  it('sends blank optional fields as null', async () => {
    const submitted = mount({
      ...EXISTING,
      description: '',
      immich_album_id: '',
    })

    await submit()

    expect(submitted[0]).toMatchObject({
      description: null,
      immich_album_id: null,
    })
  })

  it('does not submit without a name', async () => {
    const submitted = mount({ ...EXISTING, name: '   ' })

    await submit()

    expect(submitted).toEqual([])
  })
})
