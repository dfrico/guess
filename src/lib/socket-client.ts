'use client'

import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })
  }
  return socket
}

export function emitWithAck<T = Record<string, unknown>>(
  event: string,
  payload?: unknown,
): Promise<({ ok: true } & T) | { ok: false; error: string }> {
  return new Promise((resolve) => {
    getSocket()
      .timeout(10_000)
      .emit(event, payload ?? {}, (timeout: unknown, response: { ok: true } & T | { ok: false; error: string }) => {
        if (timeout) resolve({ ok: false, error: 'The server is not responding.' })
        else resolve(response ?? { ok: false, error: 'No response from the server.' })
      })
  })
}
