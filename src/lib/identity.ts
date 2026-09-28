'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { Session } from './types'

const PROFILE_KEY = 'guess.profile'
const SESSION_PREFIX = 'guess.session.'

export interface Profile {
  name: string
  avatar: string
}

function readProfile(): Profile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Profile>
    if (typeof parsed.name !== 'string') return null
    return { name: parsed.name, avatar: parsed.avatar ?? '🐶' }
  } catch {
    return null
  }
}

const profileCache = { raw: null as string | null, value: null as Profile | null }

const subscribeNothing = () => () => {}

export function useStoredProfile(): Profile | null {
  const getSnapshot = useCallback(() => {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(PROFILE_KEY)
    if (raw !== profileCache.raw) {
      profileCache.raw = raw
      profileCache.value = readProfile()
    }
    return profileCache.value
  }, [])

  return useSyncExternalStore(subscribeNothing, getSnapshot, () => null)
}

export function saveProfile(profile: Profile): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

const sessionKey = (code: string) => `${SESSION_PREFIX}${code}`

export function loadSession(code: string): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(sessionKey(code))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    if (typeof parsed.playerId !== 'string') return null
    return { roomCode: code, playerId: parsed.playerId }
  } catch {
    return null
  }
}

export function saveSession(session: Session): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(sessionKey(session.roomCode), JSON.stringify({ playerId: session.playerId }))
}

export function clearSession(code: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(sessionKey(code))
}
