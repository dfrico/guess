'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Confetti } from '@/components/Confetti'
import { GuessSheet } from '@/components/GuessSheet'
import { GridLegend, PlayerCell } from '@/components/PlayerCell'
import { PlayerList } from '@/components/PlayerList'
import { clearSession, loadSession } from '@/lib/identity'
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
        <div className="animate-rise mb-4 rounded-xl border border-bad/40 bg-bad/10 px-4 py-2.5 text-center text-sm text-bad">
          Connection lost. Reconnecting — your number is safe.
        </div>
      )}

      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-edge bg-panel/70 px-3 py-2">
          <span className="text-[10px] font-bold tracking-widest text-muted uppercase">room</span>
          <span className="font-mono text-sm font-bold text-accent-2">{view.code}</span>
          <CopyButton />
        </div>

        <Progress solved={view.solvedCount} total={view.total} />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="rounded-xl border border-edge bg-panel/70 px-3 py-2 text-sm text-muted transition hover:text-ink"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            onClick={leave}
            className="rounded-xl border border-edge bg-panel/70 px-3 py-2 text-sm text-muted transition hover:border-bad/40 hover:text-bad"
          >
            Leave
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {view.players.map((player) => (
                  <PlayerCell
                    key={player.id}
                    player={player}
                    min={view.min}
                    max={view.max}
                    shaking={shaking === player.id}
                  />
                ))}
              </div>
              <div className="mt-4">
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
            <p className="animate-rise mt-3 rounded-xl border border-bad/40 bg-bad/10 px-4 py-2.5 text-sm text-bad">
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
      className="rounded-md px-1.5 text-xs text-muted transition hover:text-ink"
      aria-label="Copy invite link"
    >
      {copied ? '✓' : '🔗'}
    </button>
  )
}

function Progress({ solved, total }: { solved: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((solved / total) * 100)
  return (
    <div className="flex items-center gap-2 rounded-xl border border-edge bg-panel/70 px-3 py-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-good transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-muted tabular-nums">
        {solved}/{total}
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
    <div className="rounded-3xl border border-edge bg-panel/70 p-6 text-center sm:p-10">
      <h2 className="text-2xl font-black">Waiting room</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Share the invite link and the room password. Numbers get dealt when the host starts.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {view.players.map((player) => (
          <span
            key={player.id}
            className="flex items-center gap-2 rounded-full border border-edge bg-panel-2 px-3 py-1.5 text-sm"
          >
            <span aria-hidden>{player.avatar}</span>
            <span className="font-semibold">{player.name}</span>
            {!player.connected && <span className="text-xs text-muted">(away)</span>}
          </span>
        ))}
      </div>

      {view.you.isHost ? (
        <div className="mt-8">
          <button
            type="button"
            onClick={onStart}
            disabled={view.players.length < 2}
            className="rounded-xl bg-accent px-8 py-3.5 font-bold text-white shadow-lg shadow-accent/25 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-panel-2 disabled:text-muted/70 disabled:shadow-none"
          >
            Deal the numbers
          </button>
          {view.players.length < 2 && (
            <p className="mt-3 text-sm text-muted">You need at least 2 players.</p>
          )}
        </div>
      ) : (
        <p className="mt-8 animate-pulse-soft text-sm font-semibold text-accent-2">
          Waiting for the host to start…
        </p>
      )}

      {actionError && <p className="mt-4 text-sm text-bad">{actionError}</p>}
    </div>
  )
}

function Finished({ view, onRestart }: { view: RoomView; onRestart: () => void }) {
  const everyone = view.solvedCount === view.total
  const winners = view.players.filter((player) => player.solved)

  return (
    <>
      <div className="animate-rise mb-4 rounded-3xl border border-good/40 bg-good/10 p-6 text-center">
        <h2 className="text-2xl font-black text-good">{everyone ? 'Everyone got it' : "That's a wrap"}</h2>
        <p className="mt-2 text-sm text-muted">
          {everyone
            ? 'Nobody out-guessed anybody. Suspicious.'
            : `Solved: ${winners.map((player) => player.name).join(', ')}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {view.players.map((player) => (
          <PlayerCell key={player.id} player={player} min={view.min} max={view.max} shaking={false} />
        ))}
      </div>

      {view.you.isHost && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onRestart}
            className="rounded-xl bg-accent px-8 py-3 font-bold text-white shadow-lg shadow-accent/25 transition hover:bg-accent/90"
          >
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
    <div className="mt-6 rounded-2xl border border-edge bg-panel/70 p-4">
      {notice && (
        <p className="animate-rise mb-3 rounded-xl border border-bad/40 bg-bad/10 px-4 py-2.5 text-center text-sm font-semibold text-bad">
          {notice}
        </p>
      )}

      {myTurn ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onGuess}
            className="w-full rounded-xl bg-accent px-8 py-4 text-lg font-black text-white shadow-lg shadow-accent/25 transition hover:bg-accent/90 sm:w-auto"
          >
            I think I know it
          </button>
          <button
            type="button"
            onClick={onPass}
            className="rounded-xl border border-edge px-6 py-4 font-semibold text-muted transition hover:bg-panel-2 hover:text-ink"
          >
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
              <span className="font-semibold text-ink">{turnPlayer.name}</span> is on the hot seat.
              {me?.number != null && (
                <>
                  {' '}
                  Yours is{' '}
                  <span className="font-display text-lg text-ink tabular-nums">{me.number}</span>
                  {me.solved && <span className="text-good"> — solved</span>}.
                </>
              )}
            </>
          ) : (
            'Waiting…'
          )}
        </p>
      )}

      {isHost && (
        <div className="mt-4 border-t border-edge pt-3 text-center">
          <button
            type="button"
            onClick={onEnd}
            className="text-xs text-muted/70 underline-offset-2 transition hover:text-bad hover:underline"
          >
            End the game and reveal everything
          </button>
        </div>
      )}
    </div>
  )
}
