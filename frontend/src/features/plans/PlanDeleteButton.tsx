import { Trash2Icon } from 'lucide-react'
import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { formatDateLabel } from '@/lib/format'
import type { DailyPlanResponse } from '@/types/api'

type PlanDeleteButtonProps = {
  plan: Pick<DailyPlanResponse, 'id' | 'planDate'>
  onConfirm: () => void
  isDeleting?: boolean
  variant: 'icon' | 'text'
}

export function PlanDeleteButton({
  plan,
  onConfirm,
  isDeleting = false,
  variant,
}: PlanDeleteButtonProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  function handleDeleteConfirm() {
    onConfirm()
    setIsDeleteDialogOpen(false)
  }

  const trigger =
    variant === 'icon' ? (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete plan for ${formatDateLabel(plan.planDate)}`}
        disabled={isDeleting}
        onClick={() => setIsDeleteDialogOpen(true)}
      >
        <Trash2Icon className="size-4" aria-hidden />
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        className="text-destructive"
        disabled={isDeleting}
        onClick={() => setIsDeleteDialogOpen(true)}
      >
        Delete plan
      </Button>
    )

  return (
    <>
      {trigger}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent aria-label="Delete plan">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the plan for {formatDateLabel(plan.planDate)}. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
