export type Phase = 'lobby' | 'playing' | 'finished'

export interface Player {
  id: string
  // Secret used by room:resume. Unlike id it is never sent to other players.
  token: string
  name: string
  avatar: string
  number: number | null
  solved: boolean
  guesses: number
  // Private: only ever sent to this player, in RoomView.you.
  wrongGuesses: number[]
  connected: boolean
  socketId: string | null
  joinedAt: number
  lastSeenAt: number
}

export interface Room {
  code: string
  password: string
  hostId: string
  phase: Phase
  order: string[]
  turnIndex: number
  players: Map<string, Player>
  min: number
  max: number
  createdAt: number
  lastActivityAt: number
  lastSolved: { playerId: string; number: number; at: number } | null
}

export interface PlayerView {
  id: string
  name: string
  avatar: string
  number: number | null
  solved: boolean
  guesses: number
  connected: boolean
  isHost: boolean
  isTurn: boolean
  isYou: boolean
}

export interface RoomView {
  code: string
  phase: Phase
  min: number
  max: number
  you: { id: string; isHost: boolean; wrongGuesses: number[] }
  turnId: string | null
  players: PlayerView[]
  solvedCount: number
  total: number
  lastSolved: { playerId: string; number: number; at: number } | null
}

export interface Session {
  roomCode: string
  token: string
}

export type Ack<T> = (result: { ok: true } & T) => void
export type AckError = (result: { ok: false; error: string }) => void

export interface CreateRoomPayload {
  roomName: string
  password: string
  name: string
  avatar: string
}

export interface JoinRoomPayload extends CreateRoomPayload {}

export interface GuessResult {
  correct: boolean
  correctNumber: number | null
}

export const AVATARS = [
  '🐶', '🐱', '🦊', '🐻', '🐼', '🐸', '🐵', '🦉',
  '🐙', '🦄', '🐝', '🦋', '🐢', '🦀', '🐳', '🌵',
  '🍕', '🌮', '🍩', '🍦', '🎸', '🎧', '🚀', '🌈',
  '👻', '🤖', '👽', '🦖', '🐧', '🧠', '⚡', '🪩',
] as const

export const MAX_PLAYERS = 16
export const MIN_NUMBER = 1
export const MAX_NUMBER = 100
