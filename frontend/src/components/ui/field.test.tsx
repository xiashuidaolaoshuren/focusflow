import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Field } from '@/components/ui/field'
import { getFieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'

describe('getFieldError', () => {
  it('returns the first details message for a field', () => {
    const error = new ApiError({
      status: 400,
      message: 'Validation failed',
      details: { title: ['First error', 'Second error'] },
    })
    expect(getFieldError(error, 'title')).toBe('First error')
    expect(getFieldError(error, 'missing')).toBeUndefined()
  })
})

describe('Field', () => {
  it('wires label, control, and the first API error message', () => {
    const apiError = new ApiError({
      status: 400,
      message: 'x',
      details: { title: ['Server title error', 'Other'] },
    })
    render(
      <Field label="Title" name="title" apiError={apiError}>
        {(control) => <Input {...control} data-testid="title-input" />}
      </Field>,
    )
    const input = screen.getByTestId('title-input')
    const label = screen.getByText('Title')
    expect(label).toHaveAttribute('for', input.id)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toContain('-error')
    expect(screen.getByRole('alert')).toHaveTextContent('Server title error')
  })

  it('prefers a client error over API details', () => {
    const apiError = new ApiError({
      status: 400,
      message: 'x',
      details: { title: ['Server'] },
    })
    render(
      <Field label="Title" name="title" error="Client error" apiError={apiError}>
        {(control) => <Input {...control} />}
      </Field>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Client error')
  })

  it('keeps legacy layout-only usage unchanged', () => {
    const { container } = render(
      <Field>
        <span data-testid="child">Child</span>
      </Field>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})
