import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { MessageBodyRenderer } from '@/components/shared/MessageBodyRenderer'

describe('MessageBodyRenderer', () => {
  it('renders bold markdown when contentType is plain', () => {
    render(<MessageBodyRenderer content="**Duration**: 40 weeks." contentType="plain" />)
    const strong = screen.getByText('Duration')
    expect(strong.tagName).toBe('STRONG')
  })

  it('renders bullet list markdown for FAQ-style answers', () => {
    const { container } = render(
      <MessageBodyRenderer
        content={'Requirements:\n\n* **Payment**: Must be paid.'}
        contentType="plain"
      />
    )
    expect(container.querySelector('ul')).not.toBeNull()
    expect(container.querySelector('li')).not.toBeNull()
  })
})
