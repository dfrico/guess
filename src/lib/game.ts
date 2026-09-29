import { randomInt, randomUUID } from 'node:crypto'
import { MAX_NUMBER, MAX_PLAYERS, MIN_NUMBER, type Player, type Room, type RoomView } from './types'
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
    avatar: input.avatar,
    number: room.phase === 'playing' ? randomInt(room.min, room.max + 1) : null,
    solved: false,
    guesses: 0,
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

export function findPlayerByToken(room: Room, token: unknown): Player | null {
  if (typeof token !== 'string' || !token) return null
  for (const player of room.players.values()) {
    if (player.token === token) return player
  }
  return null
}

export function removePlayer(room: Room, playerId: string): void {
  room.players.delete(playerId)
  room.order = room.order.filter((id) => id !== playerId)
  if (room.turnIndex >= room.order.length) room.turnIndex = 0
  if (room.hostId === playerId) room.hostId = room.order[0] ?? ''
  if (room.players.size === 0) return
  if (room.phase === 'playing' && getTurnId(room) === null) advanceTurn(room)
  room.lastActivityAt = Date.now()
}

export function startGame(room: Room): { ok: true } | { ok: false; error: string } {
  if (room.players.size < 1) return { ok: false, error: 'Nobody is in the room yet.' }
  for (const player of room.players.values()) {
    player.number = randomInt(room.min, room.max + 1)
    player.solved = false
    player.guesses = 0
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
    you: { id: viewerId, isHost: room.hostId === viewerId },
    turnId,
    players,
    solvedCount: players.filter((p) => p.solved).length,
    total: players.length,
    lastSolved: room.lastSolved,
  }
}
