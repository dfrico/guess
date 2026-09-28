'use client'

import type { PlayerView } from '@/lib/types'

interface Props {
  player: PlayerView
  min: number
  max: number
  shaking: boolean
}

export function PlayerCell({ player, min, max, shaking }: Props) {
  const hidden = player.isYou && !player.solved && player.number === null

  if (hidden) {
    return (
      <div
        className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-edge bg-panel/40 p-3 ${
          player.isTurn ? 'animate-turn-ring' : ''
        } ${shaking ? 'animate-shake' : ''}`}
      >
        <span className="text-5xl sm:text-6xl" aria-hidden>
          {player.avatar}
        </span>
        <span className="text-xs font-semibold text-ink/80">{player.name}</span>
        <span className="text-[10px] font-medium tracking-widest text-muted uppercase">your number</span>
        {!player.connected && <OfflineDot />}
      </div>
    )
  }

  return (
    <div
      className={`relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl border p-3 transition ${
        player.solved
          ? 'animate-pop-in border-good/40 bg-good/10 opacity-70'
          : player.isTurn
            ? 'animate-turn-ring border-accent/60 bg-panel-2'
            : 'border-edge bg-panel/80'
      } ${shaking ? 'animate-shake' : ''}`}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <span className="text-sm" aria-hidden>
          {player.avatar}
        </span>
        <span className="max-w-[9rem] truncate">{player.name}</span>
        {player.isHost && (
          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-accent-2 uppercase">
            host
          </span>
        )}
      </span>

      <span
        className={`text-5xl font-black tabular-nums tracking-tight sm:text-6xl ${
          player.solved ? 'text-good' : 'text-ink'
        }`}
      >
        {player.number}
      </span>

      {player.solved && (
        <span className="absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-good text-canvas">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M4 10.5 8 14.5 16 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}

      {!player.connected && <OfflineDot />}
      {player.solved && <CornerRibbon />}
    </div>
  )
}

function OfflineDot() {
  return (
    <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-muted/70" title="Disconnected" />
  )
}

function CornerRibbon() {
  return (
    <span className="absolute inset-x-0 bottom-0 h-1 bg-good/60" aria-hidden>
      <span className="sr-only">solved</span>
    </span>
  )
}

export function GridLegend({ min, max }: { min: number; max: number }) {
  return (
    <p className="text-center text-xs text-muted">
      every number is between <span className="font-semibold text-ink/80">{min}</span> and{' '}
      <span className="font-semibold text-ink/80">{max}</span>
    </p>
  )
}
