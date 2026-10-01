import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  DailyPlanResponse,
  DailyPlanSummaryResponse,
  PageResponse,
} from '@/types/api'

import { ApiError } from '@/lib/api'
import {
  deletePlan,
  generateDailyPlan,
  getPlanByDate,
  getPlanById,
  listPlans,
} from '@/features/plans/api'
import { samplePlan, samplePlanSummary } from '@/features/plans/planFixtures'

describe('plan summary types', () => {
  it('supports PageResponse<DailyPlanSummaryResponse> for listPlans', () => {
    const envelope: PageResponse<DailyPlanSummaryResponse> = {
      content: [samplePlanSummary],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    }

    expect(envelope.content[0]?.scheduledWorkMinutes).toBe(120)
  })
})

describe('generateDailyPlan', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('generates a plan on success (201)', async () => {
    const generated: DailyPlanResponse = samplePlan
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(generated), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateDailyPlan({ planDate: '2026-06-15' })).resolves.toEqual(
      generated,
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/daily-plans/generate'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          planDate: '2026-06-15',
        }),
      }),
    )
  })

  it('includes replacePlanId when replacing an existing plan', async () => {
    const generated: DailyPlanResponse = {
      ...samplePlan,
      id: 2,
      planDate: '2026-06-16',
      createdAt: '2026-06-16T09:00:00Z',
      blocks: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(generated), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      generateDailyPlan({
        planDate: '2026-06-16',
        replacePlanId: 7,
      }),
    ).resolves.toEqual(generated)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/daily-plans/generate'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          planDate: '2026-06-16',
          replacePlanId: 7,
        }),
      }),
    )
  })
})

describe('getPlanByDate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns the plan for the requested date when one exists', async () => {
    const plan: DailyPlanResponse = {
      ...samplePlan,
      planDate: '2026-06-16',
      createdAt: '2026-06-16T09:00:00Z',
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(plan), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getPlanByDate('2026-06-16')).resolves.toEqual(plan)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/api\/daily-plans\/by-date\?planDate=2026-06-16/,
      ),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('returns null when no plan exists for the requested date', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 204,
        }),
      ),
    )

    await expect(getPlanByDate('2026-06-16')).resolves.toBeNull()
  })
})

describe('listPlans', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a paged envelope from GET /api/daily-plans', async () => {
    const envelope: PageResponse<DailyPlanSummaryResponse> = {
      content: [
        samplePlanSummary,
        {
          ...samplePlanSummary,
          id: 2,
          planDate: '2026-06-15',
          createdAt: '2026-06-15T09:00:00Z',
          scheduledWorkMinutes: 0,
          workSessionCount: 0,
          scheduledTaskCount: 0,
          unplacedWorkCount: 0,
          hasWarning: false,
        },
      ],
      page: 1,
      size: 20,
      totalElements: 42,
      totalPages: 3,
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(envelope), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listPlans(1, 20)).resolves.toEqual(envelope)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/daily-plans\?page=1&size=20/),
      expect.objectContaining({ credentials: 'include' }),
    )
  })
})

describe('getPlanById', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a plan from GET /api/daily-plans/{id}', async () => {
    const plan: DailyPlanResponse = {
      ...samplePlan,
      id: 42,
      planDate: '2026-06-14',
      createdAt: '2026-06-14T09:00:00Z',
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(plan), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getPlanById(42)).resolves.toEqual(plan)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/daily-plans/42'),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('rethrows ApiError with status 404 when plan is not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 404,
            message: 'Plan not found',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    )

    await expect(getPlanById(999)).rejects.toMatchObject({
      status: 404,
      message: 'Plan not found',
    })
    await expect(getPlanById(999)).rejects.toBeInstanceOf(ApiError)
  })
})

describe('deletePlan', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deletes a plan on success (204)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(deletePlan(1)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/daily-plans/1'),
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
      }),
    )
  })

  it('rethrows ApiError with status 404 when plan is not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 404,
            message: 'daily plan not found',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    )

    await expect(deletePlan(999)).rejects.toMatchObject({
      status: 404,
      message: 'daily plan not found',
    })
    await expect(deletePlan(999)).rejects.toBeInstanceOf(ApiError)
  })
})
