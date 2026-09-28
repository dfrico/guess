import type { Server, Socket } from 'socket.io'
import {
  addPlayer,
  advanceTurn,
  endGame,
  isGameOver,
  removePlayer,
  startGame,
  submitGuess,
  toRoomView,
} from '@/lib/game'
import {
  gameDuration,
  reconnects,
  roomsCreated,
  roomsEnded,
  socketErrors,
  socketEvents,
} from '@/lib/metrics'
import { normalizeRoomName } from '@/lib/room-name'
import { getRoomStore } from '@/lib/room-store'
import type { CreateRoomPayload, JoinRoomPayload, Room } from '@/lib/types'

type GameSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, {
  roomCode: string | null
  playerId: string | null
}>

type AckResult = { ok: true; [key: string]: unknown } | { ok: false; error: string }
type Ack = (result: AckResult) => void

const STATE = 'room:state'

function noop(): void {}

function safeAck(ack: unknown): Ack {
  return typeof ack === 'function' ? (ack as Ack) : noop
}

type AckHandler<P> = (payload: P, ack: Ack) => Promise<void>

function onAck<P = Record<string, unknown>>(
  socket: GameSocket,
  event: string,
  handler: AckHandler<P>,
): void {
  socket.on(event, (payload: P, rawAck: unknown) => {
    const reply = safeAck(rawAck)
    let settled = false

    // Wrapping the ack means every handler is counted the same way, whether it
    // returns early or falls through to the end.
    const ack: Ack = (result) => {
      if (settled) return
      settled = true
      socketEvents.increment({ event, result: result.ok ? 'ok' : 'rejected' })
      reply(result)
    }

    void handler(payload, ack).catch((error: unknown) => {
      socketErrors.increment({ event })
      console.error(`[socket] ${event} failed:`, error)
      ack({ ok: false, error: 'Something went wrong handling that.' })
    })
  })
}

const firstGuessAt = new WeakMap<Room, number>()
const countedAsEnded = new WeakSet<Room>()

function markFirstGuess(room: Room): void {
  if (room.phase !== 'playing' || firstGuessAt.has(room)) return
  firstGuessAt.set(room, Date.now())
}

function trackGameEnd(room: Room, reason: 'played_to_end' | 'host_ended'): void {
  if (!isGameOver(room) || countedAsEnded.has(room)) return
  countedAsEnded.add(room)
  roomsEnded.increment({ reason })
  const started = firstGuessAt.get(room)
  if (started !== undefined) gameDuration.observe((Date.now() - started) / 1000)
}

function sendState(io: Server, room: Room, playerId: string): void {
  const socketId = room.players.get(playerId)?.socketId
  if (!socketId) return
  io.to(socketId).emit(STATE, toRoomView(room, playerId))
}

function broadcast(io: Server, room: Room): void {
  for (const id of room.order) {
    const player = room.players.get(id)
    if (!player?.socketId) continue
    io.to(player.socketId).emit(STATE, toRoomView(room, player.id))
  }
}

