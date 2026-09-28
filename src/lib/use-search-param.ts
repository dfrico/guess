'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { AVATARS } from './types'

const searchCache = { key: null as string | null, value: '' }
const subscribeNothing = () => () => {}

export function useSearchParam(key: string): string {
  const getSnapshot = useCallback(() => {
    const search = typeof window === 'undefined' ? '' : window.location.search
    if (search !== searchCache.key) {
      searchCache.key = search
      searchCache.value = new URLSearchParams(search).get(key) ?? ''
    }
    return searchCache.value
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
