'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Confetti } from '@/components/Confetti'
import { GuessSheet } from '@/components/GuessSheet'
import { GridLegend, PlayerCell } from '@/components/PlayerCell'
import { PlayerList } from '@/components/PlayerList'
import { clearSession, loadSession } from '@/lib/identity'
import { playerColor } from '@/lib/player-colors'
import { emitWithAck, getSocket } from '@/lib/socket-client'
import { useSounds } from '@/lib/sounds'
import type { RoomView } from '@/lib/types'

const STATE = 'room:state'

export function RoomScreen({ code }: { code: string }) {
  const router = useRouter()
  const [view, setView] = useState<RoomView | null>(null)
  const [connected, setConnected] = useState(getSocket().connected)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [guessing, setGuessing] = useState(false)
  const [shaking, setShaking] = useState<string | null>(null)
  const [confetti, setConfetti] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)

  const { play, setMuted: applyMuted } = useSounds()
  const lastSolvedAt = useRef<number | null>(null)
  const lastTurnId = useRef<string | null>(null)

  useEffect(() => {
    applyMuted(muted)
  }, [muted, applyMuted])

  useEffect(() => {
    const socket = getSocket()

    const resume = () => {
      const session = loadSession(code)
      if (!session) {
        router.replace(`/?room=${code}`)
        return
      }
      socket.emit(
        'room:resume',
        { code, token: session.token },
        (result: { ok: boolean }) => {
          if (!result.ok) {
            clearSession(code)
            router.replace(`/?room=${code}`)
          }
        },
      )
    }

    const onState = (next: RoomView) => {
      if (next.code !== code) return
      setView(next)
      if (next.lastSolved && next.lastSolved.at !== lastSolvedAt.current) {
        lastSolvedAt.current = next.lastSolved.at
        setConfetti(next.lastSolved.at)
        play(next.lastSolved.playerId === next.you.id ? 'correct' : 'solve')
      }
      if (next.turnId !== lastTurnId.current) {
        if (next.turnId && lastTurnId.current !== null) play('turn')
        lastTurnId.current = next.turnId
      }
      if (next.phase === 'finished' && next.total > 0 && next.solvedCount === next.total) {
        play('over')
      }
    }

    const onConnect = () => {
      setConnected(true)
      resume()
    }
    const onDisconnect = () => setConnected(false)
    const onKicked = () => {
      clearSession(code)
      router.replace('/?kicked=1')
    }

    socket.on(STATE, onState)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('room:kicked', onKicked)
    if (socket.connected) resume()

    return () => {
      socket.off(STATE, onState)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('room:kicked', onKicked)
    }
  }, [code, router, play])

  const run = useCallback(
    async (event: string, payload?: unknown) => {
      setActionError(null)
      const result = await emitWithAck(event, payload)
      if (!result.ok) setActionError(result.error)
      return result
    },
    [],
  )

  const me = view?.players.find((player) => player.isYou)
  const myTurn = view?.turnId != null && view.turnId === view.you.id
  const turnPlayer = view?.players.find((player) => player.isTurn)

  async function submitGuess(value: number) {
    setGuessing(false)
    const result = await emitWithAck<{ correct: boolean; correctNumber: number | null }>('room:guess', { value })
    if (!result.ok) {
      setActionError(result.error)
      return
    }
    if (!result.correct) {
      play('wrong')
      setNotice(`Nope. ${value} is not it.`)
      setShaking(view?.you.id ?? null)
      setTimeout(() => {
        setShaking(null)
        setNotice(null)
      }, 1600)
    }
  }

  async function leave() {
    await emitWithAck('room:leave')
    clearSession(code)
    router.replace('/')
  }

  if (!view) {
    return (
      <main className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <p className="animate-pulse-soft text-lg font-semibold">Opening room…</p>
          <p className="mt-2 text-sm text-muted">room: {code}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-5">
      <Confetti trigger={confetti} />

      {!connected && (
        <div className="animate-rise mb-4 rounded-xl border-2 border-berry bg-berry/10 px-4 py-2.5 text-center text-sm font-semibold text-berry">
          Connection lost. Reconnecting — your number is safe.
        </div>
      )}

      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div className="card flex items-center gap-2 rounded-xl px-3 py-2 shadow-hard-sm">
          <span className="text-[11px] font-extrabold tracking-widest text-muted uppercase">room</span>
          <span className="font-display text-base text-blue">{view.code}</span>
          <CopyButton />
        </div>

        {view.phase !== 'lobby' && <Progress solved={view.solvedCount} total={view.total} />}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="btn btn-secondary h-10 w-10 text-base"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button type="button" onClick={leave} className="btn btn-secondary h-10 px-4 text-sm">
            Leave
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
        <PlayerList
          players={view.players}
          youId={view.you.id}
          isHost={view.you.isHost}
          onKick={(playerId) => void run('room:kick', { playerId })}
        />

        <section className="min-w-0">
          {view.phase === 'lobby' && (
            <Lobby
              view={view}
              onStart={() => void run('room:start')}
              actionError={actionError}
            />
          )}

          {view.phase === 'playing' && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5">
                {view.players.map((player, seat) => (
                  <PlayerCell key={player.id} player={player} seat={seat} shaking={shaking === player.id} />
                ))}
              </div>
              <div className="mt-5">
                <GridLegend min={view.min} max={view.max} />
              </div>
            </>
          )}

          {view.phase === 'finished' && (
            <Finished view={view} onRestart={() => void run('room:start')} />
          )}

          {view.phase === 'playing' && (
            <ActionBar
              myTurn={myTurn}
              me={me}
              turnPlayer={turnPlayer}
              notice={notice}
              onGuess={() => setGuessing(true)}
              onPass={() => void run('room:pass')}
              isHost={view.you.isHost}
              onEnd={() => void run('room:end')}
            />
          )}

          {actionError && view.phase === 'playing' && (
            <p className="animate-rise mt-3 rounded-xl border-2 border-berry bg-berry/10 px-4 py-2.5 text-sm font-semibold text-berry">
              {actionError}
            </p>
          )}
        </section>
      </div>

      {guessing && (
        <GuessSheet
          min={view.min}
          max={view.max}
          playerName={me?.name ?? 'you'}
          onCancel={() => setGuessing(false)}
          onSubmit={submitGuess}
        />
      )}
    </main>
  )
}

