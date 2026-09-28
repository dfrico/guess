import { createRoom } from './game'
import type { Room } from './types'

export interface RoomStore {
  get(code: string): Promise<Room | null>
  create(code: string, password: string): Promise<Room>
  save(room: Room): Promise<void>
  delete(code: string): Promise<void>
  sweep(maxIdleMs: number): Promise<void>
  count(): Promise<number>
}

export class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>()

  async get(code: string): Promise<Room | null> {
    return this.rooms.get(code) ?? null
  }

  async create(code: string, password: string): Promise<Room> {
    const room = createRoom(code, password)
    this.rooms.set(code, room)
    return room
  }

  async save(room: Room): Promise<void> {
    this.rooms.set(room.code, room)
  }

  async delete(code: string): Promise<void> {
    this.rooms.delete(code)
  }

  async sweep(maxIdleMs: number): Promise<void> {
    const cutoff = Date.now() - maxIdleMs
    for (const [code, room] of this.rooms) {
      if (room.lastActivityAt < cutoff) this.rooms.delete(code)
    }
  }

  async count(): Promise<number> {
    return this.rooms.size
  }
}

const STORE_KEY = Symbol.for('guess.roomStore')

const globalScope = globalThis as typeof globalThis & { [STORE_KEY]?: RoomStore }

export function getRoomStore(): RoomStore {
  if (!globalScope[STORE_KEY]) {
    globalScope[STORE_KEY] = new InMemoryRoomStore()
  }
  return globalScope[STORE_KEY]
}

const SWEEP_EVERY_MS = 60_000
const IDLE_TTL_MS = 6 * 60 * 60 * 1000

export function startSweeper(store: RoomStore): NodeJS.Timeout {
  const timer = setInterval(() => {
    void store.sweep(IDLE_TTL_MS)
  }, SWEEP_EVERY_MS)
  timer.unref()
  return timer
}

export const ROOM_IDLE_TTL_MS = IDLE_TTL_MS
