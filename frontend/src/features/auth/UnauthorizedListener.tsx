import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { onUnauthorized } from '@/lib/api'
import { currentUserQueryKey } from '@/lib/query'

/**
 * Clears the cached session on any 401 so the route guard sends the user to
 * /login. An anonymous session check also returns 401; clearing only an
 * existing user keeps that bootstrap request quiet.
 */
export function UnauthorizedListener() {
  const queryClient = useQueryClient()

  useEffect(
    () =>
      onUnauthorized(() => {
        if (queryClient.getQueryData(currentUserQueryKey) != null) {
          queryClient.setQueryData(currentUserQueryKey, null)
        }
      }),
    [queryClient],
  )

  return null
}
