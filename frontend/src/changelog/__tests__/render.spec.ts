// DOMPurify does not sanitize under happy-dom (it reports itself supported
// but leaves markup untouched), so this runs under jsdom.
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../render'

describe('renderMarkdown', () => {
  it('renders markdown to HTML', () => {
    expect(renderMarkdown('- **bold** [link](https://example.com)')).toBe(
      '<ul>\n<li><strong>bold</strong> <a href="https://example.com">link</a></li>\n</ul>\n',
    )
  })

  it('strips scripts, event handlers and javascript: links', () => {
    const html = renderMarkdown(
      '<script>alert(1)</script><img src="x" onerror="alert(2)">\n\n[x](javascript:alert(3))',
    )

    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('<img src="x">')
  })
})
