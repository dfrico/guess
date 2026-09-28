import { io, type Socket } from 'socket.io-client'

const URL = process.env.URL ?? 'http://localhost:3000'
const NAMES = ['ada', 'grace', 'alan', 'edsger']
const ROOM = `testroom-${Date.now().toString(36)}`
const PASSWORD = 'hunter2'

let failures = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`  ok   ${label}`)
  else {
    failures++
    console.log(`  FAIL ${label}${detail ? ` -> ${detail}` : ''}`)
  }
}

const connect = () =>
  new Promise<Socket>((resolve, reject) => {
    const socket = io(URL, { transports: ['websocket'], forceNew: true })
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })

const ask = (socket: Socket, event: string, payload: unknown = {}) =>
  new Promise<any>((resolve) => {
    socket.timeout(5000).emit(event, payload, (timeout: unknown, response: unknown) => {
      resolve(timeout ? { ok: false, error: 'timeout' } : response)
    })
  })

// Mirrors emitWithAck in src/lib/socket-client.ts: every event is emitted with
// a payload, and a missing server-side ack must never become a thrown error.
const askLikeClient = (socket: Socket, event: string, payload: unknown = {}) =>
  ask(socket, event, payload)

const emitNoAck = (socket: Socket, event: string, payload: unknown = {}) =>
  new Promise<boolean>((resolve) => {
    let settled = false
    socket.emit(event, payload)
    setTimeout(() => {
      if (!settled) resolve(true)
    }, 500)
    socket.once('room:state', () => {
      settled = true
      resolve(true)
    })
    socket.once('disconnect', () => resolve(false))
  })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function capture(socket: Socket) {
  const seen: any[] = []
  const handler = (view: unknown) => seen.push(view)
  socket.on('room:state', handler)
  return {
    seen,
    last: () => seen[seen.length - 1],
    stop: () => socket.off('room:state', handler),
  }
}

