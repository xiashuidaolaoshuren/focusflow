import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { DashboardRedirect } from '@/routes/DashboardRedirect'

function LocationDisplay() {
  const location = useLocation()
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  )
}

function renderRedirect(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="/today" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DashboardRedirect', () => {
  it('sends /dashboard to /today and keeps the date query', () => {
    renderRedirect('/dashboard?date=2026-11-06')

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/today?date=2026-11-06',
    )
  })

  it('sends /dashboard without a query to /today', () => {
    renderRedirect('/dashboard')

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/today$/)
  })
})
