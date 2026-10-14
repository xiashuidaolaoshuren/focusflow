import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import { getHorizon } from '@/features/horizon/api'
import { getLocalDateString, getLocalTimeString } from '@/lib/planningDate'

export const horizonQueryPrefix = ['horizon'] as const

export function horizonQueryKey(currentDate: string, currentTime: string) {
  return [...horizonQueryPrefix, currentDate, currentTime] as const
}

export function minuteAlignedTimeString(date = new Date()): string {
  return getLocalTimeString(date).slice(0, 5)
}

export function useHorizonClock() {
  const [now, setNow] = useState(() => new Date())

  const tick = useCallback(() => {
    setNow(new Date())
  }, [])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [tick])

  useEffect(() => {
    function scheduleInterval() {
      if (document.visibilityState !== 'visible') {
        return undefined
      }
      return window.setInterval(tick, 60_000)
    }

    let intervalId = scheduleInterval()

    function handleVisibilityChange() {
      if (intervalId != null) {
        window.clearInterval(intervalId)
        intervalId = undefined
      }
      intervalId = scheduleInterval()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      if (intervalId != null) {
        window.clearInterval(intervalId)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [tick])

  return {
    currentDate: getLocalDateString(now),
    currentTime: minuteAlignedTimeString(now),
    now,
  }
}

export function useHorizon() {
  const { currentDate, currentTime } = useHorizonClock()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: horizonQueryKey(currentDate, currentTime),
    queryFn: () => getHorizon(currentDate, currentTime),
  })

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void queryClient.invalidateQueries({ queryKey: horizonQueryPrefix })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [queryClient])

  return {
    ...query,
    horizon: query.data ?? null,
    currentDate,
    currentTime,
  }
}
