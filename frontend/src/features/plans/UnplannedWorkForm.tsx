import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateUnplannedWork } from '@/features/plans/hooks'
import { wouldExhaustRemainder } from '@/features/plans/progressRules'
import { getLocalDateString } from '@/lib/planningDate'
import type { TaskResponse } from '@/types/api'

type UnplannedWorkFormProps = {
  planDate: string
  tasks: TaskResponse[]
  onSubmitted?: () => void
}

export function UnplannedWorkForm({
  planDate,
  tasks,
  onSubmitted,
}: UnplannedWorkFormProps) {
  const { mutate, isPending } = useCreateUnplannedWork()
  const [taskId, setTaskId] = useState<string | null>(null)
  const [workDate, setWorkDate] = useState(planDate)
  const [actualMinutes, setActualMinutes] = useState('')
  const [finish, setFinish] = useState(false)
  const [reassess, setReassess] = useState(false)
  const [checkpointMinutes, setCheckpointMinutes] = useState('')
  const today = getLocalDateString()

  const selectedTask = tasks.find((task) => String(task.id) === taskId) ?? null

  function parsedActualMinutes(): number | null {
    if (actualMinutes.trim() === '') {
      return null
    }
    const parsed = Number.parseInt(actualMinutes, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  function hasRemainderInput(): boolean {
    if (!reassess) {
      return false
    }
    const parsed = Number.parseInt(checkpointMinutes, 10)
    return Number.isFinite(parsed) && parsed > 0
  }

  function canSubmit(): boolean {
    if (selectedTask == null) {
      return false
    }
    const minutes = parsedActualMinutes()
    if (minutes == null || minutes <= 0) {
      return false
    }
    if (workDate > today) {
      return false
    }
    if (finish || hasRemainderInput()) {
      return true
    }
    return !wouldExhaustRemainder(
      selectedTask.remainingEffortMinutes,
      minutes,
    )
  }

  function handleSubmit() {
    if (selectedTask == null || !canSubmit()) {
      return
    }

    const parsedCheckpoint = Number.parseInt(checkpointMinutes, 10)
    mutate(
      {
        taskId: selectedTask.id,
        workDate,
        actualMinutes: parsedActualMinutes()!,
        currentDate: today,
        effortVersion: selectedTask.effortVersion,
        finish,
        checkpoint: reassess
          ? {
              remainingEffortMinutes:
                Number.isFinite(parsedCheckpoint) && parsedCheckpoint > 0
                  ? parsedCheckpoint
                  : null,
            }
          : null,
      },
      { onSuccess: () => onSubmitted?.() },
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3">
      <div className="flex flex-col gap-2">
        <Label>Task</Label>
        <Select value={taskId} onValueChange={setTaskId}>
          <SelectTrigger aria-label="Task" className="w-full">
            <SelectValue placeholder="Choose a task" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {tasks.map((task) => (
                <SelectItem key={task.id} value={String(task.id)}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="unplanned-work-date">Work date</Label>
        <Input
          id="unplanned-work-date"
          type="date"
          max={today}
          value={workDate}
          onChange={(event) => setWorkDate(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="unplanned-actual-minutes">Actual minutes</Label>
        <Input
          id="unplanned-actual-minutes"
          type="number"
          min={1}
          value={actualMinutes}
          onChange={(event) => setActualMinutes(event.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          aria-label="Finish task"
          checked={finish}
          onChange={(event) => setFinish(event.target.checked)}
        />
        Finish task
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          aria-label="Reassess remaining effort"
          checked={reassess}
          onChange={(event) => setReassess(event.target.checked)}
        />
        Reassess remaining effort
      </label>
      {reassess ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="unplanned-checkpoint-minutes">
            Remaining effort minutes
          </Label>
          <Input
            id="unplanned-checkpoint-minutes"
            type="number"
            min={1}
            value={checkpointMinutes}
            onChange={(event) => setCheckpointMinutes(event.target.value)}
          />
        </div>
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={!canSubmit() || isPending}
        onClick={handleSubmit}
      >
        Log unplanned work
      </Button>
    </div>
  )
}