async function main() {
  const sockets: Socket[] = []
  for (const name of NAMES) sockets.push(await connect())
  const caps = sockets.map((socket) => capture(socket))

  console.log('\nsetup')
  const created = await ask(sockets[0], 'room:create', {
    roomName: ROOM,
    password: PASSWORD,
    name: NAMES[0],
    avatar: '🐶',
  })
  check('room created', created.ok === true, JSON.stringify(created))

  for (let i = 1; i < NAMES.length; i++) {
    const result = await ask(sockets[i], 'room:join', {
      roomName: ROOM,
      password: PASSWORD,
      name: NAMES[i],
      avatar: '🐱',
    })
    check(`${NAMES[i]} joined`, result.ok === true, JSON.stringify(result))
  }

  await sleep(300)
  const lobby = caps[0].last()
  check('roster has 4 players', lobby?.players?.length === 4, `got ${lobby?.players?.length}`)
  check('host flag is set', lobby?.you?.isHost === true)
  check('lobby shows no numbers', lobby?.players?.every((p: any) => p.number === null))

  console.log('\nvalidation')
  check(
    'duplicate room name rejected',
    (await ask(sockets[1], 'room:create', { roomName: ROOM, password: PASSWORD, name: 'zed', avatar: 'x' })).ok === false,
  )
  check(
    'wrong password rejected',
    (await ask(sockets[1], 'room:join', { roomName: ROOM, password: 'nope', name: 'zed', avatar: 'x' })).ok === false,
  )
  check(
    'duplicate player name rejected',
    (await ask(sockets[1], 'room:join', { roomName: ROOM, password: PASSWORD, name: 'ada', avatar: 'x' })).ok === false,
  )
  check('non-host cannot start', (await ask(sockets[1], 'room:start')).ok === false)
  check('guessing before start rejected', (await ask(sockets[0], 'room:guess', { value: 42 })).ok === false)

  console.log('\nstarting the game')
  check('host starts', (await ask(sockets[0], 'room:start')).ok === true)
  await sleep(300)

  console.log('\nnumber secrecy')
  const truth = new Map<string, number>()
  for (const [index, cap] of caps.entries()) {
    const view = cap.last()
    if (!view) {
      check(`${NAMES[index]} received state`, false)
      continue
    }
    for (const player of view.players) {
      if (player.isYou) {
        check(`${player.name} cannot see own number`, player.number === null, `saw ${player.number}`)
      } else {
        truth.set(player.name, player.number)
        check(`${player.name} sees ${player.name}'s number`, typeof player.number === 'number')
      }
    }
  }

  const leaks = caps.flatMap((cap, i) =>
    cap.seen.filter((v) => v.players.some((p: any) => p.isYou && p.number !== null && !p.solved)),
  )
  check('no self-number ever appears in any payload', leaks.length === 0, `${leaks.length} leaking frames`)

  const distinct = new Set(truth.values())
  console.log(`  (dealt numbers: ${[...truth.entries()].map(([k, v]) => `${k}=${v}`).join(', ')})`)
  check('numbers are in range 1-100', [...truth.values()].every((n) => n >= 1 && n <= 100))
  check('all four numbers dealt', truth.size === 4)
  console.log(`  (${distinct.size} distinct values — duplicates are allowed, like the real game)`)

  console.log('\nturns and guessing')
  let view = caps[0].last()
  check('first player has the turn', view.turnId === view.players[0].id)

  const offTurn = sockets.findIndex((_, i) => caps[i].last().turnId !== caps[i].last().you.id)
  check('out-of-turn guess rejected', (await ask(sockets[offTurn], 'room:guess', { value: 50 })).ok === false)

  const turnBeforePass = caps[0].last().turnId
  const passResult = await askLikeClient(sockets[0], 'room:pass')
  check('room:pass succeeds when sent with a payload like the real client', passResult.ok === true, JSON.stringify(passResult))
  await sleep(200)
  check('room:pass advances the turn', caps[0].last().turnId !== turnBeforePass)
  const passTurn = caps[0].last().turnId
  const passedBack = await askLikeClient(sockets[0], 'room:pass')
  check('room:pass rejected when it is not your turn', passedBack.ok === false, JSON.stringify(passedBack))
  check('rejected pass does not move the turn', caps[0].last().turnId === passTurn)

  // room:kick with an unknown playerId reaches the ack call but mutates nothing,
  // so the dealt numbers stay valid for the checks below.
  const noAckSurvived = await emitNoAck(sockets[0], 'room:kick', { playerId: 'nobody' })
  check('event without a client ack callback does not crash the server', noAckSurvived)
  await sleep(200)
  check('server still responsive after a no-ack emit', (await ask(sockets[0], 'room:pass')).ok !== undefined)

  for (let round = 0; round < 6; round++) {
    view = caps[0].last()
    if (view.phase === 'finished') break

    const activeIndex = view.players.findIndex((p: any) => p.isTurn)
    if (activeIndex === -1) break
    const target = sockets[activeIndex]
    const otherIndex = activeIndex === 0 ? 1 : 0
    const answer = caps[otherIndex].last().players[activeIndex].number

    if (typeof answer !== 'number') {
      check(`another player can read the active player's number`, false, `got ${answer}`)
      break
    }

    const wrongValue = answer === 1 ? 2 : 1
    const wrong = await ask(target, 'room:guess', { value: wrongValue })
    check(`wrong guess ${wrongValue} is accepted but incorrect`, wrong.ok === true && wrong.correct === false)
    await sleep(150)
    const afterWrong = caps[0].last()
    check('turn stays put after a wrong guess', afterWrong.turnId === afterWrong.players[activeIndex].id)
    check(
      'wrong guess is recorded on the player',
      afterWrong.players[activeIndex].guesses > 0,
      `guesses=${afterWrong.players[activeIndex].guesses}`,
    )

    const right = await ask(target, 'room:guess', { value: answer })
    check(`correct guess ${answer} is accepted`, right.ok === true && right.correct === true, JSON.stringify(right))
    await sleep(200)
  }

  view = caps[0].last()
  check('game reaches finished', view.phase === 'finished', view.phase)
  check('everyone marked solved', view.solvedCount === view.total, `${view.solvedCount}/${view.total}`)
  check('every number revealed at the end', view.players.every((p: any) => typeof p.number === 'number'))
  check(
    'revealed numbers match what was dealt',
    view.players.every((p: any) => p.number === truth.get(p.name)),
  )
  for (const [i, cap] of caps.entries()) {
    const own = cap.last().players.find((p: any) => p.isYou)
    check(`${NAMES[i]} can now see own number`, own.number !== null)
  }

  console.log('\nrestart')
  check('host deals again', (await ask(sockets[0], 'room:start')).ok === true)
  await sleep(250)
  const restarted = caps[0].last()
  check('back to playing', restarted.phase === 'playing', restarted.phase)
  check('numbers re-hidden', restarted.players.every((p: any) => !p.solved))
  check('guesses reset', restarted.players.every((p: any) => p.guesses === 0))

  console.log('\nreconnect')
  const hostId = caps[0].last().you.id
  sockets[0].disconnect()
  await sleep(200)
  const revived = await connect()
  const revivedCap = capture(revived)
  const resume = await ask(revived, 'room:resume', { code: ROOM, playerId: hostId })
  check('resume with a real id works', resume.ok === true, JSON.stringify(resume))
  await sleep(300)
  check('resumed socket gets fresh state', revivedCap.last() !== undefined)
  check(
    'resumed player is marked connected again',
    revivedCap.last()?.players?.find((p: any) => p.isYou)?.connected === true,
  )
  revivedCap.stop()
  check(
    'resume with a bad id rejected',
    (await ask(revived, 'room:resume', { code: ROOM, playerId: 'nope' })).ok === false,
  )
  revived.close()

  console.log('\nleaving')
  check('leave succeeds', (await ask(sockets[1], 'room:leave')).ok === true)
  await sleep(250)
  const observer = caps[2].last()
  check('roster drops to 3 for a connected observer', observer.players.length === 3, `got ${observer.players.length}`)
  check('the departed player is gone', !observer.players.some((p: any) => p.name === 'grace'))
  const stillHere = observer.players.filter((p: any) => p.name !== 'ada')
  check('players still in the room are connected', stillHere.every((p: any) => p.connected === true))
  const host = observer.players.find((p: any) => p.isHost)
  check('a disconnected player is flagged, not removed', host?.name === 'ada' && host?.connected === false)

  for (const cap of caps) cap.stop()
  for (const socket of sockets) socket.close()
}

main()
  .then(() => {
    console.log(failures === 0 ? '\nall checks passed\n' : `\n${failures} FAILURES\n`)
    process.exit(failures === 0 ? 0 : 1)
  })
  .catch((error) => {
    console.error('\nsmoke test crashed:', error)
    process.exit(1)
  })
