import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import {
  commitmentsQueryKey,
  commitmentsQueryPrefix,
  currentUserQueryKey,
  horizonQueryKey,
  horizonQueryPrefix,
  invalidatePlanQueries,
  planByDateQueryKey,
  planDetailQueryKey,
  plansByDateQueryPrefix,
  plansDetailQueryPrefix,
  plansListQueryPrefix,
  plansQueryKey,
  schedulingPreferencesQueryKey,
  tasksQueryKey,
} from '@/lib/query'

describe('query keys', () => {
  it('keeps the existing cache identity for every shared key', () => {
    expect(currentUserQueryKey).toEqual(['auth', 'me'])
    expect(commitmentsQueryPrefix).toEqual(['commitments'])
    expect(commitmentsQueryKey('2026-11-06')).toEqual([
      'commitments',
      '2026-11-06',
    ])
    expect(horizonQueryPrefix).toEqual(['horizon'])
    expect(horizonQueryKey('2026-11-06', '09:00:00')).toEqual([
      'horizon',
      '2026-11-06',
      '09:00:00',
    ])
    expect(plansByDateQueryPrefix).toEqual(['plans', 'by-date'])
    expect(plansListQueryPrefix).toEqual(['plans', 'list'])
    expect(plansDetailQueryPrefix).toEqual(['plans', 'detail'])
    expect(planByDateQueryKey('2026-11-06')).toEqual([
      'plans',
      'by-date',
      '2026-11-06',
    ])
    expect(plansQueryKey(1, 20)).toEqual(['plans', 'list', 1, 20])
    expect(planDetailQueryKey(7)).toEqual(['plans', 'detail', 7])
    expect(schedulingPreferencesQueryKey).toEqual(['scheduling-preferences'])
    expect(tasksQueryKey).toEqual(['tasks', 'list'])
  })
})

describe('invalidatePlanQueries', () => {
  it('invalidates the by-date plan, plan list, plan detail, tasks, and horizon', async () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await invalidatePlanQueries(queryClient, {
      id: 7,
      planDate: '2026-11-06',
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: planByDateQueryKey('2026-11-06'),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: plansListQueryPrefix })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: planDetailQueryKey(7),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tasksQueryKey })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: horizonQueryPrefix })
  })
})
