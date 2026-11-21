import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { useDocumentTitle } from '@/hooks/use-document-title'

function renderAt(path: string) {
  return renderHook(() => useDocumentTitle(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    ),
  })
}

describe('useDocumentTitle', () => {
  it('names the current screen', () => {
    renderAt('/plans')

    expect(document.title).toBe('Plans — FocusFlow')
  })

  it('falls back to the product name for unknown paths', () => {
    renderAt('/unknown')

    expect(document.title).toBe('FocusFlow')
  })
})
