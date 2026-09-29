import { randomInt, randomUUID } from 'node:crypto'
import { AVATARS, MAX_NUMBER, MAX_PLAYERS, MIN_NUMBER, type Player, type Room, type RoomView } from './types'
import { normalizeDisplayName, normalizeRoomName } from './room-name'

export function createRoom(code: string, password: string, min = MIN_NUMBER, max = MAX_NUMBER): Room {
  const now = Date.now()
  return {
    code,
    password,
    hostId: '',
    phase: 'lobby',
    order: [],
    turnIndex: 0,
    players: new Map(),
    min,
    max,
    createdAt: now,
    lastActivityAt: now,
    lastSolved: null,
  }
}

export function addPlayer(
  room: Room,
  input: { name: string; avatar: string; id?: string },
): { ok: true; player: Player } | { ok: false; error: string } {
  if (room.players.size >= MAX_PLAYERS) {
    return { ok: false, error: `This room is full (${MAX_PLAYERS} players max).` }
  }
  const name = normalizeDisplayName(input.name)
  if (!name) return { ok: false, error: 'Pick a name first.' }
  if ([...room.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `"${name}" is already taken in this room.` }
  }
  const now = Date.now()
  const player: Player = {
    id: input.id ?? randomUUID(),
    token: randomUUID(),
    name,
    avatar: isAvatar(input.avatar) ? input.avatar : AVATARS[0],
    number: room.phase === 'playing' ? randomInt(room.min, room.max + 1) : null,
    solved: false,
    guesses: 0,
    wrongGuesses: [],
    connected: true,
    socketId: null,
    joinedAt: now,
    lastSeenAt: now,
  }
  room.players.set(player.id, player)
  room.order.push(player.id)
  if (!room.hostId) room.hostId = player.id
  room.lastActivityAt = now
  return { ok: true, player }
}

function isAvatar(value: unknown): value is string {
  return AVATARS.includes(value as (typeof AVATARS)[number])
}

export function findPlayerByToken(room: Room, token: unknown): Player | null {
  if (typeof token !== 'string' || !token) return null
  for (const player of room.players.values()) {
    if (player.token === token) return player
  }
  return null
}

export function removePlayer(room: Room, playerId: string): void {
  const seat = room.order.indexOf(playerId)
  room.players.delete(playerId)
  room.order = room.order.filter((id) => id !== playerId)
  // Removing a seat before the cursor shifts everyone after it left by one.
  // Follow them, or the current asker loses their turn to the next player.
  if (seat !== -1 && seat < room.turnIndex) room.turnIndex -= 1
  if (room.turnIndex >= room.order.length) room.turnIndex = 0
  if (room.hostId === playerId) room.hostId = nextHostId(room)
  if (room.players.size === 0) return
  if (room.phase === 'playing' && getTurnId(room) === null) advanceTurn(room)
  room.lastActivityAt = Date.now()
}

// First connected player in turn order, falling back to the first seat.
function nextHostId(room: Room): string {
  const connected = room.order.find((id) => room.players.get(id)?.connected)
  return connected ?? room.order[0] ?? ''
}

// A host who drops (rather than leaves) keeps the role for a grace period so a
// flaky phone doesn't cost them the room. After that, hand it to someone who
// is actually here, or nobody could deal, redeal or kick.
// Nobody has been connected for a while: a tab closed before the game got going,
// or everyone went home. Such a room can be taken over by a new create. The
// grace period covers a whole table briefly dropping off wifi at once.
export function isAbandoned(room: Room, graceMs: number, now = Date.now()): boolean {
  for (const player of room.players.values()) {
    if (player.connected) return false
  }
  return now - room.lastActivityAt >= graceMs
}

export function migrateHostIfAway(room: Room, graceMs: number, now = Date.now()): boolean {
  const host = room.players.get(room.hostId)
  if (host?.connected) return false
  if (host && now - host.lastSeenAt < graceMs) return false
  const next = room.order.find((id) => id !== room.hostId && room.players.get(id)?.connected)
  if (!next) return false
  room.hostId = next
  room.lastActivityAt = now
  return true
}

export function startGame(room: Room): { ok: true } | { ok: false; error: string } {
  if (room.players.size < 2) return { ok: false, error: 'You need at least 2 players.' }
  for (const player of room.players.values()) {
    player.number = randomInt(room.min, room.max + 1)
    player.solved = false
    player.guesses = 0
    player.wrongGuesses = []
  }
  room.phase = 'playing'
  room.turnIndex = 0
  room.lastSolved = null
  room.lastActivityAt = Date.now()
  return { ok: true }
}

export function endGame(room: Room): void {
  room.phase = 'finished'
  room.lastActivityAt = Date.now()
}

export function isGameOver(room: Room): boolean {
  return room.phase === 'finished'
}

export function getTurnId(room: Room): string | null {
  if (room.phase !== 'playing') return null
  const id = room.order[room.turnIndex]
  const player = id ? room.players.get(id) : undefined
  if (!player || player.solved) return null
  return player.id
}

export function advanceTurn(room: Room): void {
  const size = room.order.length
  if (size === 0) {
    room.phase = 'finished'
    return
  }
  for (let step = 1; step <= size; step++) {
    const index = (room.turnIndex + step) % size
    const player = room.players.get(room.order[index])
    if (player && !player.solved) {
      room.turnIndex = index
      return
    }
  }
  room.turnIndex = 0
  room.phase = 'finished'
}

export type GuessOutcome =
  | { ok: true; correct: boolean; correctNumber: number | null }
  | { ok: false; error: string }

export function submitGuess(room: Room, playerId: string, value: number): GuessOutcome {
  const player = room.players.get(playerId)
  if (!player) return { ok: false, error: 'You are not in this room.' }
  if (room.phase !== 'playing') return { ok: false, error: 'The game is not running.' }
  if (player.solved) return { ok: false, error: 'You already got it.' }
  if (getTurnId(room) !== playerId) return { ok: false, error: "It is not your turn." }
  if (!Number.isInteger(value) || value < room.min || value > room.max) {
    return { ok: false, error: `Pick a whole number between ${room.min} and ${room.max}.` }
  }

  player.guesses += 1
  room.lastActivityAt = Date.now()

  if (value === player.number) {
    player.solved = true
    room.lastSolved = { playerId, number: player.number as number, at: Date.now() }
    advanceTurn(room)
    return { ok: true, correct: true, correctNumber: player.number }
  }
  player.wrongGuesses.push(value)
  advanceTurn(room)
  return { ok: true, correct: false, correctNumber: null }
}

export function toRoomView(room: Room, viewerId: string): RoomView {
  const turnId = getTurnId(room)
  const revealEverything = room.phase === 'finished'

  const players = room.order
    .map((id) => room.players.get(id))
    .filter((p): p is Player => Boolean(p))
    .map((player) => {
      const hideNumber = !revealEverything && player.id === viewerId && !player.solved
      return {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        number: hideNumber ? null : player.number,
        solved: player.solved,
        guesses: player.guesses,
        connected: player.connected,
        isHost: player.id === room.hostId,
        isTurn: player.id === turnId,
        isYou: player.id === viewerId,
      }
    })

  return {
    code: room.code,
    phase: room.phase,
    min: room.min,
    max: room.max,
    // Only the viewer's own wrong guesses, never anyone else's.
    you: {
      id: viewerId,
      isHost: room.hostId === viewerId,
      wrongGuesses: [...(room.players.get(viewerId)?.wrongGuesses ?? [])],
    },
    turnId,
    players,
    solvedCount: players.filter((p) => p.solved).length,
    total: players.length,
    lastSolved: room.lastSolved,
  }
}
