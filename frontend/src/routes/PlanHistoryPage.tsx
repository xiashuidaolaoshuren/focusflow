import { useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { PlanHistoryList } from '@/features/plans/PlanHistoryList'
import { usePlans } from '@/features/plans/hooks'

const PAGE_SIZE = 20

export function PlanHistoryPage() {
  const [page, setPage] = useState(0)
  const { plans, page: pageEnvelope, isPending, isError, refetch } = usePlans(
    page,
    PAGE_SIZE,
  )

  const totalPages = pageEnvelope?.totalPages ?? 0
  const totalElements = pageEnvelope?.totalElements ?? 0
  const hasPrevious = page > 0
  const hasNext = page + 1 < totalPages

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="text-xs leading-4 font-medium tracking-[0.08em] text-muted-foreground uppercase">
          History
        </span>
        <h1 className="font-display text-xl leading-9 font-medium tracking-[-0.01em]">Plans</h1>
      </div>
      <Card>
        <CardContent>
          <PlanHistoryList
            plans={plans}
            page={page}
            size={PAGE_SIZE}
            totalPages={totalPages}
            totalElements={totalElements}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            onPageChange={setPage}
            isLoading={isPending}
            isError={isError}
            onRetry={refetch}
          />
        </CardContent>
      </Card>
    </div>
  )
}
