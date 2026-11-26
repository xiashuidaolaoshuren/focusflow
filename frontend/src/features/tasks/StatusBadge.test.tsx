import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import { describe, expect, it } from 'vitest'

import { StatusBadge } from '@/features/tasks/StatusBadge'

describe('StatusBadge', () => {
  it.each([
    ['OPEN', 'Open'],
    ['IN_PROGRESS', 'In progress'],
    ['DONE', 'Done'],
    ['CANCELLED', 'Cancelled'],
  ] as const)('renders %s as %s with data-status', (status, label) => {
    render(<StatusBadge status={status} />)

    const badge = screen.getByText(label).closest('[data-status]')
    expect(badge).toHaveAttribute('data-status', status)
    expect(badge?.querySelector('svg')).not.toBeNull()
  })
})
