import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createCommitment,
  deleteCommitment,
  listCommitments,
  updateCommitment,
} from '@/features/commitments/api'
import type { CommitmentResponse } from '@/types/api'

describe('commitments api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists commitments for an inclusive date range', async () => {
    const commitments: CommitmentResponse[] = [
      {
        id: 1,
        title: 'Standup',
        commitmentDate: '2026-06-16',
        startTime: '09:00:00',
        endTime: '09:30:00',
      },
    ]
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(commitments), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listCommitments('2026-06-16', '2026-06-16')).resolves.toEqual(
      commitments,
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/api\/commitments\?from=2026-06-16&to=2026-06-16/,
      ),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('creates a commitment', async () => {
    const created: CommitmentResponse = {
      id: 2,
      title: 'Lunch',
      commitmentDate: '2026-06-16',
      startTime: '12:00:00',
      endTime: '13:00:00',
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(created), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createCommitment({
        title: 'Lunch',
        commitmentDate: '2026-06-16',
        startTime: '12:00:00',
        endTime: '13:00:00',
      }),
    ).resolves.toEqual(created)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/commitments'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Lunch',
          commitmentDate: '2026-06-16',
          startTime: '12:00:00',
          endTime: '13:00:00',
        }),
      }),
    )
  })

  it('updates a commitment', async () => {
    const updated: CommitmentResponse = {
      id: 3,
      title: 'Moved meeting',
      commitmentDate: '2026-06-17',
      startTime: '14:00:00',
      endTime: '15:00:00',
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      updateCommitment(3, {
        title: 'Moved meeting',
        commitmentDate: '2026-06-17',
        startTime: '14:00:00',
        endTime: '15:00:00',
      }),
    ).resolves.toEqual(updated)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/commitments/3'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          title: 'Moved meeting',
          commitmentDate: '2026-06-17',
          startTime: '14:00:00',
          endTime: '15:00:00',
        }),
      }),
    )
  })

  it('deletes a commitment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteCommitment(4)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/commitments/4'),
      expect.objectContaining({
        method: 'DELETE',
      }),
    )
  })
})
