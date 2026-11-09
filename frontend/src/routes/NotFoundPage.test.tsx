import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { NotFoundPage } from '@/routes/NotFoundPage'

function renderNotFound(initialPath = '/unknown') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <NotFoundPage />
    </MemoryRouter>,
  )
}

describe('NotFoundPage', () => {
  it('renders the 404 copy and the requested path', () => {
    renderNotFound('/unknown')

    expect(screen.getByText(/^404$/)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('/unknown')).toBeInTheDocument()
  })

  it('links back to Today', () => {
    renderNotFound()

    expect(screen.getByRole('link', { name: /go to today/i })).toHaveAttribute(
      'href',
      '/today',
    )
  })
})
