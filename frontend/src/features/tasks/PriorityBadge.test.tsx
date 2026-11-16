import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import { describe, expect, it } from 'vitest'

import { PriorityBadge } from '@/features/tasks/PriorityBadge'

describe('PriorityBadge', () => {
  it.each([
    ['LOW', 'Low'],
    ['MEDIUM', 'Medium'],
    ['HIGH', 'High'],
  ] as const)('renders %s as %s with data-priority', (priority, label) => {
    render(<PriorityBadge priority={priority} />)

    const badge = screen.getByText(label).closest('[data-priority]')
    expect(badge).toHaveAttribute('data-priority', priority)
    expect(badge?.querySelector('svg')).not.toBeNull()
  })
})
