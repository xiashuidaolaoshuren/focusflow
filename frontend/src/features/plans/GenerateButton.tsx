import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useGeneratePlan } from '@/features/plans/hooks'
import { PLAN_CONFLICT_MESSAGE } from '@/features/plans/planConflicts'
import { ApiError } from '@/lib/api'
import { plansByDateQueryPrefix } from '@/lib/query'

const STALE_PLAN_CODES = new Set([
  'PLAN_EXISTS',
  'PLAN_CHANGED',
  'PLAN_HAS_PROGRESS',
])

/** A 409 that means the client's copy of the day is stale, so the plan views must refetch. */
function isStalePlanError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code != null &&
    STALE_PLAN_CODES.has(error.code)
  )
}

type GenerateButtonProps = {
  planDate: string
}

/** Generate the one Daily plan a day can have. It lives in the empty rail, not the header. */
export function GenerateButton({ planDate }: GenerateButtonProps) {
  const { mutate, isPending } = useGeneratePlan()
  const [conflict, setConflict] = useState(false)
  const queryClient = useQueryClient()

  async function handlePlanConflict(error: unknown) {
    if (!isStalePlanError(error)) {
      return
    }
    setConflict(true)
    await queryClient.invalidateQueries({ queryKey: plansByDateQueryPrefix })
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {conflict ? (
        <Alert>
          <AlertDescription>{PLAN_CONFLICT_MESSAGE}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        disabled={isPending}
        aria-busy={isPending}
        onClick={() => mutate({ planDate }, { onError: handlePlanConflict })}
      >
        <RefreshCwIcon />
        {isPending ? 'Generating…' : 'Generate'}
      </Button>
    </div>
  )
}
