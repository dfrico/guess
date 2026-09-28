import { createServer, type Server as HttpServer } from 'node:http'
import type { Server } from 'socket.io'
import { getRoomStore } from '../lib/room-store'
import {
  gameDuration,
  playersConnected,
  playersInRooms,
  reconnects,
  register,
  render,
  roomsActive,
  roomsCreated,
  roomsEnded,
  roomsSwept,
  setGaugeSource,
  socketErrors,
  socketEvents,
} from '../lib/metrics'

const DEFAULT_PORT = 9464

export function startMetricsServer(io: Server, port = DEFAULT_PORT): HttpServer {
  const store = getRoomStore()

  register(
    roomsActive,
    playersConnected,
    playersInRooms,
    roomsCreated,
    roomsEnded,
    roomsSwept,
    reconnects,
    socketEvents,
    socketErrors,
    gameDuration,
  )
  setGaugeSource(roomsActive, () => store.countSync().rooms)
  setGaugeSource(playersConnected, () => io.engine.clientsCount)
  setGaugeSource(playersInRooms, () => store.countSync().players)

  const server = createServer((req, res) => {
    if (req.url !== '/metrics' || req.method !== 'GET') {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('not found\n')
      return
    }
    let body: string
    try {
      body = render()
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain' })
      res.end(`metrics failed: ${String(error)}\n`)
      return
    }
    res.writeHead(200, {
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(body)
  })

  server.listen(port, '127.0.0.1')
  server.unref()
  return server
}
