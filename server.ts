import { createServer } from 'node:http'
import next from 'next'
import { Server } from 'socket.io'
import { registerSocketHandlers } from './src/server/socket'
import { startMetricsServer } from './src/server/metrics-server'
import { startSweeper, getRoomStore } from './src/lib/room-store'
import { lanAddresses } from './src/lib/network'

const dev = process.env.NODE_ENV !== 'production'
const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'
const metricsPort = Number(process.env.METRICS_PORT ?? 9464)

async function main() {
  const app = next({ dev })
  const handle = app.getRequestHandler()

  await app.prepare()

  const httpServer = createServer((req, res) => handle(req, res))

  httpServer.on('upgrade', app.getUpgradeHandler())

  const io = new Server(httpServer, {
    path: '/socket.io',
    serveClient: false,
  })

  registerSocketHandlers(io)
  startSweeper(getRoomStore())
  startMetricsServer(io, metricsPort)

  httpServer.listen(port, host, () => {
    console.log(`\n  guess is running\n`)
    console.log(`    local   http://localhost:${port}`)
    for (const address of lanAddresses()) {
      console.log(`    network http://${address}:${port}   <- share this one`)
    }
    console.log(`    metrics http://127.0.0.1:${metricsPort}/metrics  (loopback only)`)
    console.log('')
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      io.close()
      httpServer.close(() => process.exit(0))
    })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