export function registerSocketHandlers(io: Server): void {
  const store = getRoomStore()

  const leave = async (socket: GameSocket, remove: boolean) => {
    const { roomCode, playerId } = socket.data
    socket.data.roomCode = null
    socket.data.playerId = null
    if (!roomCode || !playerId) return
    await socket.leave(`room:${roomCode}`)

    const room = await store.get(roomCode)
    if (!room) return

    if (remove) {
      removePlayer(room, playerId)
    } else {
      const player = room.players.get(playerId)
      if (!player) return
      player.connected = false
      player.socketId = null
      room.lastActivityAt = Date.now()
    }

    if (room.players.size === 0) {
      await store.delete(room.code)
      return
    }
    await store.save(room)
    broadcast(io, room)
  }

  const current = async (socket: GameSocket) => {
    const { roomCode, playerId } = socket.data
    if (!roomCode || !playerId) return null
    const room = await store.get(roomCode)
    if (!room || !room.players.has(playerId)) return null
    return { room, playerId }
  }

  io.on('connection', (socket) => {
    socket.data.roomCode = null
    socket.data.playerId = null

    onAck<CreateRoomPayload>(socket, 'room:create', async (payload, ack) => {
      const code = normalizeRoomName(payload?.roomName ?? '')
      if (code.length < 2) {
        return ack({ ok: false, error: 'Room name needs at least 2 characters.' })
      }
      if (!payload?.password?.trim()) return ack({ ok: false, error: 'Set a room password.' })

      if ((await store.get(code))?.players.size) {
        return ack({ ok: false, error: `"${code}" is already in use. Try another name.` })
      }
      await store.delete(code)

      const room = await store.create(code, payload.password.trim())
      const result = addPlayer(room, { name: payload.name, avatar: payload.avatar })
      if (!result.ok) return ack({ ok: false, error: result.error })
      roomsCreated.increment()

      result.player.socketId = socket.id
      socket.data.roomCode = code
      socket.data.playerId = result.player.id
      await socket.join(`room:${code}`)

      sendState(io, room, result.player.id)
      ack({ ok: true, code, playerId: result.player.id })
    })

    onAck<JoinRoomPayload>(socket, 'room:join', async (payload, ack) => {
      const code = normalizeRoomName(payload?.roomName ?? '')
      const room = await store.get(code)
      if (!room) return ack({ ok: false, error: `No room called "${code}".` })
      if (room.password !== payload?.password) return ack({ ok: false, error: 'Wrong password.' })

      const result = addPlayer(room, { name: payload.name, avatar: payload.avatar })
      if (!result.ok) return ack({ ok: false, error: result.error })

      result.player.socketId = socket.id
      socket.data.roomCode = code
      socket.data.playerId = result.player.id
      await socket.join(`room:${code}`)
      await store.save(room)

      broadcast(io, room)
      ack({ ok: true, code, playerId: result.player.id })
    })

    onAck<{ code: string; playerId: string }>(socket, 'room:resume', async (payload, ack) => {
      const room = await store.get(normalizeRoomName(payload?.code ?? ''))
      const player = room?.players.get(payload?.playerId ?? '')
      if (!room || !player) {
        reconnects.increment({ result: 'expired' })
        return ack({ ok: false, error: 'Session expired. Join the room again.' })
      }
      reconnects.increment({ result: 'resumed' })

      player.connected = true
      player.socketId = socket.id
      player.lastSeenAt = Date.now()
      room.lastActivityAt = Date.now()
      socket.data.roomCode = room.code
      socket.data.playerId = player.id
      await socket.join(`room:${room.code}`)

      broadcast(io, room)
      ack({ ok: true, code: room.code, playerId: player.id })
    })

    onAck(socket, 'room:start', async (_payload, ack) => {
      const ctx = await current(socket)
      if (!ctx) return ack({ ok: false, error: 'You are not in a room.' })
      if (ctx.room.hostId !== ctx.playerId) return ack({ ok: false, error: 'Only the host can start.' })

      const result = startGame(ctx.room)
      if (!result.ok) return ack({ ok: false, error: result.error })

      await store.save(ctx.room)
      broadcast(io, ctx.room)
      ack({ ok: true })
    })

    onAck<{ value: number }>(socket, 'room:guess', async (payload, ack) => {
      const ctx = await current(socket)
      if (!ctx) return ack({ ok: false, error: 'You are not in a room.' })

      const raw = Math.trunc(Number(payload?.value))
      const outcome = submitGuess(ctx.room, ctx.playerId, raw)
      if (!outcome.ok) return ack({ ok: false, error: outcome.error })

      markFirstGuess(ctx.room)
      trackGameEnd(ctx.room, 'played_to_end')

      await store.save(ctx.room)
      broadcast(io, ctx.room)
      ack(outcome)
    })

    onAck(socket, 'room:pass', async (_payload, ack) => {
      const ctx = await current(socket)
      if (!ctx) return ack({ ok: false, error: 'You are not in a room.' })
      if (ctx.room.phase !== 'playing') return ack({ ok: false, error: 'The game is not running.' })
      if (ctx.room.order[ctx.room.turnIndex] !== ctx.playerId) {
        return ack({ ok: false, error: 'It is not your turn.' })
      }

      advanceTurn(ctx.room)
      await store.save(ctx.room)
      broadcast(io, ctx.room)
      ack({ ok: true })
    })

    onAck(socket, 'room:end', async (_payload, ack) => {
      const ctx = await current(socket)
      if (!ctx) return ack({ ok: false, error: 'You are not in a room.' })
      if (ctx.room.hostId !== ctx.playerId) return ack({ ok: false, error: 'Only the host can do that.' })

      endGame(ctx.room)
      trackGameEnd(ctx.room, 'host_ended')
      await store.save(ctx.room)
      broadcast(io, ctx.room)
      ack({ ok: true })
    })

    onAck<{ playerId: string }>(socket, 'room:kick', async (payload, ack) => {
      const ctx = await current(socket)
      if (!ctx) return ack({ ok: false, error: 'You are not in a room.' })
      if (ctx.room.hostId !== ctx.playerId) return ack({ ok: false, error: 'Only the host can do that.' })
      if (payload?.playerId === ctx.playerId) return ack({ ok: false, error: 'You cannot kick yourself.' })

      const target = ctx.room.players.get(payload?.playerId ?? '')
      if (!target) return ack({ ok: false, error: 'That player already left.' })

      if (target.socketId) {
        io.in(target.socketId).emit('room:kicked')
        io.in(target.socketId).socketsLeave(`room:${ctx.room.code}`)
      }

      removePlayer(ctx.room, target.id)
      if (ctx.room.players.size === 0) await store.delete(ctx.room.code)
      else {
        await store.save(ctx.room)
        broadcast(io, ctx.room)
      }
      ack({ ok: true })
    })

    onAck(socket, 'room:leave', async (_payload, ack) => {
      await leave(socket, true)
      ack({ ok: true })
    })

    socket.on('disconnect', () => {
      void leave(socket, false)
    })
  })
}
