'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { AVATARS } from './types'

const subscribeNothing = () => () => {}

export function useSearchParam(key: string): string {
  // Strings compare by value, so the snapshot is stable without a cache.
  const getSnapshot = useCallback(() => {
    const search = typeof window === 'undefined' ? '' : window.location.search
    return new URLSearchParams(search).get(key) ?? ''
  }, [key])

  return useSyncExternalStore(subscribeNothing, getSnapshot, () => '')
}

const avatarCache = { picked: null as string | null }

export function useStartingAvatar(): string {
  const getSnapshot = useCallback(() => {
    avatarCache.picked ??= AVATARS[Math.floor(Math.random() * AVATARS.length)]
    return avatarCache.picked
  }, [])

  return useSyncExternalStore(subscribeNothing, getSnapshot, () => AVATARS[0])
}
