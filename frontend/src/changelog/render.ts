import DOMPurify from 'dompurify'
import { marked } from 'marked'

/** Markdown → HTML safe for `v-html`. Entries are dev-authored, but are
 * sanitized anyway as defence in depth. */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false })
  return DOMPurify.sanitize(html)
}