function CopyButton() {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href)
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        } catch {
          return
        }
      }}
      className="rounded-md px-1.5 text-sm transition hover:bg-panel-2"
      aria-label="Copy invite link"
    >
      {copied ? '✓' : '🔗'}
    </button>
  )
}

function Progress({ solved, total }: { solved: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((solved / total) * 100)
  return (
    <div className="card flex items-center gap-2.5 rounded-xl px-3 py-2 shadow-hard-sm">
      <div className="h-3 w-24 overflow-hidden rounded-full border-2 border-ink bg-panel-2">
        <div className="h-full bg-green transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums">
        {solved}/{total} solved
      </span>
    </div>
  )
}

function Lobby({
  view,
  onStart,
  actionError,
}: {
  view: RoomView
  onStart: () => void
  actionError: string | null
}) {
  return (
    <div className="card p-6 text-center sm:p-10">
      <h2 className="font-display text-3xl">Waiting room</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Share the invite link and the room password. Numbers get dealt when the host starts.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        {view.players.map((player, seat) => (
          <span
            key={player.id}
            className={`flex items-center gap-2 rounded-full border-2 border-ink py-1.5 pr-3.5 pl-1.5 text-sm font-bold shadow-hard-sm ${
              playerColor(seat).band
            } ${player.connected ? '' : 'opacity-60'}`}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-card text-base" aria-hidden>
              {player.avatar}
            </span>
            {player.name}
            {!player.connected && <span className="text-xs font-semibold opacity-80">(away)</span>}
          </span>
        ))}
      </div>

      {view.you.isHost ? (
        <div className="mt-8">
          <button
            type="button"
            onClick={onStart}
            disabled={view.players.length < 2}
            className="btn btn-primary px-8 py-3.5 text-lg"
          >
            Deal the numbers
          </button>
          {view.players.length < 2 && (
            <p className="mt-3 text-sm text-muted">You need at least 2 players.</p>
          )}
        </div>
      ) : (
        <p className="mt-8 animate-pulse-soft text-sm font-bold text-blue">
          Waiting for the host to start…
        </p>
      )}

      {actionError && <p className="mt-4 text-sm font-semibold text-berry">{actionError}</p>}
    </div>
  )
}

function Finished({ view, onRestart }: { view: RoomView; onRestart: () => void }) {
  const everyone = view.solvedCount === view.total
  const winners = view.players.filter((player) => player.solved)

  return (
    <>
      <div className="animate-rise card mb-6 bg-green p-6 text-center text-white">
        <h2 className="font-display text-3xl">{everyone ? 'Everyone got it' : "That's a wrap"}</h2>
        <p className="mt-2 text-sm font-semibold text-white/85">
          {everyone
            ? 'Nobody out-guessed anybody. Suspicious.'
            : `Solved: ${winners.map((player) => player.name).join(', ') || 'nobody'}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5">
        {view.players.map((player, seat) => (
          <PlayerCell key={player.id} player={player} seat={seat} shaking={false} />
        ))}
      </div>

      {view.you.isHost && (
        <div className="mt-8 text-center">
          <button type="button" onClick={onRestart} className="btn btn-primary px-8 py-3.5 text-lg">
            Deal again
          </button>
        </div>
      )}
    </>
  )
}

function ActionBar({
  myTurn,
  me,
  turnPlayer,
  notice,
  onGuess,
  onPass,
  isHost,
  onEnd,
}: {
  myTurn: boolean
  me: RoomView['players'][number] | undefined
  turnPlayer: RoomView['players'][number] | undefined
  notice: string | null
  onGuess: () => void
  onPass: () => void
  isHost: boolean
  onEnd: () => void
}) {
  return (
    <div className={`card mt-6 p-4 sm:p-5 ${myTurn ? 'bg-yellow-soft' : ''}`}>
      {notice && (
        <p className="animate-rise mb-3 rounded-xl border-2 border-berry bg-berry/10 px-4 py-2.5 text-center text-sm font-bold text-berry">
          {notice}
        </p>
      )}

      {myTurn ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={onGuess} className="btn btn-primary w-full px-8 py-4 text-lg sm:w-auto">
            I think I know it
          </button>
          <button type="button" onClick={onPass} className="btn btn-secondary w-full px-6 py-4 sm:w-auto">
            Pass my turn
          </button>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">
          {turnPlayer ? (
            <>
              <span className="text-base" aria-hidden>
                {turnPlayer.avatar}
              </span>{' '}
              <span className="font-bold text-ink">{turnPlayer.name}</span> is on the hot seat.
              {me?.number != null && (
                <>
                  {' '}
                  Yours is{' '}
                  <span className="font-display text-lg text-ink tabular-nums">{me.number}</span>
                  {me.solved && <span className="font-bold text-green"> — solved</span>}.
                </>
              )}
            </>
          ) : (
            'Waiting…'
          )}
        </p>
      )}

      {isHost && (
        <div className="mt-4 border-t-2 border-dashed border-ink/15 pt-3 text-center">
          <button
            type="button"
            onClick={onEnd}
            className="text-xs font-semibold text-muted underline-offset-2 transition hover:text-berry hover:underline"
          >
            End the game and reveal everything
          </button>
        </div>
      )}
    </div>
  )
}
