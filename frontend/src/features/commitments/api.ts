import { apiRequest } from '@/lib/api'
import type { CommitmentRequest, CommitmentResponse } from '@/types/api'

export async function listCommitments(
  from: string,
  to: string,
): Promise<CommitmentResponse[]> {
  const params = new URLSearchParams({ from, to })
  return apiRequest<CommitmentResponse[]>(`/api/commitments?${params}`)
}

export async function createCommitment(
  request: CommitmentRequest,
): Promise<CommitmentResponse> {
  return apiRequest<CommitmentResponse>('/api/commitments', {
    method: 'POST',
    body: request,
  })
}

export async function updateCommitment(
  id: number,
  request: CommitmentRequest,
): Promise<CommitmentResponse> {
  return apiRequest<CommitmentResponse>(`/api/commitments/${id}`, {
    method: 'PUT',
    body: request,
  })
}

export async function deleteCommitment(id: number): Promise<void> {
  return apiRequest<void>(`/api/commitments/${id}`, {
    method: 'DELETE',
  })
}
