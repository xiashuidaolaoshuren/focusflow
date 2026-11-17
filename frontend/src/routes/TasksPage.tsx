import { useMemo, useState } from 'react'
import { ListTodoIcon, PlusIcon, SearchIcon } from 'lucide-react'

import { InfoPopover } from '@/components/InfoPopover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { DeadlineLegend } from '@/features/horizon/DeadlineBadge'
import { TaskEditorSheet } from '@/features/tasks/TaskEditorSheet'
import { TaskRow } from '@/features/tasks/TaskRow'
import { useDeleteTask, useTasks } from '@/features/tasks/hooks'
import {
  filterTasks,
  searchTasks,
  sortTasks,
  tabCounts,
  type TaskSort,
  type TaskTab,
} from '@/features/tasks/taskListModel'
import { liveNeededForLabel } from '@/features/tasks/taskDependencyLinks'
import { useHorizon } from '@/features/horizon/hooks'
import { useIsMobile } from '@/hooks/use-mobile'
import { getLocalDateString } from '@/lib/planningDate'
import { cn } from '@/lib/utils'
import type { TaskResponse } from '@/types/api'

const TABS: { value: TaskTab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

const SORTS: { value: TaskSort; label: string }[] = [
  { value: 'due', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'effort', label: 'Remaining effort' },
]

/**
 * Tasks: the inventory, filtered by tab and searched by title.
 */
export function TasksPage() {
  const { tasks, isPending, isError, refetch } = useTasks()
  const {
    horizon,
    isError: isHorizonError,
    refetch: refetchHorizon,
  } = useHorizon()
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskResponse | null>(null)
  const [sheetSession, setSheetSession] = useState(0)
  const [tab, setTab] = useState<TaskTab>('active')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<TaskSort>('due')
  const isMobile = useIsMobile()

  const planningDate = getLocalDateString()
  const counts = tabCounts(tasks)
  const visibleTasks = sortTasks(searchTasks(filterTasks(tasks, tab), query), sort)
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  )
  const horizonRowByTaskId = useMemo(
    () => new Map((horizon?.tasks ?? []).map((row) => [row.taskId, row])),
    [horizon],
  )

  function handleDelete(task: TaskResponse) {
    deleteTask(task.id)
  }

  function openCreate() {
    setEditingTask(null)
    setSheetSession((session) => session + 1)
    setIsSheetOpen(true)
  }

  function openEdit(task: TaskResponse) {
    setEditingTask(task)
    setSheetSession((session) => session + 1)
    setIsSheetOpen(true)
  }

  function handleSheetOpenChange(open: boolean) {
    setIsSheetOpen(open)
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }
    event.preventDefault()
    const index = TABS.findIndex((entry) => entry.value === tab)
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = TABS[(index + step + TABS.length) % TABS.length]
    if (next != null) {
      setTab(next.value)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs leading-4 font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Inventory
          </span>
          <h1 className="font-display text-xl leading-9 font-medium tracking-[-0.01em]">
            Tasks
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InfoPopover label="About deadline forecasts" title="Deadline forecast" align="end">
            <DeadlineLegend />
          </InfoPopover>
          <Button type="button" onClick={openCreate}>
            <PlusIcon aria-hidden="true" />
            New task
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div
          role="tablist"
          aria-label="Task filter"
          className="inline-flex gap-0.5 border-b border-border"
        >
          {TABS.map((entry) => {
            const selected = tab === entry.value
            return (
              <button
                key={entry.value}
                type="button"
                role="tab"
                id={`tab-${entry.value}`}
                aria-selected={selected}
                aria-controls="tasks-panel"
                tabIndex={selected ? 0 : -1}
                className={cn(
                  'relative inline-flex items-center gap-1.5 px-2 py-2 text-sm font-medium outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
                  selected ? 'text-foreground' : 'text-muted-foreground',
                )}
                onClick={() => setTab(entry.value)}
                onKeyDown={handleTabKeyDown}
              >
                {entry.label}
                <span className="font-mono text-xs text-muted-foreground">
                  {counts[entry.value]}
                </span>
                {selected ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-2 bottom-[-1px] left-2 h-0.5 rounded-sm bg-primary"
                  />
                ) : null}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-[220px] max-w-full flex-col gap-1">
            <label htmlFor="task-search" className="text-sm font-medium">
              Search
            </label>
            <div className="relative">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="task-search"
                type="search"
                aria-label="Search tasks"
                autoComplete="off"
                className="pl-[30px]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="flex w-[180px] max-w-full flex-col gap-1">
            <label htmlFor="task-sort" className="text-sm font-medium">
              Sort by
            </label>
            <select
              id="task-sort"
              aria-label="Sort by"
              value={sort}
              onChange={(event) => setSort(event.target.value as TaskSort)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {SORTS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isHorizonError ? (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Deadline forecast unavailable</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => refetchHorizon()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isError ? (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <span>Tasks could not be loaded.</span>
          <button type="button" className="underline" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      {!isPending && !isError ? (
        <section
          id="tasks-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className="overflow-hidden rounded-lg border border-border bg-card"
        >
          {tasks.length === 0 ? (
            <div className="grid justify-items-center gap-3 px-6 py-12 text-center">
              <ListTodoIcon
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="font-display text-lg leading-7 font-medium">
                No tasks yet
              </p>
              <Button type="button" variant="outline" onClick={openCreate}>
                <PlusIcon aria-hidden="true" />
                New task
              </Button>
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="grid justify-items-center gap-3 px-6 py-12 text-center">
              <SearchIcon
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="font-display text-lg leading-7 font-medium">
                {query.trim() !== ''
                  ? `No tasks match “${query.trim()}”`
                  : `No ${tab} tasks`}
              </p>
              {query.trim() !== '' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuery('')}
                >
                  Clear search
                </Button>
              ) : null}
            </div>
          ) : isMobile ? (
            <ul aria-label="Tasks" className="flex flex-col">
              {visibleTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  variant="card"
                  horizonRow={horizonRowByTaskId.get(task.id)}
                  neededFor={liveNeededForLabel(task, taskById, planningDate)}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                />
              ))}
            </ul>
          ) : (
            <table aria-label="Tasks" className="w-full border-collapse">
              <caption className="sr-only">Tasks</caption>
              <thead>
              <tr>
                <th scope="col" className="h-9 w-7 px-3">
                  <span className="sr-only">Priority</span>
                </th>
                <th scope="col" className="h-9 px-3 text-left text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Task
                </th>
                <th scope="col" className="h-9 px-3 text-left text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Status
                </th>
                <th scope="col" className="h-9 px-3 text-left text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Due
                </th>
                <th scope="col" className="h-9 px-3 text-left text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Forecast
                </th>
                <th scope="col" className="h-9 px-3 text-right text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Remaining
                </th>
                <th scope="col" className="h-9 px-3 text-left text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Deps
                </th>
                <th scope="col" className="h-9 px-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  horizonRow={horizonRowByTaskId.get(task.id)}
                  neededFor={liveNeededForLabel(task, taskById, planningDate)}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                />
              ))}
            </tbody>
          </table>
          )}
        </section>
      ) : null}

      {isPending ? (
        <div
          role="status"
          aria-label="Loading tasks"
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full rounded" />
          ))}
        </div>
      ) : null}

      <TaskEditorSheet
        key={sheetSession}
        open={isSheetOpen}
        task={editingTask}
        onOpenChange={handleSheetOpenChange}
      />
    </div>
  )
}
