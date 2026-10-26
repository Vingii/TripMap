// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import FeedbackForm from '../FeedbackForm.vue'

const submitFeedback = vi.fn()

vi.mock('../../api/feedback', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/feedback')>()),
  submitFeedback: (...args: unknown[]) => submitFeedback(...args) as unknown,
}))

const { FeedbackError } = await import('../../api/feedback')

let app: App | null = null
let root: HTMLElement
const onClose = vi.fn()

function mount(): void {
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp({ render: () => h(FeedbackForm, { onClose }) })
  app.mount(root)
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await nextTick()
}

async function typeAndSend(text: string): Promise<void> {
  const textarea = root.querySelector('textarea') as HTMLTextAreaElement
  textarea.value = text
  textarea.dispatchEvent(new Event('input'))
  await nextTick()
  root.querySelector('form')?.dispatchEvent(new Event('submit'))
  await flush()
}

afterEach(() => {
  app?.unmount()
  app = null
  root.remove()
  submitFeedback.mockReset()
  onClose.mockReset()
})

describe('FeedbackForm', () => {
  it('disables sending until a message is typed', () => {
    mount()

    const send = root.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement
    expect(send.disabled).toBe(true)
  })

  it('sends the trimmed message and confirms with the issue ID', async () => {
    submitFeedback.mockResolvedValue({ issue_id: 'TM-42' })
    mount()

    await typeAndSend('  Great app  ')

    expect(submitFeedback).toHaveBeenCalledWith('Great app', null)
    const status = root.querySelector('[role="status"]')
    expect(status?.textContent).toContain('TM-42')
    expect(root.querySelector('form')).toBeNull()
  })

  it('shows the error and keeps the message for a retry', async () => {
    submitFeedback.mockRejectedValue(
      new FeedbackError(502, 'YouTrack is unreachable'),
    )
    mount()

    await typeAndSend('Bug report')

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'YouTrack is unreachable',
    )
    expect((root.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'Bug report',
    )
  })

  it('closes on cancel', async () => {
    mount()

    const cancel = [...root.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Cancel',
    )
    cancel?.click()
    await nextTick()

    expect(onClose).toHaveBeenCalledOnce()
  })
})
