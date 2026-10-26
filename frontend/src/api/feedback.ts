// All HTTP calls live under src/api/ — components and stores import from here.
//
// Feedback is filed by the backend as a YouTrack issue; nothing is stored in
// TripMap itself.

import { apiFetch } from './client'

export interface FeedbackResult {
  // The YouTrack issue it was filed as, e.g. "TM-42".
  issue_id: string
}

/** A failed submission; `message` is the backend's human-readable detail. */
export class FeedbackError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'FeedbackError'
    this.status = status
  }
}

export async function submitFeedback(
  message: string,
  attachment: File | null = null,
): Promise<FeedbackResult> {
  const body = new FormData()
  body.append('message', message)
  if (attachment) body.append('attachment', attachment)
  // No Content-Type header: the browser sets the multipart boundary itself.
  const response = await apiFetch('/api/feedback', { method: 'POST', body })
  if (!response.ok) {
    throw new FeedbackError(response.status, await errorDetail(response))
  }
  return (await response.json()) as FeedbackResult
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown
    if (
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof body.detail === 'string'
    ) {
      return body.detail
    }
  } catch {
    // Not JSON — fall through to the generic message.
  }
  return `Feedback could not be sent (${response.status})`
}
