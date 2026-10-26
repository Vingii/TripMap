import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackError, submitFeedback } from '../feedback'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(response: Partial<Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('feedback api', () => {
  it('posts the message and attachment as multipart form data', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ issue_id: 'TM-42' }),
    })
    const file = new File(['png'], 'shot.png', { type: 'image/png' })

    expect(await submitFeedback('Hello', file)).toEqual({ issue_id: 'TM-42' })

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/feedback')
    expect(init.method).toBe('POST')
    const body = init.body as FormData
    expect(body.get('message')).toBe('Hello')
    expect((body.get('attachment') as File).name).toBe('shot.png')
    // The browser must add the multipart boundary itself.
    expect(init.headers).not.toHaveProperty('Content-Type')
  })

  it('omits the attachment field when there is none', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ issue_id: 'TM-1' }),
    })

    await submitFeedback('Hello')

    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .body as FormData
    expect(body.has('attachment')).toBe(false)
  })

  it('surfaces the backend detail as a FeedbackError', async () => {
    mockFetch({
      ok: false,
      status: 413,
      json: () => Promise.resolve({ detail: 'Attachment exceeds 10 MB' }),
    })

    const error = await submitFeedback('Hi').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(FeedbackError)
    expect((error as FeedbackError).status).toBe(413)
    expect((error as FeedbackError).message).toBe('Attachment exceeds 10 MB')
  })

  it('falls back to a generic message for a non-JSON error', async () => {
    mockFetch({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError('bad json')),
    })

    await expect(submitFeedback('Hi')).rejects.toThrow(
      'Feedback could not be sent (502)',
    )
  })
})
