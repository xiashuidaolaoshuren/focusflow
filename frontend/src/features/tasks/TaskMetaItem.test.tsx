import { FlagIcon } from 'lucide-react'
import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import { describe, expect, it } from 'vitest'

import { TaskMetaItem } from '@/features/tasks/TaskMetaItem'

describe('TaskMetaItem', () => {
  it('renders children with data-meta and a decorative icon', () => {
    render(
      <TaskMetaItem category="priority" icon={FlagIcon}>
        High
      </TaskMetaItem>,
    )

    const item = screen.getByText('High')
    expect(item).toBeInTheDocument()
    expect(item.closest('[data-meta="priority"]')).toBeInTheDocument()
    expect(
      item.closest('[data-meta="priority"]')?.querySelector('svg[aria-hidden="true"]'),
    ).toBeInTheDocument()
  })
})
